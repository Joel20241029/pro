import { DRAGON_POISON, HAND_SPEED, TIMED_BLAST } from "../config/TacticConfig";

/** 通用符号和复用到战场的泻火弹保留矢量。 */
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
    icon_back: s => line(s.graphics, [41, 11, 20, 32, 41, 53], G.dark, 8),
    icon_daily_tasks: s => {
        const g = s.graphics;
        g.drawRoundRect(10, 10, 44, 49, 5, 5, 5, 5, G.cream, G.outline, 3);
        g.drawRoundRect(21, 6, 22, 12, 4, 4, 4, 4, G.woodLight, G.outline, 2.5);
        for (const y of [29, 41, 52]) {
            line(g, [18, y - 2, 21, y + 1, 27, y - 5], "#528035", 3);
            line(g, [33, y - 1, 46, y - 1], G.outline, 2.5);
        }
    },
    [DRAGON_POISON.icon]: s => {
        const g = s.graphics;
        poly(g, [24, 19, 40, 19, 40, 28, 51, 39, 50, 50, 42, 57, 22, 57, 14, 50, 13, 39, 24, 28], "#5b347e", "#251735", 3);
        g.drawRoundRect(22, 10, 20, 12, 3, 3, 3, 3, "#d5b778", "#78532d", 2.2);
        poly(g, [16, 42, 26, 38, 37, 42, 49, 38, 47, 49, 40, 54, 24, 54, 18, 49], "#ae69df", "#6b3697", 1.8);
        g.drawCircle(27, 47, 2.8, "#f3d4ff");
        g.drawCircle(37, 43, 2.2, "#f3d4ff");
        line(g, [20, 36, 27, 30, 27, 25], "#f7e3ff", 2.6);
    },
    icon_slot_lock: s => {
        const g = s.graphics;
        line(g, [19, 31, 19, 20, 23, 12, 29, 8, 35, 8, 41, 12, 45, 20, 45, 31], "#c7ae75", 6);
        g.drawRoundRect(13, 26, 38, 29, 5, 5, 5, 5, "#d8bd80", "#785b32", 2);
        g.drawCircle(32, 37, 4, "#785b32");
        line(g, [32, 38, 32, 46], "#785b32", 4);
    },
    [HAND_SPEED.icon]: s => {
        const g = s.graphics;
        line(g, [10, 22, 24, 22], "#fbb94e", 4);
        line(g, [6, 33, 20, 33], "#fbb94e", 4);
        line(g, [13, 43, 23, 43], "#fbb94e", 4);
        poly(g, [37, 5, 25, 32, 36, 31, 27, 58, 55, 26, 43, 26, 54, 7], "#ffbd3e");
        line(g, [40, 10, 33, 25, 39, 24], "#fff3a7", 3);
    },
    [TIMED_BLAST.icon]: s => {
        const g = s.graphics;
        line(g, [36, 23, 43, 15, 48, 15, 51, 10], "#6b3c25", 5);
        g.drawCircle(29, 36, 20, "#47352d", "#211b1b", 2.5);
        g.drawCircle(25, 32, 12, "#59443a");
        line(g, [15, 31, 20, 24, 29, 21], "#bf8658", 3);
        poly(g, [49, 9, 48, 2, 54, 6, 61, 4, 57, 10, 61, 16, 54, 13, 49, 18, 50, 12], "#ffbb40", "#a95023", 1.6);
        g.drawCircle(53, 10, 3, "#fff1a1");
    },
    icon_action_dot: s => {
        s.graphics.drawCircle(32, 33, 28, "#a52520");
        s.graphics.drawCircle(32, 30, 25, "#f0312f", "#fff2bf", 4);
        s.graphics.drawCircle(25, 21, 6, "#ffb398");
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
