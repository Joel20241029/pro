import { TOWERS, TOWER_AMMO, TowerKind } from "./DefenseConfig";
/** 道具 ID 用于独立背包存档。下架时只移除 SHOP_PRODUCTS 中的引用，保留已有道具定义。 */
export const ITEMS = {
    ice_ammo: { name: TOWER_AMMO.SLOW.name, description: "永久解锁，可在石炮塔中装配", icon: TOWER_AMMO.SLOW.icon },
    food_bag: { name: "粮袋", description: "补充粮食", icon: "icon_food" },
    wood_pack: { name: "木材包", description: "补充木材", icon: "icon_wood" },
    gate_kit: { name: "修门工具", description: "用于修补城门", icon: "icon_build" },
    patrol_ration: { name: "靓哥的底线", description: "下次旋甩守夜，伤害 +50%", icon: "icon_liang_briefs" },
    liang_indulgence: { name: "靓哥的放纵", description: "下次旋甩守夜，砸地半径 +25%", icon: "icon_liang_bra" },
    seed_pack: { name: "种子包", description: "农田物资", icon: "icon_food" },
    planks: { name: "备用木板", description: "建筑物资", icon: "icon_wood" },
    liang_essence: { name: "靓哥的精华", description: "成年村民随机延后退休 5–20 夜", icon: "icon_liang_essence" }
} as const;
export type ItemId = keyof typeof ITEMS;
export function itemDefinition(id: string) {
    return Object.prototype.hasOwnProperty.call(ITEMS, id) ? ITEMS[id as ItemId] : undefined;
}

/** 靓哥的精华经用户确认按 120 粮、15 木试卖。每次随机延寿 5–20 夜，一生至多使用三瓶。 */
export const LIANG_ESSENCE = {
    id: "liang_essence", food: 120, wood: 15, minNights: 5, maxNights: 20, maxUses: 3,
    lore: "宇宙大帝靓哥身体不适，找宋大夫诊治。经过一夜翻云覆雨，两人无意间提取出一种能延年益寿的神秘物质。究竟如何萃取，至今仍是村里的谜团。",
    line: "靓哥，我好了"
} as const;

/** 靓哥的底线沿用原背包 ID。白天使用后下次旋甩守夜伤害提高 50%，同一夜仅可准备一份。 */
export const PATROL_RATION = {
    id: "patrol_ration", food: 40, wood: 20, damageMultiplier: 1.5,
    lore: "淡紫儿们把靓哥的红底裤往旗杆上一挂，个个精神抖擞，甩起人来格外卖力。"
} as const;

/** 与底线同价；一件使下次旋甩守夜的砸地半径增加四分之一，命中面积随半径的平方变化。 */
export const LIANG_INDULGENCE = {
    id: "liang_indulgence", food: 40, wood: 20, radiusMultiplier: 1.25,
    lore: "村中人称靓哥为「宇宙大帝」。他守了半辈子的清白，头一回没守住。那一夜的事，靓哥只字不提，村里却多了这么一件神器。"
} as const;
export type PatrolItemId = typeof PATROL_RATION.id | typeof LIANG_INDULGENCE.id;

/** 冰弹沿用原寒塔的35木门槛，改为每村购买一次，直接解锁所有塔的装配资格。 */
export const ICE_AMMO_OFFER = { id: "ice_ammo", ammo: "SLOW", wood: TOWERS.SLOW.cost, food: 0 } as const;
/** 按商品上架顺序陈列，详情显示配置的传闻。道具下架后，背包仍按 ITEMS 识别。 */
export const SHOP_PRODUCTS: readonly { readonly id: ItemId; readonly food: number; readonly wood: number; readonly ammo?: TowerKind; readonly lore?: string }[] = [LIANG_ESSENCE, PATROL_RATION, LIANG_INDULGENCE, ICE_AMMO_OFFER];
