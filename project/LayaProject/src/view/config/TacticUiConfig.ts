/** 已确认的战技设计稿在720逻辑宽度下的排版参数。
 * 侧边徽章共享按压容器，卡片图标/文字/按钮分区；只影响表现，不参与学习资格或扣费。
 */
export const TACTIC_UI = {
    // 一号塔点击区左边界为107；徽章右沿102，四种屏幕和三类塔均保留5px逻辑间隔。
    side: { x: 6, top: 12, size: 96, gap: 12, icon: 44, iconY: 8, textY: 55, font: 26 },
    // 资源行与列表留 18px，白天底边只留卡片边距。战斗限制保留一行。
    listTop: 192, rowHeight: 216, rowStep: 228, footer: 54,
    icon: 104, rowTextX: 142, rowTextWidth: 418,
    actionX: 376, actionY: 158, actionWidth: 188, actionHeight: 48,
    detailOwnedHeight: 688, detailLearnHeight: 848, detailIcon: 136
} as const;

/** 首波解锁演出与左侧入口共用图标和身份，调整顺序须同时检查飞行落点。 */
export const SIDE_FEATURES = [
    { title: "排行", name: "RankingButton", panel: "ranking", icon: "icon_trophy", unlock: "好友守村榜" },
    { title: "战技", name: "TacticsButton", panel: "tactics", icon: "icon_tactic_scroll", unlock: "守村战技" }
] as const;
