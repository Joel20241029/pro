import { RULE } from "../config/RuleConfig";
import { TIMED_BLAST } from "../config/TacticConfig";
import { onBattleRoad, PATH_LENGTH, pointAt, RoadPoint } from "../game/BattleRoad";
import type { BattleSimulation, CombatFeedback } from "../game/BattleSimulation";
import { GameSession } from "../game/GameSession";
import { GameLayout } from "./GameLayout";
import { LAYOUT } from "./config/HudConfig";
import { SpriteFrames } from "./SpriteFrames";
import { UiWidgets } from "./UiWidgets";

/** 选点提示及爆炸只读战斗位置。波纹用实时时钟，倒数用可暂停的战斗时钟。 */
const V = { segments: 48, shell: 34, impactSize: 152, burstSeconds: .48, blinkSeconds: .6, blinkCount: 2 } as const;

export class TimedBlastVisuals {
    readonly node = new Laya.Sprite();
    private readonly area = new Laya.Rectangle();
    private readonly pointer = new Laya.Point();
    private marker?: Laya.Sprite;
    private impact?: Laya.Sprite;
    private currentBattle: BattleSimulation | null = null;
    private preview: RoadPoint | null | undefined;
    private burst: { at: RoadPoint; start: number } | null = null;

    constructor(private game: GameSession, private art: SpriteFrames, private ui: UiWidgets, private layout: GameLayout) {
        this.node.name = "TimedBlastGround";
        this.node.mouseEnabled = false;
        this.node.hitArea = this.area;
        this.node.on(Laya.Event.MOUSE_DOWN, this, this.move);
        this.node.on(Laya.Event.MOUSE_MOVE, this, this.move);
        this.ui.bindClick(this.node, event => {
            if (this.game.blastAiming) this.game.placeBlast(this.roadPoint(event));
        });
    }

    private roadPoint(event: Laya.Event): RoadPoint {
        const p = this.node.globalToLocal(this.pointer.setTo(event.stageX, event.stageY));
        return { x: p.x, y: this.layout.referenceY(p.y) };
    }

    private move(event: Laya.Event) {
        if (!this.game.blastAiming) return;
        const at = this.roadPoint(event);
        this.preview = onBattleRoad(at) ? at : null;
    }

    // 圆周跨城墙时地图纵轴比例会变；逐点变换使预告与命中范围共用同一几何。
    private circle(at: RoadPoint, radius: number, line: string, fill: string | null, fraction = 1) {
        const points: number[] = [];
        for (let i = 0; i <= V.segments; i++) {
            const a = -Math.PI / 2 + fraction * Math.PI * 2 * i / V.segments;
            points.push(at.x + radius * Math.cos(a), this.layout.worldY(at.y + radius * Math.sin(a)));
        }
        if (fill) this.node.graphics.drawPoly(0, 0, points, fill, line, 2);
        else this.node.graphics.drawLines(0, 0, points, line, 3);
    }

    update(layout: GameLayout, battle: BattleSimulation | null, events: CombatFeedback[], time: number, panelOpen: boolean) {
        this.layout = layout;
        if (this.currentBattle !== battle) {
            this.currentBattle = battle;
            this.burst = null;
            this.preview = undefined;
        }
        for (const event of events) if (event.type === "blast") this.burst = { at: event.at, start: time };
        const aiming = !panelOpen && this.game.blastAiming;
        this.node.mouseEnabled = aiming;
        this.area.setTo(0, layout.mapTop, LAYOUT.width, layout.gateY - layout.mapTop);
        this.node.graphics.clear();
        if (this.marker) this.marker.visible = false;
        if (this.impact) this.impact.visible = false;
        if (!aiming) this.preview = undefined;

        const planted = battle && !battle.outcome ? battle.blastAt : null;
        const at = planted ?? (aiming ? this.preview === undefined ? pointAt(PATH_LENGTH / 2) : this.preview : null);
        if (at) {
            const remaining = planted ? battle!.bellTicks * RULE.step : TIMED_BLAST.delaySeconds;
            const flash = remaining < V.blinkSeconds && Math.floor(remaining / V.blinkSeconds * V.blinkCount * 2) % 2 === 0;
            this.circle(at, TIMED_BLAST.radius, "#ffce78", flash ? "rgba(255,111,25,0.23)" : "rgba(255,174,58,0.11)");
            if (planted) {
                this.circle(at, TIMED_BLAST.radius, "#fff1ad", null, 1 - remaining / TIMED_BLAST.delaySeconds);
                this.marker ??= this.ui.image(this.node, TIMED_BLAST.icon, 0, 0, V.shell);
                this.marker.name = "TimedBlastShell";
                this.marker.pos(at.x - V.shell / 2, layout.worldY(at.y) - V.shell * .8);
                this.marker.alpha = flash ? .6 : 1;
                this.marker.visible = true;
            }
        }
        if (!this.burst) return;
        const age = time - this.burst.start;
        if (age >= V.burstSeconds) { this.burst = null; return; }
        const progress = age / V.burstSeconds, hit = this.burst.at;
        this.node.graphics.save();
        this.node.graphics.alpha(1 - progress);
        this.circle(hit, TIMED_BLAST.radius * (.22 + .78 * (1 - (1 - progress) ** 2)), "#ff9b35", "rgba(255,123,30,0.18)");
        this.node.graphics.restore();
        if (!this.art.ready("night")) return;
        this.impact ??= new Laya.Sprite();
        if (!this.impact.parent) { this.impact.name = "TimedBlastImpact"; this.impact.mouseEnabled = false; this.node.addChild(this.impact); }
        this.art.applyFrame(this.impact, this.art.frameId("fx_impact_stone", age), V.impactSize * (.65 + progress * .4));
        this.impact.pos(hit.x, layout.worldY(hit.y));
        this.impact.alpha = 1 - progress ** 2;
        this.impact.visible = true;
    }
}
