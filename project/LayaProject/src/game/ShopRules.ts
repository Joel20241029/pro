import { featureUnlocked } from "../config/DailyTaskConfig";
import { ItemId, LIANG_ESSENCE, SHOP_PRODUCTS } from "../config/ShopConfig";
import { GameState, isWorkingAdult } from "./GameState";
import { patrolCaptain, patrolSpinStats } from "./PatrolRules";

export function shopOffer(state: GameState, id: ItemId) {
    const product = SHOP_PRODUCTS.find(item => item.id === id);
    if (!product || state.phase !== "DAY" || !featureUnlocked(state.legacy.bestNight, "shop"))
        throw new Error("当前无法购买此商品");
    return { product, affordable: state.wood >= product.wood && state.food >= product.food };
}

export function essenceTargets(state: GameState) {
    if (state.phase !== "DAY" || !featureUnlocked(state.legacy.bestNight, "backpack")) return [];
    return state.people.filter(p => isWorkingAdult(p) && (p.retirementDelayUses ?? 0) < LIANG_ESSENCE.maxUses);
}

export function patrolRationUnavailable(state: GameState) {
    if (state.phase !== "DAY" || !featureUnlocked(state.legacy.bestNight, "backpack")) return "白天才可在背包使用";
    if (!state.patrol.captain) return "先任命淡紫队长";
    if (state.patrol.rationReady) return "下场守夜已有口粮加成";
    if (!Number.isSafeInteger(patrolSpinStats(state.patrol.level, patrolCaptain(state), true).damage)) return "伤害已达安全范围";
    return null;
}
