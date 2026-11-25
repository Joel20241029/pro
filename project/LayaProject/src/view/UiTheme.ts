/** 720逻辑宽度的花谷村奶油草莓配色，来源为已确认的界面稿；全界面共用，只影响美术与阅读。 */
export const C = {
    ink: "#502f44", muted: "#665164", cream: "#fff4e4", paper: "#f5e3d7",
    green: "#326b1b", gold: "#edaa17", red: "#bf3c1d", grass: "#a0aa72", night: "#354f53",
    outline: "#4b2b3c", lightEdge: "#fff9ec",
    // 花谷布局使用的梅紫层级。正向数值仍用语义绿。
    status: "#95465c", trim: "#cb8998", petal: "#ffd9df", petalCenter: "#e49aab",
    // 木色用于资源、成长及米黄底板上的屏中提示；不改变资源是否足够的判定。
    timber: "#9a591f",
    // 浅麦金 Tip 底图的暖棕正文，中心区域对比度≥5.26:1；仅用于短提示，不改变警示语义。
    tipInk: "#754317",
    // 用户指定：姓名按性别区分；深蓝/橘黄的深色阶保证羊皮纸背景上的可读性。
    maleName: "#276b9c", femaleName: "#90541c",
    heroName: "#783b98", legendaryName: "#9b590f"
};
/** 既有浅字在浅桃粉面板上改用深梅墨色。按钮面层继续使用自身的对比色。 */
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
    // 建设信息使用一行效果和一行费用，尾行留给必要限制。此高度也用于塔升级。
    buildRowHeight: 184, buildRowGap: 12,
    // Tip 总显示2秒（包含淡入/淡出），按用户指定；位置由GameLayout放在实际安全区中心。
    tipSeconds: 2, tipFadeIn: .16, tipFadeOut: .28, tipWidth: 600, tipFont: 30, tipMaxHeight: 800
} as const;
