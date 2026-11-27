import { TOWER_AMMO, TowerKind } from "./DefenseConfig";
import { PATROL } from "./PatrolConfig";

/** 越秀路六家只赌基础守夜奖的一部分；80 的上限让 24 币的道具在长期保持负期望。 */
export const YUEXIU_DICE = {
    id: "yuexiu_dice", coins: 24, stakeCap: 80, faces: 6, highFrom: 4, highMultiplier: 2, lowMultiplier: .5
} as const;
export function nightRewardMultiplier(roll: number | undefined) {
    if (roll === undefined) return 1;
    return roll >= YUEXIU_DICE.highFrom ? YUEXIU_DICE.highMultiplier : YUEXIU_DICE.lowMultiplier;
}
export function nightRewardWithDice(baseCoins: number, roll: number | undefined) {
    const stake = Math.min(baseCoins, YUEXIU_DICE.stakeCap);
    return baseCoins - stake + Math.floor(stake * nightRewardMultiplier(roll));
}
/** 道具 ID 用于独立背包存档。下架时只移除 SHOP_PRODUCTS 中的引用，保留已有道具定义。 */
export const ITEMS = {
    ice_ammo: { name: TOWER_AMMO.SLOW.name, description: "永久解锁，可在石炮塔中装配", icon: TOWER_AMMO.SLOW.icon },
    gate_kit: { name: "修门工具", description: "使用后修复一次城门耐久", icon: "icon_build" },
    patrol_ration: { name: "靓哥的底线", description: `下次使用「${PATROL.spin.name}」守夜，砸地伤害 +50%`, icon: "icon_liang_briefs" },
    liang_indulgence: { name: "靓哥的放纵", description: `下次使用「${PATROL.spin.name}」守夜，砸地半径 +25%`, icon: "icon_liang_bra" },
    yuexiu_dice: { name: "越秀路六家", description: `下场守夜基础奖励中最多 ${YUEXIU_DICE.stakeCap} 尔币参与投掷。1–3 点减半，4–6 点翻倍。`, icon: "icon_yuexiu_cards" },
    liang_essence: { name: "靓哥的精华", description: "成年村民随机延后退休 5–20 夜", icon: "icon_liang_essence" }
} as const;
export type ItemId = keyof typeof ITEMS;
export function itemDefinition(id: string) {
    return Object.prototype.hasOwnProperty.call(ITEMS, id) ? ITEMS[id as ItemId] : undefined;
}

/** 每次随机延寿 5–20 夜，一生至多使用三瓶；价格按尔币经济重定。 */
export const LIANG_ESSENCE = {
    id: "liang_essence", coins: 115, minNights: 5, maxNights: 20, maxUses: 3,
    lore: "宇宙大帝靓哥身体不适，找宋大夫诊治。经过一夜翻云覆雨，两人无意间提取出一种能延年益寿的神秘物质。究竟如何萃取，至今仍是村里的谜团。",
    line: "靓哥，我好了"
} as const;

/** 靓哥的底线沿用原背包 ID。白天使用后下次旋甩守夜伤害提高 50%，同一夜仅可准备一份。 */
export const PATROL_RATION = {
    id: "patrol_ration", coins: 45, damageMultiplier: 1.5,
    lore: "淡紫儿们把靓哥的红底裤往旗杆上一挂，个个精神抖擞，甩起人来格外卖力。"
} as const;

/** 与底线同价；一件使下次旋甩守夜的砸地半径增加四分之一，命中面积随半径的平方变化。 */
export const LIANG_INDULGENCE = {
    id: "liang_indulgence", coins: 45, radiusMultiplier: 1.25,
    lore: "村中人称靓哥为「宇宙大帝」。他守了半辈子的清白，头一回没守住。那一夜的事，靓哥只字不提，村里却多了这么一件神器。"
} as const;
export type PatrolItemId = typeof PATROL_RATION.id | typeof LIANG_INDULGENCE.id;

/** 每村购买一次，直接解锁所有塔的装配资格。 */
export const ICE_AMMO_OFFER = { id: "ice_ammo", ammo: "SLOW", coins: 48 } as const;
/** 按商品上架顺序陈列，详情显示配置的传闻。道具下架后，背包仍按 ITEMS 识别。 */
export const SHOP_PRODUCTS: readonly { readonly id: ItemId; readonly coins: number; readonly ammo?: TowerKind; readonly lore?: string }[] = [LIANG_ESSENCE, PATROL_RATION, LIANG_INDULGENCE, YUEXIU_DICE, ICE_AMMO_OFFER];
