import { FEEDBACK, TOWER_IMPACT } from "./config/FeedbackConfig";
import { EnemyKind } from "../config/EnemyConfig";
import { SpriteFrames } from "./SpriteFrames";
import { ENEMY_LOOKS, ENEMY_PALETTES, ENEMY_SCALES } from "./config/EnemyVisualConfig";
import type { ZhouLoveCue } from "./CombatPresentation";
import { DRAGON_POISON } from "../config/TacticConfig";
import { drawUiGlyph } from "./UiGlyphs";
/** 留诊只摆动身体，脚底阴影、受击点与头顶的状态符号保留同一地图锚点。 */
const MIND_VISUAL = { sway: 2.5, cycle: .55, markSize: 24, violet: "#6739a2", light: "#f3dcff" } as const;
/** Laya 的批量图片路径会忽略旋转帧的顶点顺序。地图怪物使用同一组双三角形索引还原这类帧。 */
const ROTATED_QUAD = new Uint16Array([0, 1, 2, 0, 2, 3]);
const rotatedMeshes = new WeakMap<Laya.Texture, Map<string, { vertices: Float32Array; uv: Float32Array }>>();
/** 一个敌人一个复用容器；阴影、帧序列和挂件共用源画布、脚底与父变换。
 * 每个池位只在换帧/换身份时重绘，绝不逐步创建纹理或滤镜。
 */
export class EnemyVisuals {
    private key = "";
    private body = new Laya.Sprite();
    private mark?: Laya.Sprite;
    private loveCue?: Laya.Sprite;
    private poisonMark?: Laya.Sprite;
    private frostMark?: Laya.Sprite;
    private burstImpact?: Laya.Sprite;
    private patrolImpact?: Laya.Sprite;
    constructor(readonly node: Laya.Sprite, private art: SpriteFrames) {
        this.body.name = "EnemyBody"; this.body.mouseEnabled = false;
        node.addChild(this.body);
    }
    draw(kind: EnemyKind, seed: number, walkDistance: number, mirror: boolean, flashing = false, death?: { scaleY: number; alpha: number }, shake = 0, mindTime?: number, love?: ZhouLoveCue, poisoned = false, burstAge?: number, frosted = false, patrolImpactAge?: number) {
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
        const statusCount = Number(mindTime !== undefined) + Number(frosted) + Number(poisoned);
        const statusStep = FEEDBACK.enemyStatus.spacing / (mirror ? -scale : scale);
        const statusX = definition.foot.x - (statusCount - 1) * statusStep / 2;
        const bounds = statusCount || love || burstAge !== undefined || patrolImpactAge !== undefined
            ? this.art.contentBounds(frame.body) : null;
        const spriteUnit = bounds ? canvas / bounds.sourceSize.h : 0;
        const headY = frame.y + (bounds ? bounds.trimOffset.y * spriteUnit : 0);
        const impactY = headY + (bounds ? bounds.rect.h * .56 * spriteUnit : 0);
        const statusY = headY - FEEDBACK.enemyStatus.lift / scale;
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
            this.mark.pos(statusX, statusY);
            this.mark.scale((mirror ? -1 : 1) / scale, 1 / scale);
            this.mark.rotation = Math.sin(phase) * 12;
        } else if (this.mark) this.mark.visible = false;
        if (frosted) {
            if (!this.frostMark) {
                this.frostMark = new Laya.Sprite();
                this.frostMark.name = "FrostMark";
                this.frostMark.mouseEnabled = false;
                const { size, alpha } = FEEDBACK.frostMark;
                this.art.applyFrame(this.frostMark, "icon_slow", size);
                this.frostMark.pivot(size / 2, this.frostMark.height / 2);
                this.frostMark.alpha = alpha;
                this.node.addChild(this.frostMark);
            }
            this.frostMark.visible = true;
            this.frostMark.pos(statusX + Number(mindTime !== undefined) * statusStep, statusY);
            this.frostMark.scale((mirror ? -1 : 1) / scale, 1 / scale);
        } else if (this.frostMark) this.frostMark.visible = false;
        if (poisoned) {
            const { size } = FEEDBACK.poisonMark;
            if (!this.poisonMark) {
                this.poisonMark = new Laya.Sprite();
                this.poisonMark.name = "DragonPoisonMark";
                this.poisonMark.mouseEnabled = false;
                this.poisonMark.pivot(size / 2, size);
                drawUiGlyph(this.poisonMark, DRAGON_POISON.icon, size, size);
                this.node.addChild(this.poisonMark);
            }
            this.poisonMark.visible = true;
            this.poisonMark.pos(statusX + (statusCount - 1) * statusStep, statusY + size / 2 / scale);
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
                this.art.applyFrame(cue, this.art.frameId("fx_impact_arrow", love.age), TOWER_IMPACT.ARROW.size);
                cue.pos(definition.foot.x + this.body.x, definition.foot.y + (impactY - definition.foot.y) / (death?.scaleY ?? 1));
                cue.alpha = 1;
            } else {
                cue.name = "ZhouLoveHealMark";
                cue.texture = null; cue.pivot(0, 0); g.clear();
                const { seconds, lift, size, red, stroke } = FEEDBACK.loveHeal, t = love.age / seconds;
                const arm = size * .36;
                g.drawLine(-arm, 0, arm, 0, red, stroke);
                g.drawLine(0, -arm, 0, arm, red, stroke);
                cue.pos(definition.foot.x, headY - (size * .6 + t * lift) / scale);
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
            this.art.applyFrame(impact, this.art.frameId("fx_impact_stone", burstAge), size * FEEDBACK.tacticBurst.bodySizeScale * FEEDBACK.impactScale);
            // 与周博受击共用身体中部位置；爆裂不随死亡的压扁动画收缩。
            impact.pos(definition.foot.x + this.body.x, definition.foot.y + (impactY - definition.foot.y) / squash);
            impact.scale((mirror ? -1 : 1) / scale, 1 / (scale * squash));
            impact.visible = true;
        } else if (this.burstImpact) this.burstImpact.visible = false;
        if (patrolImpactAge !== undefined) {
            if (!this.patrolImpact) {
                this.patrolImpact = new Laya.Sprite();
                this.patrolImpact.name = "PatrolImpact";
                this.patrolImpact.mouseEnabled = false;
                this.node.addChild(this.patrolImpact);
            }
            const impact = this.patrolImpact;
            this.art.applyFrame(impact, this.art.frameId("fx_impact_arrow", patrolImpactAge), TOWER_IMPACT.ARROW.size);
            // 落点随身体抖动和压扁，命中帧本身维持屏幕比例。
            impact.pos(definition.foot.x + this.body.x, impactY);
            impact.scale((mirror ? -1 : 1) / scale, 1 / (scale * (death?.scaleY ?? 1)));
            impact.visible = true;
        } else if (this.patrolImpact) this.patrolImpact.visible = false;
        if (key === this.key) return;
        this.key = key;
        this.node.size(canvas, canvas).pivot(definition.foot.x, definition.foot.y);
        this.node.graphics.clear();
        this.body.size(canvas, canvas);
        this.body.graphics.clear();
        // 原生动画的固定底层阴影与身体同根；drawTexture自动恢复裁边，alpha不参与受击红闪或变体染色。
        const shadow = definition.shadow;
        this.node.graphics.drawTexture(this.art.get(shadow.frame), shadow.x, shadow.y, shadow.width, shadow.height, null, shadow.alpha);
        // 先背部再头部，保留组合选择顺序；实际遮挡由每帧原生prefab明确声明。
        for (const behind of [true, false]) {
            if (!behind) this.drawPart(frame.body, frame.x, frame.y, canvas, canvas, flashing ? FEEDBACK.flashColor : color);
            for (const id of [back, head]) if (id) {
                const part = frame.parts[id];
                if (part.behind === behind) this.drawPart(id, part.x, part.y, part.width, part.height, flashing ? FEEDBACK.flashColor : "#ffffff");
            }
        }
    }
    /** 只对旋转帧显式提交 UV，保持未旋转帧原有的批处理方式。 */
    private drawPart(id: string, x: number, y: number, width: number, height: number, tint: string) {
        const texture = this.art.get(id), graphics = this.body.graphics;
        if (!texture.rotate) {
            graphics.drawImage(texture, x, y, width, height, tint);
            return;
        }
        let bySize = rotatedMeshes.get(texture);
        if (!bySize) {
            bySize = new Map();
            rotatedMeshes.set(texture, bySize);
        }
        const size = `${width}:${height}`;
        let mesh = bySize.get(size);
        if (!mesh) {
            const scaleX = width / texture.sourceWidth, scaleY = height / texture.sourceHeight;
            const left = texture.offsetX * scaleX, top = texture.offsetY * scaleY;
            const right = left + texture.width * scaleX, bottom = top + texture.height * scaleY;
            mesh = {
                vertices: new Float32Array([left, top, right, top, right, bottom, left, bottom]),
                uv: new Float32Array(texture.uv)
            };
            bySize.set(size, mesh);
        }
        graphics.drawTriangles(texture, x, y, mesh.vertices, mesh.uv, ROTATED_QUAD, null, 1, tint);
    }

}
