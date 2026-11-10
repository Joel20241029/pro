import { ENEMIES, EnemyKind, RULE } from "./GameConfig";
import { GameState, Wave } from "./GameState";
import { SeededRandom } from "./SeededRandom";
export function season(day: number): number { return Math.floor(((day - 1) % RULE.yearDays) / RULE.seasonDays); }
export function generateWave(s: GameState): Wave {
    const rng = new SeededRandom(s.rng.world), year = Math.floor((s.day - 1) / RULE.yearDays) + 1, day = (s.day - 1) % RULE.yearDays + 1;
    const budget = 8 + 2 * (day - 1) + 6 * Math.min(year - 1, 2) + 8 * s.tier;
    const affix: Wave["affix"] = s.day < 7 ? "NONE" : (["NONE", "FAST", "STURDY", "GROUP"] as const)[rng.range(4)];
    let left = budget; const kinds: EnemyKind[] = [];
    if (day === RULE.yearDays) { kinds.push("enemy_chief"); left -= ENEMIES.enemy_chief.cost; }
    while (left > 0) {
        const candidates = (Object.keys(ENEMIES) as EnemyKind[]).filter(k => k !== "enemy_chief" && ENEMIES[k].unlock <= s.day && ENEMIES[k].cost <= left);
        const weights = candidates.map(k => ENEMIES[k].weight * ((season(s.day) === 1 && k === "enemy_runner") || (season(s.day) === 2 && k === "enemy_armored") ? 2 : 1));
        let r = rng.range(weights.reduce((a, b) => a + b, 0)), index = 0;
        while (r >= weights[index]) r -= weights[index++];
        const k = candidates[index]; kinds.push(k); left -= ENEMIES[k].cost;
    }
    if (day === RULE.yearDays) { kinds.shift(); kinds.splice(Math.floor(kinds.length / 2), 0, "enemy_chief"); }
    if (kinds.length > RULE.planCap) throw new Error("波次超出配置上限");
    const groups = affix === "GROUP" ? Math.ceil(kinds.length / 3) : kinds.length;
    const entries = kinds.map((kind, i) => ({ kind, tick: groups <= 1 ? 0 : Math.floor((affix === "GROUP" ? Math.floor(i / 3) : i) * RULE.spawnTicks / (groups - 1)) }));
    s.rng.world = rng.state; return { budget, affix, tier: s.tier, entries };
}
