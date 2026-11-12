/** 720 逻辑宽度的视觉规范。来自三屏概念图的木色、羊皮纸、森林绿；仅调整可读性与美术，不参与业务。 */
export const C = {
    ink: "#48311f", muted: "#796348", cream: "#fff1cf", paper: "#eddbad",
    green: "#557637", gold: "#d49a35", red: "#af5338", grass: "#97af70", night: "#354f53",
    outline: "#493420", lightEdge: "#fff9e7",
    // 木色用于资源与成长信息强调；不改变资源是否足够的判定。
    timber: "#9a591f",
    // 浅麦金 Tip 底图的暖棕正文，中心区域对比度≥5.26:1；仅用于短提示，不改变警示语义。
    tipInk: "#6b4928",
    // 用户指定：姓名按性别区分；深蓝/橘黄的深色阶保证羊皮纸背景上的可读性。
    maleName: "#276b9c", femaleName: "#ba741a"
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
    pressedOffset: 4,
    // Tip 总显示2秒（包含淡入/淡出），按用户指定；位置由GameLayout放在实际安全区中心。
    tipSeconds: 2, tipFadeIn: .16, tipFadeOut: .28, tipWidth: 600, tipFont: 30, tipMaxHeight: 800
} as const;
