/** 720 逻辑宽度的纯色卡通界面配色，来自定稿。语义色同时供按钮区分操作类型。 */
export const C = {
    ink: "#53372b", muted: "#695641", cream: "#fff7dd", paper: "#f6e5bb",
    green: "#3f6935", gold: "#ac6b16", red: "#a23f31", grass: "#a0aa72", night: "#354f53",
    outline: "#654732", lightEdge: "#fff9e9",
    // 现有图标和场景色保留各自语义。
    status: "#89443f", trim: "#c4a26e", petal: "#f7dda0", petalCenter: "#d96f64",
    selection: "#678c50", coral: "#d96f64", blue: "#687ba7", fern: "#7fac61",
    fernArt: "#dce6b7", blueArt: "#d5e0ed",
    // 色带用深色阶支撑浅字。蓝灰锁槽和高亮绿框是两种独立状态。
    dayRibbon: "#855c3d", nightRibbon: "#4e5f83", lockedFill: "#d6ddec", lockedRim: "#7787a6",
    actionFace: "#ffc65d", actionLip: "#d28a42",
    // 木色用于资源、成长及米黄底板上的屏中提示；不改变资源是否足够的判定。
    timber: "#9a591f",
    // 浅麦金 Tip 底图的暖棕正文，中心区域对比度≥5.26:1；仅用于短提示，不改变警示语义。
    tipInk: "#754317",
    // 用户指定：姓名按性别区分；深蓝/橘黄的深色阶保证羊皮纸背景上的可读性。
    maleName: "#276b9c", femaleName: "#90541c",
    heroName: "#783b98", legendaryName: "#9b590f"
};
/** 既有浅字在奶油色面板上改用深棕色。按钮面层继续使用自身的对比色。 */
export const PANEL_TEXT: Readonly<Record<string, string>> = { [C.cream]: C.ink };
/** 标题/正文/按钮按手机约一半缩放后的阅读尺寸设置；滚动列表保持同一列宽和行距。 */
export const UI = {
    body: 28, button: 30, title: 38, mapLabel: 24,
    panelWidth: 668, panelHeight: 860,
    inset: 34, contentWidth: 600, listTop: 222, listStep: 128, listHeight: 118,
    // 审稿尺寸（720 逻辑宽）。底部操作距外框 48，预留金边和回弹空间；单按钮居中，成对操作同高。
    action: { width: 320, height: 92, bottom: 48, pairHeight: 76 },
    // 带具体条件的家庭条目容纳姓名和两行原因；行高与步长一起使用，避免文字压住边框。
    conditionRowHeight: 170, conditionRowStep: 180,
    // 纯触控表现参数（逻辑像素）：给滑块留白，超过 8px 的移动视为拖动，避免抬指误点条目。
    scrollGutter: 16, scrollDragThreshold: 8, scrollThumbMin: 32, scrollWheelStep: 24,
    // 列表提醒使用独立角标，右上角预留，不跟操作按钮缩放。
    cellActionDot: { size: 24, right: 6, top: 4, clearRight: 36 },
    // 建设信息使用一行效果和一行费用，尾行留给必要限制。此高度也用于塔升级。
    buildRowHeight: 184, buildRowGap: 12,
    // Tip 总显示2秒（包含淡入/淡出），按用户指定；位置由GameLayout放在实际安全区中心。
    tipSeconds: 2, tipFadeIn: .16, tipFadeOut: .28, tipWidth: 600, tipFont: 30, tipMaxHeight: 800
} as const;
