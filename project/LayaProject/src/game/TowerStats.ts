import { AMMO_DAMAGE_PER_LEVEL, COMBAT, FIXED_NIGHT, TOWERS, TowerKind, WAVE_RHYTHM } from "../config/DefenseConfig";
import { VILLAGER_QUALITY } from "../config/VillagerQuality";
import { GameState, Person } from "./GameState";
import { levelPower } from "./Growth";
import { policy } from "./VillageQueries";

/** 战斗与换装预览使用同一组常态属性。临时战技、饥饿、敌方干扰在实战中另行结算。 */
export function towerStats(s: GameState, kind: TowerKind, level: number, p?: Person) {
    const t = TOWERS[kind], po = policy(s);
    const speed = 1 + (p?.traits.includes("trait_nimble") ? COMBAT.nimbleSpeed : 0);
    const bonus = (po.damage || 0) + (p?.traits.includes("trait_strong") ? COMBAT.strongDamage : 0);
    const range = t.range;
    const slow = kind === "SLOW" ? COMBAT.slowBase : 0;
    const interval = s.wave?.rhythm === WAVE_RHYTHM.fixed ? t.interval / FIXED_NIGHT.towerFireRate : t.interval;
    const damage = t.damage * levelPower(level) * (1 + AMMO_DAMAGE_PER_LEVEL * (s.ammoLevels[kind] - 1))
        * (1 + bonus) * (p ? VILLAGER_QUALITY[p.quality].damage : 1);
    return { damage, speed, interval, range, slow };
}
