/** 已确认的战技设计稿在720逻辑宽度下的排版参数。
 * 侧边徽章共享按压容器，卡片图标/文字/按钮分区；只影响表现，不参与学习资格或扣费。
 */
export const TACTIC_UI = {
    // 一号塔点击区左边界为107；徽章右沿102，四种屏幕和三类塔均保留5px逻辑间隔。
    side: { x: 6, top: 12, size: 96, gap: 12, icon: 44, iconY: 8, textY: 55, font: 26,
        // 四、五入口在短屏缩小间距及面高，保持左边界和塔点击区的横向间隔。
        compactGap: 8, minSize: 74 },
    // 确认面板集中展示解锁条件、费用及操作，单位为720宽布局中的逻辑像素。
    unlock: { width: 544, conditionY: 106, costY: 185, reasonY: 235, footerY: 274, cancelX: 55, cancelW: 170, confirmX: 249, confirmW: 258 },
    // 怜悯确认框使用独立边距与扣费行。缺料提示保留专行，按钮果冻回弹也留有余量。
    mercy: {
        width: 620, inset: 44, questionY: 117, effectY: 173, effectH: 80,
        costY: 276, costH: 60, readoutH: 46, reasonY: 351,
        footerY: 395, cancelX: 56, cancelW: 170, confirmX: 246, confirmW: 268
    },
    // 展开传闻高度按真实文字测量，这里只定义边距、标题区和动作行。
    detail: { top: 112, width: 600, inset: 28, icon: 128, loreTop: 164, gap: 20 }
} as const;

/** 分波解锁演出与左侧入口共用图标和身份，调整顺序须同时检查飞行落点。 */
export const SIDE_FEATURES = [
    { title: "排行", name: "RankingButton", panel: "ranking", icon: "icon_trophy", unlock: "好友守村榜" },
    { title: "战技", name: "TacticsButton", panel: "tactics", icon: "icon_tactic_scroll", unlock: "守村战技" },
    { title: "任务", name: "DailyTasksButton", panel: "dailyTasks", icon: "icon_daily_tasks", unlock: "每日任务" },
    { title: "背包", name: "BackpackButton", panel: "backpack", icon: "icon_backpack", unlock: "背包" },
    { title: "商城", name: "ShopButton", panel: "shop", icon: "icon_shop", unlock: "商城" }
] as const;
