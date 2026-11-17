import { ECONOMY } from "../config/RuleConfig";
import { ELITE, TowerKind, Skill, Trait } from "../game/GameConfig";
import { isWorkingAdult, Person, Tower } from "../game/GameState";

export type WorkRole = "FARM" | "LOGGING" | "CARE";
type Role = WorkRole | TowerKind;
/** 1.0.35 每个岗位只展示最合适的三位待安排者，避免所有合格条目都挂标签。 */
const RECOMMENDATION_LIMIT = 3;
/** 对应村务产出与战斗公式中生效的加成。实际调岗资格仍由原操作检查。 */
const BENEFITS: Record<Role, { trait?: Trait; skill: Skill }> = {
    FARM: { trait: "trait_diligent", skill: "skill_farming" },
    LOGGING: { trait: "trait_woodwise", skill: "skill_logging" },
    CARE: { skill: "skill_nurturing" },
    ARROW: { trait: "trait_focused", skill: "skill_archery" },
    STONE: { trait: "trait_strong", skill: "skill_throwing" },
    SLOW: { trait: "trait_patient", skill: "skill_warding" }
};

function roleBenefit(person: Person, role: Role) {
    const { trait, skill } = BENEFITS[role];
    const traitMatch = Number(person.trait === trait), skillMatch = Number(person.skill === skill);
    if (role === "CARE") return skillMatch * ECONOMY.nurturingFood + Number(person.elite) * ELITE.careFoodBonus;
    if (role === "FARM" || role === "LOGGING") {
        const traitBonus = role === "FARM" ? ECONOMY.diligentFood : ECONOMY.woodwiseWood;
        const skillBonus = role === "FARM" ? ECONOMY.farmingFood : ECONOMY.loggingWood;
        return (person.elite ? ELITE.productionMultiplier : 1) * (1 + traitMatch * traitBonus + skillMatch * skillBonus) - 1;
    }
    // 伤害、攻速、射程和减速不能直接比较百分数。先推荐在当前塔种有更多项加成的人。
    return traitMatch + skillMatch + Number(person.elite) + Number(person.trait === "trait_farsight" || person.trait === "trait_nimble");
}

export function recommendedPeople(candidates: readonly Person[], role: Role, towers: readonly Tower[]): Person[] {
    const occupied = new Set(towers.map(tower => tower.operator));
    return candidates.filter(person => person.job === "WAITING" && isWorkingAdult(person) && !occupied.has(person.id))
        .map(person => ({ person, benefit: roleBenefit(person, role) }))
        .filter(row => row.benefit > 0).sort((a, b) => b.benefit - a.benefit)
        .slice(0, RECOMMENDATION_LIMIT).map(row => row.person);
}
