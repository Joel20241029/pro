import { BattleSimulation, CombatFeedback } from "./BattleSimulation";
import { clone, GameState } from "./GameState";
import { RULE, Trait } from "./GameConfig";
import { applyCommand, Command, createGame, finishNight } from "./VillageRules";
import { LoadResult, SaveMode, SaveStore } from "../storage/SaveStore";
import { DeviceSettings } from "../storage/DeviceSettings";
import { dailyRationAmount, localRationDate } from "./DailyRation";
export type Pause = "USER" | "BACKGROUND" | "WAIT_RESUME" | "CHOICE" | "SAVE_PENDING" | "DISABLED" | "DAILY_RATION" | "ASSETS";
export class GameSession {
    state: GameState | null = null; battle: BattleSimulation | null = null;
    /** 仅供最终弹道/死亡演出；结算与保存不等待它，新夜/新村/成功读档即清理，不写入存档。 */
    private finishedBattle: BattleSimulation | null = null;
    get presentationBattle() { return this.battle ?? this.finishedBattle; }
    /** 跨一帧多个逻辑步的表现信箱；换战斗时清空，结算不等待动画。 */
    private combatFeedback: CombatFeedback[] = [];
    takeCombatFeedback(): CombatFeedback[] { const events = this.combatFeedback; this.combatFeedback = []; return events; }
    readonly pauses = new Set<Pause>(); boot: LoadResult | null = null;
    private currentError = "";
    /** 仅供表现层识别新提示；同文案再次报错也递增，不写入存档或参与业务判断。 */
    errorRevision = 0;
    get error() { return this.currentError; }
    set error(value: string) { this.currentError = value; if (value) this.errorRevision++; }
    changed = () => {}; private accumulator = 0; private continuingBattle = false;
    /** 供表现层识别已保存的新村；同 run 的纯净开局也递增，普通进度保存不递增。 */
    private currentVillageRevision = 0;
    get villageRevision() { return this.currentVillageRevision; }
    /** 标记当前候选为开村操作；提交失败后重试也要在成功时清理旧村表现。 */
    private pendingNewVillage = false;
    /** 只在进入/返回/重开时更新；不会在常驻跨午夜时自动打断游戏。 */
    private visitDate: string | null = null;
    dailyRationDate: string | null = null;
    private deviceSettings = new DeviceSettings(this.saves.port);
    constructor(readonly saves: SaveStore, private today = () => localRationDate(new Date())) {}
    enter() { this.visitDate = this.today(); this.checkDailyRation(); this.changed(); }
    /** 与状态接受共用调度：清晨/失败/启动/保存先完成，安全时才暂停领取。 */
    private checkDailyRation() {
        const s = this.state;
        if (!s || this.saves.pending) return;
        if (this.dailyRationDate !== null && s.legacy.lastRationDate !== null && s.legacy.lastRationDate >= this.dailyRationDate) {
            this.dailyRationDate = null; this.resume("DAILY_RATION"); this.resume("WAIT_RESUME");
        }
        if (this.visitDate === null || (s.phase !== "DAY" && s.phase !== "NIGHT")) return;
        if (dailyRationAmount(s, this.visitDate) !== null) {
            this.dailyRationDate = this.visitDate; this.pause("DAILY_RATION");
        } else { this.dailyRationDate = null; this.resume("DAILY_RATION"); }
    }
    claimDailyRation() {
        if (!this.state || this.dailyRationDate === null || this.saves.pending || this.pauses.has("BACKGROUND") || this.pauses.has("DISABLED")) return;
        // 确认时再次核对日期和仓储；一旦创建保存候选，重试只提交该候选，不重新取日期或加粮。
        this.visitDate = this.today();
        if (dailyRationAmount(this.state, this.visitDate) === null) { this.checkDailyRation(); this.changed(); return; }
        this.dailyRationDate = this.visitDate;
        this.command({ type: "DAILY_RATION", date: this.visitDate });
    }
    load() {
        if (this.saves.pending) { this.retry(); return; }
        try {
            this.boot = this.saves.inspect(); this.error = "";
            if (this.boot.kind === "ready") { this.finishedBattle = null; this.combatFeedback = []; this.accept(this.boot.state); }
            else if (this.boot.kind === "complete-clean-start") {
                this.pendingNewVillage = true; this.pauses.add("SAVE_PENDING"); this.retry();
            } else this.changed();
        }
        catch (e) { this.error = String(e); this.boot = { kind: "blocked", reason: "微信存档暂时读取失败。请重试，未新建或覆盖进度。", canReset: false }; this.changed(); }
    }
    recover() { if (this.boot?.kind === "recover") { this.finishedBattle = null; this.combatFeedback = []; this.accept(this.boot.state); } }
    newVillage(trait?: Trait, reset = false) {
        if (this.saves.pending) return;
        if (this.visitDate !== null) this.visitDate = this.today();
        if (reset) {
            if (!(this.boot?.kind === "incompatible" || (this.boot?.kind === "blocked" && this.boot.canReset))) return;
            this.submit(createGame(Date.now() >>> 0), false, "RESET"); return;
        }
        const next = createGame(Date.now() >>> 0, this.state?.legacy, trait, this.state ? this.state.history : [], this.state ? this.state.favorites : []);
        // 已确认传承保留学会结果；新村仍默认携带大王之心。纯净开始走独立路径。
        if (this.state) {
            next.tactics.learned = this.state.tactics.learned.slice();
            if (this.state.tactics.extraSlots) next.tactics.extraSlots = this.state.tactics.extraSlots.map((): null => null);
        }
        this.submit(next, false, "NORMAL");
    }
    cleanStart() {
        if (!this.state || this.boot !== null || this.saves.pending) return;
        if (this.visitDate !== null) this.visitDate = this.today();
        const next = createGame(Date.now() >>> 0);
        next.legacy.bestNight = this.state.legacy.bestNight;
        this.submit(next, false, "CLEAN_START");
    }
    private accept(s: GameState, newVillage = false) {
        const settings = this.deviceSettings.resolve(s.settings);
        if (s.settings.music !== settings.music || s.settings.speed !== settings.speed) s = { ...s, settings };
        const sameNight = !newVillage && this.continuingBattle && this.battle !== null && s.phase === "NIGHT";
        if (newVillage) {
            this.currentVillageRevision++;
            // 前后台、等待恢复和禁用来自应用生命周期；清除旧村自身的暂停。
            this.pauses.delete("USER"); this.pauses.delete("CHOICE"); this.pauses.delete("DAILY_RATION");
            this.dailyRationDate = null;
        }
        this.state = s; this.boot = null; this.error = ""; this.pauses.delete("SAVE_PENDING");
        if (!sameNight) {
            // 清晨递归FINALIZE及结算保存重试保留尚未消费的最终事件；不能把最后一击清掉。
            if (newVillage || s.phase === "NIGHT") { this.finishedBattle = null; this.combatFeedback = []; }
            this.battle = s.phase === "NIGHT" ? new BattleSimulation(s) : null; this.accumulator = 0;
        }
        this.continuingBattle = false;
        if (s.phase === "DAWN" && s.choices.length === 0) { this.command({ type: "FINALIZE" }); return; }
        this.checkDailyRation();
        this.changed();
    }
    private submit(next: GameState, keepBattle = false, start?: SaveMode) {
        try {
            if (start !== undefined) next.settings = this.deviceSettings.resolve(next.settings);
            this.saves.prepare(next, start); this.continuingBattle = keepBattle; this.pendingNewVillage = start !== undefined;
            this.pauses.add("SAVE_PENDING"); this.retry();
        } catch (e) { this.error = e instanceof Error ? e.message : String(e); this.changed(); }
    }
    retry() {
        if (!this.saves.pending) { this.load(); return; }
        try {
            const state = this.saves.commit(), newVillage = this.pendingNewVillage;
            this.pendingNewVillage = false; this.accept(state, newVillage);
        } catch (e) { this.error = e instanceof Error ? e.message : String(e); this.changed(); }
    }
    command(c: Command) {
        if (!this.state || this.saves.pending || (c.type === "NIGHT" && this.pauses.has("ASSETS"))) return;
        try {
            const next = clone(this.state);
            applyCommand(next, c);
            if (c.type === "MUSIC" || c.type === "SPEED") {
                this.deviceSettings.write(next.settings);
                this.state = next; this.error = ""; this.changed();
                return;
            }
            this.submit(next, next.phase === "NIGHT" && this.state.phase === "NIGHT");
        }
        catch (e) { this.error = e instanceof Error ? e.message : String(e); this.changed(); }
    }
    pause(reason: Pause) { this.pauses.add(reason); this.accumulator = 0; }
    resume(reason: Pause) { this.pauses.delete(reason); this.accumulator = 0; }
    hide = () => { this.pause("BACKGROUND"); this.changed(); };
    show = () => { this.resume("BACKGROUND"); this.pause("WAIT_RESUME"); this.enter(); };
    get canRingBell() { return this.canCast(this.battle?.tactics[0].id); }
    canCast(id?: string) { return this.state?.phase === "NIGHT" && id !== undefined && this.battle?.canCast(id) === true && !this.pauses.size && !this.saves.pending; }
    bell(id = this.battle?.tactics[0].id) { if (this.canCast(id)) { this.battle.bell(id); this.changed(); } }
    reassign(index: number, id: string) {
        // 夜间调任允许手动暂停或面板临时暂停；关闭面板只解除 CHOICE，其余暂停仍由各自流程管理。
        if (this.pauses.has("ASSETS") || !this.battle || (!this.pauses.has("USER") && !this.pauses.has("CHOICE")) || this.saves.pending) return false;
        try { this.battle.reassign(index, id); this.error = ""; this.changed(); return true; }
        catch (e) { this.error = String(e); this.changed(); return false; }
    }
    update(delta: number) {
        if (this.pauses.size || !this.battle || !this.state || this.battle.outcome) return;
        this.accumulator += Math.min(RULE.frameCap, Math.max(0, delta)) * this.state.settings.speed;
        let steps = 0;
        while (this.accumulator + 1e-9 >= RULE.step && steps++ < RULE.maxSteps) {
            this.accumulator -= RULE.step; this.battle.step();
            this.combatFeedback.push(...this.battle.feedback);
            if (this.battle.outcome) {
                this.finishedBattle = this.battle;
                const next = clone(this.state); finishNight(next, this.battle.gate, this.battle.operators); this.submit(next); break;
            }
        }
    }
}
