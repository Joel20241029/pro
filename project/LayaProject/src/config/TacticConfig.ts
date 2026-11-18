import { RULE } from "./RuleConfig";
import { RESOURCE_CONTRACT } from "./ResourceManifest";
import { PATH_LENGTH } from "../game/BattleRoad";

/** 每场守夜最多两次，按下即开始计算 21 个战斗秒。效果、冷却和暂停共用固定战斗步。 */
export const TACTIC_USE = { perNight: 2, cooldownTicks: 21 / RULE.step } as const;

/** 村庄战技与村民专长分离；目录只登记已实现的效果。
 * 波数是当前村庄成功防守数，木粮为一次学习费用，已学会后的更换/施放免费。
 * 持续时间使用固定战斗步，暂停与倍速由原战斗时钟管理；更改效果需重新调平。
 */
interface TacticBase {
    id: string; name: string; icon: string; order: number;
    summary: string; lore: string;
    unlockWaves: number; wood: number; food: number;
    ticks: number; usesPerNight: number;
}
// 各效果只携带自己的参数；保护城门、齐射不能被当成攻速倍率。
export type TacticDefinition = TacticBase & (
    { effect: "ATTACK_SPEED" | "ATTACK_DAMAGE"; multiplier: number } |
    { effect: "MULTI_TARGET"; targets: number } |
    { effect: "GATE_INVULNERABLE" } |
    { effect: "SUMMON_CHARGE" }
);
/** 本轮确认的分身冲锋节奏；时间用战斗步，距离用720图宽逻辑单位。 */
const summonPace = { gatherTicks: 12, startDelayTicks: 7, minSpeed: 125, maxSpeed: 175, gateInset: 7 } as const;
/** 分身散在约两个塔身长的路段内；横向分位覆盖两侧，前后间距错开避免形成横排。 */
export const SUMMON_CHARGE = {
    ...summonPace,
    count: 20, formationDepth: 166, laneSpread: .94,
    // 原黄色胖村民动画缩小后以更窄的脚部范围贴路，不沿用放大怪物的占地。
    footprint: { halfWidth: 10, back: 16, front: 3 },
    // 半径涵盖分身与怪物的脚部，首领占地更宽。纵深以脚底而非头部或武器判定。
    contact: { ordinary: { x: 24, y: 14 }, boss: { x: 33, y: 19 } },
    // 覆盖最迟起跑和最慢分身跑完整段路；全员退场时提前结束。
    maxTicks: summonPace.gatherTicks + summonPace.startDelayTicks +
        Math.ceil((PATH_LENGTH - summonPace.gateInset) / (summonPace.minSpeed * RULE.step)),
    usesPerNight: 1
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
export const TACTICS: readonly TacticDefinition[] = [{
    id: DEFAULT_TACTIC, name: "大王之心", icon: "icon_crowned_heart", order: 0,
    summary: "全塔攻速 +50% · 持续 15 秒",
    lore: "大王是文明里村的第一位先贤。他以一身骨血守护这片土地，直到最后一息。自那以后，每逢长夜，守塔人总会敲响第一声钟——为来敌示警，也为后人记得他的名字。",
    unlockWaves: 0, wood: 0, food: 0,
    effect: "ATTACK_SPEED", ticks: RULE.bellTicks, usesPerNight: TACTIC_USE.perNight, multiplier: RULE.bellSpeedMultiplier
}, {
    id: RAGE_TACTIC, name: "百毅靓之怒", icon: "icon_tactic_rage", order: 1,
    summary: "全塔伤害 +50% · 持续 15 秒",
    lore: "相传，文明里村的三位开拓者曾立誓并肩，生死与共。至于谁是谁的爹，三人争了一辈子。直到敌军兵临城下，塔上齐声喝道：「退后，让爹来！」",
    // 1.0.52 守夜每10波揭晓一项。三项费用按该阶段可攒库存试算，均低于初始单项仓储。
    unlockWaves: 10, wood: 40, food: 20,
    // 与大王之心等长；独立伤害乘区1.5在既有护甲和最终取整前计算，不新增破甲。
    effect: "ATTACK_DAMAGE", ticks: RULE.bellTicks, usesPerNight: TACTIC_USE.perNight, multiplier: 1.5
}, {
    id: SHIELD_TACTIC, name: "二楠之盾", icon: "icon_tactic_shield", order: 2,
    summary: "城门无敌 · 持续 8 秒",
    lore: "二楠是文明里村最出色的厨师。敌军来袭的那一夜，他搁下了厨刀，从此未再回到炉火旁。多年以后，村里人已说不清他最拿手的是哪道菜，却还记得，那夜的城门始终没有打开。",
    // 第二项在守住20波后开放，粮木费用高于第一项。
    unlockWaves: 20, wood: 60, food: 30,
    // 8个战斗秒覆盖普通怪和首领；仅阻止扣城门耐久，不改变攻击、退场和结算。
    effect: "GATE_INVULNERABLE", ticks: 8 / RULE.step, usesPerNight: TACTIC_USE.perNight
}, {
    id: SPLIT_TACTIC, name: "分裂术·超", icon: "icon_arrow", order: 3,
    summary: "全塔齐射 3 目标 · 持续 15 秒",
    lore: "相传，守塔人超生得一副讨喜的模样，风流之名传遍了整条友谊路。他能一面同三个姑娘调笑，一面盯住三路来敌。后来，守塔人学会了他的三路齐射，至于他怎么哄得三个姑娘都不生气，至今无人参透。",
    // 第三项在守住30波后开放，保留三目标齐射原规则。
    unlockWaves: 30, wood: 80, food: 40,
    // 与大王之心等长；每轮最多3个独立主目标，不足时不重复选人，不增加射程或攻速。
    effect: "MULTI_TARGET", ticks: RULE.bellTicks, usesPerNight: TACTIC_USE.perNight, targets: 3
}, {
    id: SUMMON_TACTIC, name: "智卓的召唤", icon: "portrait_hd_straw_down_idle", order: 4,
    summary: `召出 ${SUMMON_CHARGE.count} 名分身冲锋 · 一人换一怪`,
    lore: "智卓是文明里村的第一任村长，深得民心。相传，他无需战鼓，也无需号角。只消一声召唤，便有无数老谭儿甘愿为他赴阵，至死不退。",
    // 延续每10波揭晓。一次性学习费用低于初级仓储，施放不扣粮木及村庄人口。
    unlockWaves: 40, wood: 120, food: 60,
    effect: "SUMMON_CHARGE", ticks: SUMMON_CHARGE.maxTicks, usesPerNight: SUMMON_CHARGE.usesPerNight
}];

/** 配置错误直接暴露，不能把未知技能静默当成默认技能。供启动与配置测试共用。 */
export function validateTactics(definitions: readonly TacticDefinition[] = TACTICS) {
    const seen = new Set<string>();
    for (const t of definitions) {
        // 战技选择在守夜前即可打开，图标随进村素材准备。
        if (![t.id, t.name, t.icon, t.summary, t.lore].every(v => typeof v === "string" && v.trim().length > 0) ||
            seen.has(t.id) || !RESOURCE_CONTRACT.village.frames.includes(t.icon) ||
            ![t.order, t.unlockWaves, t.wood, t.food].every(n => Number.isSafeInteger(n) && n >= 0) ||
            !["ATTACK_SPEED", "ATTACK_DAMAGE", "GATE_INVULNERABLE", "MULTI_TARGET", "SUMMON_CHARGE"].includes(t.effect) ||
            !Number.isSafeInteger(t.usesPerNight) || t.usesPerNight < 1 || t.usesPerNight > TACTIC_USE.perNight ||
            !Number.isSafeInteger(t.ticks) || t.ticks <= 0 || t.ticks > TACTIC_USE.cooldownTicks ||
            (t.effect === "MULTI_TARGET" ? !Number.isSafeInteger(t.targets) || t.targets < 2 || t.targets > RULE.enemyCap || "multiplier" in t :
                t.effect === "ATTACK_SPEED" || t.effect === "ATTACK_DAMAGE" ?
                    !Number.isFinite(t.multiplier) || t.multiplier <= 0 : "multiplier" in t))
            throw new Error("战技配置无效");
        seen.add(t.id);
    }
    const initial = definitions.find(t => t.id === DEFAULT_TACTIC);
    if (!initial || initial.unlockWaves !== 0 || initial.wood !== 0 || initial.food !== 0)
        throw new Error("初始战技必须免费可用");
}
export function tacticDefinition(id: string): TacticDefinition {
    const found = TACTICS.find(t => t.id === id);
    if (!found) throw new Error("战技不存在");
    return found;
}
validateTactics();
