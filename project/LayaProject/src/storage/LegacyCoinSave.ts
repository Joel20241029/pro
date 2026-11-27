import { PATROL } from "../config/PatrolConfig";
import { VILLAGER_QUALITY } from "../config/VillagerQuality";
import { migrateLegacyDailyTaskDay } from "../game/DailyTaskState";
import { migrateLegacyExpedition } from "../game/Expedition";
import { TRAIT_POOL, Trait } from "../game/GameConfig";
import { GameState, Person } from "../game/GameState";
import { sewingSlots } from "../game/Growth";

/** 原粮木经济写入的配置版，封套结构与当前双槽协议相同。 */
export const LEGACY_COIN_CONFIG_VERSION = 22;
/** 固定 v22 的单资源仓容曲线，只用于校验兑换前的余额和战前余额。 */
const LEGACY_STORAGE = { base: 200, linear: 160, quadratic: 12 } as const;
/** 原农林岗位的前三档及后续增长步长，防止错误岗位在归并时被掩盖。 */
const LEGACY_WORK = { FARM: [2, 4, 6], LOGGING: [2, 3, 4], levelsPerSlot: 2 } as const;
/** v22 的三个村规 ID 和旧天赋归并，未知 ID 不参与兑换。 */
const LEGACY_POLICY_IDS = new Set(["policy_harvest", "policy_logging", "policy_prepare"]);
const LEGACY_TRAITS = {
    trait_diligent: "trait_crafty", trait_woodwise: "trait_crafty", trait_frugal: "trait_crafty",
    trait_strong: "trait_strong", trait_nimble: "trait_nimble"
} as const;

type LegacyWallet = { wood: number; food: number };
type LegacyPerson = Omit<Person, "job" | "traits"> & {
    job: "WAITING" | "FARM" | "LOGGING";
    traits: (keyof typeof LEGACY_TRAITS)[];
};
type LegacyChoice = { kind: "TRAVELER"; person: LegacyPerson } | { kind: "POLICY"; options: string[] };
type Night = NonNullable<GameState["night"]>;
type LegacyNight = Omit<Night, "hungry" | "returnPoint" | "reward"> & {
    hungry: boolean;
    returnPoint?: Omit<NonNullable<Night["returnPoint"]>, "coins" | "dailyTasks"> & LegacyWallet & { dailyTasks?: unknown };
};
type LegacyState = Omit<GameState, "coins" | "factory" | "people" | "history" | "choices" | "night" | "legacy" | "dailyTasks" | "expedition"> & LegacyWallet & {
    farm: number;
    logging: number;
    people: LegacyPerson[];
    history: LegacyPerson[];
    choices: LegacyChoice[];
    night: LegacyNight | null;
    legacy: Omit<GameState["legacy"], "traits"> & Pick<LegacyPerson, "traits">;
    dailyTasks?: unknown;
    expedition?: unknown;
    policy?: string | null;
};

function requireLegacy(value: unknown): asserts value {
    if (!value) throw new Error("旧粮木存档无效");
}
function legacyInt(value: number, min: number, max = Number.MAX_SAFE_INTEGER) {
    return Number.isSafeInteger(value) && value >= min && value <= max;
}

function walletCoins(wallet: LegacyWallet, capacity: number) {
    requireLegacy(wallet && legacyInt(wallet.wood, 0, capacity) && legacyInt(wallet.food, 0, capacity));
    return wallet.wood + Math.floor(wallet.food / 2);
}

function legacySlots(job: "FARM" | "LOGGING", level: number) {
    const slots = LEGACY_WORK[job];
    return slots[Math.min(level, slots.length) - 1] + Math.max(0, Math.floor((level - slots.length) / LEGACY_WORK.levelsPerSlot));
}

function migrateTrait(trait: keyof typeof LEGACY_TRAITS): Trait {
    requireLegacy(Object.prototype.hasOwnProperty.call(LEGACY_TRAITS, trait));
    return LEGACY_TRAITS[trait];
}

function migratePerson(person: LegacyPerson, sewing: boolean): Person {
    requireLegacy(person && Object.prototype.hasOwnProperty.call(VILLAGER_QUALITY, person.quality));
    requireLegacy(person.job === "WAITING" || (person.job === "FARM" || person.job === "LOGGING") && person.adult && person.nights > 0);
    const count = VILLAGER_QUALITY[person.quality].traitCount;
    requireLegacy(Array.isArray(person.traits) && person.traits.length === count && new Set(person.traits).size === count);
    const traits = Array.from(new Set(person.traits.map(migrateTrait)));
    // 三种旧生产天赋归并时保证仍有品质对应的不同天赋。固定由人物编号决定，不推进村庄随机流。
    requireLegacy(typeof person.id === "string");
    const offset = person.id.split(":").reduce((sum, part) => (sum + Number(part)) % TRAIT_POOL.length, 0);
    for (let i = 0; i < TRAIT_POOL.length && traits.length < count; i++) {
        const trait = TRAIT_POOL[(offset + i) % TRAIT_POOL.length];
        if (trait && !traits.includes(trait)) traits.push(trait);
    }
    return { ...person, traits, job: sewing ? "SEWING" : "WAITING" };
}

/** 只处理通过封套校验的 v22 快照。原始字节、存档身份和事务编号由 SaveStore 持有。 */
export function migrateLegacyCoinSave(payload: unknown): GameState {
    const old = payload as LegacyState;
    requireLegacy(old && legacyInt(old.houses, 1) && legacyInt(old.farm, 1) && legacyInt(old.logging, 1) &&
        Array.isArray(old.people) && Array.isArray(old.history) && Array.isArray(old.choices) && old.legacy && Array.isArray(old.legacy.traits));
    requireLegacy(!("policy" in old) || old.policy === null || LEGACY_POLICY_IDS.has(old.policy));
    requireLegacy(!("coins" in old) && !("factory" in old));
    const levels = old.houses - 1;
    const pastCap = LEGACY_STORAGE.base + LEGACY_STORAGE.linear * levels + LEGACY_STORAGE.quadratic * levels * levels;
    requireLegacy(Number.isSafeInteger(pastCap));
    const { farm, logging, food, wood, policy, people, history, choices, night, legacy, dailyTasks, expedition, ...retained } = old;
    const level = Math.max(farm, logging);
    const workers = sewingSlots(level);
    const taskMigration = migrateLegacyDailyTaskDay(dailyTasks);
    const expeditionMigration = migrateLegacyExpedition(expedition, old.completed);
    const coins = walletCoins({ food, wood }, pastCap) + taskMigration.coins + expeditionMigration.coins;
    requireLegacy(people.filter(p => p?.job === "FARM").length <= legacySlots("FARM", farm) &&
        people.filter(p => p?.job === "LOGGING").length <= legacySlots("LOGGING", logging));
    let assigned = 0;
    const migrants = people.map(p => {
        const sewing = !!p && p.job !== "WAITING" && assigned < workers;
        if (sewing) assigned++;
        return migratePerson(p, sewing);
    });
    const descendants = history.map(p => {
        requireLegacy(p?.job === "WAITING");
        return migratePerson(p, false);
    });
    const pending: GameState["choices"] = [];
    for (const choice of choices) {
        requireLegacy(choice);
        if (choice.kind === "POLICY") {
            const ids = choice.options;
            requireLegacy(old.phase === "DAWN" && Array.isArray(ids) && ids.length === LEGACY_POLICY_IDS.size &&
                new Set(ids).size === ids.length && ids.every(id => LEGACY_POLICY_IDS.has(id)));
        } else {
            requireLegacy(choice.kind === "TRAVELER" && choice.person?.job === "WAITING");
            pending.push({ kind: "TRAVELER", person: migratePerson(choice.person, false) });
        }
    }
    requireLegacy(new Set(legacy.traits).size === legacy.traits.length &&
        people.every(p => p.traits.every(trait => legacy.traits.includes(trait))));
    const traits = new Set(legacy.traits.map(migrateTrait));
    for (const migrant of migrants) for (const trait of migrant.traits) traits.add(trait);
    const state: GameState = { ...retained, coins, factory: { level, batches: 0, earned: 0, elapsedMs: 0 }, people: migrants,
        history: descendants, choices: pending, legacy: { ...legacy, traits: Array.from(traits) }, night: null };
    if (taskMigration.day) state.dailyTasks = taskMigration.day;
    if (expeditionMigration.trip) state.expedition = expeditionMigration.trip;
    if (!Object.prototype.hasOwnProperty.call(state, "patrol")) state.patrol = { level: PATROL.startLevel, captain: null };
    if (night !== null) {
        requireLegacy(night && typeof night.hungry === "boolean" && !("reward" in night));
        const { returnPoint, hungry, ...battle } = night;
        state.night = { ...battle, ...(hungry ? { hungry: true } : {}) };
        if (returnPoint !== undefined) {
            requireLegacy(returnPoint && !("coins" in returnPoint));
            const { food, wood, dailyTasks, ...before } = returnPoint;
            const tasksBefore = migrateLegacyDailyTaskDay(dailyTasks);
            state.night.returnPoint = { ...before,
                coins: walletCoins({ food, wood }, pastCap) + tasksBefore.coins + expeditionMigration.coins,
                ...(tasksBefore.day ? { dailyTasks: tasksBefore.day } : {}) };
        }
    }
    return state;
}

/** 旧守夜提前发了粮木。有可校验回退点才退回白天并把商品转回待用；没有时保留旧战斗。 */
export function restoreLegacyNight(state: GameState, back = state.night?.returnPoint): GameState {
    const night = state.night;
    if (!night || !back) return state;
    const next: GameState = { ...state, phase: "DAY", coins: back.coins, gate: back.gate, night: null,
        tactics: { ...state.tactics }, patrol: { ...state.patrol } };
    if (back.dailyTasks) next.dailyTasks = back.dailyTasks;
    else delete next.dailyTasks;
    if (back.mercyCooldown) next.tactics.mercyCooldown = back.mercyCooldown;
    else delete next.tactics.mercyCooldown;
    if (night.patrolRation) next.patrol.rationReady = true;
    if (night.patrolWideImpact) next.patrol.radiusReady = true;
    if (night.rewardDie !== undefined) next.rewardDie = night.rewardDie;
    return next;
}
