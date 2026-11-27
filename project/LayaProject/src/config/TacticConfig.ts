import { RULE } from "./RuleConfig";
import { HERO } from "./HeroConfig";
import { DELIVERY_HERO } from "./DeliveryHeroConfig";
import { RESOURCE_CONTRACT } from "./ResourceManifest";
import { PATH_LENGTH } from "../game/BattleRoad";

/** 单次战技保留原内部冷却。耗尽时本夜以次数为准。 */
const SINGLE_USE_COOLDOWN = 7;
/** 额外槽按次序购买；解锁后增加可携带的战技。 */
export const TACTIC_SLOTS = [{ unlockWaves: 15, coins: 120 }, { unlockWaves: 35, coins: 235 }] as const;

/** 村庄战技与村民天赋分离；目录只登记已实现的效果。
 * 波数是当前村庄成功防守数，尔币为一次学习费用。大王的怜悯另在施放时献纳库存。
 * 持续时间使用固定战斗步，暂停与倍速由原战斗时钟管理；更改效果需重新调平。
 */
interface TacticBase {
    id: string; name: string; buttonName?: string; icon: string; order: number;
    summary: string; detail?: string; lore: string;
    unlockWaves: number; coins: number;
    ticks: number;
    /** 常速下的实际秒。怜悯仅按胜利波数冷却。 */
    cooldownSeconds: number;
    /** 冷却型省略本字段。 */
    usesPerNight?: number;
}
// 各效果只携带自己的参数；保护城门、齐射不能被当成攻速倍率。
export type TacticDefinition = TacticBase & (
    { effect: "ATTACK_SPEED" | "ATTACK_DAMAGE"; multiplier: number } |
    { effect: "MULTI_TARGET"; targets: number } |
    { effect: "GATE_INVULNERABLE" } |
    { effect: "SUMMON_CHARGE" | "MIND_LOCK" | "TIMED_BLAST" | "HAND_SPEED" | "ZHOU_LOVE" | "DRAGON_POISON" | "KING_MERCY" }
);
/** 本轮确认的分身冲锋节奏；时间用战斗步，距离用720图宽逻辑单位。 */
const summonPace = { gatherTicks: 12, startDelayTicks: 7, minSpeed: 125, maxSpeed: 175, gateInset: 7 } as const;
/** 分身散在约两个塔身长的路段内；横向分位覆盖两侧，前后间距错开避免形成横排。 */
export const SUMMON_CHARGE = {
    ...summonPace,
    count: 20, formationDepth: 166, laneSpread: .94,
    // 分身用较窄的脚部占地贴路；角色素材和显示尺寸的调整只影响表现。
    footprint: { halfWidth: 10, back: 16, front: 3 },
    // 半径涵盖分身与怪物的脚部，首领占地更宽。纵深以脚底而非头部或武器判定。
    contact: { ordinary: { x: 24, y: 14 }, boss: { x: 33, y: 19 } },
    // 对每只首领每次冲锋最多结算三次伤害；百分比基于出生生命值。
    bossHitPercent: 15, bossMaxPercent: 45,
    // 覆盖最迟起跑和最慢分身跑完整段路；全员退场时提前结束。
    maxTicks: summonPace.gatherTicks + summonPace.startDelayTicks +
        Math.ceil((PATH_LENGTH - summonPace.gateInset) / (summonPace.minSpeed * RULE.step))
} as const;
export const DEFAULT_TACTIC = "KING_HEART";
/** 用户确认的第二种战技标识；存档及战前快照使用，不能随显示名称改动。 */
export const RAGE_TACTIC = "BAIYILIANG_RAGE";
/** 2026-11-15确认的城门保护战技；用于存档和战前快照，显示名调整不改此标识。 */
export const SHIELD_TACTIC = "ERNAN_SHIELD";
/** 2026-11-16确认的三目标齐射战技；存档/战前快照标识，不随显示名称改变。 */
export const SPLIT_TACTIC = "SPLIT_SUPER";
/** 1.0.53 的召唤战技标识，用于战前快照和已学战技列表。 */
export const SUMMON_TACTIC = "ZHIZHUO_SUMMON";
/** 留诊战技的稳定存档标识；显示名称可独立调整。 */
export const MIND_LOCK_TACTIC = "SONGLEI_MIND_LOCK";
/** 泻火的唯一击杀半径为 140 地图逻辑像素，预览、波纹与判定共用。 */
export const BLAST_TACTIC = "MENGZHAOYI_BLAST";
export const TIMED_BLAST = {
    icon: "icon_tactic_blast", delaySeconds: 3, radius: 140
} as const;
/** 连点战技的稳定存档标识。用最大生命比例维持后期作用，首领倍率保留撞门压力。 */
export const HAND_SPEED_TACTIC = "MINGBO_HAND_SPEED";
/** 4 个实际游玩秒内第 15 次有效点按立即压低在场敌人血量。比例以各自最大生命计，只减不增。 */
export const HAND_SPEED = {
    icon: "icon_tactic_hand_speed", seconds: 4, burstTaps: 15, burstRemainingPercent: 10,
    ordinaryPermille: 30, bossPermille: 10
} as const;
/** 周博战技的持久身份。成功清场后，本夜后续来敌（包括首领和召唤怪）以此比例进入，最大生命沿用原值。 */
export const ZHOU_LOVE_TACTIC = "ZHOU_BO_LOVE";
export const ZHOU_LOVE_SPAWN_HEALTH_PERCENT = 65;
/** 男村民更多或人数持平时，沿用按最大生命恢复的比例。 */
export const ZHOU_LOVE_HEAL = 0.25;
/** 稳定存档标识。本夜来敌在施放时或入场时染毒，伤害按最大生命的千分比结算。 */
export const DRAGON_POISON_TACTIC = "LONGLONG_POISON";
/** 一次施放覆盖本波；每只怪的基础毒效单独计时，击杀最多给当时仍中毒的敌人延长三秒。 */
export const DRAGON_POISON = {
    icon: "icon_tactic_dragon_poison", seconds: 6, intervalTicks: 1 / RULE.step,
    smallPermille: 40, bossPermille: 15, maxExtraSeconds: 3
} as const;
/** 怜悯的固定存档标识。献纳按确认时的库存向上取整，冷却为基础波数加累计成功施放次数。 */
export const KING_MERCY_TACTIC = "KING_MERCY";
export const KING_MERCY = { offeringPercent: 50, minimumCoins: 20, baseCooldownWaves: 5 } as const;
/** 以战斗秒配置沿用固定逻辑步，卡片显示常速下玩家看到的秒数。 */
const SHIELD_SECONDS = 12, SPLIT_SECONDS = 15, MIND_LOCK_SECONDS = 9;
const ATTACK_BOOST_SECONDS = RULE.bellTicks * RULE.step / RULE.battleSpeed;

/** 每守住五波开放一项。档位费用随学习进度递增，最高档仍可用初始仓储支付。 */
const tacticLearning = [
    { unlockWaves: 0, coins: 0 },
    { unlockWaves: 5, coins: 45 },
    { unlockWaves: 10, coins: 60 },
    { unlockWaves: 15, coins: 80 },
    { unlockWaves: 20, coins: 100 },
    { unlockWaves: 25, coins: 125 },
    { unlockWaves: 30, coins: 150 },
    { unlockWaves: 35, coins: 180 },
    // 可一次清掉在场首领，学习安排在目前技能阶梯的最后一档。
    { unlockWaves: 40, coins: 205 },
    // 保持五波阶梯，最高价格仍可用初始仓储支付。
    { unlockWaves: 45, coins: 230 },
    { unlockWaves: 50, coins: 260 }
] as const;
export const TACTICS: readonly TacticDefinition[] = [{
    id: DEFAULT_TACTIC, name: "大王之心", icon: "icon_crowned_heart", order: 0,
    summary: `全塔攻速 +50% · 持续 ${ATTACK_BOOST_SECONDS} 秒`,
    lore: `先贤${DELIVERY_HERO.givenName}一单一单攒下尔币，把文明里村建了起来。后来他连守夜的单都接。城门一响铃，守塔人便连射不停。后人称那声铃为「大王之心」，他本人管这叫催单。`,
    ...tacticLearning[0],
    effect: "ATTACK_SPEED", ticks: RULE.bellTicks, cooldownSeconds: 18, multiplier: RULE.bellSpeedMultiplier
}, {
    id: SHIELD_TACTIC, name: "二楠之盾", icon: "icon_tactic_shield", order: 1,
    summary: `城门无敌 · 持续 ${SHIELD_SECONDS / RULE.battleSpeed} 秒`,
    lore: "二楠是文明里村最出色的厨师。敌军来袭的那一夜，他搁下了厨刀，从此未再回到炉火旁。多年以后，村里人已说不清他最拿手的是哪道菜，却还记得，那夜的城门始终没有打开。",
    ...tacticLearning[1],
    effect: "GATE_INVULNERABLE", ticks: SHIELD_SECONDS / RULE.step, cooldownSeconds: 18
}, {
    id: RAGE_TACTIC, name: "百毅靓之怒", icon: "icon_tactic_rage", order: 2,
    summary: `全塔伤害 +50% · 持续 ${ATTACK_BOOST_SECONDS} 秒`,
    lore: "相传，文明里村的三位开拓者曾立誓并肩，生死与共。至于谁是谁的爹，三人争了一辈子。直到敌军兵临城下，塔上齐声喝道：「退后，让爹来！」",
    ...tacticLearning[2],
    // 与大王之心等长；独立伤害乘区1.5在最终取整前计算。
    effect: "ATTACK_DAMAGE", ticks: RULE.bellTicks, cooldownSeconds: 18, multiplier: 1.5
}, {
    id: SPLIT_TACTIC, name: "分裂术·超", icon: "icon_arrow", order: 3,
    summary: `全塔齐射 3 目标 · 持续 ${SPLIT_SECONDS / RULE.battleSpeed} 秒`,
    lore: "相传，守塔人超生得一副讨喜的模样，风流之名传遍了整条友谊路。他能一面同三个姑娘调笑，一面盯住三路来敌。后来，守塔人学会了他的三路齐射，至于他怎么哄得三个姑娘都不生气，至今无人参透。",
    ...tacticLearning[3],
    // 保持每轮三目标及各塔原攻速。
    effect: "MULTI_TARGET", ticks: SPLIT_SECONDS / RULE.step, cooldownSeconds: 19, targets: 3
}, {
    id: BLAST_TACTIC, name: "孟昭易·泻火", buttonName: "泻火", icon: TIMED_BLAST.icon, order: 4,
    summary: `点路面埋弹 · ${TIMED_BLAST.delaySeconds / RULE.battleSpeed} 秒后引爆，范围内敌人全灭`,
    lore: `孟昭易曾是村中德高望重的长者，因一桩不苟之事，被${HERO.name}放逐。那桩事究竟是什么，无人知晓。村庄遇袭时，他闻讯毅然归来。自那一夜起，旧事再无人提及。`,
    ...tacticLearning[4],
    effect: "TIMED_BLAST", ticks: TIMED_BLAST.delaySeconds / RULE.step, cooldownSeconds: 20, usesPerNight: 2
}, {
    id: MIND_LOCK_TACTIC, name: "宋磊·留诊", icon: "icon_view", order: 5,
    summary: `全场怪物停步 ${MIND_LOCK_SECONDS / RULE.battleSpeed} 秒 · 首领也会停步`,
    lore: "吴家窑诊所的旧簿里，宋磊的名字排在头一页。他早年替村民诊心，最常开的医嘱是少动心思。后来他弃医从淫，自己头一个违了医嘱。村里至今还留着他的诊签，背面只写四个字：「照我说的。」",
    ...tacticLearning[5],
    effect: "MIND_LOCK", ticks: MIND_LOCK_SECONDS / RULE.step, cooldownSeconds: 16
}, {
    id: HAND_SPEED_TACTIC, name: "明波的手速", buttonName: "手速", icon: HAND_SPEED.icon, order: 6,
    summary: `冻结战场 · 连点 ${HAND_SPEED.burstTaps} 次压至 ${HAND_SPEED.burstRemainingPercent}% 血量`,
    lore: "明波是文明里村最讲义气的人，手速也是全村第一。守夜人常说，找明波帮忙，最好先把话想清楚。你才喊出一个「明」字，他已经出手了。",
    ...tacticLearning[6],
    // 连点结束后战斗时钟恢复，26 秒后可再次使用。长夜能再出手，近门时仍需要把握时机。
    effect: "HAND_SPEED", ticks: HAND_SPEED.seconds / RULE.step, cooldownSeconds: 26
}, {
    id: SUMMON_TACTIC, name: `${HERO.givenName}的召唤`, icon: HERO.portrait, order: 7,
    summary: `${SUMMON_CHARGE.count} 名${HERO.givenName}分身冲锋`,
    detail: `${HERO.name}召出 ${SUMMON_CHARGE.count} 名分身\n一人换一小怪\n每只首领最多扣 ${SUMMON_CHARGE.bossMaxPercent}% 最大生命`,
    lore: `${HERO.givenName}是文明里村的第一任村长，深得民心。相传他举起一对旧酒瓶，瓶口一碰，城门前便站满了和他一模一样的「老谭儿」。那阵仗，连守门人也数不清哪位才是村长。`,
    ...tacticLearning[7],
    effect: "SUMMON_CHARGE", ticks: SUMMON_CHARGE.maxTicks, cooldownSeconds: 24, usesPerNight: 2
}, {
    id: ZHOU_LOVE_TACTIC, name: "周博的爱", icon: "icon_heart", order: 8,
    summary: `女村民更多：清场，后续来敌剩 ${ZHOU_LOVE_SPAWN_HEALTH_PERCENT}% 生命\n男多或持平：在场来敌回复 ${ZHOU_LOVE_HEAL * 100}% 最大生命`,
    lore: "少年曾有凌云志，为情所困伴酒眠。\n城下敌军催战鼓，案头旧信压经年。\n酒醒挥手千军倒，醉里偏教敌命延。\n功过两页留灯下，且看今宵写哪边。",
    ...tacticLearning[8],
    effect: "ZHOU_LOVE", ticks: 0, cooldownSeconds: SINGLE_USE_COOLDOWN, usesPerNight: 1
}, {
    id: DRAGON_POISON_TACTIC, name: "龙龙主母", buttonName: "主母", icon: DRAGON_POISON.icon, order: 9,
    summary: `整波来敌入场染毒 · 击倒中毒怪续时\n小怪基础扣 ${DRAGON_POISON.smallPermille * DRAGON_POISON.seconds / 10}%，首领扣 ${DRAGON_POISON.bossPermille * DRAGON_POISON.seconds / 10}% 最大生命`,
    lore: "龙龙冲阵浑似莽夫，下毒时连敌人的脚步都算得准。村人把「主」去一点，往「母」上一搁，凑成个「毒」字，便喊他「主母」。至于他好龙阳的传闻，村里至今没人说得准。",
    ...tacticLearning[9],
    effect: "DRAGON_POISON", ticks: DRAGON_POISON.seconds * DRAGON_POISON.intervalTicks, cooldownSeconds: SINGLE_USE_COOLDOWN, usesPerNight: 1
}, {
    id: KING_MERCY_TACTIC, name: "大王的怜悯", buttonName: "怜悯", icon: "icon_shield", order: 10,
    summary: "献出半数尔币 · 击败在场敌军，修满城门",
    lore: `旧祠账册里，${DELIVERY_HERO.givenName}的急单都记在一本账上。只要村里喊救命，外卖大王便清场、修门，全给送到。至于半袋尔币，账上只写了五个字：夜间配送费。`,
    ...tacticLearning[10],
    effect: "KING_MERCY", ticks: 0, cooldownSeconds: 0, usesPerNight: 1
}];

/** 从常速显示换算到战斗步。暂停、减速由战斗时钟统一管理。 */
export function tacticCooldownTicks(tactic: TacticDefinition) {
    return tactic.cooldownSeconds * RULE.battleSpeed / RULE.step;
}

/** 配置错误直接暴露，不能把未知技能静默当成默认技能。供启动与配置测试共用。 */
export function validateTactics(definitions: readonly TacticDefinition[] = TACTICS) {
    const seen = new Set<string>();
    for (const t of definitions) {
        // 战技选择在守夜前即可打开，图标随进村素材准备。
        if (![t.id, t.name, t.icon, t.summary, t.lore].every(v => typeof v === "string" && v.trim().length > 0) ||
            seen.has(t.id) || !(t.effect === "TIMED_BLAST" ? t.icon === TIMED_BLAST.icon :
                t.effect === "HAND_SPEED" ? t.icon === HAND_SPEED.icon :
                    t.effect === "DRAGON_POISON" ? t.icon === DRAGON_POISON.icon : RESOURCE_CONTRACT.village.frames.includes(t.icon)) ||
            ![t.order, t.unlockWaves, t.coins].every(n => Number.isSafeInteger(n) && n >= 0) ||
            !["ATTACK_SPEED", "ATTACK_DAMAGE", "GATE_INVULNERABLE", "MULTI_TARGET", "SUMMON_CHARGE", "MIND_LOCK", "TIMED_BLAST", "HAND_SPEED", "ZHOU_LOVE", "DRAGON_POISON", "KING_MERCY"].includes(t.effect) ||
            (t.usesPerNight !== undefined && (!Number.isSafeInteger(t.usesPerNight) || t.usesPerNight < 1)) ||
            !Number.isSafeInteger(t.cooldownSeconds) || !Number.isSafeInteger(tacticCooldownTicks(t)) ||
            (t.effect === "KING_MERCY" ? t.cooldownSeconds !== 0 || t.usesPerNight !== 1 : t.cooldownSeconds <= 0) ||
            !Number.isSafeInteger(t.ticks) || (t.effect === "ZHOU_LOVE" || t.effect === "KING_MERCY" ? t.ticks !== 0 : t.ticks <= 0) ||
            (t.effect === "MULTI_TARGET" ? !Number.isSafeInteger(t.targets) || t.targets < 2 || t.targets > RULE.effectCap || "multiplier" in t :
                t.effect === "ATTACK_SPEED" || t.effect === "ATTACK_DAMAGE" ?
                    !Number.isFinite(t.multiplier) || t.multiplier <= 0 : "multiplier" in t))
            throw new Error("战技配置无效");
        seen.add(t.id);
    }
    const initial = definitions.find(t => t.id === DEFAULT_TACTIC);
    if (!initial || initial.unlockWaves !== 0 || initial.coins !== 0)
        throw new Error("初始战技必须免费可用");
}
export function tacticDefinition(id: string): TacticDefinition {
    const found = TACTICS.find(t => t.id === id);
    if (!found) throw new Error("战技不存在");
    return found;
}
validateTactics();
