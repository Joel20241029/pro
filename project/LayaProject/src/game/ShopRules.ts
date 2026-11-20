import { featureUnlocked } from "../config/DailyTaskConfig";
import { ItemId, LIANG_ESSENCE, SHOP_PRODUCTS } from "../config/ShopConfig";
import { GameState, isWorkingAdult } from "./GameState";

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
