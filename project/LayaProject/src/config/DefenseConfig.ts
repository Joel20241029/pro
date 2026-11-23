export type TowerKind = "ARROW" | "STONE" | "SLOW";
export const TOWERS = {
    ARROW: { name: "箭楼", damage: 12, interval: .8, range: 175, cost: 30, splash: 0, image: "building_tower_arrow" },
    STONE: { name: "石塔", damage: 22, interval: 1.6, range: 165, cost: 45, splash: 70, image: "building_tower_stone" },
    SLOW: { name: "寒塔", damage: 4, interval: 1.5, range: 160, cost: 35, splash: 60, image: "building_tower_slow" }
} as const;
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
export const WAVE_RHYTHM = { paired: "PAIR_V1", nightly: "NIGHT_V1", extended: "NIGHT_V2" } as const;
export type WaveRhythm = typeof WAVE_RHYTHM[keyof typeof WAVE_RHYTHM];

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
    // 每个既有入场时点翻倍，保持队列顺序和怪群的相对节奏。仅新生成的 NIGHT_V2 使用。
    extendedArrivalScale: 2,
    // 90 人以下保留原窗口，180 人起窗口额外加 25%，让重叠最明显的大波次先降密。
    denseArrival: { fromCount: 90, fullCount: 180, extraWindowScale: .25 },
    eliteFirstWeightPercent: 32, eliteWeightPerBand: 5, eliteWeightBonusMax: 12, seasonalWeightPercent: 125
} as const;

/** 保留老波次的密集出怪标记。新波次从显式 rhythm 字段识别。 */
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
