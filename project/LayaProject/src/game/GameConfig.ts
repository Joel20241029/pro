/** 首版规则取自 doc/design/01 与 doc/tech/01；集中调整会改变经济、存档与战斗，需升级 CONFIG_VERSION。 */
// v6：修正随机整数的低位相关性，移除无用/重复存档字段；不迁移旧档，交付后人工清两槽，同版正常续玩。
export const CONFIG_VERSION = 6;
/** 2026-11-11 已确认的持续成长方案（doc/tech/12）。等级不封顶，人数及工作站仍有界。
 * 成本线性增长，产出线性、战力二次增长；更改系数须复跑完整经营模拟及升级预检。
 */
export const GROWTH = {
    productionPerLevel: 2, storagePerLevel: 160, powerLinear: .45, powerQuadratic: .05,
    enemyStartDay: 12, enemyLevelNights: 18,
    costWoodPerLevel: 25, costFoodPerLevel: 10,
    costs: { FARM: { wood: 40, food: 15 }, LOGGING: { wood: 35, food: 15 }, HOUSING: { wood: 30, food: 10 }, GATE: { wood: 30, food: 10 }, TOWER: { wood: 35, food: 10 } },
    repairWoodPerLevel: 5, repairFraction: .2
} as const;
/** 已确认的柔性人口平衡：出生最多偏置25个百分点、旅人35个百分点；不使用固定交替性别。
 * 旅人保留第5天起每4夜的来访时点，成年性别断档可提前；所有来访至少间隔3次成功守夜。
 * 两种人口都为空时为50%，计数排除老人。调整会影响后续出生/旅人，不重抽已经生成的人。
 */
export const POPULATION = { birthBias: .25, travelerBias: .35, firstTravelerDay: 5, travelerPeriod: 4, travelerMinNights: 3 } as const;
/** 原生音乐只用一条循环，音量低于前景反馈；不随战斗倍速，遵循系统静音。 */
export const MUSIC = { file: "village_loop.mp3", volume: .3 } as const;
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
/** 用户指定的两种成人外观；出生、旅人及开村统一使用，不改变性别/天赋/专长。 */
export const ADULT_APPEARANCE = { MALE: "male_a", FEMALE: "female_a" } as const;
/** 随机姓名沿用原孩子字根及旅人名，追加用户指定的男女姓名；只影响新人物命名，不增加人口。
 * 普通孩子继续附编号，指定姓名保持原文。调整池大小会改变新开局后姓名的抽样概率。
 */
export const VILLAGER_NAMES = {
    child: ["禾", "桃", "松", "竹", "杏", "川"], traveler: ["行舟", "云溪", "山青", "晚晴"],
    personal: { MALE: "四辈儿", FEMALE: "芊芊" }
} as const;
/** 纯表现动作表：男女均具备三类劳动动画；到工位播放，移动仍使用方向 walk，不限制任职资格。 */
export const LABOR_CLIPS: Readonly<Record<string, Readonly<Record<"FARM" | "LOGGING" | "CARE", string>>>> = {
    male_a: { FARM: "villager_male_a_farm", LOGGING: "villager_male_a_chop", CARE: "villager_male_a_care" },
    female_a: { FARM: "villager_female_a_harvest", LOGGING: "villager_female_a_chop", CARE: "villager_female_a_care" }
};
export const RULE = {
    storageCap: 200, populationCap: 20, houseCapacity: 4, houseMax: 5, houseCost: 30,
    initialResource: 60, gateMax: 200, repairCost: 10,
    birthCost: 20, birthCooldown: 4, parentMinNights: 3, growNights: 2, adultNights: 12,
    // 用户确认的晚年为 3 个成功守夜夜晚；刚荣休的清晨不扣减，改变此值会影响口粮与床位占用。
    elderNights: 3,
    // 劳作剩余 2 夜起预告荣休，仅影响提醒，不提前释放岗位或减少劳动产出。
    retirementNoticeNights: 2,
    // 成人及老人共用普通 2 粮、节俭 1 粮的口粮规则，再统一应用季节和村规。
    farmBase: 8, logBase: 6, adultRation: 2, childRation: 1,
    farmSlots: [2, 4, 6], logSlots: [2, 3, 4], towerConvert: 20,
    yearDays: 12, seasonDays: 3, maxTier: 3, historyCap: 60, favoriteCap: 20,
    // 15步覆盖允许计入的0.25秒×最高3倍速，不追赶后台时间，不改变固定模拟步长。
    step: .05, frameCap: .25, maxSpeed: 3, maxSteps: 15, enemyCap: 40, planCap: 80,
    bellTicks: 100, slowTicks: 30, hungerSpeed: .7, disruptSpeed: .8,
    spawnTicks: 480, summonTicks: [120, 240], effectCap: 32
} as const;
export type TowerKind = "ARROW" | "STONE" | "SLOW";
export type EnemyKind = "enemy_raider" | "enemy_runner" | "enemy_armored" | "enemy_disruptor" | "enemy_chief";
export const TOWERS = {
    ARROW: { name: "箭楼", damage: 12, interval: .8, range: 170, cost: 30, splash: 0, image: "building_tower_arrow" },
    STONE: { name: "石塔", damage: 22, interval: 1.6, range: 155, cost: 45, splash: 70, image: "building_tower_stone" },
    SLOW: { name: "寒塔", damage: 4, interval: 1.5, range: 150, cost: 35, splash: 60, image: "building_tower_slow" }
} as const;
export const ENEMIES = {
    enemy_raider: { name: "山匪", hp: 36, speed: 36, armor: 0, gate: 8, cost: 1, weight: 6, unlock: 1 },
    enemy_runner: { name: "疾行匪", hp: 24, speed: 70, armor: 0, gate: 6, cost: 2, weight: 3, unlock: 2 },
    enemy_armored: { name: "甲兵", hp: 160, speed: 22, armor: .4, gate: 18, cost: 5, weight: 2, unlock: 4 },
    enemy_disruptor: { name: "扰阵师", hp: 96, speed: 28, armor: 0, gate: 12, cost: 4, weight: 1, unlock: 7 },
    enemy_chief: { name: "匪首", hp: 480, speed: 18, armor: .2, gate: 40, cost: 12, weight: 0, unlock: 12 }
} as const;
export const TRAITS = {
    trait_diligent: ["勤耕", "耕作产粮 +20%"], trait_woodwise: ["识木", "伐木产量 +20%"],
    trait_focused: ["专注", "箭楼攻速 +15%"], trait_strong: ["强健", "石塔伤害 +20%"],
    trait_patient: ["沉稳", "寒塔减速 +10%"], trait_frugal: ["节俭", "成人每日只吃 1 粮"],
    trait_farsight: ["远见", "防塔射程 +15%"], trait_nimble: ["灵巧", "防塔攻速 +10%"]
} as const;
export const SKILLS = {
    skill_farming: ["农艺", "产粮 +20%"], skill_logging: ["伐木", "产木 +20%"],
    skill_archery: ["弓术", "箭楼伤害 +25%"], skill_throwing: ["投掷", "石塔伤害 +25%"],
    skill_warding: ["守御", "减速 +10%"], skill_nurturing: ["育幼", "照料孩子时产 2 粮"]
} as const;
export type Trait = keyof typeof TRAITS;
export type Skill = keyof typeof SKILLS;
export interface Policy { name: string; desc: string; food?: number; wood?: number; ration?: number; speed?: number; damage?: number; range?: number; arrowSpeed?: number; stoneSpeed?: number; stoneDamage?: number; slow?: number; care?: number; repair?: number; gate?: number; }
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
/** 720×1280 的固定逻辑路径/塔位，首版地图配置；改变坐标会影响射程和到门时间。 */
export const PATH = [{ x: 360, y: 230 }, { x: 360, y: 350 }, { x: 250, y: 435 }, { x: 470, y: 550 }, { x: 360, y: 655 }, { x: 360, y: 760 }];
export const PADS = [{ x: 240, y: 340 }, { x: 475, y: 395 }, { x: 220, y: 555 }, { x: 495, y: 665 }];
export const FOUNDERS = [
    { name: "阿禾", sex: "MALE", appearance: "male_a", trait: "trait_diligent", skill: "skill_farming", nights: 4, job: "FARM" },
    { name: "春杏", sex: "FEMALE", appearance: "female_a", trait: "trait_frugal", skill: "skill_nurturing", nights: 6, job: "FARM" },
    { name: "石生", sex: "MALE", appearance: "male_a", trait: "trait_strong", skill: "skill_throwing", nights: 8, job: "LOGGING" },
    { name: "青竹", sex: "FEMALE", appearance: "female_a", trait: "trait_focused", skill: "skill_archery", nights: 10, job: "WAITING" },
    { name: "林川", sex: "MALE", appearance: "male_a", trait: "trait_woodwise", skill: "skill_logging", nights: 12, job: "LOGGING" },
    { name: "小满", sex: "FEMALE", appearance: "female_a", trait: "trait_farsight", skill: "skill_farming", nights: 12, job: "WAITING" }
] as const;
