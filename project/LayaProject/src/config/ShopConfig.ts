/** 道具 ID 用于独立背包存档。下架时只移除 SHOP_PRODUCTS 中的引用，保留已有道具定义。 */
export const ITEMS = {
    food_bag: { name: "粮袋", description: "补充粮食", icon: "icon_food" },
    wood_pack: { name: "木材包", description: "补充木材", icon: "icon_wood" },
    gate_kit: { name: "修门工具", description: "用于修补城门", icon: "icon_build" },
    patrol_ration: { name: "巡防口粮", description: "下一场守夜淡紫儿旋甩伤害 +50%", icon: "icon_food" },
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

/** 按商品上架顺序陈列。道具下架后保留 ITEMS 定义，背包仍可识别及使用。 */
/** 玩家确认的单夜补给。白天使用后下一夜伤害提高 50%，不叠加，补员间隔不变。 */
export const PATROL_RATION = { id: "patrol_ration", food: 40, wood: 20, damageMultiplier: 1.5 } as const;

export const SHOP_PRODUCTS: readonly { readonly id: ItemId; readonly food: number; readonly wood: number }[] = [LIANG_ESSENCE, PATROL_RATION];
