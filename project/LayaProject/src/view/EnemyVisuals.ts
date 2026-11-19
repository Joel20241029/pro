import { FEEDBACK } from "./config/FeedbackConfig";
import { EnemyKind } from "../config/EnemyConfig";
import { SpriteFrames } from "./SpriteFrames";
import { ENEMY_LOOKS, ENEMY_PALETTES, ENEMY_SCALES } from "./config/EnemyVisualConfig";
import type { ZhouLoveCue } from "./CombatPresentation";
import { DRAGON_POISON } from "../config/TacticConfig";
import { drawUiGlyph } from "./UiGlyphs";
/** 留诊只摆动身体，脚底阴影、受击点与头顶的状态符号保留同一地图锚点。 */
const MIND_VISUAL = { sway: 2.5, cycle: .55, markSize: 24, violet: "#6739a2", light: "#f3dcff" } as const;
/** 一个敌人一个复用容器；阴影、帧序列和挂件共用源画布、脚底与父变换。
 * 每个池位只在换帧/换身份时重绘，绝不逐步创建纹理或滤镜。
 */
export class EnemyVisuals {
    private key = "";
    private body = new Laya.Sprite();
    private mark?: Laya.Sprite;
    private loveCue?: Laya.Sprite;
    private poisonMark?: Laya.Sprite;
    private burstImpact?: Laya.Sprite;
    constructor(readonly node: Laya.Sprite, private art: SpriteFrames) {
        this.body.name = "EnemyBody"; this.body.mouseEnabled = false;
        node.addChild(this.body);
    }
    draw(kind: EnemyKind, seed: number, walkDistance: number, mirror: boolean, flashing = false, death?: { scaleY: number; alpha: number }, shake = 0, mindTime?: number, love?: ZhouLoveCue, poisoned = false, burstAge?: number) {
        const definition = this.art.enemyLayouts[kind], look = ENEMY_LOOKS[kind];
        if (!definition) throw new Error("未声明的怪物布局：" + kind);
        let value = seed >>> 0;
        const pick = <T>(values: readonly T[]): T => { const choice = values[value % values.length]; value = Math.floor(value / values.length); return choice; };
        const color = pick(ENEMY_PALETTES), size = look.size * pick(ENEMY_SCALES), head = pick(look.head), back = pick(look.back);
        const scale = size / definition.canvas;
        const index = Math.floor(walkDistance / (definition.stride * scale) * definition.frames.length) % definition.frames.length;
        const key = `${kind}:${seed}:${index}:${flashing}`;
        // 复用节点必须在缓存提前返回前恢复透明度/高度，尸体不能污染下一个活怪。
        this.node.scale(mirror ? -scale : scale, scale * (death ? death.scaleY : 1));
        this.node.alpha = death ? death.alpha : 1;
        const phase = mindTime === undefined ? 0 : mindTime / MIND_VISUAL.cycle * Math.PI * 2 + seed % 7;
        this.body.x = (shake + (mindTime === undefined ? 0 : MIND_VISUAL.sway * Math.sin(phase))) / (mirror ? -scale : scale);
        const frame = definition.frames[index], canvas = definition.canvas;
        if (mindTime !== undefined) {
            if (!this.mark) {
                this.mark = new Laya.Sprite();
                this.mark.name = "MindLockMark"; this.mark.mouseEnabled = false;
                const g = this.mark.graphics;
                g.drawCircle(0, 0, MIND_VISUAL.markSize / 2, MIND_VISUAL.violet, MIND_VISUAL.light, 1.5);
                g.drawCurves(0, 0, [1, 4, -6, 4, -5, -2, -3, -7, 3, -6, 8, -3, 4, 2, 0, 4, -1, 0, 0, -2, 2, -1], MIND_VISUAL.light, 1.8);
                this.mark.size(MIND_VISUAL.markSize, MIND_VISUAL.markSize);
                this.node.addChild(this.mark);
            }
            this.mark.visible = true;
            this.mark.pos(definition.foot.x, frame.y + canvas * .06 - MIND_VISUAL.markSize * .58 / scale);
            this.mark.scale((mirror ? -1 : 1) / scale, 1 / scale);
            this.mark.rotation = Math.sin(phase) * 12;
        } else if (this.mark) this.mark.visible = false;
        if (poisoned) {
            const { size, gap } = FEEDBACK.poisonMark;
            if (!this.poisonMark) {
                this.poisonMark = new Laya.Sprite();
                this.poisonMark.name = "DragonPoisonMark";
                this.poisonMark.mouseEnabled = false;
                this.poisonMark.pivot(size / 2, size);
                drawUiGlyph(this.poisonMark, DRAGON_POISON.icon, size, size);
                this.node.addChild(this.poisonMark);
            }
            this.poisonMark.visible = true;
            this.poisonMark.pos(definition.foot.x, frame.y + canvas * .06 - gap / scale);
            this.poisonMark.scale((mirror ? -1 : 1) / scale, 1 / scale);
        } else if (this.poisonMark) this.poisonMark.visible = false;
        if (love && (love.cleared || !death)) {
            if (!this.loveCue) {
                this.loveCue = new Laya.Sprite();
                this.loveCue.mouseEnabled = false;
                this.node.addChild(this.loveCue);
            }
            const cue = this.loveCue, g = cue.graphics;
            cue.visible = true;
            cue.scale((mirror ? -1 : 1) / scale, 1 / (scale * (death?.scaleY ?? 1)));
            if (love.cleared) {
                cue.name = "ZhouLoveArrowImpact";
                g.clear();
                this.art.applyFrame(cue, this.art.frameId("fx_impact_arrow", love.age), FEEDBACK.impact.size.ARROW);
                cue.pos(definition.foot.x, definition.foot.y + (frame.y + canvas * .46 - definition.foot.y) / (death?.scaleY ?? 1));
                cue.alpha = 1;
            } else {
                cue.name = "ZhouLoveHealMark";
                cue.texture = null; cue.pivot(0, 0); g.clear();
                const { seconds, lift, size, red, stroke } = FEEDBACK.loveHeal, t = love.age / seconds;
                const arm = size * .36;
                g.drawLine(-arm, 0, arm, 0, red, stroke);
                g.drawLine(0, -arm, 0, arm, red, stroke);
                cue.pos(definition.foot.x, frame.y + canvas * .06 - (size * .6 + t * lift) / scale);
                cue.alpha = Math.min(1, (1 - t) * 4);
            }
        } else if (this.loveCue) this.loveCue.visible = false;
        if (burstAge !== undefined) {
            if (!this.burstImpact) {
                this.burstImpact = new Laya.Sprite();
                this.burstImpact.name = "TacticBurstImpact";
                this.burstImpact.mouseEnabled = false;
                this.node.addChild(this.burstImpact);
            }
            const impact = this.burstImpact, squash = death?.scaleY ?? 1;
            this.art.applyFrame(impact, this.art.frameId("fx_impact_stone", burstAge), size * FEEDBACK.tacticBurst.bodySizeScale);
            // 与周博受击共用身体中部位置；爆裂不随死亡的压扁动画收缩。
            impact.pos(definition.foot.x + this.body.x, definition.foot.y + (frame.y + canvas * .46 - definition.foot.y) / squash);
            impact.scale((mirror ? -1 : 1) / scale, 1 / (scale * squash));
            impact.visible = true;
        } else if (this.burstImpact) this.burstImpact.visible = false;
        if (key === this.key) return;
        this.key = key;
        this.node.size(canvas, canvas).pivot(definition.foot.x, definition.foot.y);
        this.node.graphics.clear();
        this.body.graphics.clear();
        // 原生动画的固定底层阴影与身体同根；drawTexture自动恢复裁边，alpha不参与受击红闪或变体染色。
        const shadow = definition.shadow;
        this.node.graphics.drawTexture(this.art.get(shadow.frame), shadow.x, shadow.y, shadow.width, shadow.height, null, shadow.alpha);
        // 先背部再头部，保留组合选择顺序；实际遮挡由每帧原生prefab明确声明。
        for (const behind of [true, false]) {
            if (!behind) this.body.graphics.drawImage(this.art.get(frame.body), frame.x, frame.y, canvas, canvas, flashing ? FEEDBACK.flashColor : color);
            for (const id of [back, head]) if (id) {
                const part = frame.parts[id];
                if (part.behind === behind) this.body.graphics.drawImage(this.art.get(id), part.x, part.y, part.width, part.height, flashing ? FEEDBACK.flashColor : "#ffffff");
            }
        }
    }
}
