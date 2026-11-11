import { BattleSimulation } from "./BattleSimulation";
import { clone, GameState } from "./GameState";
import { RULE, Trait } from "./GameConfig";
import { applyCommand, Command, createGame, finishNight } from "./VillageRules";
import { LoadResult, SaveStore } from "../storage/SaveStore";
export type Pause = "USER" | "BACKGROUND" | "WAIT_RESUME" | "CHOICE" | "SAVE_PENDING" | "DISABLED";
export class GameSession {
    state: GameState | null = null; battle: BattleSimulation | null = null;
    readonly pauses = new Set<Pause>(); boot: LoadResult | null = null;
    private currentError = "";
    /** 仅供表现层识别新提示；同文案再次报错也递增，不写入存档或参与业务判断。 */
    errorRevision = 0;
    get error() { return this.currentError; }
    set error(value: string) { this.currentError = value; if (value) this.errorRevision++; }
    changed = () => {}; private accumulator = 0; private continuingBattle = false;
    constructor(readonly saves: SaveStore) {}
    load() {
        try { this.boot = this.saves.inspect(); this.error = ""; if (this.boot.kind === "ready") this.accept(this.boot.state); else this.changed(); }
        catch (e) { this.error = String(e); this.boot = { kind: "blocked", reason: "微信存档暂时读取失败。请重试，未新建或覆盖进度。", canReset: false }; this.changed(); }
    }
    recover() { if (this.boot?.kind === "recover") this.accept(this.boot.state); }
    newVillage(trait?: Trait, reset = false) {
        if (reset) this.saves.allowReset();
        this.submit(createGame(Date.now() >>> 0, this.state?.legacy, trait, this.state ? this.state.history : [], this.state ? this.state.favorites : []));
    }
    private accept(s: GameState) {
        const sameNight = this.continuingBattle && this.battle !== null && s.phase === "NIGHT";
        this.state = s; this.boot = null; this.error = ""; this.pauses.delete("SAVE_PENDING");
        if (!sameNight) { this.battle = s.phase === "NIGHT" ? new BattleSimulation(s) : null; this.accumulator = 0; }
        this.continuingBattle = false;
        if (s.phase === "DAWN" && s.choices.length === 0) { this.command({ type: "FINALIZE" }); return; }
        this.changed();
    }
    private submit(next: GameState, keepBattle = false) {
        try {
            this.continuingBattle = keepBattle; this.saves.prepare(next); this.pauses.add("SAVE_PENDING");
            this.accept(this.saves.commit());
        } catch (e) { this.error = e instanceof Error ? e.message : String(e); if (!this.saves.pending) this.pauses.delete("SAVE_PENDING"); this.changed(); }
    }
    retry() {
        if (!this.saves.pending) { this.load(); return; }
        try { this.accept(this.saves.commit()); } catch (e) { this.error = e instanceof Error ? e.message : String(e); this.changed(); }
    }
    command(c: Command) {
        if (!this.state || this.saves.pending) return;
        try { const next = clone(this.state); applyCommand(next, c); this.submit(next, next.phase === "NIGHT" && this.state.phase === "NIGHT"); }
        catch (e) { this.error = e instanceof Error ? e.message : String(e); this.changed(); }
    }
    pause(reason: Pause) { this.pauses.add(reason); this.accumulator = 0; }
    resume(reason: Pause) { this.pauses.delete(reason); this.accumulator = 0; }
    hide = () => { this.pause("BACKGROUND"); this.changed(); };
    show = () => { this.resume("BACKGROUND"); this.pause("WAIT_RESUME"); this.changed(); };
    bell() { if (this.battle && !this.pauses.size) { this.battle.bell(); this.changed(); } }
    reassign(index: number, id: string | null) {
        // 夜间调任允许手动暂停或面板临时暂停；关闭面板只解除 CHOICE，其余暂停仍由各自流程管理。
        if (!this.battle || (!this.pauses.has("USER") && !this.pauses.has("CHOICE")) || this.saves.pending) return false;
        try { this.battle.reassign(index, id); this.error = ""; this.changed(); return true; }
        catch (e) { this.error = String(e); this.changed(); return false; }
    }
    update(delta: number) {
        if (this.pauses.size || !this.battle || !this.state || this.battle.outcome) return;
        this.accumulator += Math.min(RULE.frameCap, Math.max(0, delta)) * this.state.settings.speed;
        let steps = 0;
        while (this.accumulator + 1e-9 >= RULE.step && steps++ < RULE.maxSteps) {
            this.accumulator -= RULE.step; this.battle.step();
            if (this.battle.outcome) {
                const next = clone(this.state); finishNight(next, this.battle.gate, this.battle.operators); this.submit(next); break;
            }
        }
    }
}
