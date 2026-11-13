import { C } from "./UiTheme";

/** 主HUD保持象牙白信息区，沿用明亮田园的麦金/木色细边；不再为三种资源各画一个框。 */
export function drawHudSurface(sprite: Laya.Sprite, width: number, height: number, footer: boolean) {
    const g = sprite.graphics;
    if (footer) g.drawRoundRect(0, 0, width, height, 20, 20, 0, 0, C.cream);
    else g.drawRect(0, 0, width, height, C.cream);
    g.drawLine(footer ? 20 : 0, footer ? 2 : height - 2, width - (footer ? 20 : 0), footer ? 2 : height - 2, C.gold, 3);
    g.drawLine(footer ? 20 : 0, footer ? 5 : height - 5, width - (footer ? 20 : 0), footer ? 5 : height - 5, "#fffbe9", 2);
}

