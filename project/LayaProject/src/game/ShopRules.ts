import { featureUnlocked } from "../config/DailyTaskConfig";
import { ItemId, LIANG_ESSENCE, LIANG_INDULGENCE, PatrolItemId, SHOP_PRODUCTS } from "../config/ShopConfig";
import { GameState, isAvailableAdult } from "./GameState";
import { gateCapacity } from "./Growth";
import { patrolCaptain, patrolSpinStats } from "./PatrolRules";

export function shopOffer(state: GameState, id: ItemId) {
    const product = SHOP_PRODUCTS.find(item => item.id === id);
    if (!product || state.phase !== "DAY" || !featureUnlocked(state.legacy.bestNight, "shop"))
        throw new Error("当前无法购买此商品");
    return { product, affordable: state.coins >= product.coins };
}

export function gateKitUnavailable(state: GameState) {
    if (state.phase !== "DAY" || !featureUnlocked(state.legacy.bestNight, "backpack")) return "白天才可在背包使用";
    return state.gate >= gateCapacity(state) ? "城门已完好" : null;
}

export function essenceTargets(state: GameState) {
    if (state.phase !== "DAY" || !featureUnlocked(state.legacy.bestNight, "backpack")) return [];
    return state.people.filter(p => isAvailableAdult(state, p) && (p.retirementDelayUses ?? 0) < LIANG_ESSENCE.maxUses);
}

export function patrolItemUnavailable(state: GameState, id: PatrolItemId) {
    if (state.phase !== "DAY" || !featureUnlocked(state.legacy.bestNight, "backpack")) return "白天才可在背包使用";
    if (!state.patrol.captain) return "先任命淡紫队长";
    if (id === LIANG_INDULGENCE.id) return state.patrol.radiusReady ? "下次旋甩已扩大砸地范围" : null;
    if (state.patrol.rationReady) return "下次旋甩已获鼓舞";
    if (!Number.isSafeInteger(patrolSpinStats(state.patrol.level, patrolCaptain(state), true).damage)) return "伤害已达安全范围";
    return null;
}

export function rewardDiceUnavailable(state: GameState) {
    if (state.phase !== "DAY" || !featureUnlocked(state.legacy.bestNight, "backpack")) return "白天才可在背包使用";
    return state.rewardDie === undefined ? null : "下场守夜的骰子点数已确定";
}
