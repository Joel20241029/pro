/** 百毅靓之怒的二维贴图表现。尺寸是128px建筑编辑画布的逻辑像素，时长为战斗秒。
 * 2026-11-15用户选择B旋刃光环：红白双弧连续转动，前后分层，箭头标记强化。
 * 调节只影响显示，不改变伤害、射程、命中或点击范围。
 */
export const RAGE_VISUAL = {
    // 以128px编辑画布测量，轨道宽于武器；寒塔保留中央蓝晶，不能用红光盖住。
    ringWidth: { ARROW: 132, STONE: 128, SLOW: 112 }, ringHeightRatio: .5,
    orbitCanvas: 128, centerTop: { ARROW: 9, STONE: 11, SLOW: 6 },
    // 转速和提示箭头均走战斗时钟，暂停冻结，最高档（实际倍率3）同步加快；不生成逐帧图片。
    // 寒塔箭头靠近晶体顶部，320×568短屏的12阶外观也留在地图内。
    turnSeconds: 1.6, markerSize: 40, markerTop: { ARROW: 47, STONE: 48, SLOW: 44 }, markerRise: 2,
    glowSize: 94, glowTop: 18, glowAlpha: .28,
    castSeconds: .35, castScale: .22, fadeSeconds: .25, pulseSeconds: 1.2, pulseScale: .025,
    ringAlpha: .96, pulseAlpha: .04,
    projectileScale: 1.18, projectileAlpha: .85,
    // 从首次观察到命中起计时；即使追帧越过整段飞行，首帧仍可见，暂停不会耗时。
    hitSeconds: .2, hitSize: { ARROW: 34, STONE: 44, SLOW: 34 }
} as const;
