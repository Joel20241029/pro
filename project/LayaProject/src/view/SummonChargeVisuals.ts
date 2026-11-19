import { SUMMON_CHARGE } from "../config/TacticConfig";
import { enemyPoint } from "../game/BattleRoad";
import type { BattleSimulation, CombatFeedback } from "../game/BattleSimulation";
import type { GameLayout } from "./GameLayout";
import type { SpriteFrames } from "./SpriteFrames";
import { walkDirection, WalkDirection } from "./VillagerAppearance";
import { WalkAnimation } from "./WalkAnimation";
import { FEEDBACK } from "./config/FeedbackConfig";

/** 错列可读性及固定表现长度。距离以720逻辑画布为基准，收尾秒数从首个可见命中起算。 */
const V = { model: "straw", canvas: 42, fadeDistance: 48, aftermath: .32, endFade: .22 } as const;
type Hit = Extract<CombatFeedback, { type: "summon" }>;
type Depth = { id: string; y: number; node: Laya.Sprite };
interface Actor { root: Laya.Sprite; dust: Laya.Sprite; body: Laya.Sprite; direction: WalkDirection; }
interface Impact { node: Laya.Sprite; hit: Hit | null; seenAt: number; }

/** 固定20组节点与已有行走图集。逻辑退场即时发生，短光效可在结算后继续播放。 */
export class SummonChargeVisuals {
    private battle: BattleSimulation | null = null;
    private actors: Actor[] = [];
    private impacts: Impact[] = [];
    private ring: Laya.Sprite | null = null;
    private walk: WalkAnimation;
    private endedAt: number | null = null;
    constructor(private world: Laya.Sprite, private art: SpriteFrames) { this.walk = new WalkAnimation(art); }

    reset() {
        this.battle = null;
        this.endedAt = null;
        this.walk = new WalkAnimation(this.art);
        if (this.ring) this.ring.visible = false;
        for (const actor of this.actors) { actor.root.visible = false; actor.direction = "UP"; }
        for (const impact of this.impacts) { impact.node.visible = false; impact.hit = null; }
    }

    private sprite(name: string, parent = this.world) {
        const node = new Laya.Sprite(); node.name = name; node.visible = false; node.mouseEnabled = false;
        parent.addChild(node);
        return node;
    }

    update(battle: BattleSimulation | null, layout: GameLayout, events: CombatFeedback[], clock: number): Depth[] {
        if (battle !== this.battle) { this.reset(); this.battle = battle; }
        const rush = battle?.summonCharge;
        if (!rush || !this.art.ready("village")) return [];
        if (!this.ring) {
            this.ring = this.sprite("SummonGateRing");
            for (let i = 0; i < SUMMON_CHARGE.count; i++) {
                const root = this.sprite(`SummonedVillager:${i}`);
                root.stackingRoot = true;
                const dust = this.sprite("SummonDust", root), body = this.sprite("SummonBody", root);
                dust.visible = body.visible = true;
                this.actors.push({ root, dust, body, direction: "UP" });
                this.impacts.push({ node: this.sprite(`SummonImpact:${i}`), hit: null, seenAt: 0 });
            }
        }
        const depth: Depth[] = [];
        const gathering = rush.gathered < 1;
        if (battle.outcome && this.endedAt === null) this.endedAt = clock;
        const ending = this.endedAt === null ? 1 : Math.max(0, 1 - (clock - this.endedAt) / V.endFade);
        const ring = this.ring, line = rush.villagers[0];
        ring.visible = gathering && ending > 0;
        if (ring.visible) {
            const t = rush.gathered, w = 30 + 42 * t;
            ring.pos(line.at.x, layout.worldY(line.at.y - 12));
            ring.alpha = Math.sin((.12 + .87 * t) * Math.PI) * ending;
            ring.graphics.clear();
            ring.graphics.drawEllipse(0, 0, w, w * .48, "rgba(244,175,56,0.21)", "#ffdb83", 3);
            ring.graphics.drawEllipse(0, 0, w * .75, w * .35, null, "#fff1b6", 1);
            depth.push({ id: ring.name, y: ring.y - 31, node: ring });
        }
        for (const unit of rush.villagers) {
            const actor = this.actors[unit.index], { root, body, dust } = actor;
            root.visible = !unit.retired && ending > 0;
            if (!root.visible) continue;
            root.pos(unit.at.x, layout.worldY(unit.at.y));
            root.alpha = ending * Math.min(1, unit.progress / V.fadeDistance) * (.3 + .7 * Math.min(1, rush.gathered * 2.8));
            const dx = unit.at.x - unit.from.x, dy = unit.at.y - unit.from.y;
            actor.direction = walkDirection(dx, dy, actor.direction);
            const facing = this.art.walk(V.model, actor.direction);
            const width = V.canvas * (this.art.animation(facing.clip).displayScale ?? 1);
            const scale = layout.personScale;
            const frame = this.walk.frame({ id: root.name, walkDistance: unit.distance, walking: unit.distance > 0 }, facing.clip, width * scale);
            this.art.applyFrame(body, frame, width);
            const entryScale = scale * (.83 + .17 * Math.min(1, rush.gathered * 2.5));
            body.scale((facing.mirror ? -1 : 1) * entryScale, entryScale);
            dust.graphics.clear();
            dust.graphics.drawEllipse(0, 1, width * .23, width * .09, "rgba(64,45,24,0.28)", null, 0);
            if (unit.distance > 0) {
                const t = (unit.distance / 29 + unit.index * .23) % 1;
                dust.graphics.drawEllipse(-dx * (.45 + t), -dy * (.45 + t), 8 + 7 * t, 3 + 4 * t,
                    `rgba(235,197,129,${.25 * (1 - t)})`, null, 0);
            }
            depth.push({ id: root.name, y: root.y, node: root });
        }
        for (const event of events) if (event.type === "summon") {
            const impact = this.impacts[event.index];
            impact.hit = event; impact.seenAt = clock;
        }
        for (const impact of this.impacts) {
            const { node, hit } = impact, t = (clock - impact.seenAt) / V.aftermath;
            node.visible = hit !== null && t < 1;
            if (!node.visible || !hit) continue;
            const enemy = enemyPoint(hit.enemy), x = (hit.at.x + enemy.x) / 2, y = (hit.at.y + enemy.y) / 2;
            node.pos(x, layout.worldY(y));
            node.scale(FEEDBACK.impactScale, FEEDBACK.impactScale);
            node.alpha = 1 - t;
            node.graphics.clear();
            const spread = 1 - (1 - t) * (1 - t);
            node.graphics.drawEllipse(0, 0, 10 + 35 * spread, 5 + 15 * spread, "rgba(255,183,66,0.22)", "#ffd487", 4 - t * 3);
            if (t < .34) {
                node.graphics.drawCircle(0, -8, 13 + 12 * spread, "#fff1af");
                node.graphics.drawCircle(0, -8, 6 + 8 * spread, "#fff9d9");
                node.graphics.drawEllipse(0, 0, 20 + 24 * spread, 7 + 10 * spread, null, "#fff4ce", 2);
            }
            const turn = Math.atan2(hit.dy, hit.dx);
            for (let i = 0; i < 5; i++) {
                const angle = turn + i * Math.PI * 2 / 5, length = 13 + (22 + i * 3) * spread;
                node.graphics.drawCircle(Math.cos(angle) * length, Math.sin(angle) * length * .6 - t * 13, 3 - 2 * t, i % 2 ? "#fff2c3" : "#eca54a");
            }
            depth.push({ id: node.name, y: Math.max(layout.worldY(enemy.y), layout.worldY(hit.at.y)) + .1, node });
        }
        return depth;
    }
}
