/** 用户指定的两种成人外观；出生、旅人及开村统一使用，不改变性别/天赋/专长。 */
export const ADULT_APPEARANCE = { MALE: "male_a", FEMALE: "female_a" } as const;
/** 2026-11-12 用户确认：普通姓名仅使用原孩子字根及旅人名，四辈儿移入精英池，移除芊芊。
 * 只影响新人物命名，不增加人口或重命名已有村民；普通孩子继续附编号，精英姓名保持原文。
 * 调整池大小会改变后续姓名的抽样概率，精英概率和能力仍由 ELITE 决定。
 */
export const VILLAGER_NAMES = {
    child: ["禾", "桃", "松", "竹", "杏", "川"], traveler: ["行舟", "云溪", "山青", "晚晴"],
    // 用户指定的12个名字：仅新生/来访精英使用，男女共用，不加编号。
    // 独立取名不推进业务随机流；修改只影响后续精英姓名，不改性别、5%概率、能力及已有村民。
    elite: ["旭勇", "智卓", "二百", "翟毅", "周博", "赵靓", "龙龙", "昭易", "明波", "宋磊", "徐超", "四辈儿"]
} as const;
export const TRAITS = {
    trait_diligent: ["勤耕", "耕作产粮 +20%"], trait_woodwise: ["识木", "伐木产量 +20%"],
    trait_focused: ["专注", "箭楼攻速 +15%"], trait_strong: ["强健", "石塔伤害 +20%"],
    trait_patient: ["沉稳", "寒塔减速 +10%"], trait_frugal: ["节俭", "成人每日只吃 1 粮"],
    trait_farsight: ["远见", "防塔射程 +15%"], trait_nimble: ["灵巧", "防塔攻速 +10%"]
} as const;
export const SKILLS = {
    skill_farming: ["农艺", "产粮 +20%"], skill_logging: ["伐木", "产木 +20%"],
    skill_archery: ["弓术", "箭楼伤害 +25%"], skill_throwing: ["投掷", "石塔伤害 +25%"],
    skill_warding: ["守御", "减速 +10%"], skill_nurturing: ["育幼", "照料孩子时产 2 粮"]
} as const;
export type Trait = keyof typeof TRAITS;
export type Skill = keyof typeof SKILLS;
export const FOUNDERS = [
    { name: "阿禾", sex: "MALE", appearance: "male_a", trait: "trait_diligent", skill: "skill_farming", nights: 4, job: "FARM" },
    { name: "春杏", sex: "FEMALE", appearance: "female_a", trait: "trait_frugal", skill: "skill_nurturing", nights: 6, job: "FARM" },
    { name: "石生", sex: "MALE", appearance: "male_a", trait: "trait_strong", skill: "skill_throwing", nights: 8, job: "LOGGING" },
    { name: "青竹", sex: "FEMALE", appearance: "female_a", trait: "trait_focused", skill: "skill_archery", nights: 10, job: "WAITING" },
    { name: "林川", sex: "MALE", appearance: "male_a", trait: "trait_woodwise", skill: "skill_logging", nights: 12, job: "LOGGING" },
    { name: "小满", sex: "FEMALE", appearance: "female_a", trait: "trait_farsight", skill: "skill_farming", nights: 12, job: "WAITING" }
] as const;
