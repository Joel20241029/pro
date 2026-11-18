/** 已确认的战技设计稿在720逻辑宽度下的排版参数。
 * 侧边徽章共享按压容器，卡片图标/文字/按钮分区；只影响表现，不参与学习资格或扣费。
 */
export const TACTIC_UI = {
    // 一号塔点击区左边界为107；徽章右沿102，四种屏幕和三类塔均保留5px逻辑间隔。
    side: { x: 6, top: 12, size: 96, gap: 12, icon: 44, iconY: 8, textY: 55, font: 26 },
    // 紧凑条目留一行给费用、限制及操作。战斗时在列表下单独说明暂不可换。
    listTop: 112, rowHeight: 174, rowStep: 186, footer: 54,
    // 三个等宽槽按钮及一行当选槽操作，同一张卡展示解锁材料。
    slots: { top: 108, x: 34, width: 190, gap: 15, height: 56, actionY: 68, actionH: 44, bodyGap: 124 },
    icon: 96, rowTextX: 136, rowTextWidth: 420,
    actionX: 376, actionY: 112, actionWidth: 188, actionHeight: 48,
    // 展开传闻高度按真实文字测量，这里只定义边距、标题区和动作行。
    detail: { top: 112, width: 600, inset: 28, icon: 96, loreTop: 164, actionHeight: 66, gap: 20 }
} as const;

/** 首波解锁演出与左侧入口共用图标和身份，调整顺序须同时检查飞行落点。 */
export const SIDE_FEATURES = [
    { title: "排行", name: "RankingButton", panel: "ranking", icon: "icon_trophy", unlock: "好友守村榜" },
    { title: "战技", name: "TacticsButton", panel: "tactics", icon: "icon_tactic_scroll", unlock: "守村战技" }
] as const;
