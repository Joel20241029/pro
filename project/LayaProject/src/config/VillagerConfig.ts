/** 用户指定的两种成人外观；出生、旅人及开村统一使用，与性别和天赋分别保存。 */
export const ADULT_APPEARANCE = { MALE: "male_a", FEMALE: "female_a" } as const;
/** 2026-11-12 用户确认：普通姓名仅使用原孩子字根及旅人名，四辈儿移入精英池，移除芊芊。
 * 只影响新人物命名，不增加人口或重命名已有村民；普通孩子继续附编号，精英姓名保持原文。
 * 调整池大小会改变后续姓名的抽样概率，品质概率和能力由 VILLAGER_QUALITY 决定。
 */
export const VILLAGER_NAMES = {
    child: ["禾", "桃", "松", "竹", "杏", "川"], traveler: ["行舟", "云溪", "山青", "晚晴"],
    // 用户指定的12个名字：仅新生/来访精英使用，男女共用，不加编号。
    // 独立取名不推进业务随机流；三种特殊品质共用，普通村民不进入此池。
    special: ["旭勇", "智卓", "二百", "翟毅", "周博", "赵靓", "龙龙", "昭易", "明波", "宋磊", "徐超", "四辈儿"]
} as const;
export const TRAITS = {
    trait_crafty: ["巧手", "提高制衣收入和守夜后的制衣奖励。"],
    trait_strong: ["强健", "驻塔或担任淡紫队长时，提高攻击伤害。"],
    trait_nimble: ["灵巧", "驻塔提高攻速，任淡紫队长时缩短两种打法的准备时间。"]
} as const;
export type Trait = keyof typeof TRAITS;
export const TRAIT_POOL = Object.keys(TRAITS) as Trait[];
export const FOUNDERS = [
    { name: "阿禾", sex: "MALE", appearance: "male_a", trait: "trait_crafty", nights: 4, job: "WAITING" },
    { name: "春杏", sex: "FEMALE", appearance: "female_a", trait: "trait_crafty", nights: 6, job: "WAITING" },
    { name: "石生", sex: "MALE", appearance: "male_a", trait: "trait_strong", nights: 8, job: "WAITING" },
    { name: "青竹", sex: "FEMALE", appearance: "female_a", trait: "trait_nimble", nights: 10, job: "WAITING" },
    { name: "林川", sex: "MALE", appearance: "male_a", trait: "trait_nimble", nights: 12, job: "WAITING" },
    { name: "小满", sex: "FEMALE", appearance: "female_a", trait: "trait_strong", nights: 12, job: "WAITING" }
] as const;
