/** 已确认高清UI稿中的通用小图标。64逻辑像素母版由原生矢量绘制，避免为尺寸/颜色变体增加图片。
 * 只替换通用UI图标，人物身份头像、建筑和场景图片继续使用原有资源入口。
 */
const G = { outline: "#805025", dark: "#513322", gold: "#ffc45c", goldLight: "#ffe49d", wood: "#c98a49", woodLight: "#efbb74", cream: "#fff4d9", green: "#6c8845", red: "#e8634d", blue: "#6f95a4", skin: "#efc594" };
type Painter = (s: Laya.Sprite) => void;
const line = (g: Laya.Graphics, points: number[], color = G.outline, width = 2.6) => g.drawLines(0, 0, points, color, width);
const poly = (g: Laya.Graphics, points: number[], color: string, edge = G.outline, width = 2.2) => g.drawPoly(0, 0, points, color, edge, width);

function heart(s: Laya.Sprite) {
    const g = s.graphics;
    g.drawCircle(23, 25, 13, G.red); g.drawCircle(41, 25, 13, G.red);
    poly(g, [11, 29, 32, 53, 53, 29], G.red, G.red, 1);
    g.drawCircle(19, 21, 3, "#ffaf98");
}
function food(s: Laya.Sprite) {
    const g = s.graphics;
    line(g, [26, 59, 34, 9], G.outline, 3.5);
    line(g, [28, 57, 15, 24], G.outline, 3);
    line(g, [28, 56, 50, 24], G.outline, 3);
    for (let i = 0; i < 4; i++) {
        const y = 18 + i * 8, x = 32 - i;
        poly(g, [x, y + 4, x - 10, y - 1, x - 11, y - 10, x - 3, y - 6], G.gold, G.outline, 1.8);
        poly(g, [x + 2, y + 6, x + 12, y - 1, x + 13, y - 10, x + 5, y - 5], G.goldLight, G.outline, 1.8);
    }
    poly(g, [18, 39, 9, 33, 8, 23, 15, 28], G.gold, G.outline, 1.8);
    poly(g, [39, 42, 51, 38, 56, 29, 47, 31], G.gold, G.outline, 1.8);
    line(g, [22, 52, 33, 55], "#b97532", 3);
}
function wood(s: Laya.Sprite) {
    const g = s.graphics;
    const log = (x: number, y: number) => {
        poly(g, [x, y - 8, x + 20, y - 18, x + 29, y - 14, x + 30, y - 1, x + 12, y + 10, x, y + 8], G.wood);
        line(g, [x + 5, y - 5, x + 25, y - 13], G.woodLight, 2);
        g.drawCircle(x + 4, y + 1, 10, G.woodLight, G.outline, 2.2);
        g.drawCircle(x + 4, y + 1, 5.2, null, "#cf9856", 1.4);
    };
    log(22, 27); log(33, 44); log(8, 44);
}
function portrait(s: Laya.Sprite, x: number, y: number, female: boolean, scale = 1) {
    const head = new Laya.Sprite(); head.pos(x, y).scale(scale, scale); s.addChild(head); const g = head.graphics;
    poly(g, [0, 21, -12, 30, -14, 42, 14, 42, 12, 30], female ? "#bd7544" : G.green, G.dark, 1.8);
    if (female) { g.drawCircle(10, 11, 9, G.dark); g.drawCircle(-9, 10, 7, G.dark); }
    g.drawCircle(0, 12, 11, G.skin, G.dark, 1.8);
    poly(g, [-11, 10, -11, 2, -5, -3, 4, -2, 12, 4, 10, 12, 5, 6, 0, 8, -4, 4, -6, 10], G.dark, G.dark, 1);
    g.drawCircle(-4, 13, 1.2, G.dark); g.drawCircle(5, 13, 1.2, G.dark);
    line(g, [-3, 19, 1, 21, 5, 18], "#b87542", 1.3);
    poly(g, [-8, 28, 0, 33, 7, 27, 2, 39], G.cream, G.outline, 1);
    if (female) g.drawCircle(10, 1, 3.2, G.red);
}
function population(s: Laya.Sprite) { portrait(s, 20, 10, false, 1.02); portrait(s, 43, 15, true, .92); }
function house(s: Laya.Sprite) {
    const g = s.graphics;
    poly(g, [12, 30, 32, 10, 52, 30, 52, 56, 12, 56], G.cream);
    poly(g, [6, 30, 32, 5, 58, 30, 53, 35, 32, 15, 11, 35], "#b96334");
    g.drawRoundRect(25, 37, 15, 19, 2, 2, 0, 0, G.wood, G.outline, 2);
    g.drawCircle(36, 47, 1.5, G.cream);
}
function family(s: Laya.Sprite) {
    const left = new Laya.Sprite(); left.pos(0, 10).scale(.59, .71); house(left); s.addChild(left);
    const right = new Laya.Sprite(); right.pos(28, 3).scale(.59, .82); house(right); s.addChild(right);
    const mark = new Laya.Sprite(); mark.pos(24, 29).scale(.3, .3); heart(mark); s.addChild(mark);
}
function hammer(s: Laya.Sprite) {
    const g = s.graphics;
    poly(g, [31, 27, 40, 33, 22, 58, 13, 52], G.wood, G.outline, 2.4);
    poly(g, [24, 8, 55, 26, 49, 38, 18, 20], G.woodLight, G.outline, 2.6);
    line(g, [25, 12, 49, 26], "#ffdda4", 2.6);
    line(g, [19, 48, 29, 35], "#e4ad68", 2);
}
function view(s: Laya.Sprite) {
    const g = s.graphics;
    poly(g, [4, 34, 17, 23, 32, 18, 47, 23, 60, 34, 47, 45, 32, 50, 17, 45], G.cream, G.outline, 2.7);
    g.drawCircle(32, 34, 11, G.woodLight, G.outline, 2.1); g.drawCircle(32, 34, 5.5, G.dark); g.drawCircle(29, 30, 2.2, "#fffdfa");
    line(g, [32, 3, 32, 11]); line(g, [16, 7, 19, 13]); line(g, [48, 7, 45, 13]);
}
function trophy(s: Laya.Sprite) {
    const g = s.graphics;
    g.drawRoundRect(5, 14, 54, 25, 7, 7, 10, 10, null, G.outline, 3);
    g.drawRoundRect(8, 17, 48, 19, 5, 5, 8, 8, null, G.gold, 3);
    poly(g, [15, 9, 49, 9, 46, 34, 39, 42, 25, 42, 18, 34], G.gold, G.outline, 2.5);
    poly(g, [20, 12, 27, 12, 28, 34, 23, 31], G.goldLight, G.goldLight, 1);
    g.drawRect(29, 42, 6, 10, G.gold, G.outline, 1.7);
    g.drawRoundRect(18, 51, 28, 7, 3, 3, 2, 2, G.woodLight, G.outline, 2);
    g.drawCircle(34, 24, 5, "#ffeb9c", "#d69a3c", 1.5);
}
function baby(s: Laya.Sprite) {
    const g = s.graphics;
    g.drawRoundRect(14, 23, 36, 35, 15, 15, 17, 17, "#f2d6a4", G.outline, 2.2);
    g.drawCircle(32, 21, 15, G.skin, G.outline, 2.2);
    line(g, [29, 7, 34, 6, 36, 10], G.dark, 2.3);
    g.drawCircle(26, 21, 1.5, G.dark); g.drawCircle(38, 21, 1.5, G.dark);
    line(g, [29, 28, 33, 30, 36, 27], "#b87542", 1.7);
    line(g, [17, 37, 43, 51], "#c59b67", 2);
}
function shield(s: Laya.Sprite) {
    const g = s.graphics;
    poly(g, [32, 5, 54, 14, 52, 39, 44, 51, 32, 60, 20, 51, 12, 39, 10, 14], G.woodLight);
    poly(g, [32, 12, 47, 18, 45, 37, 39, 46, 32, 52, 25, 46, 19, 37, 17, 18], G.cream, G.outline, 1.5);
    line(g, [32, 18, 32, 43], G.wood, 5); line(g, [22, 29, 42, 29], G.wood, 5);
}
function journal(s: Laya.Sprite) {
    const g = s.graphics;
    g.drawRoundRect(9, 9, 39, 47, 5, 5, 5, 5, G.cream, G.outline, 3);
    line(g, [17, 20, 36, 20]); line(g, [17, 28, 31, 28]); line(g, [17, 42, 34, 42]);
    poly(g, [33, 35, 50, 9, 57, 14, 40, 40, 31, 45], G.woodLight, G.outline, 2);
    poly(g, [31, 45, 33, 35, 40, 40], G.dark, G.dark, 1);
}
function arrow(s: Laya.Sprite) {
    const g = s.graphics; line(g, [13, 53, 48, 15], G.wood, 5);
    poly(g, [40, 12, 58, 6, 52, 25, 48, 18], "#cbd1ce", G.outline, 2);
    poly(g, [11, 43, 9, 55, 21, 53, 23, 41], G.cream, G.outline, 2);
}
function stone(s: Laya.Sprite) {
    const g = s.graphics; poly(g, [9, 42, 18, 19, 34, 9, 53, 23, 58, 45, 43, 55, 19, 54], "#a59b87");
    poly(g, [18, 19, 34, 9, 41, 30, 28, 44, 9, 42], "#c8bdab", "#c8bdab", 0); line(g, [9, 42, 28, 44, 43, 55], "#8a7e69", 2);
}
function ice(s: Laya.Sprite) {
    const g = s.graphics; poly(g, [32, 5, 51, 24, 46, 49, 32, 60, 16, 47, 13, 24], "#8bd5db", "#4e8893");
    poly(g, [32, 5, 32, 60, 16, 47, 13, 24], "#bcecf0", "#bcecf0", 0); line(g, [14, 24, 32, 31, 51, 24], "#eaffff", 2);
}
const PAINTERS: Record<string, Painter> = {
    icon_food: food, icon_wood: wood, icon_logging: wood, icon_population: population, icon_house: house,
    icon_family: family, icon_build: hammer, icon_view: view, icon_trophy: trophy, icon_heart: heart,
    icon_baby: baby, icon_shield: shield, icon_settings: journal, icon_journal: journal,
    icon_arrow: arrow, icon_stone: stone, icon_slow: ice,
    icon_pause: s => { s.graphics.drawRoundRect(13, 11, 13, 42, 3, 3, 3, 3, G.cream); s.graphics.drawRoundRect(38, 11, 13, 42, 3, 3, 3, 3, G.cream); },
    icon_play: s => poly(s.graphics, [17, 10, 53, 32, 17, 54], G.cream, G.cream, 1),
    icon_speed: s => { poly(s.graphics, [5, 13, 30, 32, 5, 51], "#986128", "#986128", 1); poly(s.graphics, [32, 13, 57, 32, 32, 51], "#986128", "#986128", 1); },
    icon_king_heart: s => { s.graphics.drawCircle(32, 32, 27, "#e84d38", "#fff1d1", 2); const h = new Laya.Sprite(); h.pos(12, 11).scale(.62, .62); h.graphics.drawCircle(23, 25, 13, G.cream); h.graphics.drawCircle(41, 25, 13, G.cream); poly(h.graphics, [11, 29, 32, 53, 53, 29], G.cream, G.cream, 1); s.addChild(h); }
};
export function drawUiGlyph(sprite: Laya.Sprite, id: string, width: number, height: number): boolean {
    const paint = PAINTERS[id];
    if (!paint) return false;
    const drawing = new Laya.Sprite(); drawing.name = "UiGlyph"; drawing.mouseEnabled = false;
    drawing.scale(width / 64, height / 64); sprite.addChild(drawing); paint(drawing); return true;
}
