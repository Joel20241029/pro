import { C } from "./UiTheme";

/** 顶部资源与底部操作共用无多层框的象牙白底；只保留场景交界的一条细线。 */
export function drawHudSurface(sprite: Laya.Sprite, width: number, height: number, footer: boolean) {
    const g = sprite.graphics;
    if (footer) g.drawRoundRect(0, 0, width, height, 20, 20, 0, 0, C.cream);
    else g.drawRect(0, 0, width, height, C.cream);
    g.drawLine(footer ? 20 : 0, footer ? 1 : height - 1, width - (footer ? 20 : 0), footer ? 1 : height - 1, "#dfc69f", 1.5);
}

