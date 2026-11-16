import { RULE } from "../game/GameConfig";
import { ProjectilePose } from "./ProjectileMotion";
import { SpriteFrames } from "./SpriteFrames";
import { WORLD_ART } from "./config/WorldArtConfig";
import { RAGE_VISUAL } from "./config/RageVisualConfig";

/** 投射物固定节点池：只呈现已有弹道，生命周期由 shots 父节点管理，不推进战斗或动画时钟。 */
export class ProjectileVisuals {
    private projectileNodes: Laya.Sprite[] = [];
    private projectileGlows: Laya.Sprite[] = [];
    constructor(shots: Laya.Sprite, private art: SpriteFrames) {
        for (let i = 0; i < RULE.effectCap; i++) {
            const glow = new Laya.Sprite(); glow.mouseEnabled = false; glow.visible = false;
            shots.addChild(glow); this.projectileGlows.push(glow);
            const s = new Laya.Sprite();
            s.mouseEnabled = false;
            s.visible = false;
            shots.addChild(s);
            this.projectileNodes.push(s);
        }
    }
    clear() {
        this.projectileNodes.forEach(n => n.visible = false);
        this.projectileGlows.forEach(n => n.visible = false);
    }
    draw(poses: readonly ProjectilePose[]) {
        poses.forEach((p, i) => {
            const n = this.projectileNodes[i];
            n.name = `projectile:${p.shot.kind}:${p.shot.tower}:${p.shot.tick}:${i}`;
            n.visible = !p.impacted || p.shot.empowered;
            this.art.applyFrame(n, p.frame, p.size);
            n.pos(p.x, p.y);
            n.rotation = p.rotation + (p.shot.kind === "ARROW" && !p.impacted ? WORLD_ART.arrowAngleOffset : 0);
            n.alpha = p.alpha;
            if (p.shot.empowered && !p.impacted) {
                // 围绕实际裁框中心附加窄柔光，主体尺寸/发射口/弹道都不变；冰弹保留原青蓝色。
                const glow = this.projectileGlows[i], frame = this.art.contentBounds(p.frame);
                const unit = p.size / frame.sourceSize.w, angle = n.rotation * Math.PI / 180;
                const dx = (frame.trimOffset.x + frame.rect.w / 2 - frame.pivot.x) * unit;
                const dy = (frame.trimOffset.y + frame.rect.h / 2 - frame.pivot.y) * unit;
                const width = frame.rect.w * unit * RAGE_VISUAL.projectileScale, height = frame.rect.h * unit * RAGE_VISUAL.projectileScale;
                glow.texture = this.art.get("fx_rage_glow"); glow.size(width, height).pivot(width / 2, height / 2);
                glow.pos(p.x + dx * Math.cos(angle) - dy * Math.sin(angle), p.y + dx * Math.sin(angle) + dy * Math.cos(angle));
                glow.rotation = n.rotation; glow.alpha = RAGE_VISUAL.projectileAlpha; glow.visible = true;
            }
        });
    }
}
