export type TowerKind = "ARROW" | "STONE" | "SLOW";
export const TOWERS = {
    ARROW: { name: "箭楼", damage: 12, interval: .8, range: 170, cost: 30, splash: 0, image: "building_tower_arrow" },
    STONE: { name: "石塔", damage: 22, interval: 1.6, range: 155, cost: 45, splash: 70, image: "building_tower_stone" },
    SLOW: { name: "寒塔", damage: 4, interval: 1.5, range: 150, cost: 35, splash: 60, image: "building_tower_slow" }
} as const;
/** 720×1280 的固定逻辑路径/塔位，首版地图配置；改变坐标会影响射程和到门时间。 */
export const PATH = [{ x: 360, y: 230 }, { x: 360, y: 350 }, { x: 250, y: 435 }, { x: 470, y: 550 }, { x: 360, y: 655 }, { x: 360, y: 760 }];
/** 2026-11-13按高清道路真实边缘与最大84×34塔占地调整，短长屏下保留草地间距。
 * 1号塔由(210,330)沿弯道外侧移到(175,350)，增加顶部留白；同步向左让开下方左弯的路面。
 * 1.0.25将第五塔移到原路牌上方；最高寒塔的顶部留白由地图排版预留，原有双塔位置保持。
 * 坐标同时驱动战斗、立绘、点击区、进塔与弹道；须验证5位置×3塔种。
 */
export const PADS = [{ x: 175, y: 350 }, { x: 470, y: 450 }, { x: 300, y: 560 }, { x: 505, y: 660 }, { x: 470, y: 285 }];
/** doc/tech/46 的数量型成长：每晚数量、年度轻重波和入场窗口共用配置。
 * 仍由世界随机源产生敌人及词缀，改变数量会影响之后的世界序列；配套配置版本16。
 */
export const WAVE = {
    // doc/tech/46：常规数量从8向72平滑增长；年度轻重波与挑战档增加少量数量，不无限堆同屏对象。
    initialCount: 8, additionalCount: 64, countGrowthNights: 72, tierCount: 3,
    seasonPulse: [0, 2, -1, 4],
    // 最长48战斗秒完成计划入场；拥堵继续排队，不丢怪。前24只保持原24秒窗口。
    spawnCountThreshold: 24, extraSpawnTicks: 10, maxSpawnTicks: 960,
    affixStartDay: 7, affixes: ["NONE", "FAST", "STURDY", "GROUP"], seasonalWeight: 2, groupSize: 3
} as const;
/** 原 BattleSimulation 的词缀、天赋、专长及减速参数，单位为倍率/逻辑距离/战斗步。
 * 保留原加法、乘法、取整与扣减顺序；本表只替代散落字面量，不改变战斗规则。
 */
export const COMBAT = {
    fastHealth: .9, sturdyHealth: 1.15, fastSpeed: 1.1, sturdySpeed: .9,
    nimbleSpeed: .1, focusedSpeed: .15, farsightRange: .15, disruptRange: 190,
    strongDamage: .2, throwingDamage: .25, archeryDamage: .25, stoneArmorDivisor: 2,
    slowMax: .6, slowBase: .3, patientSlow: .1, wardingSlow: .1, shotLifetimeTicks: 5
} as const;
