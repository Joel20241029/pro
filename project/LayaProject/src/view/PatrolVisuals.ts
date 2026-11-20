import { PATROL } from "../config/PatrolConfig";
import type { BattleSimulation } from "../game/BattleSimulation";
import { appearanceSeed, APPEARANCE_DOMAIN } from "../game/EnemySeed";
import type { GameLayout } from "./GameLayout";
import type { SpriteFrames } from "./SpriteFrames";
import type { WorldItem } from "./WorldInteraction";

/** 1.0.73 的出征尺寸偏大，人物与脚下阴影一起缩小 25%。步态按累计路程换帧。 */
const LOOK = { spriteSize: 49, actorScale: .75 };
/** 出征外观池，索引只选择美术片段，每种步态按图集内记录的步幅换帧。 */
const WALK_CLIPS = ["patrol_walk", "patrol_walk_shuffle", "patrol_walk_waddle"] as const;

export class PatrolVisuals {
    private nodes: { root: Laya.Sprite; body: Laya.Sprite }[] = [];
    constructor(private world: Laya.Sprite, private art: SpriteFrames) {}

    update(battle: BattleSimulation | null, layout: GameLayout): WorldItem[] {
        const patrol = battle?.outcome ? null : battle?.patrol;
        for (const { root } of this.nodes) root.visible = false;
        const depth: WorldItem[] = [];
        if (!battle || !patrol) return depth;
        if (!this.nodes.length) for (let i = 0; i < PATROL.squad.maxActive; i++) {
            const root = new Laya.Sprite(), body = new Laya.Sprite();
            root.name = `PatrolActor:${i}`;
            root.mouseEnabled = body.mouseEnabled = false;
            root.graphics.drawEllipse(0, 1, 13 * LOOK.actorScale, 5 * LOOK.actorScale, "rgba(56,34,33,0.30)", null, 0);
            root.addChild(body);
            this.world.addChild(root);
            this.nodes.push({ root, body });
        }
        patrol.units.forEach((unit, i) => {
            const { root, body } = this.nodes[i];
            root.visible = true;
            root.pos(unit.at.x, layout.worldY(unit.at.y));
            const seed = appearanceSeed(APPEARANCE_DOMAIN.patrol, battle.base.rng.world, battle.base.day, unit.index);
            const clipId = WALK_CLIPS[seed % WALK_CLIPS.length];
            const clip = this.art.animation(clipId);
            const time = unit.distance / clip.stridePixels! * clip.frameIds.length / clip.fps;
            this.art.applyFrame(body, this.art.frameId(clipId, time), LOOK.spriteSize * LOOK.actorScale * layout.personScale);
            depth.push({ id: root.name, y: root.y, node: root });
        });
        return depth;
    }
}
