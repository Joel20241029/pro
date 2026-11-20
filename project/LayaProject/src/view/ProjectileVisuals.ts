import { RULE } from "../game/GameConfig";
import { ARROW_TIP, ProjectilePose } from "./ProjectileMotion";
import { SpriteFrames } from "./SpriteFrames";
import { WORLD_ART } from "./config/WorldArtConfig";
import { RAGE_VISUAL } from "./config/RageVisualConfig";
import { FEEDBACK, TOWER_IMPACT } from "./config/FeedbackConfig";

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
            const body = !p.impacted || p.contact;
            n.name = `projectile:${p.shot.kind}:${p.shot.tower}:${p.shot.tick}:${i}`;
            n.visible = body || p.shot.empowered;
            this.art.applyFrame(n, p.frame, p.size);
            // 箭尖/石冰可见中心才是弹道坐标；角色足底pivot在旋转后会将图案甩离落点。
            const frame = this.art.contentBounds(p.frame), unit = p.size / frame.sourceSize.w;
            n.pivot(body && p.shot.kind === "ARROW" ? ARROW_TIP.x * p.size : (frame.trimOffset.x + frame.rect.w / 2) * unit,
                body && p.shot.kind === "ARROW" ? ARROW_TIP.y * frame.sourceSize.h * unit : (frame.trimOffset.y + frame.rect.h / 2) * unit);
            n.pos(p.x, p.y);
            n.rotation = p.rotation + (p.shot.kind === "ARROW" && body ? WORLD_ART.arrowAngleOffset : 0);
            n.alpha = p.alpha;
            const glow = this.projectileGlows[i];
            if (p.impactFrame) {
                this.art.applyFrame(glow, p.impactFrame, FEEDBACK.impact.size[p.shot.kind] * FEEDBACK.impactScale * TOWER_IMPACT[p.shot.kind].displayScale);
                glow.name = `impact:${p.shot.kind}:${i}`;
                glow.pos((p.impactAt?.x ?? p.x) + p.impactShift!, p.impactAt?.y ?? p.y);
                glow.rotation = p.impactAngle!;
                glow.alpha = 1; glow.visible = true;
            } else if (p.shot.empowered && !p.impacted) {
                // 围绕实际裁框中心附加窄柔光，主体尺寸/发射口/弹道都不变；冰弹保留原青蓝色。
                const angle = n.rotation * Math.PI / 180;
                const dx = (frame.trimOffset.x + frame.rect.w / 2) * unit - n.pivotX;
                const dy = (frame.trimOffset.y + frame.rect.h / 2) * unit - n.pivotY;
                const width = frame.rect.w * unit * RAGE_VISUAL.projectileScale, height = frame.rect.h * unit * RAGE_VISUAL.projectileScale;
                glow.texture = this.art.get("fx_rage_glow"); glow.size(width, height).pivot(width / 2, height / 2);
                glow.name = `projectileGlow:${i}`;
                glow.pos(p.x + dx * Math.cos(angle) - dy * Math.sin(angle), p.y + dx * Math.sin(angle) + dy * Math.cos(angle));
                glow.rotation = n.rotation; glow.alpha = RAGE_VISUAL.projectileAlpha; glow.visible = true;
            }
        });
    }
}
