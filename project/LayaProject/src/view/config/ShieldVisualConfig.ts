/** 二楠之盾按2026-11-15确认稿制作。比例相对城门当前Body实际范围，
 * 时长使用战斗秒；只影响护罩、涟漪和HUD，不改变建筑占地、点击或免伤规则。 */
export const SHIELD_VISUAL = {
    widthScale: 1.65, heightScale: 1.35, footGap: 5,
    // 战场低于600逻辑像素时，护罩略扁并保留原血条高度，避免向上挤入第三塔的名称区。
    compactBattleHeight: 600, compactHeightScale: 1.2,
    // 原稿底部亮弧中心位于画布92.5%处；按亮弧贴地，不能按透明画布底沿对齐。
    domeFoot: .925,
    castSeconds: .3, fadeSeconds: .25, pulseSeconds: 1.6, pulseAlpha: .06,
    // 从门脚展开；极小的非零起始高度保证发动首帧可见，不影响业务计时。
    initialHeight: .08, ringHeight: .18, sweepSeconds: 2.4, sweepAlpha: .24,
    emblemScale: .25, emblemHeight: .6,
    // 固定三节点池；同一帧大量到门时复用最早涟漪，不能随来敌数量增长节点。
    hitPool: 3, hitSeconds: .3, hitWidth: .36, hitStartScale: .55,
    // 保护时整体上提22逻辑像素，让扩大后的罩顶和数字/血条之间保留间距；到期原位恢复。
    hud: { iconSize: 24, iconGap: 5, raise: 22, compactFont: 18, fill: "#62eff2", outline: "#175c68" }
} as const;
