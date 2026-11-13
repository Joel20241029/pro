/** 720逻辑宽度的明亮田园规范，来源为已确认08号设计稿；全界面共用，只影响美术与阅读。 */
export const C = {
    ink: "#4c2c12", muted: "#696a50", cream: "#fff5dd", paper: "#f5e3b2",
    green: "#326b1b", gold: "#edaa17", red: "#bf3c1d", grass: "#97af70", night: "#354f53",
    outline: "#493420", lightEdge: "#fff9e7",
    // 木色用于资源、成长及米黄底板上的屏中提示；不改变资源是否足够的判定。
    timber: "#9a591f",
    // 浅麦金 Tip 底图的暖棕正文，中心区域对比度≥5.26:1；仅用于短提示，不改变警示语义。
    tipInk: "#754317",
    // 用户指定：姓名按性别区分；深蓝/橘黄的深色阶保证羊皮纸背景上的可读性。
    maleName: "#276b9c", femaleName: "#ba741a"
};
/** 绿色内底上的语义色。仅供面板正文/标题与说明滚动层，奶油卡片和HUD保留深色正文。
 * 状态和性别仍用同一含义，浅色阶配深绿细描边，避免直接把深绿字放在绿色底板上。 */
export const PANEL_TEXT: Readonly<Record<string, string>> = {
    [C.ink]: "#fff9e9", [C.muted]: "#f3edc6", [C.green]: "#f1ffc4",
    [C.timber]: "#ffe4a2", [C.red]: "#ffcf9f", [C.maleName]: "#c8edff", [C.femaleName]: "#ffe1a0"
};
/** 标题/正文/按钮按手机约一半缩放后的阅读尺寸设置；滚动列表保持同一列宽和行距。 */
export const UI = {
    body: 28, button: 30, title: 38, mapLabel: 24,
    panelWidth: 668, panelHeight: 860,
    inset: 34, contentWidth: 600, listTop: 222, listStep: 128, listHeight: 118,
    // 带具体条件的家庭/照料条目容纳姓名和两行原因；行高与步长一起使用，避免文字压住边框。
    conditionRowHeight: 170, conditionRowStep: 180,
    // 纯触控表现参数（逻辑像素）：给滑块留白，超过 8px 的移动视为拖动，避免抬指误点条目。
    scrollGutter: 16, scrollDragThreshold: 8, scrollThumbMin: 32, scrollWheelStep: 24,
    pressedOffset: 3,
    // Tip 总显示2秒（包含淡入/淡出），按用户指定；位置由GameLayout放在实际安全区中心。
    tipSeconds: 2, tipFadeIn: .16, tipFadeOut: .28, tipWidth: 600, tipFont: 30, tipMaxHeight: 800
} as const;
