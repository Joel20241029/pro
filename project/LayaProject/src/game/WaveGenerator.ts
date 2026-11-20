import { appearanceSeed, APPEARANCE_DOMAIN } from "./EnemySeed";
import { BOSS_ROTATION } from "../config/EnemyConfig";
import { PATROL } from "../config/PatrolConfig";
import { WAVE_PROGRESSION, WAVE, WAVE_RHYTHM } from "../config/DefenseConfig";
import { ENEMIES, EnemyKind, RULE } from "./GameConfig";
import { GameState, Wave } from "./GameState";
import { SeededRandom } from "./SeededRandom";
import { waveArrivalTick, waveDifficulty } from "./WaveDifficulty";
export function season(day: number): number { return Math.floor(((day - 1) % RULE.yearDays) / RULE.seasonDays); }
export function generateWave(s: GameState): Wave {
    const rng = new SeededRandom(s.rng.world), year = Math.floor((s.day - 1) / RULE.yearDays) + 1, day = (s.day - 1) % RULE.yearDays + 1;
    const difficulty = waveDifficulty(s.day);
    const affix: Wave["affix"] = s.day < WAVE.affixStartDay ? "NONE" : WAVE.affixes[rng.range(WAVE.affixes.length)];
    const boss = BOSS_ROTATION[(year - 1) % BOSS_ROTATION.length];
    const kinds: EnemyKind[] = [];
    const currentSeason = season(s.day);
    const candidates = (Object.keys(ENEMIES) as EnemyKind[]).filter(k => !ENEMIES[k].boss && ENEMIES[k].unlock <= s.day);
    const weights = candidates.map(k => {
        const seasonWeight = difficulty.band >= WAVE_PROGRESSION.earlyBands && ((currentSeason === 1 && k === "enemy_runner") || (currentSeason === 2 && k === "enemy_armored")) ? WAVE_PROGRESSION.seasonalWeightPercent : 100;
        const weightPercent = k === "enemy_raider" ? 100 : Math.min(100 + WAVE_PROGRESSION.eliteWeightBonusMax,
            WAVE_PROGRESSION.eliteFirstWeightPercent + difficulty.band * WAVE_PROGRESSION.eliteWeightPerBand);
        // 使用整数权重，保证种子在真机和回放中一致。
        return Math.floor(ENEMIES[k].weight * seasonWeight * weightPercent / 100);
    });
    const support = WAVE.density * (s.day >= PATROL.pressure.secondDay ? 2 : s.day >= PATROL.pressure.firstDay ? 1 : 0);
    const annual = day === RULE.yearDays;
    const weightTotal = weights.reduce((a, b) => a + b, 0);
    while (kinds.length < difficulty.count - support - Number(annual)) {
        let r = rng.range(weightTotal), index = 0;
        while (r >= weights[index])
            r -= weights[index++];
        const k = candidates[index];
        kinds.push(k);
    }
    const pressure = WAVE.qualityPressure;
    const extra = WAVE.density * Math.min(pressure.max, Math.max(0, Math.floor((s.day - pressure.after) / pressure.step)));
    for (let i = 0; i < extra; i++)
        kinds[Math.floor((i + 1) * kinds.length / (extra + 1))] = pressure.kinds[i % pressure.kinds.length];
    for (let i = 0; i < support; i++)
        kinds.splice(Math.floor((i + 1) * kinds.length / (support + 1)), 0, PATROL.pressure.kinds[Math.floor(i / WAVE.density)]);
    if (annual) kinds.splice(Math.floor(kinds.length / 2), 0, boss);
    const grouped = affix === "GROUP";
    const entries = kinds.map((kind, i) => {
        const last = kinds.length - 1;
        const groupStart = grouped ? Math.floor(i / WAVE.groupSize) * WAVE.groupSize : i;
        const groupTick = waveArrivalTick(groupStart, kinds.length, difficulty.spawnTicks);
        const evenTick = waveArrivalTick(i, kinds.length, difficulty.spawnTicks);
        const tick = i === last ? difficulty.spawnTicks : Math.floor(groupTick + (evenTick - groupTick) * WAVE.groupStagger);
        return { kind, appearanceSeed: appearanceSeed(APPEARANCE_DOMAIN.wave, s.rng.world, s.day, i), tick };
    });
    const budget = entries.reduce((sum, { kind }) => sum + ENEMIES[kind].cost, 0);
    s.rng.world = rng.state;
    return { budget, affix, tier: s.tier, entries, ordinaryHealthPercent: WAVE_PROGRESSION.ordinaryHealthPercent, rhythm: WAVE_RHYTHM.nightly };
}
