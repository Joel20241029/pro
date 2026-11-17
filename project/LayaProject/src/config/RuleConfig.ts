/** 首版规则取自 doc/design/01 与 doc/tech/01；集中调整会改变经济、存档与战斗，需升级 CONFIG_VERSION。 */
// v18：第五塔移至上段，全年固定最高档；改变波次及旧守夜重放，沿用异版进度显式确认重开，不静默迁移。
export const CONFIG_VERSION = 18;
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
    costs: { FARM: { wood: 40, food: 15 }, LOGGING: { wood: 35, food: 15 }, HOUSING: { wood: 30, food: 10 }, GATE: { wood: 30, food: 10 }, TOWER: { wood: 35, food: 10 } },
    repairWoodPerLevel: 5, repairFraction: .2
} as const;
/** doc/tech/46 已确认：住宅从1级、8容量起，每级+1，100级共107容量；不直接赠送居民。
 * 原 houses 字段改存扩建等级。成本按当前级别计算，粮木共同限制快速扩张；改动须重新模拟。
 */
export const RESIDENTIAL = {
    maxLevel: 100, initialCapacity: 8, capacityPerLevel: 1,
    woodBase: 30, woodPerLevel: 10, woodQuadratic: .5, foodBase: 10, foodPerLevel: 5
} as const;
/** 已确认的柔性人口平衡：出生最多偏置25个百分点、旅人35个百分点；不使用固定交替性别。
 * 旅人保留第5天起每4夜的来访时点，成年性别断档可提前；所有来访至少间隔3次成功守夜。
 * 两种人口都为空时为50%，计数排除老人。调整会影响后续出生/旅人，不重抽已经生成的人。
 */
export const POPULATION = { birthBias: .25, travelerBias: .35, firstTravelerDay: 5, travelerPeriod: 4, travelerMinNights: 3 } as const;
/** 用户确认的稀有村民规则：仅新生儿/旅人独立抽取，不遗传、不重抽，创始人普通。
 * 产出与伤害在原加成后乘倍率、最后取整；照料只额外产粮，不缩短两夜成长。
 * 寿命按成功守夜计算，口粮沿 RULE；改动影响经济、战斗与存档校验，须同步版本。
 */
export const ELITE = {
    chancePercent: 5, chanceScale: 100, productionMultiplier: 1.5, damageMultiplier: 1.25,
    careFoodBonus: 1, adultNights: 18, elderNights: 5,
    // 纯表现缩放，各人生阶段沿用原动画与足底，不改变寻路、速度和住房占用。
    visualScale: 1.25
} as const;
export const RULE = {
    storageCap: 200,
    // 真实人口安全上界由住宅最终容量推导；地图绘制人数另由表现配置控制。
    populationCap: RESIDENTIAL.initialCapacity + (RESIDENTIAL.maxLevel - 1) * RESIDENTIAL.capacityPerLevel,
    houseMax: RESIDENTIAL.maxLevel,
    initialResource: 60, gateMax: 200, repairCost: 10,
    // 用户确认固定20粮；同村本地自然日一次、仓满截断、确认后记领取日。新开村清空日期，可再次领取。
    dailyFood: 20,
    birthCost: 20, birthCooldown: 4, parentMinNights: 3, growNights: 2, adultNights: 12,
    // 用户确认的晚年为 3 个成功守夜夜晚；刚荣休的清晨不扣减，改变此值会影响口粮与床位占用。
    elderNights: 3,
    // 劳作剩余 2 夜起预告荣休，仅影响提醒，不提前释放岗位或减少劳动产出。
    retirementNoticeNights: 2,
    // 成人及老人共用普通 2 粮、节俭 1 粮的口粮规则，再统一应用季节和村规。
    farmBase: 8, logBase: 6, adultRation: 2, childRation: 1,
    farmSlots: [2, 4, 6], logSlots: [2, 3, 4], towerConvert: 20,
    yearDays: 12, seasonDays: 3,
    // 用户确认从第一年起固定原最高3档，跨年不再选择；沿用WAVE.tierCount加数量，调整须验证首夜及长期经营。
    maxTier: 3, historyCap: 60, favoriteCap: 20,
    // 2026-11-16用户指定：原2倍为新1档、原3倍为新2档。此处存实际倍率，默认最低档；不改变单步战斗规则。
    minSpeed: 2,
    // 15步覆盖允许计入的0.25秒×最高档实际倍率3，不追赶后台时间，不改变固定模拟步长。
    step: .05, frameCap: .25, maxSpeed: 3, maxSteps: 15, enemyCap: 40, planCap: 128,
    // 进攻战技持续 15 个战斗秒（300 步×0.05 秒）。每夜施放与冷却规则见 TacticConfig。
    bellTicks: 300,
    // 沿用原警钟攻速+50%；战斗与说明共用，乘在天赋/村规加成之后，再乘缺粮/扰阵减益。
    bellSpeedMultiplier: 1.5,
    slowTicks: 30, hungerSpeed: .7, disruptSpeed: .8,
    spawnTicks: 480, summonTicks: [120, 240], effectCap: 32
} as const;
export interface Policy {
    name: string;
    desc: string;
    food?: number;
    wood?: number;
    ration?: number;
    speed?: number;
    damage?: number;
    range?: number;
    arrowSpeed?: number;
    stoneSpeed?: number;
    stoneDamage?: number;
    slow?: number;
    care?: number;
    repair?: number;
    gate?: number;
}
/** 村规三天生效；加成相加，特别倍率由战斗/经济边界统一应用。 */
export const POLICIES: Record<string, Policy> = {
    policy_harvest: { name: "丰收", desc: "产粮 +25%，产木 -10%", food: .25, wood: -.1 },
    policy_tillage: { name: "深耕", desc: "产粮 +40%，攻速 -10%", food: .4, speed: -.1 },
    policy_logging: { name: "开林", desc: "产木 +25%，产粮 -10%", wood: .25, food: -.1 },
    policy_rations: { name: "节粮", desc: "口粮 -20%，攻速 -10%", ration: -.2, speed: -.1 },
    policy_prepare: { name: "备战", desc: "伤害 +15%，产粮 -10%", damage: .15, food: -.1 },
    policy_watch: { name: "瞭望", desc: "射程 +15%，产木 -10%", range: .15, wood: -.1 },
    policy_arrows: { name: "疾箭", desc: "箭楼攻速 +25%，石塔攻速 -10%", arrowSpeed: .25, stoneSpeed: -.1 },
    policy_stones: { name: "重石", desc: "石塔伤害 +25%，箭楼攻速 -10%", stoneDamage: .25, arrowSpeed: -.1 },
    policy_slow: { name: "凝霜", desc: "减速 +10%，伤害 -10%", slow: .1, damage: -.1 },
    policy_nurture: { name: "育苗", desc: "照料者产 3 粮，产木 -10%", care: 3, wood: -.1 },
    policy_repair: { name: "固门", desc: "修门效果 +50%，伤害 -5%", repair: .5, damage: -.05 },
    policy_patrol: { name: "巡防", desc: "城门受伤 -15%，产粮 -10%", gate: -.15, food: -.1 }
};
export const SEASONS = ["春", "夏", "秋", "冬"];
/** 原 VillageRules.economy 的加成与口粮数值，逐项原值迁移。
 * 加成仍先相加、乘精英倍率后取整；季节口粮最后统一向上取整。
 * 修改会影响经营平衡，需要对照成长模拟和配置版本；此次没有调参。
 */
export const ECONOMY = {
    diligentFood: .2, farmingFood: .2, springFood: .1,
    woodwiseWood: .2, loggingWood: .2, autumnWood: .15,
    nurturingFood: 2, frugalRation: 1, winterRation: .2
} as const;
