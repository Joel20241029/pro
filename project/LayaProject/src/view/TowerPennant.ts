import type { TowerFlag } from "../config/DefenseConfig";

/** 源塔 128 像素画布上的旗杆摆位。坐标相对足点、朝道路外侧，颜色也用于识别不同旗样。 */
const STYLES = {
    briefs: { x: 38, y: -10, height: 108, pole: "#a9663f", glint: "#f6b970", gold: "#ffce6b", phase: 0 },
    bra: { x: 35, y: -13, height: 110, pole: "#715486", glint: "#d6a6da", gold: "#fde2f1", phase: 1.7 },
    sock: { x: 40, y: -9, height: 107, pole: "#437364", glint: "#9ac787", gold: "#f9df87", phase: 3.1 }
} as const;
const OUTLINE = "#543042";
/** 旗布单独放大，缩屏时仍可辨认；旗杆保留细轮廓。 */
const CLOTH_SCALE = 1.18;

/** 旗杆静止，只有悬挂的布小幅来回翻动。独立于塔身变形和炮口后坐。 */
export class TowerPennant {
    private readonly root = new Laya.Sprite();
    private readonly cloth = new Laya.Sprite();
    private kind: TowerFlag | undefined;
    private time = 0;

    constructor(private owner: Laya.Sprite) {
        this.root.name = "TowerPennant";
        this.root.mouseEnabled = this.cloth.mouseEnabled = false;
        this.cloth.name = "PennantCloth";
        this.owner.addChildAt(this.root, 0);
        this.root.addChild(this.cloth);
    }

    sync(kind: TowerFlag | undefined, facing: number, scale: number) {
        this.root.visible = !!kind;
        if (!kind) return;
        const style = STYLES[kind];
        this.root.pos(this.owner.pivotX - facing * style.x * scale, this.owner.pivotY + style.y * scale).scale(-facing * scale, scale);
        if (this.kind === kind) return;
        this.kind = kind;
        this.draw(kind);
    }

    advance(delta: number) {
        if (!this.kind || !this.root.visible) return;
        this.time += delta;
        const gust = this.time * 4.1 + STYLES[this.kind].phase;
        this.cloth.rotation = Math.sin(gust) * 7 + Math.sin(gust * 2 + 1) * 2;
        this.cloth.scaleX = CLOTH_SCALE * (.91 + .09 * Math.cos(gust));
    }

    private draw(kind: TowerFlag) {
        const style = STYLES[kind], h = style.height;
        const pole = this.root.graphics;
        pole.clear();
        pole.drawEllipse(0, -1, 7, 3, "rgba(52,36,41,.25)", null, 0);
        pole.drawRoundRect(-3, -h, 6, h, 3, 3, 3, 3, style.pole, OUTLINE, 1.7);
        pole.drawLine(-1, -h + 6, -1, -6, style.glint, 1.1);
        pole.drawRoundRect(-3.8, -h + 22, 7.6, 4, 2, 2, 2, 2, style.gold, OUTLINE, 1);
        const cloth = this.cloth.graphics;
        cloth.clear();
        this.cloth.pos(2, -h + 7).scale(CLOTH_SCALE, CLOTH_SCALE);
        if (kind === "briefs") {
            pole.drawCircle(0, -h, 4.8, style.gold, OUTLINE, 1.7);
            cloth.drawPoly(0, 0, [0, 0, 9, 2, 23, 0, 31, 6, 28, 18, 19, 15, 15, 12, 9, 19, 3, 17],
                "#f2605e", OUTLINE, 1.7);
            cloth.drawLines(0, 0, [0, 0, 9, 2, 23, 0, 31, 6], "#ffe5ad", 2.4);
            cloth.drawCircle(10, 9, 1.8, "#ffe0ac");
            cloth.drawCircle(23, 8, 1.5, "#ffe0ac");
        } else if (kind === "bra") {
            pole.drawPoly(0, -h, [0, -7, 5, 0, 0, 5, -5, 0], style.gold, OUTLINE, 1.7);
            cloth.drawLines(0, 0, [0, 0, 7, 0, 11, 7, 14, 2, 24, 3, 28, 10, 31, 3], "#b94b85", 2.3);
            cloth.drawPoly(0, 0, [2, 8, 6, 5, 12, 7, 16, 13, 19, 11, 23, 7, 29, 7, 33, 11, 31, 18, 24, 20, 18, 17, 15, 17, 9, 20, 3, 17],
                "#e986c3", OUTLINE, 1.7);
            cloth.drawLines(0, 0, [5, 12, 8, 9, 11, 10], "#ffd9e9", 1.7);
            cloth.drawLines(0, 0, [23, 12, 26, 10, 29, 11], "#ffd9e9", 1.7);
            cloth.drawCircle(17, 14, 1.8, "#ffe285");
        } else {
            pole.drawRoundRect(-3, -h - 4, 14, 6, 3, 3, 3, 3, style.gold, OUTLINE, 1.7);
            pole.drawLine(-4.5, -h + 12, 4.5, -h + 12, style.glint, 2.3);
            cloth.drawPoly(0, 0, [0, 0, 14, 1, 18, 11, 28, 11, 33, 15, 31, 21, 24, 24, 15, 21, 10, 19, 7, 13],
                "#69c7a1", OUTLINE, 1.7);
            cloth.drawLine(3, 4, 14, 5, "#ffe297", 2.5);
            cloth.drawLine(5, 8, 15, 9, "#eaf2bb", 2);
            cloth.drawLines(0, 0, [25, 13, 28, 15, 28, 18], "#d0f3b1", 1.7);
        }
    }
}
