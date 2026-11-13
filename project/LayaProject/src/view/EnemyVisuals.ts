import { FEEDBACK } from "./config/FeedbackConfig";
import { EnemyKind } from "../config/EnemyConfig";
import { SpriteFrames } from "./SpriteFrames";
import { ENEMY_LOOKS, ENEMY_PALETTES, ENEMY_SCALES } from "./config/EnemyVisualConfig";
export interface EnemyLayout {
    canvas: number; fps: number; foot: { x: number; y: number };
    frames: { body: string; head: { x: number; y: number }; back: { x: number; y: number } }[];
}
/** 一个敌人一个复用容器、最多四个绘制层；帧序列和挂件共用源画布与脚底。
 * 每个池位只在换帧/换身份时重绘，绝不逐步创建纹理或滤镜。
 */
export class EnemyVisuals {
    private key = "";
    constructor(readonly node: Laya.Sprite, private art: SpriteFrames) {}
    draw(kind: EnemyKind, seed: number, seconds: number, mirror: boolean, flashing = false) {
        const definition = this.art.enemyLayouts[kind], look = ENEMY_LOOKS[kind];
        if (!definition) throw new Error("未声明的怪物布局：" + kind);
        const index = Math.floor(seconds * definition.fps) % definition.frames.length;
        const key = `${kind}:${seed}:${index}:${flashing}`;
        let value = seed >>> 0;
        const pick = <T>(values: readonly T[]): T => { const choice = values[value % values.length]; value = Math.floor(value / values.length); return choice; };
        const color = pick(ENEMY_PALETTES), size = look.size * pick(ENEMY_SCALES), head = pick(look.head), back = pick(look.back);
        const scale = size / definition.canvas;
        this.node.scale(mirror ? -scale : scale, scale);
        if (key === this.key) return;
        this.key = key;
        const frame = definition.frames[index], canvas = definition.canvas;
        this.node.size(canvas, canvas).pivot(definition.foot.x, definition.foot.y);
        this.node.graphics.clear();
        if (back) this.node.graphics.drawImage(this.art.get(back), frame.back.x - look.backSize / 2, frame.back.y - look.backSize * .8, look.backSize, look.backSize, flashing ? FEEDBACK.flashColor : "#ffffff");
        this.node.graphics.drawImage(this.art.get(frame.body), 0, 0, canvas, canvas, flashing ? FEEDBACK.flashColor : color);
        if (head) this.node.graphics.drawImage(this.art.get(head), frame.head.x - look.headSize / 2, frame.head.y - look.headSize * .8, look.headSize, look.headSize, flashing ? FEEDBACK.flashColor : "#ffffff");
    }
}
