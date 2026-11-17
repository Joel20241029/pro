import { appearanceSeed, APPEARANCE_DOMAIN } from "./EnemySeed";
import { BOSS_ROTATION } from "../config/EnemyConfig";
import { WAVE } from "../config/DefenseConfig";
import { ENEMIES, EnemyKind, RULE } from "./GameConfig";
import { GameState, Wave } from "./GameState";
import { SeededRandom } from "./SeededRandom";
export function season(day: number): number { return Math.floor(((day - 1) % RULE.yearDays) / RULE.seasonDays); }
export function generateWave(s: GameState): Wave {
    const rng = new SeededRandom(s.rng.world), year = Math.floor((s.day - 1) / RULE.yearDays) + 1, day = (s.day - 1) % RULE.yearDays + 1;
    const count = WAVE.initialCount + Math.floor(WAVE.additionalCount * (1 - Math.exp(-(s.day - 1) / WAVE.countGrowthNights))) +
        WAVE.seasonPulse[season(s.day)] + WAVE.tierCount * s.tier;
    const affix: Wave["affix"] = s.day < WAVE.affixStartDay ? "NONE" : WAVE.affixes[rng.range(WAVE.affixes.length)];
    const boss = BOSS_ROTATION[(year - 1) % BOSS_ROTATION.length];
    const kinds: EnemyKind[] = [];
    if (day === RULE.yearDays) {
        kinds.push(boss);
    }
    while (kinds.length < count) {
        const candidates = (Object.keys(ENEMIES) as EnemyKind[]).filter(k => !ENEMIES[k].boss && ENEMIES[k].unlock <= s.day);
        const weights = candidates.map(k => ENEMIES[k].weight * ((season(s.day) === 1 && k === "enemy_runner") || (season(s.day) === 2 && k === "enemy_armored") ? WAVE.seasonalWeight : 1));
        let r = rng.range(weights.reduce((a, b) => a + b, 0)), index = 0;
        while (r >= weights[index])
            r -= weights[index++];
        const k = candidates[index];
        kinds.push(k);
    }
    if (day === RULE.yearDays) {
        kinds.shift();
        kinds.splice(Math.floor(kinds.length / 2), 0, boss);
    }
    if (kinds.length > RULE.planCap)
        throw new Error("波次超出配置上限");
    const groups = affix === "GROUP" ? Math.ceil(kinds.length / WAVE.groupSize) : kinds.length;
    const plannedTicks = RULE.spawnTicks + Math.max(0, count - WAVE.spawnCountThreshold) * WAVE.extraSpawnTicks;
    const { minimum, maximum } = WAVE.spawnWindowTicks;
    const spawnTicks = Math.min(maximum, Math.max(minimum, plannedTicks));
    const entries = kinds.map((kind, i) => ({ kind, appearanceSeed: appearanceSeed(APPEARANCE_DOMAIN.wave, s.rng.world, s.day, i), tick: groups <= 1 ? 0 : Math.floor((affix === "GROUP" ? Math.floor(i / WAVE.groupSize) : i) * spawnTicks / (groups - 1)) }));
    const budget = kinds.reduce((sum, kind) => sum + ENEMIES[kind].cost, 0);
    s.rng.world = rng.state;
    const wave: Wave = { budget, affix, tier: s.tier, entries };
    if (s.day >= WAVE.ordinaryPressureDay) wave.ordinaryHealthPercent = WAVE.ordinaryHealthPercent;
    return wave;
}
