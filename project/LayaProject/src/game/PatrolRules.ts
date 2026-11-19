import { PATROL } from "../config/PatrolConfig";
import { RULE } from "../config/RuleConfig";
import { VILLAGER_QUALITY } from "../config/VillagerQuality";
import { GameState, Person } from "./GameState";
import { levelPower, upgradeCost, upgradeUnavailableReason } from "./Growth";

export function patrolCost(s: GameState) {
    return upgradeCost("PATROL", s.patrol.level);
}

export function patrolUpgradeReason(s: GameState) {
    if (!Number.isSafeInteger(patrolStats(s.patrol.level + 1, patrolCaptain(s)).damage)) return "建设数值已达安全范围";
    return upgradeUnavailableReason(s, patrolCost(s));
}

/** 队长选择、建筑预览与战斗使用同一取整，间隔对齐实际固定步。 */
export function patrolStats(level: number, captain?: Person, squad = true) {
    const quality = captain?.quality ?? "COMMON";
    const strength = captain?.trait === "trait_strong" ? PATROL.strongBonus : 0;
    const haste = PATROL.qualityHaste[quality] + (captain?.trait === "trait_nimble" ? PATROL.nimbleBonus : 0);
    const growthLevels = PATROL.squad.maxSize - PATROL.squad.initialSize;
    const powerLevel = squad ? Math.max(1, level - growthLevels) : level;
    const perPerson = squad ? PATROL.squad.damage : PATROL.legacy.damage;
    const interval = squad ? PATROL.interval : PATROL.interval - PATROL.legacy.perLevel * (level - 1);
    const ticks = Math.round(Math.max(PATROL.minimum, interval * (1 - haste)) / RULE.step);
    return {
        count: squad ? Math.min(PATROL.squad.maxSize, PATROL.squad.initialSize + level - 1) : 1,
        damage: Math.round(perPerson * (1 + PATROL.powerShare * (levelPower(powerLevel) - 1)) * (1 + strength) * VILLAGER_QUALITY[quality].damage),
        ticks, seconds: Number((ticks * RULE.step).toFixed(2))
    };
}

export function patrolCaptain(s: GameState) {
    return s.people.find(p => p.id === s.patrol.captain);
}
