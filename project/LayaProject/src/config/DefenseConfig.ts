export type TowerKind = "ARROW" | "STONE" | "SLOW";
/** 石炮塔可保存的装饰旗样式。仅改变地图外观，使用固定 ID 便于旧村继续读档。 */
export const TOWER_FLAGS = ["briefs", "bra", "sock"] as const;
export type TowerFlag = typeof TOWER_FLAGS[number];
/** 统一石炮塔以弹种区分战斗行为。旧塔型 ID 继续标识已装弹种，保留夜战与存档引用。 */
export const TOWER_AMMO = {
    ARROW: { name: "弓箭", icon: "cannon_ammo_arrow", effect: "单体快攻" },
    STONE: { name: "石弹", icon: "cannon_ammo_stone", effect: "命中时溅射周围敌人" },
    SLOW: { name: "冰弹", icon: "icon_slow", effect: "命中后使周围敌人减速" }
} as const;
/** 开村的两座炮塔按塔位顺序预装免费弹种。其他新建塔一律装第一种。 */
export const STARTER_AMMO = ["ARROW", "STONE"] as const;
/** 同一弹种全村共用等级；从 1 级起每级额外提供 5% 的基础伤害，加法累计。 */
export const AMMO_DAMAGE_PER_LEVEL = .05;
/** 新建一座石炮塔统一消耗 40 尔币。建造、费用提示和每日任务预算共用此值。 */
export const TOWER_BUILD_COINS = 40;
export const TOWERS = {
    ARROW: { damage: 12, interval: .8, range: 175, splash: 0 },
    STONE: { damage: 22, interval: 1.6, range: 165, splash: 70 },
    SLOW: { damage: 4, interval: 1.5, range: 160, splash: 60 }
} as const;
/** 新开夜战在旧最终生命上额外加 30%，每过一夜多 1 个百分点，第 71 夜到 200%。试算只调整生命。 */
export const REINFORCED_NIGHT = { initialHealthPercent: 130, healthPercentPerNight: 1, maximumHealthPercent: 200 } as const;
/** 720×1280 的固定逻辑路径/塔位，首版地图配置；改变坐标会影响射程和到门时间。 */
export const PATH = [{ x: 360, y: 230 }, { x: 360, y: 350 }, { x: 250, y: 435 }, { x: 470, y: 550 }, { x: 360, y: 655 }, { x: 360, y: 760 }];
/** 正常战场高度的塔位基准。下标沿用存档编号，与屏幕投影、战斗索敌及弹道共用。 */
export const PADS: readonly { x: number; y: number }[] = [
    { x: 236, y: 356 }, { x: 543, y: 314 }, { x: 212, y: 624 }, { x: 401, y: 526 }, { x: 547, y: 716 }
];
/** 已发存档保留原先的生命倍率、出怪窗口与撞门规则。词缀仍由新旧波次共用。 */
export const WAVE = {
    // 固定增援沿用三人一组，纳入新波次的总人数。
    density: 3,
    // 多怪围攻用模拟得出的单体生命与撞门倍率。第九夜后混合怪群更密，因此再降低小怪生命。
    ordinaryHealthStageDay: 9,
    ordinaryHealth: [70, 62],
    ordinaryGateScale: .78,
    // 已生成的旧波次持有原生命倍率。用该快照识别原场上上限与撞门伤害，读档时原样回放。
    legacyOrdinaryHealth: [100, 106],
    // 保护前24波，每12波再加1名，最多4名。补充快怪、厚甲和野猪，和原队列共用上场节奏。
    qualityPressure: { after: 24, step: 12, max: 4, kinds: ["enemy_runner", "enemy_armored", "enemy_boar"] },
    // 1.0.35：新波次限制在 28～42 个战斗秒。首夜留出二次施放时间，密集后期收紧。
    spawnWindowTicks: { minimum: 560, maximum: 840 },
    affixStartDay: 7, affixes: ["NONE", "FAST", "STURDY", "GROUP"], groupSize: 3,
    // 结队保留组间停顿，组内间隔向均匀出怪靠近，减少连续三只叠在同一点。
    groupStagger: .90
} as const;
/** 波次规则随已排计划保存，旧双波难度保留原曲线和时间。 */
export const WAVE_RHYTHM = { paired: "PAIR_V1", nightly: "NIGHT_V1", extended: "NIGHT_V2", fixed: "NIGHT_V3" } as const;
export type WaveRhythm = typeof WAVE_RHYTHM[keyof typeof WAVE_RHYTHM];

/** 固定常速的守夜试算值，只用于新排的 NIGHT_V3；旧存档已排的一夜沿用原战斗属性。
 * 首夜灰牙按原始生命先乘 1.35，再按波次取整为 35 血；其余小怪降血、降撞门伤害，补偿三塔射频降低。
 * 移速包括首领，首领血量和撞门规则独立。首夜沿用原入场窗口，第六夜起拉长至原来的 1.4 倍。
 */
export const FIXED_NIGHT = {
    towerFireRate: .60, enemySpeed: 1.15, raiderHealth: 1.35, otherOrdinaryHealth: .65,
    ordinaryGateDamage: .75, fullWindowDay: 6, fullWindowScale: 1.4
} as const;

/** 每个原双波档拆成两次增量，保证前中期同一夜数的总强度接近此前。后期仍每夜加一名。
 * 初期保留已验证的首夜规模。血量、城门压力分别使用独立线性曲线，避免叠乘产生陡增。
 */
export const WAVE_PROGRESSION = {
    nightsPerBand: 2, initialCount: 51,
    earlyBands: 11, middleBands: 18, countPerBand: [6, 4, 1],
    ordinaryHealthPercent: 70, earlyHealth: .04, laterHealth: .06,
    // 前期混入的厚甲、野猪和干扰单位仍在成长，早夜使用较轻的体质，随升档自然达到完整强度。
    earlyHeavyHealth: .78, heavyHealthPerBand: .025,
    earlyGate: .025, laterGate: .04,
    speedPerBand: .01, speedBonusMax: .10, bossGrowthShare: .65,
    // 通用入场留白；大波次另按来敌数逐步拉开，批间停顿单独计算。
    windowTicksPerBand: 30, arrivalWindowScale: 1.15, batchSize: 252, joinTicks: 10,
    // NIGHT_V2 起将入场时点翻倍；NIGHT_V3 沿用这个基础窗口再逐夜拉开，已排旧波仍用各自节奏。
    extendedArrivalScale: 2,
    // 90 人以下保留原窗口，180 人起窗口额外加 25%，让重叠最明显的大波次先降密。
    denseArrival: { fromCount: 90, fullCount: 180, extraWindowScale: .25 },
    eliteFirstWeightPercent: 32, eliteWeightPerBand: 5, eliteWeightBonusMax: 12
} as const;

/** 保留老波次的密集出怪标记。新波次从显式 rhythm 字段识别。 */
export function isDenseWave(ordinaryHealthPercent: number) {
    return WAVE.ordinaryHealth.some(percent => percent === ordinaryHealthPercent);
}
/** 原 BattleSimulation 的词缀、天赋及减速参数，单位为倍率/逻辑距离/战斗步。
 * 保留原加法、乘法、取整与扣减顺序；本表只替代散落字面量，不改变战斗规则。
 */
export const COMBAT = {
    fastHealth: .9, sturdyHealth: 1.15, fastSpeed: 1.1, sturdySpeed: .9,
    // 五天赋方案：单个驻守者覆盖所有弹种。按开村双塔火力试算，防止首次换弹丢失加成。
    nimbleSpeed: .35, disruptRange: 190,
    strongDamage: .45,
    slowBase: .3, shotLifetimeTicks: 5
} as const;
