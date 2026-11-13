import { C } from "./UiTheme";

/** 高清田园 UI 的可伸缩皮肤。数值来自已确认设计稿，单位为720画布逻辑像素。
 * 原生圆角/路径替代像素边框，不增加贴图；边线和内高光不随面板中心拉伸而变粗。
 */
const SURFACES: Record<string, { fill: string; edge: string; inset: string; radius: number; raised?: boolean }> = {
    panel_parchment: { fill: "#fff8ed", edge: "#b57c36", inset: "#fffdfa", radius: 22 },
    panel_card: { fill: "#fff5e5", edge: "#ceb794", inset: "#fffaf1", radius: 14 },
    panel_portrait_frame: { fill: "#f5e8cd", edge: "#d1b184", inset: "#fff7e8", radius: 16 },
    panel_button_green: { fill: "#62853b", edge: "#3f5e25", inset: "#a4bd78", radius: 18, raised: true },
    panel_button_gold: { fill: "#ffcc69", edge: "#af6a20", inset: "#ffedb2", radius: 18, raised: true },
    panel_button_red: { fill: "#b86243", edge: "#84422f", inset: "#e2a287", radius: 18, raised: true },
    panel_button_disabled: { fill: "#d7d1c5", edge: "#a39a8a", inset: "#e8e2d8", radius: 18 },
    panel_anchored_tip: { fill: "#fff4d9", edge: "#bc8338", inset: "#fffbee", radius: 22 },
    panel_tip: { fill: "#fff4d9", edge: "#bc8338", inset: "#fffbee", radius: 22 }
};

/** 仅识别这套UI皮肤；非UI资源仍由SpriteFrames原有九宫格入口绘制。 */
export function drawUiSurface(sprite: Laya.Sprite, id: string, width: number, height: number): boolean {
    const style = SURFACES[id];
    if (!style) return false;
    const g = sprite.graphics, r = Math.min(style.radius, width / 4, height / 4);
    g.drawRoundRect(1, 1, width - 2, height - 2, r, r, r, r, style.fill, style.edge, id === "panel_card" ? 1.5 : 2);
    g.drawRoundRect(3.5, 3.5, width - 7, height - 7, r - 2, r - 2, r - 2, r - 2, null, style.inset, 1);
    if (style.raised) {
        // 高光和底部压边均留在按钮内部，不能重新出现用户已移除的外部黑阴影。
        g.drawPath(0, 0, [["moveTo", 7, r + 3], ["arcTo", 7, 6, r + 7, 6, r - 2], ["lineTo", width - r - 7, 6], ["arcTo", width - 7, 6, width - 7, r + 3, r - 2]], null,
            { strokeStyle: style.inset, lineWidth: 2, lineJoin: "round", lineCap: "round" });
        g.drawPath(0, 0, [["moveTo", r, height - 5], ["lineTo", width - r, height - 5]], null,
            { strokeStyle: style.edge, lineWidth: 2, lineCap: "round" });
    }
    return true;
}

/** 顶部资源与底部操作共用无多层框的象牙白底；只保留场景交界的一条细线。 */
export function drawHudSurface(sprite: Laya.Sprite, width: number, height: number, footer: boolean) {
    const g = sprite.graphics;
    if (footer) g.drawRoundRect(0, 0, width, height, 20, 20, 0, 0, C.cream);
    else g.drawRect(0, 0, width, height, C.cream);
    g.drawLine(footer ? 20 : 0, footer ? 1 : height - 1, width - (footer ? 20 : 0), footer ? 1 : height - 1, "#dfc69f", 1.5);
}

/** 与气泡主体共用颜色；顶边不描线，重叠部分遮住主体边缘形成连续指角。 */
export function drawUiTipTail(sprite: Laya.Sprite, width: number, height: number) {
    const style = SURFACES.panel_anchored_tip;
    sprite.graphics.drawPoly(0, 0, [0, 0, width / 2, height - 1, width, 0], style.fill);
    sprite.graphics.drawPath(0, 0, [["moveTo", 0, 0], ["lineTo", width / 2, height - 1], ["lineTo", width, 0]], null,
        { strokeStyle: style.edge, lineWidth: 2, lineJoin: "round", lineCap: "round" });
}
