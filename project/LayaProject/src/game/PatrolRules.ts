import { PATROL } from "../config/PatrolConfig";
import { RULE } from "../config/RuleConfig";
import { VILLAGER_QUALITY } from "../config/VillagerQuality";
import { GameState, Person } from "./GameState";
import { levelPower, upgradeCost, upgradeUnavailableReason } from "./Growth";

export function patrolCost(s: GameState) {
    return s.patrol ? upgradeCost("PATROL", s.patrol.level) : PATROL.build;
}

export function patrolBuildReason(s: GameState) {
    if (s.completed < PATROL.unlock) return `守住 ${PATROL.unlock} 波后开放`;
    if (!Number.isSafeInteger(patrolStats((s.patrol?.level ?? 0) + 1).damage)) return "建设数值已达安全范围";
    return upgradeUnavailableReason(s, patrolCost(s));
}

/** 队长选择、建筑预览与战斗使用同一取整，间隔对齐实际固定步。 */
export function patrolStats(level: number, captain?: Person) {
    const quality = captain?.quality ?? "COMMON";
    const strength = captain?.trait === "trait_strong" ? PATROL.strongBonus : 0;
    const haste = PATROL.qualityHaste[quality] + (captain?.trait === "trait_nimble" ? PATROL.nimbleBonus : 0);
    const interval = Math.max(PATROL.minimum, (PATROL.interval - PATROL.perLevel * (level - 1)) * (1 - haste));
    const ticks = Math.round(interval / RULE.step);
    return {
        damage: Math.round(PATROL.damage * (1 + PATROL.powerShare * (levelPower(level) - 1)) * (1 + strength) * VILLAGER_QUALITY[quality].damage),
        ticks, seconds: Number((ticks * RULE.step).toFixed(2))
    };
}

export function patrolCaptain(s: GameState) {
    return s.people.find(p => p.id === s.patrol?.captain);
}
