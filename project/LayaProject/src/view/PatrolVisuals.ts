import { PATROL } from "../config/PatrolConfig";
import type { BattleSimulation, CombatFeedback } from "../game/BattleSimulation";
import type { GameLayout } from "./GameLayout";
import type { SpriteFrames } from "./SpriteFrames";
import type { WorldItem } from "./WorldInteraction";

/** 显示比例与村民接近。按累计路程换帧，因此暂停和倍速不会造成滑步。 */
const LOOK = { spriteSize: 49, hitSeconds: .22 };
export class PatrolVisuals {
    private nodes: { root: Laya.Sprite; body: Laya.Sprite }[] = [];
    private impact: { node: Laya.Sprite; hit: Extract<CombatFeedback, { type: "patrol" }>; until: number } | null = null;
    private active: BattleSimulation | null = null;
    constructor(private world: Laya.Sprite, private art: SpriteFrames) {}

    update(battle: BattleSimulation | null, layout: GameLayout, events: CombatFeedback[], clock: number): WorldItem[] {
        const patrol = battle?.outcome ? null : battle?.patrol;
        for (const { root } of this.nodes) root.visible = false;
        if (battle !== this.active) {
            this.impact?.node.destroy();
            this.impact = null;
            this.active = battle;
        }
        const depth: WorldItem[] = [];
        if (patrol && !this.nodes.length) for (let i = 0; i < PATROL.maxActive; i++) {
            const root = new Laya.Sprite(), body = new Laya.Sprite();
            root.name = `PatrolActor:${i}`;
            root.mouseEnabled = body.mouseEnabled = false;
            root.graphics.drawEllipse(0, 1, 13, 5, "rgba(56,34,33,0.30)", null, 0);
            root.addChild(body);
            this.world.addChild(root);
            this.nodes.push({ root, body });
        }
        patrol?.units.forEach((unit, i) => {
            const { root, body } = this.nodes[i];
            root.visible = true;
            root.pos(unit.at.x, layout.worldY(unit.at.y));
            const clip = this.art.animation("patrol_walk");
            const time = unit.distance / clip.stridePixels! * clip.frameIds.length / clip.fps;
            this.art.applyFrame(body, this.art.frameId("patrol_walk", time), LOOK.spriteSize * layout.personScale);
            depth.push({ id: root.name, y: root.y, node: root });
        });
        for (const hit of events) if (hit.type === "patrol") {
            const node = this.impact?.node ?? this.world.addChild(new Laya.Sprite());
            node.mouseEnabled = false;
            node.name = "PatrolImpact";
            this.impact = { node, hit, until: clock + LOOK.hitSeconds };
        }
        if (this.impact) {
            const { node, hit, until } = this.impact, remaining = Math.max(0, until - clock) / LOOK.hitSeconds;
            node.visible = remaining > 0;
            if (node.visible) {
                node.graphics.clear();
                node.graphics.drawEllipse(0, -5, 11 + 16 * (1 - remaining), 7 + 9 * (1 - remaining), null, "#ffe6b6", 3);
                node.pos(hit.at.x, layout.worldY(hit.at.y));
                node.alpha = remaining;
                depth.push({ id: node.name, y: node.y + 1, node });
            }
        }
        return depth;
    }
}
