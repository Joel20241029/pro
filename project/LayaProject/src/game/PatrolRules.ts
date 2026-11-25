import { PATROL } from "../config/PatrolConfig";
import { PATROL_RATION } from "../config/ShopConfig";
import { RULE } from "../config/RuleConfig";
import { VILLAGER_QUALITY } from "../config/VillagerQuality";
import { GameState, Person } from "./GameState";
import { levelPower, upgradeCost, upgradeUnavailableReason } from "./Growth";

export function patrolCost(s: GameState) {
    return upgradeCost("PATROL", s.patrol.level);
}

export function patrolUpgradeReason(s: GameState) {
    if (!Number.isSafeInteger(patrolSpinStats(s.patrol.level + 1, patrolCaptain(s), s.patrol.rationReady).damage)) return "建设数值已达安全范围";
    return upgradeUnavailableReason(s, patrolCost(s));
}

/** 队长选择、建筑预览与战斗使用同一取整，间隔对齐实际固定步。 */
export function patrolStats(level: number, captain?: Person, squad = true) {
    const quality = captain?.quality ?? "COMMON";
    const strength = captain?.traits.includes("trait_strong") ? PATROL.strongBonus : 0;
    const haste = PATROL.qualityHaste[quality] + (captain?.traits.includes("trait_nimble") ? PATROL.nimbleBonus : 0);
    const perPerson = squad ? PATROL.squad.damage : PATROL.legacy.damage;
    const interval = squad ? PATROL.interval : PATROL.interval - PATROL.legacy.perLevel * (level - 1);
    const ticks = Math.round(Math.max(PATROL.minimum, interval * (1 - haste)) / RULE.step);
    return {
        damage: Math.round(perPerson * (1 + PATROL.powerShare * (levelPower(level) - 1)) * (1 + strength) * VILLAGER_QUALITY[quality].damage),
        ticks, seconds: Number((ticks * RULE.step).toFixed(2))
    };
}

export function patrolCaptain(s: GameState) {
    return s.people.find(p => p.id === s.patrol.captain);
}

export function patrolSpinStats(level: number, captain?: Person, ration = false): ReturnType<typeof patrolStats> {
    const quality = captain?.quality ?? "COMMON", spec = PATROL.spin, n = level - 1;
    const strength = captain?.traits.includes("trait_strong") ? PATROL.strongBonus : 0;
    const haste = PATROL.qualityHaste[quality] + (captain?.traits.includes("trait_nimble") ? PATROL.nimbleBonus : 0);
    const reserve = spec.interval - spec.intervalFloor;
    const interval = (spec.intervalFloor + reserve / (1 + spec.intervalGrowth * n)) * (1 - haste);
    const ticks = Math.round(Math.max(spec.minimum, interval) / RULE.step);
    const power = 1 + spec.damageGrowth * n + spec.earlyDamageGrowth * Math.sqrt(n);
    const damage = Math.round(PATROL.squad.damage * power * (1 + strength) * VILLAGER_QUALITY[quality].damage);
    return { damage: ration ? Math.round(damage * PATROL_RATION.damageMultiplier) : damage, ticks, seconds: Number((ticks * RULE.step).toFixed(2)) };
}
