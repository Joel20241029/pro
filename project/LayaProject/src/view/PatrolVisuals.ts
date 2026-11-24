import { AnchoredTip } from "./AnchoredTip";
import { SPEECH } from "./config/VillagerSpeechConfig";
import { PATROL } from "../config/PatrolConfig";
import type { BattleSimulation, CombatFeedback } from "../game/BattleSimulation";
import { appearanceSeed, APPEARANCE_DOMAIN } from "../game/EnemySeed";
import type { GameLayout } from "./GameLayout";
import type { SpriteFrames } from "./SpriteFrames";
import type { GameSession } from "../game/GameSession";
import { PatrolRapidView } from "./PatrolRapidView";
import { PatrolThrowCue } from "./PatrolThrowCue";
import type { WorldItem } from "./WorldInteraction";

/** 旧单人出征沿用原尺寸。双人旋甩再放大约 30%，阴影和就绪提示同步缩放。 */
const LOOK = { spriteSize: 49, actorScale: .75, spinScale: 1.625 };
/** 出征外观池，索引只选择美术片段，每种步态按图集内记录的步幅换帧。 */
// 沿用村民气泡高度与字体。长句扩宽，蓄力时在箭头侧面留出阅读空间。
const TIPS = { hint: "按住任一人往下拉，松手发射", call: PATROL.spin.name, width: 340, side: 147 } as const;
const WALK_CLIPS = ["patrol_walk", "patrol_walk_shuffle", "patrol_walk_waddle"] as const;

export class PatrolVisuals {
    private nodes: { root: Laya.Sprite; body: Laya.Sprite; shadow: Laya.Sprite; focus: Laya.Sprite }[] = [];
    private cue: PatrolThrowCue;
    private rapidView?: PatrolRapidView;
    private hint?: AnchoredTip;
    private call?: AnchoredTip;
    private tipBattle: BattleSimulation | null = null;
    private callActor: number | undefined;
    private tipTime = 0;
    private hintBounds?: Laya.Rectangle;
    private callBounds?: Laya.Rectangle;
    constructor(private world: Laya.Sprite, private art: SpriteFrames, private game: GameSession) {
        this.cue = new PatrolThrowCue(world, game, art);
    }
    get hasLanding() { return this.cue.impact !== null; }
    destroy() {
        this.cue.dispose();
        this.rapidView?.root.destroy(true);
        this.hint?.hide(); this.hint?.removeSelf();
        this.call?.hide(); this.call?.removeSelf();
    }

    update(battle: BattleSimulation | null, layout: GameLayout, events: CombatFeedback[] = [], time = 0, blocked = false): WorldItem[] {
        this.cue.update(layout, battle, events, time, blocked);
        const patrol = battle?.outcome ? null : battle?.patrol;
        for (const { root } of this.nodes) root.visible = false;
        const depth: WorldItem[] = [];
        if (this.tipBattle !== battle) {
            this.tipBattle = battle;
            this.callActor = undefined;
            this.rapidView?.hide();
            this.hint?.hide(); this.call?.hide();
        }
        const dt = Math.max(0, time - this.tipTime);
        this.tipTime = time;
        const rapid = patrol?.rapid;
        if (rapid && !battle?.outcome) {
            if (!this.art.ready("night")) return depth;
            if (!this.rapidView) {
                this.rapidView = new PatrolRapidView(this.art);
                this.rapidView.root.zIndex = 2;
                this.rapidView.root.stackingRoot = true;
                (this.world.parent as Laya.Sprite).addChild(this.rapidView.root);
            }
            this.rapidView.update(layout, rapid, this.cue.rapidAim, time,
                !blocked && this.game.patrolRapidReady && !this.game.hasFiredPatrolRapid && !this.cue.rapidAim);
            return depth;
        }
        if (this.rapidView?.root.visible) this.rapidView.hide();
        if (!battle?.patrol) return depth;
        if (!this.nodes.length) for (let i = 0; i < PATROL.squad.maxActive; i++) {
            const root = new Laya.Sprite(), body = new Laya.Sprite(), shadow = new Laya.Sprite(), focus = new Laya.Sprite();
            root.name = `PatrolActor:${i}`;
            root.mouseEnabled = body.mouseEnabled = false;
            shadow.mouseEnabled = false;
            shadow.graphics.drawEllipse(0, 1, 13, 5, "rgba(56,34,33,0.30)", null, 0);
            focus.name = "PatrolReadyHalo";
            focus.mouseEnabled = false;
            focus.graphics.drawEllipse(0, 2, 24, 8, "rgba(255,182,80,.33)", "#ffe7a2", 2.5);
            root.addChild(shadow);
            root.addChild(focus);
            root.addChild(body);
            this.world.addChild(root);
            this.nodes.push({ root, body, shadow, focus });
        }
        const impact = this.cue.impact;
        const age = impact ? time - impact.started : 0;
        const landing = impact && age < .32 ? [{ index: impact.actor, at: impact.at, distance: 0,
            lift: 10 * Math.sin(Math.PI * Math.min(1, age / .32)), rotation: 52, squash: 1 - .36 * (1 - age / .32) }] : [];
        const spin = patrol?.spin;
        const scale = LOOK.actorScale * (battle.patrol.spin ? LOOK.spinScale : 1);
        const angle = this.cue.orbitAngle;
        const pair = spin && angle !== null ? spin.actors.map((actor, i) => ({ ...actor, ...spin.orbit(i, angle) })) : spin?.actors;
        const actors = [...(pair ?? patrol?.units ?? []), ...landing];
        const ready = !!spin?.canGather && !blocked && this.game.patrolDragReady;
        actors.forEach((unit, i) => {
            const { root, body, shadow, focus } = this.nodes[i];
            root.visible = true;
            shadow.scale(scale, scale);
            focus.visible = ready;
            focus.scale(scale, scale);
            root.pos(unit.at.x, layout.worldY(unit.at.y));
            const seed = appearanceSeed(APPEARANCE_DOMAIN.patrol, battle.base.rng.world, battle.base.day, unit.index);
            const clipId = WALK_CLIPS[seed % WALK_CLIPS.length];
            const clip = this.art.animation(clipId);
            const time = unit.distance / clip.stridePixels! * clip.frameIds.length / clip.fps;
            this.art.applyFrame(body, this.art.frameId(clipId, time), LOOK.spriteSize * scale * layout.personScale);
            body.y = "lift" in unit ? -(unit.lift as number ?? 0) : 0;
            body.rotation = "rotation" in unit ? unit.rotation as number ?? 0 : 0;
            body.scaleY = "squash" in unit ? unit.squash as number ?? 1 : 1;
            body.scaleX = 1 / body.scaleY;
            depth.push({ id: root.name, y: root.y, node: root });
        });
        this.updateTips(spin, dt);
        return depth;
    }

    private updateTips(spin: NonNullable<BattleSimulation["patrol"]>["spin"] | undefined, dt: number) {
        const scene = this.world.parent as Laya.Sprite | null;
        if (!scene || !spin) {
            this.hint?.hide(); this.call?.hide();
            return;
        }
        const [first, second] = this.nodes;
        if (spin.canGather && !this.game.hasLaunchedPatrol) {
            if (!this.hint) {
                this.hint = new AnchoredTip(this.art, TIPS.width, SPEECH.height, SPEECH.font, true, Infinity);
                this.hint.name = "PatrolLaunchHint";
                this.hint.zIndex = 4;
                this.hintBounds = new Laya.Rectangle();
                scene.addChild(this.hint);
            }
            const direction = this.cue.aimHorizontal;
            const x = direction === undefined ? 0 : direction > 0 ? -TIPS.side : TIPS.side;
            const height = Math.max(first.body.height, second.body.height);
            const bounds = this.hintBounds!;
            bounds.setTo((first.root.x + second.root.x) / 2 + x, Math.min(first.root.y, second.root.y) - height, 0, 0);
            if (!this.hint.visible) this.hint.show(TIPS.hint, () => ({ node: this.world, bounds }));
            this.hint.advance(dt);
        } else this.hint?.hide();

        const speaker = spin.flying ? spin.actors[0] : undefined;
        if (!speaker) { this.call?.hide(); return; }
        if (this.callActor !== speaker.index) {
            this.callActor = speaker.index;
            if (!this.call) {
                this.call = new AnchoredTip(this.art, SPEECH.width, SPEECH.height, SPEECH.font, true, SPEECH.seconds);
                this.call.name = "PatrolLaunchCall";
                this.call.zIndex = 4;
                this.callBounds = new Laya.Rectangle();
                scene.addChild(this.call);
            }
            const bounds = this.callBounds!;
            bounds.setTo(0, -first.body.height, 0, 0);
            this.call.show(TIPS.call, () => ({ node: first.root, bounds }));
        }
        this.callBounds?.setTo(0, -first.body.height, 0, 0);
        this.call?.advance(dt);
    }
}
