import { BOSS_INTERVAL_NIGHTS } from "../config/EnemyConfig";
import { RESIDENTIAL, WIN_REWARD } from "../config/RuleConfig";
import { nightRewardWithDice } from "../config/ShopConfig";
import { RULE } from "./GameConfig";
import { GameState, isWorkingAdult, isAvailableAdult, isExploring, NightReward, Person } from "./GameState";
import { sewingYield } from "./Growth";
/** 村务只读查询与预检；不修改状态、不消耗随机数。 */
export function person(s: GameState, id: string): Person {
    const p = s.people.find(p => p.id === id);
    if (!p)
        throw new Error("村民已不在村中");
    return p;
}
export function capacity(s: GameState) { return Math.min(RULE.populationCap, RESIDENTIAL.initialCapacity + (s.houses - 1) * RESIDENTIAL.capacityPerLevel); }
export function canMarry(s: GameState, a: Person, b: Person): boolean {
    return a.id !== b.id && isAvailableAdult(s, a) && isAvailableAdult(s, b) && a.sex !== b.sex &&
        !s.families.some(f => f.partners.includes(a.id) || f.partners.includes(b.id)) &&
        !a.ancestors.includes(b.id) && !b.ancestors.includes(a.id) && !a.parents.some(id => b.parents.includes(id));
}
/** 迎接孩子的预检与命令共用原生育条件，按原校验顺序返回首个阻塞原因。
 */
export function birthUnavailableReason(s: GameState, familyId: string): string | null {
    if (s.phase !== "DAY")
        return "请在白天安排村务";
    const family = s.families.find(f => f.id === familyId);
    if (!family)
        return "家庭不存在";
    const parents = family.partners.map(id => person(s, id));
    if (parents.some(p => isExploring(s, p.id))) return "有家人正在探索";
    const unavailableParent = parents.find(p => !isWorkingAdult(p));
    if (unavailableParent)
        return `${unavailableParent.name}${unavailableParent.adult ? "已退休" : "未成年"}，不能迎接孩子`;
    if (s.people.length >= capacity(s))
        return s.people.length >= RULE.populationCap ? `人口已满 ${RULE.populationCap} 人，需等空出名额` : `住房已满 ${s.people.length}/${capacity(s)} 人，请增建民居`;
    if (family.lastBirth !== null && s.completed - family.lastBirth < RULE.birthCooldown)
        return `再守住 ${RULE.birthCooldown - (s.completed - family.lastBirth)} 夜`;
    if (s.coins < RULE.birthCost)
        return `还缺 ${RULE.birthCost - s.coins} 尔币`;
    return null;
}
/** 守夜准备锁定工资和骰子结果；参与缝纫的村民在战斗前已经确定。 */
export function economy(s: GameState): NightReward {
    if (s.night?.reward) return s.night.reward;
    if (s.phase === "NIGHT") return { base: 0, sewing: 0, boss: 0, total: 0 };
    const basePay = WIN_REWARD.base + WIN_REWARD.perWave * s.completed;
    const sewingPay = s.people.reduce((sum, p) => sum + (p.job === "SEWING" && isAvailableAdult(s, p) ?
        sewingYield(s, p, "night") : 0), 0);
    const sewing = Math.min(sewingPay, Math.floor(basePay * WIN_REWARD.sewingLimit));
    const boss = s.day % BOSS_INTERVAL_NIGHTS === 0 ? Math.floor((basePay + sewing) * WIN_REWARD.bossBonus) : 0;
    const base = nightRewardWithDice(basePay, s.rewardDie);
    return { base, sewing, boss, total: base + sewing + boss };
}
