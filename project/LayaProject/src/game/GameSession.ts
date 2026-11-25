import { BattleSimulation, CombatFeedback } from "./BattleSimulation";
import { clone, GameState, isWorkingAdult, ownsTowerAmmo } from "./GameState";
import { RULE } from "./GameConfig";
import { applyCommand, Command, createGame, finishNight } from "./VillageRules";
import { LoadResult, SaveMode, SaveStore } from "../storage/SaveStore";
import { DeviceSettings } from "../storage/DeviceSettings";
import { BackpackChange, VillageItemStorage } from "../storage/VillageItemStorage";
import { VillageGuides } from "../storage/VillageGuides";
import { ICE_AMMO_OFFER, ItemId, ITEMS, LIANG_ESSENCE, LIANG_INDULGENCE, PatrolItemId } from "../config/ShopConfig";
import { essenceTargets, patrolItemUnavailable, shopOffer } from "./ShopRules";
import { dailyRationAmount, localRationDate } from "./DailyRation";
import { BLAST_TACTIC, KING_MERCY, KING_MERCY_TACTIC } from "../config/TacticConfig";
import { gateCapacity } from "./Growth";
import { mercyOffering } from "./Tactics";

import { DAILY_TASKS, TaskKind } from "../config/DailyTaskConfig";
import { DailyTaskCombat } from "./DailyTaskCombat";
import { claimDailyTask } from "./DailyTaskState";
import { creditTaskCommand, creditTaskVictory, dailyTasksNeedRefresh, prepareDailyTasks } from "./DailyTasks";
import type { RoadPoint } from "./BattleRoad";
import { PATROL } from "../config/PatrolConfig";
import { autoAssignNightDuties } from "./VillageJobs";
export type Pause = "USER" | "BACKGROUND" | "WAIT_RESUME" | "CHOICE" | "SAVE_PENDING" | "DISABLED" | "DAILY_RATION" | "ASSETS";
export interface EssenceFeedback { person: string; nights: number; }
export class GameSession {
    state: GameState | null = null; battle: BattleSimulation | null = null;
    /** 仅供最终弹道/死亡演出；结算与保存不等待它，新夜/新村/成功读档即清理，不写入存档。 */
    private finishedBattle: BattleSimulation | null = null;
    private taskCombat: DailyTaskCombat | null = null;
    private nextTaskClockCheck = 0;
    private aimingBlastIn: BattleSimulation | null = null;
    private aimingPatrolIn: BattleSimulation | null = null;
    get presentationBattle() { return this.battle ?? this.finishedBattle; }
    /** 跨一帧多个逻辑步的表现信箱；换战斗时清空，结算不等待动画。 */
    private combatFeedback: CombatFeedback[] = [];
    onPatrolLanding?: () => void;
    onPatrolRapidFire?: () => void;
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
    readonly villageItems = new VillageItemStorage(this.saves.port, () => this.saves.villageId);
    readonly guides = new VillageGuides(this.saves.port, () => this.saves.villageId);
    private pendingEssence: EssenceFeedback | undefined;
    private essenceFeedback: EssenceFeedback | undefined;
    private purchaseFeedback = false;
    takeEssenceFeedback() { const result = this.essenceFeedback; this.essenceFeedback = undefined; return result; }
    takePurchaseFeedback() { const result = this.purchaseFeedback; this.purchaseFeedback = false; return result; }
    constructor(readonly saves: SaveStore, private today = () => localRationDate(new Date())) {}
    get taskDate() { return this.today(); }
    enter() { this.visitDate = this.today(); this.checkDailyRation(); if (!this.refreshDailyTasks()) this.changed(); }

    private refreshDailyTasks() {
        const state = this.state;
        if (!state || this.saves.pending || this.pauses.has("BACKGROUND") || this.pauses.has("DISABLED")) return false;
        const date = this.taskDate;
        if (!dailyTasksNeedRefresh(state, date)) return false;
        const next = clone(state);
        prepareDailyTasks(next, date);
        this.submit(next);
        return true;
    }
    claimTask(kind: TaskKind, issuedDate: string) {
        if (!this.state || this.saves.pending || this.pauses.has("BACKGROUND") || this.pauses.has("DISABLED") || this.pauses.has("ASSETS")) return;
        if (this.refreshDailyTasks()) return;
        const next = clone(this.state);
        try {
            claimDailyTask(next, kind, issuedDate, this.taskDate);
            this.submit(next);
        } catch (e) { this.error = e instanceof Error ? e.message : String(e); this.changed(); }
    }
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
            if (this.boot.kind === "ready") { this.finishedBattle = null; this.combatFeedback = []; this.accept(this.boot.state); this.refreshDailyTasks(); }
            else if (this.boot.kind === "complete-clean-start" || this.boot.kind === "complete-backpack-change") {
                this.pendingNewVillage = this.boot.kind === "complete-clean-start"; this.pauses.add("SAVE_PENDING"); this.retry();
            } else this.changed();
        }
        catch (e) { this.error = String(e); this.boot = { kind: "blocked", reason: "微信存档暂时读取失败。请重试，未新建或覆盖进度。", canReset: false }; this.changed(); }
    }
    recover() { if (this.boot?.kind === "recover") { this.finishedBattle = null; this.combatFeedback = []; this.accept(this.boot.state); this.refreshDailyTasks(); } }
    newVillage(reset = false) {
        if (this.saves.pending) return;
        if (reset) {
            if (!(this.boot?.kind === "incompatible" || (this.boot?.kind === "blocked" && this.boot.canReset))) return;
        } else if (this.state ? this.boot !== null : this.boot?.kind !== "new") return;
        if (this.visitDate !== null) this.visitDate = this.today();
        // 首次开村写普通档，已有村庄的重开同时覆盖两个存档槽。
        const mode: SaveMode = reset ? "RESET" : this.state ? "CLEAN_START" : "NORMAL";
        this.submit(createGame(Date.now() >>> 0), false, mode);
    }
    private accept(s: GameState, newVillage = false) {
        // 旧白天档在校验后才补岗，只改变运行态；下次正常保存时入档。已开打的夜战按存档重放。
        if (s.phase === "DAY" && s.patrol.captain === null && s.people.some(isWorkingAdult)) {
            s = clone(s);
            autoAssignNightDuties(s);
        }
        const settings = this.deviceSettings.resolve(s.settings);
        if (s.settings.music !== settings.music || s.settings.speed !== settings.speed) s = { ...s, settings };
        const sameNight = !newVillage && this.continuingBattle && this.battle !== null && s.phase === "NIGHT";
        const mercyAccepted = sameNight && !this.state?.night?.mercySpent && s.night?.mercySpent === true;
        if (newVillage) {
            this.currentVillageRevision++;
            // 前后台、等待恢复和禁用来自应用生命周期；清除旧村自身的暂停。
            this.pauses.delete("USER"); this.pauses.delete("CHOICE"); this.pauses.delete("DAILY_RATION");
            this.dailyRationDate = null;
            this.aimingBlastIn = null;
            this.nextTaskClockCheck = 0;
        }
        this.state = s; this.boot = null; this.error = ""; this.pauses.delete("SAVE_PENDING");
        if (!sameNight) {
            // 清晨递归FINALIZE及结算保存重试保留尚未消费的最终事件；不能把最后一击清掉。
            if (newVillage || s.phase === "NIGHT") { this.finishedBattle = null; this.combatFeedback = []; }
            this.taskCombat = s.phase === "NIGHT" && s.dailyTasks?.tasks.length ? new DailyTaskCombat() : null;
            this.battle = s.phase === "NIGHT" ? new BattleSimulation(s, this.taskCombat ?? undefined) : null; this.accumulator = 0;
        } else if (mercyAccepted && this.battle) {
            const before = this.battle.feedback.length;
            this.battle.applyPaidMercy();
            this.combatFeedback.push(...this.battle.feedback.slice(before));
            this.resume("CHOICE");
        }
        this.continuingBattle = false;
        if (s.phase === "DAWN" && s.choices.length === 0) { this.command({ type: "FINALIZE" }); return; }
        this.checkDailyRation();
        this.changed();
    }
    private submit(next: GameState, keepBattle = false, start?: SaveMode, backpack?: BackpackChange, essence?: EssenceFeedback) {
        try {
            if (start !== undefined) next.settings = this.deviceSettings.resolve(next.settings);
            this.saves.prepare(next, start, start !== undefined, backpack); this.continuingBattle = keepBattle; this.pendingNewVillage = start !== undefined;
            this.pendingEssence = essence;
            this.stopPatrolRapid();
            this.pauses.add("SAVE_PENDING"); this.retry();
        } catch (e) { this.error = e instanceof Error ? e.message : String(e); this.changed(); }
    }
    retry() {
        if (!this.saves.pending) { this.load(); return; }
        try {
            const purchase = this.saves.pending.backpack?.change.delta === 1 && this.boot?.kind !== "complete-backpack-change";
            const state = this.saves.commit(), newVillage = this.pendingNewVillage;
            this.essenceFeedback = this.pendingEssence; this.pendingEssence = undefined;
            this.purchaseFeedback = purchase || !!(this.state && !newVillage && !ownsTowerAmmo(this.state, "SLOW") && state.iceAmmoUnlocked);
            this.pendingNewVillage = false; this.accept(state, newVillage);
        } catch (e) { this.error = e instanceof Error ? e.message : String(e); this.changed(); }
    }
    buyItem(id: ItemId) {
        const state = this.state;
        if (!state || this.saves.pending || this.pauses.has("BACKGROUND") || this.pauses.has("DISABLED")) return;
        try {
            const { product, affordable } = shopOffer(state, id);
            if (id === ICE_AMMO_OFFER.id && ownsTowerAmmo(state, "SLOW")) throw new Error("冰弹已拥有");
            if (!affordable) throw new Error("粮木不足");
            this.villageItems.shop();
            const next = { ...state, food: state.food - product.food, wood: state.wood - product.wood };
            if (id === ICE_AMMO_OFFER.id) {
                this.submit({ ...next, iceAmmoUnlocked: true });
                return;
            }
            const count = this.villageItems.backpack().items[id] ?? 0;
            this.submit(next, false, undefined, { id, delta: 1, before: count });
        } catch (e) { this.error = e instanceof Error ? e.message : String(e); this.changed(); }
    }
    useEssence(person: string) {
        const state = this.state;
        if (!state || this.saves.pending || this.pauses.has("BACKGROUND") || this.pauses.has("DISABLED")) return;
        try {
            if (!essenceTargets(state).some(p => p.id === person)) throw new Error("这位村民当前无法使用道具");
            const count = this.villageItems.backpack().items[LIANG_ESSENCE.id] ?? 0;
            if (!count) throw new Error("背包里没有靓哥的精华");
            // 只在确认后抽一次，重试使用存档候选，不推进既有的家庭与世界随机序列。
            const nights = LIANG_ESSENCE.minNights + Math.floor(Math.random() * (LIANG_ESSENCE.maxNights - LIANG_ESSENCE.minNights + 1));
            const next = clone(state), target = next.people.find(p => p.id === person)!;
            target.nights += nights;
            target.retirementDelayUses = (target.retirementDelayUses ?? 0) + 1;
            this.submit(next, false, undefined, { id: LIANG_ESSENCE.id, delta: -1, before: count }, { person, nights });
        } catch (e) { this.error = e instanceof Error ? e.message : String(e); this.changed(); }
    }
    usePatrolItem(id: PatrolItemId) {
        const state = this.state;
        if (!state || this.saves.pending || this.pauses.has("BACKGROUND") || this.pauses.has("DISABLED")) return;
        try {
            const reason = patrolItemUnavailable(state, id);
            if (reason) throw new Error(reason);
            const count = this.villageItems.backpack().items[id] ?? 0;
            if (!count) throw new Error(`背包里没有「${ITEMS[id].name}」`);
            const next = clone(state);
            if (id === LIANG_INDULGENCE.id) next.patrol.radiusReady = true;
            else next.patrol.rationReady = true;
            this.submit(next, false, undefined, { id, delta: -1, before: count });
        } catch (e) { this.error = e instanceof Error ? e.message : String(e); this.changed(); }
    }
    command(c: Command) {
        if (!this.state || this.saves.pending || (c.type === "NIGHT" && this.pauses.has("ASSETS"))) return;
        try {
            const before = this.state, next = clone(before), date = this.taskDate;
            if (c.type !== "MUSIC") prepareDailyTasks(next, date);
            applyCommand(next, c);
            if (before.phase !== "DAY" && next.phase === "DAY") prepareDailyTasks(next, date);
            creditTaskCommand(before, next, c, date);
            if (c.type === "MUSIC") {
                this.deviceSettings.write(next.settings);
                this.state = next; this.error = ""; this.changed();
                return;
            }
            this.submit(next, next.phase === "NIGHT" && this.state.phase === "NIGHT");
        }
        catch (e) { this.error = e instanceof Error ? e.message : String(e); this.changed(); }
    }
    pause(reason: Pause) { this.stopPatrolRapid(); this.pauses.add(reason); this.accumulator = 0; this.aimingBlastIn = this.aimingPatrolIn = null; }
    resume(reason: Pause) { this.pauses.delete(reason); this.accumulator = 0; }
    hide = () => { this.pause("BACKGROUND"); this.changed(); };
    show = () => { this.resume("BACKGROUND"); this.pause("WAIT_RESUME"); this.enter(); };
    get canRingBell() { return this.canCast(this.battle?.tactics[0].id); }
    canCast(id?: string) { return this.state?.phase === "NIGHT" && id !== undefined && this.battle?.canCast(id) === true && !this.pauses.size && !this.saves.pending; }
    get blastAiming() { return this.aimingBlastIn !== null && this.aimingBlastIn === this.battle && this.canCast(BLAST_TACTIC); }
    bell(id = this.battle?.tactics[0].id) {
        if (id === KING_MERCY_TACTIC || !this.canCast(id)) return;
        const aim = id === BLAST_TACTIC && !this.blastAiming;
        if (aim) this.stopPatrolRapid();
        this.aimingBlastIn = aim ? this.battle : null;
        if (id !== BLAST_TACTIC) {
            const beforeCast = this.battle.feedback.length;
            this.battle.bell(id);
            if (this.battle.handSpeed) this.stopPatrolRapid();
            // 瞬发战技在点击当下产生反馈，不能等下一步清空信箱再收集。
            this.combatFeedback.push(...this.battle.feedback.slice(beforeCast));
        }
        this.changed();
    }
    confirmMercy() {
        const { state, battle } = this;
        if (state?.phase !== "NIGHT" || !state.night || state.night.mercySpent || this.saves.pending ||
            !this.pauses.has("CHOICE") || this.pauses.size !== 1 || !battle?.canCast(KING_MERCY_TACTIC)) return;
        const cost = mercyOffering(state);
        if (cost.reason) { this.error = cost.reason; this.changed(); return; }
        const next = clone(state), casts = (state.tactics.mercyCooldown?.casts ?? 0) + 1;
        next.wood -= cost.wood;
        next.food -= cost.food;
        next.gate = gateCapacity(state);
        next.night!.mercySpent = true;
        next.tactics.mercyCooldown = { casts, wavesLeft: KING_MERCY.baseCooldownWaves + casts };
        this.submit(next, true);
    }
    get patrolRapidReady() {
        const battle = this.battle;
        return !!battle?.patrol?.rapid?.ammo && !battle.outcome && !battle.handSpeed && !this.blastAiming &&
            !this.pauses.size && !this.saves.pending;
    }
    aimPatrolRapid(direction: RoadPoint, origin: RoadPoint = PATROL.rapid.origin, muzzleDistance: number = PATROL.rapid.muzzleDistance) {
        return this.patrolRapidReady && this.battle!.patrol!.rapid!.aim(direction, origin, muzzleDistance);
    }
    stopPatrolRapid() {
        if (this.battle?.patrol?.rapid) {
            this.battle.patrol.rapid.stop();
            this.aimingPatrolIn = null;
        }
    }
    get patrolDragReady() {
        const battle = this.battle;
        return !!battle?.patrol?.spin?.canGather && !battle.outcome && !battle.handSpeed && !this.blastAiming &&
            !this.pauses.size && !this.saves.pending;
    }
    setPatrolAiming(active: boolean) {
        this.aimingPatrolIn = active && (this.patrolDragReady || this.patrolRapidReady) ? this.battle : null;
    }
    get patrolAiming() {
        return !!this.aimingPatrolIn && this.aimingPatrolIn === this.battle && (this.patrolDragReady || this.patrolRapidReady);
    }
    get battleSpeed() {
        return this.patrolAiming ? RULE.battleSpeed * PATROL.spin.aimSpeedRatio : RULE.battleSpeed;
    }
    get hasFiredPatrolRapid() { return this.deviceSettings.hasFiredPatrolRapid; }
    get hasLaunchedPatrol() { return this.deviceSettings.hasLaunchedPatrol; }
    throwPatrol(at: RoadPoint, angle: number) {
        if (!this.patrolDragReady || !this.battle!.patrol!.spin!.throwAt(this.battle!.tick, at, angle)) return false;
        this.deviceSettings.markPatrolLaunched();
        return true;
    }
    placeBlast(at: RoadPoint) {
        if (!this.blastAiming || !this.battle?.bell(BLAST_TACTIC, at)) return false;
        this.aimingBlastIn = null;
        this.changed();
        return true;
    }
    tapHandSpeed() {
        const { battle, state } = this;
        if (this.pauses.size || this.saves.pending || !state || !battle?.tapHandSpeed()) return false;
        if (!battle.handSpeed && !this.collectBattleStep(battle, state)) this.changed();
        return true;
    }
    reassign(index: number, id: string) {
        // 夜间调任允许手动暂停或面板临时暂停；关闭面板只解除 CHOICE，其余暂停仍由各自流程管理。
        if (this.pauses.has("ASSETS") || !this.battle || (!this.pauses.has("USER") && !this.pauses.has("CHOICE")) || this.saves.pending) return false;
        try { this.battle.reassign(index, id); this.error = ""; this.changed(); return true; }
        catch (e) { this.error = String(e); this.changed(); return false; }
    }
    update(delta: number) {
        const now = Date.now();
        if (this.state?.phase === "DAY" && now >= this.nextTaskClockCheck) {
            this.nextTaskClockCheck = now + DAILY_TASKS.clockCheckMs;
            this.refreshDailyTasks();
        }
        if (this.pauses.size || !this.battle || !this.state || this.battle.outcome) return;
        const realDelta = Math.min(RULE.frameCap, Math.max(0, delta));
        if (this.battle.handSpeed) {
            const battle = this.battle;
            battle.step(realDelta);
            this.collectBattleStep(battle, this.state);
            return;
        }
        // 累积现实秒。打空弹仓可以在同一帧恢复战场常速，机关枪始终按实际经过的时间推进。
        this.accumulator += realDelta;
        for (let steps = 0; steps < RULE.maxSteps; steps++) {
            const realStep = RULE.step / this.battleSpeed;
            if (this.accumulator + 1e-9 < realStep) break;
            this.accumulator -= realStep;
            const battle = this.battle;
            const rapid = battle.patrol?.rapid;
            const previousShots = rapid?.shotsFired;
            battle.step(realStep);
            if (rapid && !rapid.ammo) this.aimingPatrolIn = null;
            if (rapid && previousShots !== undefined && rapid.shotsFired > previousShots) {
                this.onPatrolRapidFire?.();
                if (previousShots === 0) this.deviceSettings.markPatrolRapidFired();
            }
            if (this.collectBattleStep(battle, this.state)) break;
        }
    }
    /** 普通战斗步、连点倒计时与达标引爆共用反馈、胜负与保存结果。 */
    private collectBattleStep(battle: BattleSimulation, state: GameState) {
        this.combatFeedback.push(...battle.feedback);
        // 每批人只产生一个落地事件，包括空砸；在本步结算换场前交付音效，表现信箱仍保留完整事件。
        if (this.onPatrolLanding && battle.feedback.some(event => event.type === "patrolLanding")) this.onPatrolLanding();
        if (!battle.outcome) return false;
        this.finishedBattle = battle;
        const next = clone(state);
        if (this.taskCombat) creditTaskVictory(next, this.taskDate, battle, this.taskCombat);
        finishNight(next, battle.gate, battle.operators);
        this.submit(next);
        return true;
    }
}
