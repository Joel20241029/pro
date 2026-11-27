import { GROWTH, RESIDENTIAL, RULE, SEWING } from "./GameConfig";
import { VILLAGER_QUALITY } from "../config/VillagerQuality";
import { GameState, Person } from "./GameState";

export type UpgradeKind = keyof typeof GROWTH.costs;
export interface UpgradeCost { coins: number; }
/** 规则、预览和存档校验共用成长计算。 */
export function levelPower(level: number) { const n = level - 1; return 1 + GROWTH.powerLinear * n + GROWTH.powerQuadratic * n * n; }
export function enemyPower(day: number) { return 1 + Math.max(0, day - GROWTH.enemyStartDay) / GROWTH.enemyLevelNights; }
export function gateCapacity(s: GameState) { return Math.ceil(RULE.gateMax * levelPower(s.gateLevel)); }
export function sewingSlots(level: number) {
    return Math.min(RULE.populationCap, SEWING.baseSlots + SEWING.slotsPerUpgrade * (level - 1));
}
export function sewingYield(s: GameState, p: Person, period: "day" | "night") {
    const n = s.factory.level - 1;
    const quality = VILLAGER_QUALITY[p.quality];
    const crafty = p.traits.includes("trait_crafty") ? SEWING.craftyBonus : 0;
    return period === "day" ? quality.sewingDay + n * SEWING.dayPerUpgrade + crafty :
        quality.sewingNight + Math.floor(n / SEWING.nightUpgradeLevels) + crafty;
}
export function sewingDayCap(s: GameState) {
    const reference = SEWING.dayReference + s.completed * SEWING.dayReferenceStep;
    return Math.min(Math.floor(reference * SEWING.dayCapMaxRatio),
        Math.floor(reference * SEWING.dayCapBaseRatio) + (s.factory.level - 1) * SEWING.dayCapPerUpgrade);
}
export function upgradeCost(kind: UpgradeKind, level: number): UpgradeCost {
    const [base, linear, quadratic] = GROWTH.costs[kind], n = level - 1;
    return { coins: base + linear * n + quadratic * n * n };
}
export function residentialCost(level: number): UpgradeCost {
    const n = level - 1;
    return { coins: RESIDENTIAL.coinsBase + RESIDENTIAL.coinsPerLevel * n + Math.floor(RESIDENTIAL.coinsQuadratic * n * n) };
}
export function repairCost(s: GameState) { return RULE.repairCost + GROWTH.repairCoinsPerLevel * (s.gateLevel - 1); }
/** 总价按补满所需的整次修复计算，末次封顶；用于面板报价和提交时重新结算。 */
export function gateRepairQuote(s: GameState) {
    const maximum = gateCapacity(s), perRepair = Math.ceil(maximum * GROWTH.repairFraction);
    const count = Math.ceil((maximum - s.gate) / perRepair);
    return { maximum, perRepair, count, fullCost: count * repairCost(s) };
}
export function upgradeUnavailableReason(s: GameState, cost: UpgradeCost): string | null {
    if (s.phase !== "DAY") return "请在白天建设";
    if (!Number.isSafeInteger(cost.coins)) return "建设数值已达安全范围";
    if (s.coins < cost.coins) return `还缺 ${cost.coins - s.coins} 尔币`;
    return null;
}
export function residentialUpgradeReason(s: GameState) {
    if (s.houses >= RESIDENTIAL.lastBedLevel) return "民居容量已达上限";
    return upgradeUnavailableReason(s, residentialCost(s.houses));
}
