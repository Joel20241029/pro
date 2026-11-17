import { RULE } from "./RuleConfig";
import { RESOURCE_CONTRACT } from "./ResourceManifest";

/** 每场守夜最多两次，按下即开始计算 21 个战斗秒。效果、冷却和暂停共用固定战斗步。 */
export const TACTIC_USE = { perNight: 2, cooldownTicks: 21 / RULE.step } as const;
const useDescription = `每夜最多 ${TACTIC_USE.perNight} 次，冷却 ${TACTIC_USE.cooldownTicks * RULE.step} 个战斗秒。`;

/** 村庄战技与村民专长分离；目录只登记已实现的效果。
 * 波数是当前村庄成功防守数，木粮为一次学习费用，已学会后的更换/施放免费。
 * 持续时间使用固定战斗步，暂停与倍速由原战斗时钟管理；更改效果需重新调平。
 */
interface TacticBase {
    id: string; name: string; icon: string; order: number;
    summary: string; description: string;
    unlockWaves: number; wood: number; food: number;
    ticks: number;
}
// 各效果只携带自己的参数；保护城门、齐射不能被当成攻速倍率。
export type TacticDefinition = TacticBase & (
    { effect: "ATTACK_SPEED" | "ATTACK_DAMAGE"; multiplier: number } |
    { effect: "MULTI_TARGET"; targets: number } |
    { effect: "GATE_INVULNERABLE" }
);
export const DEFAULT_TACTIC = "KING_HEART";
/** 用户确认的第二种战技标识；存档及战前快照使用，不能随显示名称改动。 */
export const RAGE_TACTIC = "BAIYILIANG_RAGE";
/** 2026-11-15确认的城门保护战技；用于存档和战前快照，显示名调整不改此标识。 */
export const SHIELD_TACTIC = "ERNAN_SHIELD";
/** 2026-11-16确认的三目标齐射战技；存档/战前快照标识，不随显示名称改变。 */
export const SPLIT_TACTIC = "SPLIT_SUPER";
export const TACTICS: readonly TacticDefinition[] = [{
    id: DEFAULT_TACTIC, name: "大王之心", icon: "icon_crowned_heart", order: 0,
    summary: "全塔攻速 +50% · 持续 15 秒",
    description: `全部驻塔攻速 +50%，持续 15 个战斗秒。\n${useDescription}\n单次伤害不变，暂停时冻结计时。`,
    unlockWaves: 0, wood: 0, food: 0,
    effect: "ATTACK_SPEED", ticks: RULE.bellTicks, multiplier: RULE.bellSpeedMultiplier
}, {
    id: RAGE_TACTIC, name: "百毅靓之怒", icon: "icon_tactic_rage", order: 1,
    summary: "全塔伤害 +50% · 持续 15 秒",
    description: `全部驻塔伤害 +50%，持续 15 个战斗秒。\n${useDescription}\n攻速与减速维持原效果。`,
    // doc/tech/46：首个年度首领后开放，12波、180木90粮；学习后免费切换/施放。
    unlockWaves: 12, wood: 180, food: 90,
    // 与大王之心等长；独立伤害乘区1.5在既有护甲和最终取整前计算，不新增破甲。
    effect: "ATTACK_DAMAGE", ticks: RULE.bellTicks, multiplier: 1.5
}, {
    id: SHIELD_TACTIC, name: "二楠之盾", icon: "icon_tactic_shield", order: 2,
    summary: "城门无敌 · 持续 8 秒",
    description: `城门免疫所有触门伤害，持续 8 个战斗秒。\n${useDescription}\n敌人到门后退场，城门保持当前耐久。`,
    // doc/tech/46：第三年度后开放，36波、600木300粮，形成中期目标。
    unlockWaves: 36, wood: 600, food: 300,
    // 8个战斗秒覆盖普通怪和首领；仅阻止扣城门耐久，不改变攻击、退场和结算。
    effect: "GATE_INVULNERABLE", ticks: 8 / RULE.step
}, {
    id: SPLIT_TACTIC, name: "分裂术·超", icon: "icon_arrow", order: 3,
    summary: "全塔齐射 3 目标 · 持续 15 秒",
    description: `全塔最多齐射 3 目标，持续 15 个战斗秒。\n${useDescription}\n石塔同轮每只怪只受一次伤，寒塔照常减速。`,
    // doc/tech/46：第六年度后开放，72波、1500木750粮；保留三目标齐射原规则。
    unlockWaves: 72, wood: 1500, food: 750,
    // 与大王之心等长；每轮最多3个独立主目标，不足时不重复选人，不增加射程或攻速。
    effect: "MULTI_TARGET", ticks: RULE.bellTicks, targets: 3
}];

/** 配置错误直接暴露，不能把未知技能静默当成默认技能。供启动与配置测试共用。 */
export function validateTactics(definitions: readonly TacticDefinition[] = TACTICS) {
    const seen = new Set<string>();
    for (const t of definitions) {
        // 战技选择在守夜前即可打开，图标随进村素材准备。
        if (![t.id, t.name, t.icon, t.summary, t.description].every(v => typeof v === "string" && v.length > 0) ||
            seen.has(t.id) || !RESOURCE_CONTRACT.village.frames.includes(t.icon) ||
            ![t.order, t.unlockWaves, t.wood, t.food].every(n => Number.isSafeInteger(n) && n >= 0) ||
            !["ATTACK_SPEED", "ATTACK_DAMAGE", "GATE_INVULNERABLE", "MULTI_TARGET"].includes(t.effect) ||
            !Number.isSafeInteger(t.ticks) || t.ticks <= 0 || t.ticks > TACTIC_USE.cooldownTicks ||
            (t.effect === "MULTI_TARGET" ? !Number.isSafeInteger(t.targets) || t.targets < 2 || t.targets > RULE.enemyCap || "multiplier" in t :
                t.effect === "GATE_INVULNERABLE" ? "multiplier" in t : !Number.isFinite(t.multiplier) || t.multiplier <= 0))
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
