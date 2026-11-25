import { ECONOMY } from "../config/RuleConfig";
import { VILLAGER_QUALITY } from "../config/VillagerQuality";
import { COMBAT } from "../config/DefenseConfig";
import { TowerKind } from "../game/GameConfig";
import { isWorkingAdult, Person, Tower } from "../game/GameState";

export type WorkRole = "FARM" | "LOGGING";
type Role = WorkRole | TowerKind;
/** 1.0.35 每个岗位只展示最合适的三位待安排者，避免所有合格条目都挂标签。 */
const RECOMMENDATION_LIMIT = 3;
/** 对应村务产出与战斗公式中生效的加成。实际调岗资格仍由原操作检查。 */
function roleBenefit(person: Person, role: Role) {
    const quality = VILLAGER_QUALITY[person.quality], traits = person.traits;
    if (role === "FARM" || role === "LOGGING") {
        const bonus = role === "FARM" ? Number(traits.includes("trait_diligent")) * ECONOMY.diligentFood
            : Number(traits.includes("trait_woodwise")) * ECONOMY.woodwiseWood;
        return quality.production * (1 + bonus) - 1;
    }
    const damage = traits.includes("trait_strong") ? 1 + COMBAT.strongDamage : 1;
    const speed = traits.includes("trait_nimble") ? 1 + COMBAT.nimbleSpeed : 1;
    return quality.damage * damage * speed - 1;
}

export function recommendedPeople(candidates: readonly Person[], role: Role, towers: readonly Tower[]): Person[] {
    const occupied = new Set(towers.map(tower => tower.operator));
    return candidates.filter(person => person.job === "WAITING" && isWorkingAdult(person) && !occupied.has(person.id))
        .map(person => ({ person, benefit: roleBenefit(person, role) }))
        .filter(row => row.benefit > 0).sort((a, b) => b.benefit - a.benefit)
        .slice(0, RECOMMENDATION_LIMIT).map(row => row.person);
}
