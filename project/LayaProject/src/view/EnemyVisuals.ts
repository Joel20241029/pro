import { FEEDBACK } from "./config/FeedbackConfig";
import { EnemyKind } from "../config/EnemyConfig";
import { SpriteFrames } from "./SpriteFrames";
import { ENEMY_LOOKS, ENEMY_PALETTES, ENEMY_SCALES } from "./config/EnemyVisualConfig";
/** 一个敌人一个复用容器；阴影、帧序列和挂件共用源画布、脚底与父变换。
 * 每个池位只在换帧/换身份时重绘，绝不逐步创建纹理或滤镜。
 */
export class EnemyVisuals {
    private key = "";
    constructor(readonly node: Laya.Sprite, private art: SpriteFrames) {}
    draw(kind: EnemyKind, seed: number, walkDistance: number, mirror: boolean, flashing = false) {
        const definition = this.art.enemyLayouts[kind], look = ENEMY_LOOKS[kind];
        if (!definition) throw new Error("未声明的怪物布局：" + kind);
        let value = seed >>> 0;
        const pick = <T>(values: readonly T[]): T => { const choice = values[value % values.length]; value = Math.floor(value / values.length); return choice; };
        const color = pick(ENEMY_PALETTES), size = look.size * pick(ENEMY_SCALES), head = pick(look.head), back = pick(look.back);
        const scale = size / definition.canvas;
        const index = Math.floor(walkDistance / (definition.stride * scale) * definition.frames.length) % definition.frames.length;
        const key = `${kind}:${seed}:${index}:${flashing}`;
        this.node.scale(mirror ? -scale : scale, scale);
        if (key === this.key) return;
        this.key = key;
        const frame = definition.frames[index], canvas = definition.canvas;
        this.node.size(canvas, canvas).pivot(definition.foot.x, definition.foot.y);
        this.node.graphics.clear();
        // 原生动画的固定底层阴影与身体同根；drawTexture自动恢复裁边，alpha不参与受击红闪或变体染色。
        const shadow = definition.shadow;
        this.node.graphics.drawTexture(this.art.get(shadow.frame), shadow.x, shadow.y, shadow.width, shadow.height, null, shadow.alpha);
        // 先背部再头部，保留组合选择顺序；实际遮挡由每帧原生prefab明确声明。
        for (const behind of [true, false]) {
            if (!behind) this.node.graphics.drawImage(this.art.get(frame.body), frame.x, frame.y, canvas, canvas, flashing ? FEEDBACK.flashColor : color);
            for (const id of [back, head]) if (id) {
                const part = frame.parts[id];
                if (part.behind === behind) this.node.graphics.drawImage(this.art.get(id), part.x, part.y, part.width, part.height, flashing ? FEEDBACK.flashColor : "#ffffff");
            }
        }
    }
}
