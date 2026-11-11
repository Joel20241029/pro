import { GROWTH, RULE } from "./GameConfig";
import { GameState } from "./GameState";

export type UpgradeKind = keyof typeof GROWTH.costs;
export interface UpgradeCost { wood: number; food: number; }
/** 规则、预览和存档校验共用成长计算；没有全局等级上限，也不增加同屏对象。 */
export function levelPower(level: number) { const n = level - 1; return 1 + GROWTH.powerLinear * n + GROWTH.powerQuadratic * n * n; }
export function enemyPower(day: number) { return levelPower(1 + Math.max(0, day - GROWTH.enemyStartDay) / GROWTH.enemyLevelNights); }
export function storageCapacity(s: GameState) { return RULE.storageCap + GROWTH.storagePerLevel * (s.housing - 1); }
export function gateCapacity(s: GameState) { return Math.ceil(RULE.gateMax * levelPower(s.gateLevel)); }
export function laborSlots(job: "FARM" | "LOGGING", level: number) { const slots = job === "FARM" ? RULE.farmSlots : RULE.logSlots; return slots[Math.min(level, slots.length) - 1]; }
export function laborYield(job: "FARM" | "LOGGING", level: number) { return (job === "FARM" ? RULE.farmBase : RULE.logBase) + GROWTH.productionPerLevel * (level - 1); }
export function upgradeCost(kind: UpgradeKind, level: number): UpgradeCost {
    const base = GROWTH.costs[kind], n = level - 1;
    return { wood: base.wood + GROWTH.costWoodPerLevel * n, food: base.food + GROWTH.costFoodPerLevel * n };
}
export function repairCost(s: GameState) { return RULE.repairCost + GROWTH.repairWoodPerLevel * (s.gateLevel - 1); }
/** 共同预检先指出仓储不足，再指出实际材料不足；不扣费、不改存档。 */
export function upgradeUnavailableReason(s: GameState, cost: UpgradeCost): string | null {
    if (s.phase !== "DAY") return "请在白天建设";
    if (!Number.isSafeInteger(cost.wood) || !Number.isSafeInteger(cost.food)) return "建设数值已达安全范围";
    if (Math.max(cost.wood, cost.food) > storageCapacity(s)) return "仓储不足，请先修缮民居";
    if (s.wood < cost.wood && s.food < cost.food) return "木材与粮食不足";
    if (s.wood < cost.wood) return "木材不足";
    if (s.food < cost.food) return "粮食不足";
    return null;
}
