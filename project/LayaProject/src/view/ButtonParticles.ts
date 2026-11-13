import { ParticleEffect, ParticleLibrary } from './ParticleLibrary';
import { FEEDBACK } from './config/FeedbackConfig';
/** 圆角矩形周长的均速轨迹，全部在按钮面层内，不扩展点击区。 */
export function buttonEdge(phase: number, width: number, height: number) {
    const { inset, radius } = FEEDBACK.button, w = width - inset * 2, h = height - inset * 2, r = radius;
    const straightX = w - 2 * r, straightY = h - 2 * r, arc = Math.PI * r / 2;
    let d = (phase % 1) * (straightX * 2 + straightY * 2 + arc * 4);
    const segments = [straightX, arc, straightY, arc, straightX, arc, straightY, arc];
    let part = 0; while (part < segments.length - 1 && d > segments[part]) d -= segments[part++];
    let x: number, y: number;
    if (part === 0) { x = r + d; y = 0; }
    else if (part === 2) { x = w; y = r + d; }
    else if (part === 4) { x = w - r - d; y = h; }
    else if (part === 6) { x = 0; y = h - r - d; }
    else {
        const corner = (part - 1) / 2, angle = (-.5 + corner * .5) * Math.PI + d / r;
        const centers = [[w-r,r], [w-r,h-r], [r,h-r], [r,r]];
        x = centers[corner][0] + Math.cos(angle) * r; y = centers[corner][1] + Math.sin(angle) * r;
    }
    return { x: x + inset, y: y + inset };
}
export class ButtonParticles {
    private effect: ParticleEffect;
    private showing = false;
    private time = 0;
    constructor(library: ParticleLibrary, private face: Laya.Sprite, private width: number, private height: number) { this.effect = library.create('button_ready'); }
    advance(delta: number, enabled: boolean) {
        if (!enabled) { if (this.showing) this.effect.clear(); this.showing = false; return; }
        if (!this.showing) { this.effect.start(this.face, 0, 0); this.showing = true; }
        this.time += delta;
        const p = buttonEdge(this.time / FEEDBACK.button.period, this.width, this.height);
        this.effect.system.shape.shape.positionX = p.x;
        this.effect.system.shape.shape.positionY = -p.y; // 原生发射形状Y向上，UI局部Y向下。
        this.effect.clock(1);
    }
    destroy() { this.effect.destroy(); }
}
