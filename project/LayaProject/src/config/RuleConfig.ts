/** v23 启用尔币和制衣厂。v22 交易经过校验后在读档入口转换。 */
export const CONFIG_VERSION = 23;
/** 保留既有建筑战力与怪物成长，费用按本轮尔币收支试算重定。 */
export const GROWTH = {
    powerLinear: .45, powerQuadratic: .05, enemyStartDay: 12, enemyLevelNights: 32,
    costs: {
        GATE: [40, 15, 1], TOWER: [45, 20, 2], AMMO: [35, 14, 1],
        PATROL: [48, 18, 2], FACTORY: [55, 18, 2]
    },
    repairCoinsPerLevel: 4, repairFraction: .2
} as const;
/** 民居只提升居住容量，等级与住房上限同步。 */
export const RESIDENTIAL = {
    lastBedLevel: 100, initialCapacity: 8, capacityPerLevel: 1,
    coinsBase: 35, coinsPerLevel: 10, coinsQuadratic: .5
} as const;
/** 试算基线。常驻制衣每批 30 秒，每次成功守夜刷新额度和批次；同步调整预览及实际入账。 */
export const SEWING = {
    batchMs: 30_000, maxBatches: 3, baseSlots: 6, slotsPerUpgrade: 2,
    dayPerUpgrade: 1, nightUpgradeLevels: 2, craftyBonus: 1,
    dayReference: 42, dayReferenceStep: 3, dayCapBaseRatio: .5,
    dayCapMaxRatio: .65, dayCapPerUpgrade: 3
} as const;
/** 日常胜利底薪按成功波次增长；制衣加成受底薪约束，年度首领另发津贴。 */
export const WIN_REWARD = { base: 30, perWave: 3, sewingLimit: .5, bossBonus: .25 } as const;
/** 已确认的柔性人口平衡：出生最多偏置25个百分点、旅人35个百分点；不使用固定交替性别。
 * 旅人保留第5天起每4夜的来访时点，成年性别断档可提前；所有来访至少间隔3次成功守夜。
 * 两种人口都为空时为50%，计数排除老人。调整会影响后续出生/旅人，不重抽已经生成的人。
 */
export const POPULATION = { birthBias: .25, travelerBias: .35, firstTravelerDay: 5, travelerPeriod: 4, travelerMinNights: 3 } as const;
export const RULE = {
    // 真实人口安全上界由住宅最终容量推导；地图绘制人数另由表现配置控制。
    populationCap: RESIDENTIAL.initialCapacity + (RESIDENTIAL.lastBedLevel - 1) * RESIDENTIAL.capacityPerLevel,
    // 开局够建第三座塔并升一次塔身，迎接孩子沿用原冷却与成长周期。
    initialCoins: 90, gateMax: 200, repairCost: 8,
    birthCost: 18, birthCooldown: 4, growNights: 2, adultNights: 12,
    elderNights: 3, retirementNoticeNights: 2,
    // 开局沿用固定最高档，敌人强度按连续守夜波数增长。
    maxTier: 3, historyCap: 60, favoriteCap: 20,
    // 守夜固定采用旧界面 ×2 档的真实倍率，每现实秒推进 3 个战斗秒；瞄准减速以它为基准。
    battleSpeed: 3,
    // 旧界面 ×1 档曾将实际倍率 2 写入存档和设备设置。仅供读取校验。
    legacySlowSpeed: 2,
    // 15步覆盖0.25秒×固定倍率3，不追赶后台时间，不改变固定模拟步长。
    step: .05, frameCap: .25, maxSteps: 15,
    // 只给已生成的历史波次回放使用，原版最多同时存活40只。
    legacyEnemyCap: 40,
    // 旧版已排定的波次校验上限，新规则按当夜预算校验。
    planCap: 288,
    // 攻速和增伤战技持续 18 个战斗秒（360 步×0.05 秒）。每夜施放与冷却规则见 TacticConfig。
    bellTicks: 360,
    // 沿用原警钟攻速+50%；战斗与说明共用，乘在驻塔天赋加成之后，再计扰阵减益（旧夜重演另保留缺粮）。
    bellSpeedMultiplier: 1.5,
    slowTicks: 30, hungerSpeed: .7, disruptSpeed: .8,
    spawnTicks: 480, summonTicks: [120, 240], effectCap: 32
} as const;
