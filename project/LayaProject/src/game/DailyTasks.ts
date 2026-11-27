import { DAILY_TASKS, DENSE_TASK_GOALS, TASK_GOALS, TaskKind, featureUnlocked } from "../config/DailyTaskConfig";
import { isDenseWave, TOWER_BUILD_COINS } from "../config/DefenseConfig";
import { BattleSimulation } from "./BattleSimulation";
import { PATH_LENGTH, pointAt } from "./BattleRoad";
import { DailyTaskCombat } from "./DailyTaskCombat";
import { activeDailyTasks, DailyTask } from "./DailyTaskState";
import { ENEMIES, RULE, SEWING } from "./GameConfig";
import { clone, GameState, isAvailableAdult } from "./GameState";
import { gateCapacity, repairCost, residentialCost, residentialUpgradeReason, sewingDayCap, sewingYield, upgradeCost, upgradeUnavailableReason, UpgradeCost } from "./Growth";
import { SeededRandom } from "./SeededRandom";
import { birthUnavailableReason, canMarry } from "./VillageQueries";
import { applyCommand, Command } from "./VillageRules";

type Candidate = Pick<DailyTask, "kind" | "goal" | "enemy" | "tactic"> & { cost?: UpgradeCost };
/** Keeps preflight bounded on late-game waves. A forecast that reaches the limit cannot qualify a combat task. */
const FORECAST_SECONDS = 180;

export function dailyTasksNeedRefresh(s: GameState, date: string) {
    return s.phase === "DAY" && featureUnlocked(s.legacy.bestNight, "dailyTasks") &&
        (s.dailyTasks === undefined || date > s.dailyTasks.date);
}

function forecast(s: GameState, useTactics: boolean) {
    const combat = new DailyTaskCombat(), battle = new BattleSimulation(s, combat);
    while (!battle.outcome && battle.tick < FORECAST_SECONDS / RULE.step) {
        if (useTactics && battle.enemies.length) {
            const tactic = battle.tactics.find(t => t.effect !== "KING_MERCY" && battle.canCast(t.id));
            if (tactic) {
                const foremost = battle.enemies.reduce((a, b) => b.progress > a.progress ? b : a);
                battle.bell(tactic.id, pointAt(Math.min(PATH_LENGTH, foremost.progress)));
            }
        }
        battle.step();
    }
    return { battle, combat };
}

export function prepareDailyTasks(s: GameState, date: string) {
    if (!dailyTasksNeedRefresh(s, date)) return;
    // Neither the draw nor the isolated simulation advances the actual village or its saved random streams.
    const rng = new SeededRandom(Math.imul(s.run ^ s.rng.world, 16777619) ^ Number(date.replace(/-/g, "")));
    const buckets: Candidate[][] = [[], [], [], [], []];
    const dense = s.wave!.rhythm !== undefined || isDenseWave(s.wave!.ordinaryHealthPercent);
    const count = (theme: number, kind: TaskKind, available: number, fields?: Partial<Candidate>) => {
        const [min, max] = dense && (kind === "kills" || kind === "enemyKind") ? DENSE_TASK_GOALS[kind] : TASK_GOALS[kind];
        const upper = Math.min(max, available);
        if (upper >= min) buckets[theme].push({ kind, goal: min + rng.range(upper - min + 1), ...fields });
    };
    const one = (theme: number, kind: TaskKind, available: boolean) => { if (available) count(theme, kind, 1); };
    const affordable = (theme: number, kind: TaskKind, cost: UpgradeCost) => {
        if (!upgradeUnavailableReason(s, cost)) count(theme, kind, 1, { cost });
    };
    const night = clone(s);
    applyCommand(night, { type: "NIGHT" });
    const baseline = forecast(night, false), withTactics = forecast(night, true);
    const witness = baseline.battle.outcome === "WIN" ? baseline : withTactics;
    const wins = witness.battle.outcome === "WIN";
    if (wins) {
        const { battle, combat } = witness;
        count(0, "win", 1);
        count(0, "kills", combat.totalKills);
        const gate = Math.floor(100 * battle.gate / gateCapacity(s)), [healthMin, healthMax] = TASK_GOALS.gateHealth;
        if (gate > 0) buckets[0].push({ kind: "gateHealth", goal: Math.min(gate, healthMin + rng.range(healthMax - healthMin + 1)) });
        const [hitMin, hitMax] = TASK_GOALS.gateHits;
        if (combat.gateHits <= hitMax) {
            const min = Math.max(hitMin, combat.gateHits);
            buckets[0].push({ kind: "gateHits", goal: min + rng.range(hitMax - min + 1) });
        }
        const [kindMinimum] = dense ? DENSE_TASK_GOALS.enemyKind : TASK_GOALS.enemyKind;
        const viableKinds = [...new Set(s.wave!.entries.map(e => e.kind))].filter(kind =>
            !ENEMIES[kind].boss && (combat.kills.get(kind) ?? 0) >= kindMinimum);
        if (viableKinds.length) {
            const enemy = viableKinds[rng.range(viableKinds.length)];
            count(0, "enemyKind", combat.kills.get(enemy)!, { enemy });
        }
        count(0, "enemyTypes", combat.ordinaryTypes);
        count(1, "towersHit", combat.towers.size);
        count(1, "arrowHits", combat.arrows.size);
        count(1, "stoneSplash", combat.splash);
        count(1, "frostHits", combat.frost.size);
        if (withTactics.battle.outcome === "WIN") {
            count(1, "casts", withTactics.combat.totalCasts);
            const castable = Array.from(withTactics.combat.casts.keys());
            if (castable.length) count(1, "equipped", 1, { tactic: castable[rng.range(castable.length)] });
        }
    }

    const adults = s.people.filter(p => isAvailableAdult(s, p));
    const sewingBatch = adults.reduce((sum, p) => sum + (p.job === "SEWING" ? sewingYield(s, p, "day") : 0), 0);
    count(2, "sewCoins", Math.min(sewingDayCap(s) - s.factory.earned, sewingBatch * (SEWING.maxBatches - s.factory.batches)));

    if (s.towers.some(t => !t.kind)) affordable(3, "towerBuild", { coins: TOWER_BUILD_COINS });
    const towerLevels = s.towers.filter(t => t.kind).map(t => t.level);
    if (towerLevels.length) affordable(3, "towerUpgrade", upgradeCost("TOWER", Math.min(...towerLevels)));
    affordable(3, "factoryUpgrade", upgradeCost("FACTORY", s.factory.level));
    affordable(3, "gateUpgrade", upgradeCost("GATE", s.gateLevel));
    if (s.gate < gateCapacity(s)) affordable(3, "repair", { coins: repairCost(s) });
    if (residentialUpgradeReason(s) === null) count(4, "houseBuild", 1, { cost: residentialCost(s.houses) });
    const unpaired = adults.filter(p => !s.families.some(f => f.partners.includes(p.id)));
    one(4, "marriage", Number.isSafeInteger(s.nextFamily + 1) && unpaired.some(a => unpaired.some(b => canMarry(s, a, b))));
    if (Number.isSafeInteger(s.nextPerson + 1) && s.families.some(f => birthUnavailableReason(s, f.id) === null))
        affordable(4, "child", { coins: RULE.birthCost });
    const chosen: Candidate[] = [];
    // Shuffle the eligible themes, with the normal one-wave objective guaranteed when a win is feasible.
    if (wins) {
        const side = buckets[0];
        // The first entry stays the easiest, and the other proven objectives also rotate into the pool.
        const index = rng.range(2) === 0 ? 0 : rng.range(side.length);
        chosen.push(side.splice(index, 1)[0]);
    }
    let coins = s.coins;
    const fits = (task: Candidate) => !task.cost || task.cost.coins <= coins;
    const pick = (bucket: Candidate[]) => {
        const choices = bucket.filter(fits);
        if (!choices.length) return;
        const task = choices[rng.range(choices.length)];
        chosen.push(task);
        bucket.splice(bucket.indexOf(task), 1);
        if (task.cost) coins -= task.cost.coins;
    };
    // Reserve costs across all drawn tasks, so today's construction and village objectives can use the same starting stock.
    const otherThemes = buckets.filter((bucket, i) => bucket.length > 0 && (!wins || i !== 0));
    for (const bucket of rng.choices(otherThemes, otherThemes.length)) {
        if (chosen.length >= DAILY_TASKS.limit) break;
        pick(bucket);
    }
    const remaining = ([] as Candidate[]).concat(...buckets);
    while (chosen.length < DAILY_TASKS.limit && remaining.some(fits)) pick(remaining);
    s.dailyTasks = { date, tasks: chosen.map(({ cost, ...task }, index) => ({
        ...task, progress: 0, claimed: false, reward: DAILY_TASKS.rewards[index]
    })) };
}

function credit(s: GameState, date: string, amount: (task: DailyTask) => number) {
    for (const task of activeDailyTasks(s, date)?.tasks ?? [])
        if (task.progress < task.goal) task.progress = Math.min(task.goal, task.progress + amount(task));
}

export function creditTaskCommand(before: GameState, after: GameState, c: Command, date: string) {
    if (before.phase !== "DAY" || !activeDailyTasks(after, date)) return;
    const building = { FACTORY: "factoryUpgrade", GATE: "gateUpgrade",
        HOUSE: "houseBuild" } as const;
    switch (c.type) {
        case "BUILD": credit(after, date, t => Number(t.kind === building[c.kind])); return;
        case "REPAIR": credit(after, date, t => Number(t.kind === "repair")); return;
        case "TOWER": credit(after, date, t => Number(t.kind === "towerBuild" && !before.towers[c.index].kind)); return;
        case "UPGRADE": credit(after, date, t => Number(t.kind === "towerUpgrade")); return;
        case "FAMILY": credit(after, date, t => Number(t.kind === "marriage")); return;
        case "BIRTH": credit(after, date, t => Number(t.kind === "child")); return;
        case "OPERATOR": credit(after, date, t => Number(t.kind === "operator" && !before.towers[c.index].operator)); return;
    }
}

/** 只有已进入本次保存候选的缝纫收入才能记入目标。 */
export function creditTaskSewing(s: GameState, date: string, coins: number) {
    credit(s, date, task => task.kind === "sewCoins" ? coins : 0);
}

export function creditTaskVictory(s: GameState, date: string, battle: BattleSimulation, combat: DailyTaskCombat) {
    if (battle.outcome !== "WIN") return;
    credit(s, date, task => {
        switch (task.kind) {
            case "win": return 1;
            case "kills": return combat.totalKills;
            case "gateHealth": return 100 * battle.gate / gateCapacity(battle.base) >= task.goal ? task.goal : 0;
            case "gateHits": return combat.gateHits <= task.goal ? task.goal : 0;
            case "enemyKind": return combat.kills.get(task.enemy!) ?? 0;
            case "enemyTypes": return combat.ordinaryTypes >= task.goal ? task.goal : 0;
            case "casts": return combat.totalCasts;
            case "equipped": return combat.casts.get(task.tactic!) ?? 0;
            case "towersHit": return combat.towers.size >= task.goal ? task.goal : 0;
            case "arrowHits": return combat.arrows.size >= task.goal ? task.goal : 0;
            case "stoneSplash": return combat.splash >= task.goal ? task.goal : 0;
            case "frostHits": return combat.frost.size >= task.goal ? task.goal : 0;
            default: return 0;
        }
    });
}
