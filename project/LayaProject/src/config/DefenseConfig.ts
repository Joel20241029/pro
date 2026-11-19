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
/** 保留 doc/tech/46 的数量曲线和入场窗口，三倍方案增加同一窗口内的来敌。
 * 仍由世界随机源抽取敌人及词缀，增加抽样会影响之后的世界序列。
 */
export const WAVE = {
    // doc/tech/46：常规数量从8向72平滑增长；年度轻重波与挑战档增加少量数量，不无限堆同屏对象。
    initialCount: 8, additionalCount: 64, countGrowthNights: 72, tierCount: 3,
    // 已确认的三倍波次总量，含季节、年度挑战和增援；年度仍只有一个首领。
    density: 3,
    // 多怪围攻用模拟得出的单体生命与撞门倍率。第九夜后混合怪群更密，因此再降低小怪生命。
    ordinaryHealthStageDay: 9,
    ordinaryHealth: [70, 62],
    ordinaryGateScale: .78,
    // 已生成的旧波次持有原生命倍率。用该快照识别原场上上限与撞门伤害，读档时原样回放。
    legacyOrdinaryHealth: [100, 106],
    // 保护前24波，每12波再加1名，最多4名。补充快怪、厚甲和野猪，和原队列共用上场节奏。
    qualityPressure: { after: 24, step: 12, max: 4, kinds: ["enemy_runner", "enemy_armored", "enemy_boar"] },
    seasonPulse: [0, 2, -1, 4],
    // 依照三倍前的数量估算入场时长，使用原来的 28～42 个战斗秒窗口。
    spawnCountThreshold: 24, extraSpawnTicks: 10,
    // 1.0.35：新波次限制在 28～42 个战斗秒。首夜留出二次施放时间，密集后期收紧。
    spawnWindowTicks: { minimum: 560, maximum: 840 },
    affixStartDay: 7, affixes: ["NONE", "FAST", "STURDY", "GROUP"], seasonalWeight: 2, groupSize: 3
} as const;
/** 新波次沿用存档里的生命快照标识。旧档的两个已发行倍率与新档互斥。 */
export function isDenseWave(ordinaryHealthPercent: number) {
    return WAVE.ordinaryHealth.some(percent => percent === ordinaryHealthPercent);
}
/** 原 BattleSimulation 的词缀、天赋、专长及减速参数，单位为倍率/逻辑距离/战斗步。
 * 保留原加法、乘法、取整与扣减顺序；本表只替代散落字面量，不改变战斗规则。
 */
export const COMBAT = {
    fastHealth: .9, sturdyHealth: 1.15, fastSpeed: 1.1, sturdySpeed: .9,
    nimbleSpeed: .1, focusedSpeed: .15, farsightRange: .15, disruptRange: 190,
    strongDamage: .2, throwingDamage: .25, archeryDamage: .25, stoneArmorDivisor: 2,
    slowMax: .6, slowBase: .3, patientSlow: .1, wardingSlow: .1, shotLifetimeTicks: 5
} as const;
