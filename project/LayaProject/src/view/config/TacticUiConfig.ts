/** 已确认的战技设计稿在720逻辑宽度下的排版参数。
 * 侧边徽章共享按压容器，卡片图标/文字/按钮分区；只影响表现，不参与学习资格或扣费。
 */
export const TACTIC_UI = {
    // 一号塔点击区左边界为107；徽章右沿102，四种屏幕和三类塔均保留5px逻辑间隔。
    side: { x: 6, top: 12, size: 96, gap: 12, icon: 44, iconY: 8, textY: 55, font: 26 },
    // 紧凑条目留一行给费用、限制及操作。战斗时在列表下单独说明暂不可换。
    rowHeight: 174, rowStep: 186, footer: 54,
    // 圆槽图标与短标签共用一列，状态行留给当前装配和卸下操作。
    slots: { top: 109, x: 34, width: 190, gap: 15, size: 82, icon: 48, captionH: 32, actionY: 118, actionH: 38 },
    // 确认面板集中展示解锁条件、费用及操作，单位为720宽布局中的逻辑像素。
    unlock: { width: 544, height: 364, conditionY: 106, costY: 185, reasonY: 235, footerY: 274, buttonH: 68 },
    // 怜悯确认框使用独立边距与扣费行。缺料提示保留专行，按钮果冻回弹也留有余量。
    mercy: {
        width: 620, height: 500, inset: 44, questionY: 117, effectY: 173, effectH: 80,
        costY: 276, costH: 60, readoutH: 46, reasonY: 351,
        footerY: 407, buttonH: 64, cancelW: 218, confirmW: 282
    },
    // 提示卡比下面的列表窄，增加高度、间距和浮层阴影；引导期间的面板加高以保留短屏列表空间。
    slotGuide: { width: 568, height: 112, gap: 18, portrait: 68, skipW: 96, spotlightInset: 4 },
    icon: 96, rowTextX: 136, rowTextWidth: 420,
    actionX: 376, actionY: 112, actionWidth: 188, actionHeight: 48,
    // 展开传闻高度按真实文字测量，这里只定义边距、标题区和动作行。
    detail: { top: 112, width: 600, inset: 28, icon: 96, loreTop: 164, actionHeight: 66, gap: 20 }
} as const;

/** 分波解锁演出与左侧入口共用图标和身份，调整顺序须同时检查飞行落点。 */
export const SIDE_FEATURES = [
    { title: "排行", name: "RankingButton", panel: "ranking", icon: "icon_trophy", unlock: "好友守村榜" },
    { title: "战技", name: "TacticsButton", panel: "tactics", icon: "icon_tactic_scroll", unlock: "守村战技" },
    { title: "任务", name: "DailyTasksButton", panel: "dailyTasks", icon: "icon_daily_tasks", unlock: "每日任务" }
] as const;
