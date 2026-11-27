import { PATROL } from "./PatrolConfig";

/** v22 起使用合并后的民居等级。退役的节令和村规字段由旧档读取流程移除。 */
export const CONFIG_VERSION = 22;
/** 持续成长基础来自 doc/tech/12，百级住宅与数量型波次按 doc/tech/46 重平衡。
 * 设施等级不封顶，产出线性、战力与费用二次增长；更改须复跑经营模拟及升级预检。
 */
export const GROWTH = {
    productionPerLevel: 2, storagePerLevel: 160, powerLinear: .45, powerQuadratic: .05,
    // 人口上限增长后用二次成本约束经济；仓储二次项必须大于自身费用，避免扩仓死锁。
    storageQuadratic: 12, costWoodQuadratic: 2, costFoodQuadratic: .5, laborSlotLevels: 2,
    // 数量优先后个体线性成长，避免人口封顶、设施升级变慢时敌人平方增长形成必败墙。
    enemyStartDay: 12, enemyLevelNights: 32,
    costWoodPerLevel: 25, costFoodPerLevel: 10,
    costs: { FARM: { wood: 40, food: 15 }, LOGGING: { wood: 35, food: 15 }, GATE: { wood: 30, food: 10 }, TOWER: { wood: 35, food: 10 }, PATROL: PATROL.upgrade },
    repairWoodPerLevel: 5, repairFraction: .2
} as const;
/** doc/tech/46 已确认：住宅从1级、8容量起，每级+1，100级共107容量，此后只增加仓储；不直接赠送居民。
 * 原 houses 字段改存扩建等级。成本按当前级别计算，粮木共同限制快速扩张；改动须重新模拟。
 */
export const RESIDENTIAL = {
    lastBedLevel: 100, initialCapacity: 8, capacityPerLevel: 1,
    woodBase: 30, woodPerLevel: 10, woodQuadratic: .5, foodBase: 10, foodPerLevel: 5
} as const;
/** 已确认的柔性人口平衡：出生最多偏置25个百分点、旅人35个百分点；不使用固定交替性别。
 * 旅人保留第5天起每4夜的来访时点，成年性别断档可提前；所有来访至少间隔3次成功守夜。
 * 两种人口都为空时为50%，计数排除老人。调整会影响后续出生/旅人，不重抽已经生成的人。
 */
export const POPULATION = { birthBias: .25, travelerBias: .35, firstTravelerDay: 5, travelerPeriod: 4, travelerMinNights: 3 } as const;
export const RULE = {
    storageCap: 200,
    // 真实人口安全上界由住宅最终容量推导；地图绘制人数另由表现配置控制。
    populationCap: RESIDENTIAL.initialCapacity + (RESIDENTIAL.lastBedLevel - 1) * RESIDENTIAL.capacityPerLevel,
    initialResource: 60, gateMax: 200, repairCost: 10,
    // 用户确认固定20粮；同村本地自然日一次、仓满截断、确认后记领取日。新开村清空日期，可再次领取。
    dailyFood: 20,
    birthCost: 20, birthCooldown: 4, growNights: 2, adultNights: 12,
    // 用户确认的晚年为 3 个成功守夜夜晚；刚荣休的清晨不扣减，改变此值会影响口粮与床位占用。
    elderNights: 3,
    // 劳作剩余 2 夜起预告荣休，仅影响提醒，不提前释放岗位或减少劳动产出。
    retirementNoticeNights: 2,
    // 成人和老人共用普通 2 粮、节俭 1 粮的口粮规则。
    farmBase: 8, logBase: 6, adultRation: 2, childRation: 1,
    farmSlots: [2, 4, 6], logSlots: [2, 3, 4], towerConvert: 20,
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
    // 沿用原警钟攻速+50%；战斗与说明共用，乘在驻塔天赋加成之后，再乘缺粮/扰阵减益。
    bellSpeedMultiplier: 1.5,
    slowTicks: 30, hungerSpeed: .7, disruptSpeed: .8,
    spawnTicks: 480, summonTicks: [120, 240], effectCap: 32
} as const;
/** 常年适用的村民生产与口粮加成，每人产出乘品质和天赋后取整。 */
export const ECONOMY = {
    diligentFood: .4, woodwiseWood: .4, frugalRation: 1
} as const;
