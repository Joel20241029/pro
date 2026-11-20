import { FEATURE_WINS, TaskKind, TaskMaterial } from "../config/DailyTaskConfig";
import { activeDailyTasks } from "../game/DailyTaskState";
import { BattleSimulation } from "../game/BattleSimulation";
import { TACTICS, TacticDefinition } from "../config/TacticConfig";
import { GameSession } from "../game/GameSession";
import { GameState } from "../game/GameState";
import { tacticRevealed } from "../game/Tactics";
import { economy } from "../game/VillageQueries";
import { GameHud } from "./GameHud";
import { FEEDBACK } from "./config/FeedbackConfig";
import { UiWidgets } from "./UiWidgets";
import { SIDE_FEATURES } from "./config/TacticUiConfig";
import { drawFeatureUnlock, drawNightResult, drawTacticUnlock, NightResult } from "./panels/NightResultPanel";
import { PanelContext } from "./panels/PanelContext";

/** 实时表现秒。首解锁先让玩家看清功能，再依次飞向左侧，落点稍微放大后回稳。 */
const MOTION = {
    // 收下与新战技采用同样的加速放大、短停与曲线飞行，时间为实际表现秒。
    grow: .24, hold: .14, flight: .42, collectTail: .08,
    // 对应 1.0.34 的峰值约 96 和 122 像素的约 3.3 倍。
    gainPeak: 315, tacticPeak: 403,
    unlockNotice: .46, unlockSeconds: .62, popSeconds: .32,
    featureSize: 84
} as const;
const RAISED_FLIGHT_SECONDS = MOTION.grow + MOTION.hold + MOTION.flight;
const MATERIAL_KEYS = ["food", "wood"] as const;
type FlightPoint = { x: number; y: number; size: number };
type DailyFlight = { kind: TaskKind; date: string; material: TaskMaterial; source: FlightPoint; raised: FlightPoint; elapsed: number | null };
type Stage = "impact" | "summary" | "collect" | "unlock" | "tactic";

/** 只消费已提交的本次战斗结果。领取和解锁均为表现，不写存档、不发命令。 */
export class NightResultPresentation {
    readonly layer = new Laya.Sprite();
    private tiles: Laya.Sprite[] = [];
    private lastResult: BattleSimulation | null = null;
    private result: NightResult | null = null;
    private featureUnlock = -1;
    private dailyFlight: DailyFlight | null = null;
    private newTactic: TacticDefinition | null = null;
    private phase: Stage | null = null;
    private elapsed = 0;
    private box: Laya.Sprite | null = null;
    private sources: Laya.Sprite[] = [];
    private point = new Laya.Point();
    shownFeatures: number = SIDE_FEATURES.length;
    get active() { return this.phase !== null; }
    get revealingTactic() { return this.newTactic !== null; }
    get playingFinalImpact() { return this.phase === "impact"; }

    constructor(private ui: UiWidgets, private hud: GameHud, private refresh: () => void) {
        this.layer.name = "NightFlights"; this.layer.mouseEnabled = false;
    }

    reset() {
        this.dailyFlight = null;
        this.featureUnlock = -1;
        this.lastResult = null; this.result = null; this.phase = null; this.box = null; this.sources = []; this.newTactic = null;
        this.hideFlights();
        this.shownFeatures = SIDE_FEATURES.length;
    }

    observe(game: GameSession, s: GameState | null, patrolImpactPlaying: boolean) {
        this.hideFlights();
        const flight = this.dailyFlight;
        if (flight && flight.elapsed === null && !game.saves.pending) {
            if (s && activeDailyTasks(s, flight.date)?.tasks.some(task => task.kind === flight.kind && task.claimed)) flight.elapsed = 0;
            else this.dailyFlight = null;
        }
        const battle = game.presentationBattle;
        if (!s || game.battle || game.saves.pending || !battle?.outcome || battle === this.lastResult || battle.base.run !== s.run) return;
        const patrolImpact = patrolImpactPlaying || battle.feedback.some(event => event.type === "patrol");
        if (battle.outcome === "LOSE") {
            if (s.phase !== "GAME_OVER" || !patrolImpact) return;
            this.lastResult = battle;
            this.phase = "impact";
            this.elapsed = 0;
            return;
        }
        const committed = s.completed === battle.base.completed + 1 && (s.phase === "DAWN" || s.phase === "DAY");
        if (!committed) return;
        const production = economy(battle.base);
        this.lastResult = battle;
        this.result = { night: battle.base.day, food: production.food, wood: production.wood, rations: production.rations,
            stock: { food: s.food, wood: s.wood }, patrol: battle.patrol ?? undefined, recap: s.summary.replace(/^守夜成功！/, "") };
        this.featureUnlock = SIDE_FEATURES.findIndex(feature => {
            const threshold = FEATURE_WINS[feature.panel];
            return battle.base.legacy.bestNight < threshold && threshold <= s.legacy.bestNight;
        });
        this.newTactic = TACTICS.find(t => !tacticRevealed(battle.base, t.id) && tacticRevealed(s, t.id)) ?? null;
        this.shownFeatures = this.featureUnlock < 0 ? SIDE_FEATURES.length : this.featureUnlock;
        this.phase = "impact";
        this.elapsed = 0;
    }

    claimDaily(game: GameSession, kind: TaskKind, date: string, icon: Laya.Sprite) {
        if (this.dailyFlight || !game.state || game.saves.pending) return;
        const task = activeDailyTasks(game.state, date)?.tasks.find(t => t.kind === kind && !t.claimed);
        const box = icon.parent?.parent?.parent as Laya.Sprite | undefined;
        if (!task || !box) return;
        // Successful commits rebuild the panel and HUD. Snapshot the old source and use the live HUD target.
        this.dailyFlight = { kind, date, material: task.material, source: this.center(icon), raised: this.center(box), elapsed: null };
        game.claimTask(kind, date);
        if (this.dailyFlight?.elapsed === null && !game.saves.pending) this.dailyFlight = null;
    }

    draw(ctx: PanelContext): boolean {
        if (this.phase === "impact") return true;
        if (!this.phase || !this.result) return false;
        if (this.phase === "unlock" || this.phase === "tactic") {
            const view = this.phase === "unlock" ? drawFeatureUnlock(ctx, this.featureUnlock) : drawTacticUnlock(ctx, this.newTactic!);
            this.box = view.box; this.sources = view.sources;
        } else {
            const view = drawNightResult(ctx, this.result, this.phase === "collect", () => {
                if (this.phase !== "summary") return;
                this.phase = "collect"; this.elapsed = 0;
                this.refresh();
            });
            this.box = view.box; this.sources = view.sources;
        }
        return true;
    }

    advance(seconds: number, patrolImpactPlaying = false, enemyDeathsPlaying = false) {
        this.hideFlights();
        const flight = this.dailyFlight;
        if (flight && flight.elapsed !== null) {
            const target = this.hud.materialIcons[flight.material];
            if (target && flight.elapsed < RAISED_FLIGHT_SECONDS) {
                this.raisedFlight(0, `icon_${flight.material}`, flight.source, target, flight.raised, MOTION.gainPeak, flight.elapsed);
                flight.elapsed += seconds;
            } else this.dailyFlight = null;
        }
        if (this.phase === "impact") {
            if (this.result) {
                if (patrolImpactPlaying || enemyDeathsPlaying) this.elapsed = 0;
                else if ((this.elapsed += seconds) >= FEEDBACK.victoryClearSeconds) this.next("summary");
            } else {
                this.elapsed += seconds;
                if (!patrolImpactPlaying && this.elapsed >= FEEDBACK.finalImpactSeconds) this.next(null);
            }
            return;
        }
        if (!this.phase || this.phase === "summary" || !this.box?.displayedInStage || !this.box.mouseEnabled) return;
        this.elapsed += seconds;
        if (this.phase === "collect") {
            const result = this.result!;
            let sequenceSeconds = 0;
            MATERIAL_KEYS.forEach((key, i) => {
                const target = this.hud.materialIcons[key];
                if (result[key] <= 0 || !target) return;
                const elapsed = this.elapsed - sequenceSeconds;
                sequenceSeconds += RAISED_FLIGHT_SECONDS;
                if (elapsed >= 0 && elapsed < RAISED_FLIGHT_SECONDS)
                    this.raisedFlight(i, `icon_${key}`, this.center(this.sources[i]), target, this.center(this.box!), MOTION.gainPeak, elapsed);
            });
            if (this.elapsed >= sequenceSeconds + MOTION.collectTail)
                this.next(this.featureUnlock >= 0 ? "unlock" : this.newTactic ? "tactic" : null);
            return;
        }
        if (this.phase === "tactic") {
            const target = this.hud.featureButtons.find(n => n.name === "TacticsButton");
            const age = this.elapsed - MOTION.unlockNotice;
            if (target && age >= 0) {
                const source = this.sources[0];
                source.visible = false;
                if (age < RAISED_FLIGHT_SECONDS) this.raisedFlight(0, this.newTactic!.icon, this.center(source), target, this.center(source), MOTION.tacticPeak, age);
                else {
                    if (this.hud.tacticBadge) this.hud.tacticBadge.visible = true;
                    this.pop(target, age - RAISED_FLIGHT_SECONDS);
                }
            }
            if (age >= RAISED_FLIGHT_SECONDS + MOTION.popSeconds) this.next(null);
            return;
        }
        const index = this.featureUnlock, feature = SIDE_FEATURES[index];
        const progress = (this.elapsed - MOTION.unlockNotice) / MOTION.unlockSeconds;
        const target = this.hud.featureButtons[index];
        if (target && progress >= 0) {
            const source = this.sources[0];
            source.visible = false;
            if (progress < 1) this.fly(index, feature.icon, MOTION.featureSize, source, target, progress);
            else {
                target.visible = true; target.mouseEnabled = true;
                this.shownFeatures = index + 1;
                this.pop(target, (progress - 1) * MOTION.unlockSeconds);
            }
        }
        if (this.elapsed >= MOTION.unlockNotice + MOTION.unlockSeconds + MOTION.popSeconds)
            this.next(this.newTactic ? "tactic" : null);
    }

    private next(phase: Stage | null) {
        if (this.phase === "unlock") this.shownFeatures = SIDE_FEATURES.length;
        this.phase = phase; this.elapsed = 0;
        this.hideFlights(); this.box = null;
        if (phase === null) { this.result = null; this.newTactic = null; }
        this.refresh();
    }

    private tile(index: number, id: string, size: number) {
        let tile = this.tiles[index];
        if (tile?.name !== id || tile.width !== size) {
            tile?.destroy(true);
            tile = this.ui.image(this.layer, id, 0, 0, size);
            tile.name = id; tile.pivot(size / 2, size / 2); this.tiles[index] = tile;
        }
        tile.visible = true;
        this.layer.visible = true;
        return tile;
    }
    private center(node: Laya.Sprite) {
        node.localToGlobal(this.point.setTo(node.width / 2, node.height / 2), false, this.layer.parent as Laya.Sprite);
        return { x: this.point.x, y: this.point.y, size: Math.max(node.width, node.height) };
    }
    private pop(button: Laya.Sprite, elapsed: number) {
        const t = Math.min(1, elapsed / MOTION.popSeconds), scale = 1 + .26 * (1 - t) * Math.cos(t * Math.PI * 2);
        (button.getChildByName("buttonFace") as Laya.Sprite).scale(scale, scale);
    }
    private curve(tile: Laya.Sprite, from: {x: number; y: number}, to: {x: number; y: number}, t: number, side: number) {
        const arc = 2 * (1 - t) * t;
        tile.pos(from.x + (to.x - from.x) * t + arc * side * 88, from.y + (to.y - from.y) * t - arc * 84);
    }
    private fly(index: number, id: string, size: number, from: Laya.Sprite, to: Laya.Sprite, progress: number) {
        const tile = this.tile(index, id, size), t = progress * progress;
        this.curve(tile, this.center(from), this.center(to), t, index ? 1 : -1);
        tile.scale(.72 + .37 * t, .72 + .37 * t);
    }
    private raisedFlight(index: number, id: string, start: FlightPoint, to: Laya.Sprite, raised: { x: number; y: number }, peak: number, elapsed: number) {
        const tile = this.tile(index, id, peak);
        let scale: number;
        if (elapsed < MOTION.grow + MOTION.hold) {
            const t = Math.min(1, elapsed / MOTION.grow) ** 2;
            tile.pos(start.x + (raised.x - start.x) * t, start.y + (raised.y - start.y) * t);
            const initialScale = start.size / peak;
            scale = initialScale + (1 - initialScale) * t;
        } else {
            const t = ((elapsed - MOTION.grow - MOTION.hold) / MOTION.flight) ** 2;
            this.curve(tile, raised, this.center(to), t, index ? 1 : -1);
            const landingScale = Math.max(to.width, to.height) / peak;
            scale = 1 + (landingScale - 1) * t;
        }
        tile.scale(scale, scale);
    }

    hideFlights() {
        this.layer.visible = false;
        this.tiles.forEach(tile => tile.visible = false);
    }
}
