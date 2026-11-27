/** 新夜的慢速档。战前快照旧值 true 继续用 1.0.127 的半速。 */
export const SLOWER_HERO_SORTIE = "SLOWER" as const;
export type ExtendedHeroSortie = true | typeof SLOWER_HERO_SORTIE;

/** 村委会、智卓引导与召唤战技共用这套公开称呼和已交付的四向角色素材。 */
const ZHIZHUO = "智卓";

/** 村委会首位英雄开局赠送。时长、移动与攻击均按战斗时间，跟随暂停和淡紫瞄准。 */
export const HERO = {
    actorId: "Hero:zhizhuo",
    givenName: ZHIZHUO,
    name: `村长·${ZHIZHUO}`,
    portrait: "zhizhuo_portrait",
    spritePrefix: "hero_zhizhuo",
    committeeName: "文明里村委会",
    // 出门、追怪都计入一轮出击；回到门内后才开始休息。
    sortieSeconds: 12,
    restSeconds: 8,
    walkSpeed: 150,
    returnSpeed: 175,
    // 新夜的出门和回程放慢两成。留存原速度供升级前已开始的夜战重放。
    movementScale: .8,
    // 新开夜战的出门、追击和回程均为 1.0.126 的一半。出战窗口翻倍，进门后的休息沿用 8 秒。
    extendedMovementScale: .4,
    extendedSortieSeconds: 24,
    // 步态随移速减半，攻击动作仍和命中帧共用秒轴。
    extendedWalkTempo: .5,
    // 新档按上次半速再减三成，行走动画和实际移动采用同一减速比。
    slowerPace: .7,
    // 参考地图城门基线 830。门内站点和落脚余量只控制往返路线及开门反馈。
    gateY: 830,
    restPoint: { x: 360, y: 852 },
    gateTriggerDistance: 27,
    roadEdgeInset: 8,
    // 每轮攻击采用 4 帧，起手、右瓶命中、左瓶命中、收瓶。
    attackSeconds: 1,
    attackFrames: 4,
    strikeFrames: [1, 2],
    walkFps: 8,
    // 留出起手距离差，敌人在摆臂期间走动仍可被实际挥瓶命中。
    windupRange: 46,
    hitRange: 64,
    sweepCos: .42,
    targetsPerBottle: 2,
    // 基础伤害低于石弹；随波次体质等比例成长，固定的休息时长约束总出手数。
    bottleDamage: 9,
    // 单英雄夜战的双瓶只锁定一只，保留两段动作。首领加伤突出贴身集火，与群伤英雄区分。
    duel: { bottleDamage: 13, interval: 1.25, bossMultiplier: 1.35 },
    // 按同波次的有/无英雄试算，仅增加参战新夜战普通怪的生命，首领、出怪与撞门规则沿用。
    ordinaryHealthBonus: .05
} as const;

/** 第三名英雄在首领波后招募。用较低单击伤害换单体控制，随同波怪物生命倍率成长。
 * 时长均为战斗秒，受暂停及瞄准减速影响。首领按较短麻痹时长计算。
 */
export const SONGLEI = {
    actorId: "Hero:songlei",
    name: "大夫·宋磊",
    portrait: "songlei_portrait",
    spritePrefix: "hero_songlei",
    attackName: "双棍麻痹",
    lore: "吴家窑诊所关门后，宋磊拎着两根电棍去了城门。守门人问他来做什么，他说，看看谁跑得最急。",
    // 第一只首领之后开放。粮木按开村经营实跑校准，给守门与招募都留支出空间。
    recruitment: { waves: 12, wood: 55, food: 35 },
    damage: 11, interval: 1.6, walkSpeed: 57, windupRange: 55, hitRange: 74,
    // 每棍独立抽样，倒下的怪不再附加状态。调整时同时观察重复控住首领的概率。
    paralysis: { chancePercent: 30, seconds: 5.4, bossSeconds: 2.1 }
} as const;
