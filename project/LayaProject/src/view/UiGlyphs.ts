/** 暂停/播放/倍速等通用符号保留矢量；游戏题材图标统一使用高清原画。 */
// 奶油按钮上的暂停/播放沿用既有倍速图标的木棕色，原绿色按钮的浅色版本继续保留。
const G = { outline: "#805025", dark: "#513322", woodLight: "#efbb74", cream: "#fff4d9", control: "#986128" };
type Painter = (s: Laya.Sprite) => void;
const line = (g: Laya.Graphics, points: number[], color = G.outline, width = 2.6) => g.drawLines(0, 0, points, color, width);
const poly = (g: Laya.Graphics, points: number[], color: string, edge = G.outline, width = 2.2) => g.drawPoly(0, 0, points, color, edge, width);

function journal(s: Laya.Sprite) {
    const g = s.graphics;
    g.drawRoundRect(9, 9, 39, 47, 5, 5, 5, 5, G.cream, G.outline, 3);
    line(g, [17, 20, 36, 20]); line(g, [17, 28, 31, 28]); line(g, [17, 42, 34, 42]);
    poly(g, [33, 35, 50, 9, 57, 14, 40, 40, 31, 45], G.woodLight, G.outline, 2);
    poly(g, [31, 45, 33, 35, 40, 40], G.dark, G.dark, 1);
}
const PAINTERS: Record<string, Painter> = {
    icon_settings: journal, icon_journal: journal,
    icon_action_dot: s => {
        s.graphics.drawCircle(32, 32, 27, "#e94735", G.cream, 5);
        s.graphics.drawCircle(25, 23, 7, "#ff9c79");
    },
    icon_build_plus: s => {
        // 轻立体加号：金色外沿、奶油描边和草绿内芯；不依赖字体，也不增加位图包体。
        const p = [24, 7, 40, 7, 40, 24, 57, 24, 57, 40, 40, 40, 40, 57, 24, 57, 24, 40, 7, 40, 7, 24, 24, 24];
        poly(s.graphics, p, "#75b52e", "#a87525", 9);
        poly(s.graphics, p, "#75b52e", G.cream, 5);
        line(s.graphics, [28, 12, 28, 28, 12, 28], "#d7f6a3", 3);
    },
    icon_pause: s => { s.graphics.drawRoundRect(13, 11, 13, 42, 3, 3, 3, 3, G.cream); s.graphics.drawRoundRect(38, 11, 13, 42, 3, 3, 3, 3, G.cream); },
    icon_play: s => poly(s.graphics, [17, 10, 53, 32, 17, 54], G.cream, G.cream, 1),
    icon_pause_dark: s => { s.graphics.drawRoundRect(13, 11, 13, 42, 3, 3, 3, 3, G.control); s.graphics.drawRoundRect(38, 11, 13, 42, 3, 3, 3, 3, G.control); },
    icon_play_dark: s => poly(s.graphics, [17, 10, 53, 32, 17, 54], G.control, G.control, 1),
    icon_speed: s => { poly(s.graphics, [5, 13, 30, 32, 5, 51], G.control, G.control, 1); poly(s.graphics, [32, 13, 57, 32, 32, 51], G.control, G.control, 1); },
    icon_king_heart: s => { s.graphics.drawCircle(32, 32, 27, "#e84d38", "#fff1d1", 2); const h = new Laya.Sprite(); h.pos(12, 11).scale(.62, .62); h.graphics.drawCircle(23, 25, 13, G.cream); h.graphics.drawCircle(41, 25, 13, G.cream); poly(h.graphics, [11, 29, 32, 53, 53, 29], G.cream, G.cream, 1); s.addChild(h); }
};
export function drawUiGlyph(sprite: Laya.Sprite, id: string, width: number, height: number): boolean {
    const paint = PAINTERS[id];
    if (!paint) return false;
    const drawing = new Laya.Sprite(); drawing.name = "UiGlyph"; drawing.mouseEnabled = false;
    drawing.scale(width / 64, height / 64); sprite.addChild(drawing); paint(drawing); return true;
}
