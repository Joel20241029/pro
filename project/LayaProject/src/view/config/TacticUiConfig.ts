/** 已确认的战技设计稿在720逻辑宽度下的排版参数。
 * 侧边徽章共享按压容器，卡片图标/文字/按钮分区；只影响表现，不参与学习资格或扣费。
 */
export const TACTIC_UI = {
    // 一号塔点击区左边界为107；徽章右沿102，四种屏幕和三类塔均保留5px逻辑间隔。
    side: { x: 6, top: 12, size: 96, gap: 12, icon: 44, iconY: 8, textY: 55, font: 26 },
    listTop: 230, rowHeight: 216, rowStep: 228, footer: 54,
    icon: 104, rowTextX: 142, rowTextWidth: 418,
    actionX: 376, actionY: 158, actionWidth: 188, actionHeight: 48,
    detailOwnedHeight: 688, detailLearnHeight: 848, detailIcon: 136
} as const;
