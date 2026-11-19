import { ECONOMY, RESIDENTIAL } from "../config/RuleConfig";
import { VILLAGER_QUALITY } from "../config/VillagerQuality";
import { POLICIES, Policy, RULE } from "./GameConfig";
import { GameState, isElder, isWorkingAdult, Person } from "./GameState";
import { season } from "./WaveGenerator";
import { laborYield, storageCapacity } from "./Growth";
/** 村务只读查询与预检；不修改状态、不消耗随机数。 */
export function person(s: GameState, id: string): Person {
    const p = s.people.find(p => p.id === id);
    if (!p)
        throw new Error("村民已不在村中");
    return p;
}
export function policy(s: GameState): Partial<Policy> { return s.policy === null ? {} : POLICIES[s.policy]; }
export function capacity(s: GameState) { return RESIDENTIAL.initialCapacity + (s.houses - 1) * RESIDENTIAL.capacityPerLevel; }
export function canMarry(s: GameState, a: Person, b: Person): boolean {
    return a.id !== b.id && isWorkingAdult(a) && isWorkingAdult(b) && a.sex !== b.sex &&
        !s.families.some(f => f.partners.includes(a.id) || f.partners.includes(b.id)) &&
        !a.ancestors.includes(b.id) && !b.ancestors.includes(a.id) && !a.parents.some(id => b.parents.includes(id));
}
/** 迎接孩子的预检与命令共用原生育条件，按原校验顺序返回首个阻塞原因。
 * 不传照料者时只检查是否存在合格人选；传入 ID 时校验该人。纯查询，不扣粮、不改岗位或随机数。
 */
export function birthUnavailableReason(s: GameState, familyId: string, carerId?: string): string | null {
    if (s.phase !== "DAY")
        return "请在白天安排村务";
    const family = s.families.find(f => f.id === familyId);
    if (!family)
        return "家庭不存在";
    const parents = family.partners.map(id => person(s, id));
    const unavailableParent = parents.find(p => !isWorkingAdult(p));
    if (unavailableParent)
        return `${unavailableParent.name}${unavailableParent.adult ? "已退休" : "未成年"}，不能迎接孩子`;
    if (s.people.length >= capacity(s))
        return s.people.length >= RULE.populationCap ? `人口已满 ${RULE.populationCap} 人，需等空出名额` : `住房已满 ${s.people.length}/${capacity(s)} 人，请增建民居`;
    const agingParent = parents.find(p => p.nights < RULE.parentMinNights);
    if (agingParent)
        return `${agingParent.name}距退休 ${agingParent.nights} 夜，至少需 ${RULE.parentMinNights} 夜`;
    if (s.people.some(p => !p.adult && p.parents.some(id => family.partners.includes(id))))
        return "已有孩子未成年，请先照料长大";
    if (family.lastBirth !== null && s.completed - family.lastBirth < RULE.birthCooldown)
        return `再成功守住 ${RULE.birthCooldown - (s.completed - family.lastBirth)} 夜可迎接`;
    const carer = carerId === undefined ? s.people.find(p => isWorkingAdult(p) && p.job !== "CARE") : s.people.find(p => p.id === carerId);
    if (!carer)
        return carerId === undefined ? "没有可接手照料的成年人" : "照料者已不在村中，请重新选择";
    if (!isWorkingAdult(carer))
        return `${carer.name}${carer.adult ? "已退休" : "未成年"}，无法照料`;
    if (carer.job === "CARE")
        return `${carer.name}正在照料其他孩子`;
    if (s.food < RULE.birthCost)
        return `还缺 ${RULE.birthCost - s.food} 粮（现有 ${s.food}/${RULE.birthCost}）`;
    return null;
}
export function economy(s: GameState) {
    const po = policy(s);
    let food = 0, wood = 0, rations = 0, elderRations = 0;
    for (const p of s.people) {
        const ration = p.adult ? (p.trait === "trait_frugal" ? ECONOMY.frugalRation : RULE.adultRation) : RULE.childRation;
        rations += ration;
        if (isElder(p))
            elderRations += ration;
        if (!isWorkingAdult(p))
            continue;
        const { production, careFood } = VILLAGER_QUALITY[p.quality];
        if (p.job === "FARM")
            food += Math.floor(production * laborYield("FARM", s.farm) * (1 + (p.trait === "trait_diligent" ? ECONOMY.diligentFood : 0) + (p.skill === "skill_farming" ? ECONOMY.farmingFood : 0) + (season(s.day) === 0 ? ECONOMY.springFood : 0) + (po.food || 0)));
        if (p.job === "LOGGING")
            wood += Math.floor(production * laborYield("LOGGING", s.logging) * (1 + (p.trait === "trait_woodwise" ? ECONOMY.woodwiseWood : 0) + (p.skill === "skill_logging" ? ECONOMY.loggingWood : 0) + (season(s.day) === 2 ? ECONOMY.autumnWood : 0) + (po.wood || 0)));
        if (p.job === "CARE" && s.people.some(c => c.id === p.careChild && !c.adult))
            food += (p.skill === "skill_nurturing" ? ECONOMY.nurturingFood : 0) + (po.care || 0) + careFood;
    }
    rations = Math.ceil(rations * (1 + (season(s.day) === 3 ? ECONOMY.winterRation : 0) + (po.ration || 0)));
    // elderRations 是已包含在总口粮中的基础值，仅供 UI 解释；不可再次扣除或单独向上取整。
    return { food, wood, rations, elderRations, hungry: s.food + food < rations, endFood: Math.min(storageCapacity(s), Math.max(0, s.food + food - rations)), endWood: Math.min(storageCapacity(s), s.wood + wood) };
}
