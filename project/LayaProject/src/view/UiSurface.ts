import { C } from "./UiTheme";

/** 花谷主 HUD 使用暖象牙白和粉梅细边；不再为三种资源各画一个框。 */
export function drawHudSurface(sprite: Laya.Sprite, width: number, height: number, footer: boolean) {
    const g = sprite.graphics;
    if (footer) g.drawRoundRect(0, 0, width, height, 20, 20, 0, 0, C.cream);
    else g.drawRect(0, 0, width, height, C.cream);
    g.drawLine(footer ? 20 : 0, footer ? 2 : height - 2, width - (footer ? 20 : 0), footer ? 2 : height - 2, C.trim, 3);
    g.drawLine(footer ? 20 : 0, footer ? 5 : height - 5, width - (footer ? 20 : 0), footer ? 5 : height - 5, C.lightEdge, 2);
}


/** 奶油草莓底板试稿中的四朵花与散瓣。主枝宽 120 逻辑像素，位置由安全区及菜单留白决定。 */
const HUD_FLOWERS = {
    stem: "#d69a98", pink: "#f4b0bd", pale: "#ffd5d8", lilac: "#e3c6ea",
    center: "#da8796", bud: "#deb6c0", line: "#f2d8d7",
    branch: [[0, 0], [21, -13], [33, -16], [48, -6], [63, -14], [80, -29], [97, -26]],
    twig: [[29, -11], [37, -20], [54, -23]],
    buds: [[32, -18], [53, -18], [79, -18], [86, -33]],
    petals: [[102, -8, 3], [120, -20, 2], [111, -36, 2.5], [61, 0, 2]]
} as const;

export function drawHudFlowers(graphics: Laya.Graphics, width: number, y: number, footer: boolean) {
    const { stem, pale, pink, lilac, center, bud, line, branch, twig, buds, petals } = HUD_FLOWERS;
    const sprig = (x: number, originY: number, direction: number, vertical: number, main: boolean) => {
        const project = (dx: number, dy: number) => [x + direction * dx, originY + vertical * dy];
        for (const points of [branch, twig]) {
            const vertices: number[] = [];
            for (const [dx, dy] of points) vertices.push(...project(dx, dy));
            graphics.drawLines(0, 0, vertices, stem, 2);
        }
        const flowers = [[19, -10, 9, pale], [46, -10, main ? 15 : 12, pink], [62, -19, 8, lilac], [91, -25, 6, pale]] as const;
        for (const [dx, dy, radius, color] of flowers) {
            for (let i = 0; i < 5; i++) {
                const angle = i * Math.PI * 2 / 5 - Math.PI / 2;
                const [px, py] = project(dx + Math.cos(angle) * radius * .64, dy + Math.sin(angle) * radius * .64);
                graphics.drawCircle(px, py, radius * .57, color);
            }
            const [cx, cy] = project(dx, dy);
            graphics.drawCircle(cx, cy, radius * .24, center);
            graphics.drawCircle(cx - 1, cy - 1, radius * .09, C.cream);
        }
        for (const [dx, dy] of buds) {
            const [px, py] = project(dx + 3, dy - 4);
            graphics.drawCircle(px, py, 3, bud);
        }
        for (const [dx, dy, radius] of petals) {
            const [px, py] = project(dx, dy);
            graphics.drawCircle(px, py, radius, pale);
        }
    };
    sprig(10, y, 1, footer ? -1 : 1, true);
    if (footer) {
        sprig(width - 10, y + 2, -1, -1, false);
        // 细线只延伸到底栏两侧，给中间守夜圆钮和系统手势保留留白。
        for (const [x, dir] of [[45, 1], [width - 45, -1]])
            graphics.drawLines(x, y + 26, [0, 0, 43 * dir, -2, 82 * dir, -2, 105 * dir, -2, 133 * dir, 0], line, 1.8);
    } else {
        // 右上只放几片散瓣，保留微信胶囊和人口栏的净空。
        for (const [inset, dy, radius] of [[40, 0, 3.8], [28, -9, 2.5], [19, -1, 2]])
            graphics.drawCircle(width - inset, y + 76 + dy, radius, pale);
    }
}
