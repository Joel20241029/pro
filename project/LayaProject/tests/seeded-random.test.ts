import { SeededRandom } from "../src/game/SeededRandom";
import { ELITE, VILLAGER_NAMES } from "../src/game/GameConfig";
import { createGame, applyCommand } from "../src/game/VillageRules";
import { nextSex } from "../src/game/Population";

let passed = 0;
function ok(value: unknown, message = "assertion failed"): asserts value { if (!value) throw new Error(message); }
function equal(a: unknown, b: unknown) { ok(JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} != ${JSON.stringify(b)}`); }
function test(name: string, run: () => void) { run(); passed++; console.log("PASS", name); }

test("Integer sampling has stable full-width vectors", () => {
    for (const [range, expected] of [[2, [0, 0, 1, 1, 0]], [3, [0, 1, 1, 2, 0]], [7, [1, 2, 3, 4, 0]], [100, [23, 36, 50, 70, 5]]] as const) {
        const rng = new SeededRandom(1); equal(Array.from({ length: 5 }, () => rng.range(range)), expected);
    }
    const min = new SeededRandom(1), max = new SeededRandom(1), raw = new SeededRandom(1);
    for (let i = 0; i < 100; i++) { equal(min.range(1), 0); equal(max.range(0x100000000), raw.next()); }
});
test("Invalid ranges are rejected without consuming randomness", () => {
    for (const n of [NaN, Infinity, 0, -1, .5, 0x100000001]) {
        const rng = new SeededRandom(1); let rejected = false;
        try { rng.range(n); } catch { rejected = true; }
        ok(rejected); equal(rng.state, 1);
    }
});
test("The rejection boundary preserves equal-size buckets", () => {
    const limit = 4294967200, samples = [limit - 1, limit, 0xffffffff, 0, 42949672];
    const rng = new SeededRandom(1); let draws = 0;
    rng.next = () => { ok(draws < samples.length); return samples[draws++]; };
    equal(rng.range(100), 99); equal(draws, 1);
    equal(rng.range(100), 0); equal(draws, 4);
    equal(rng.range(100), 1); equal(draws, 5);
});
test("Fixed range sequences consume the same raw draws as the previous rejection policy", () => {
    const current = new SeededRandom(29), reference = new SeededRandom(29);
    for (let i = 0; i < 1000; i++) {
        const n = [2, 7, 100, 0x80000001, 0xffffffff][i % 5];
        const limit = Math.floor(0x100000000 / n) * n;
        let value: number; do { value = reference.next(); } while (value >= limit);
        const sampled = current.range(n); ok(sampled >= 0 && sampled < n); equal(current.state, reference.state);
    }
});
test("Repeated birth draw cadence does not lock inheritance or distort elite rarity", () => {
    for (const seed of [0, 1, 2, 11, 123]) {
        const rng = new SeededRandom(seed), population = createGame(seed).people;
        let firstParent = 0, elites = 0;
        for (let i = 0; i < 100000; i++) {
            nextSex(population, rng);
            if (rng.range(2) === 0) firstParent++;
            rng.range(VILLAGER_NAMES.child.length + 1);
            if (rng.range(ELITE.chanceScale) < ELITE.chancePercent) elites++;
        }
        ok(firstParent >= 49000 && firstParent <= 51000, `parent distribution for seed ${seed}: ${firstParent}`);
        ok(elites >= 4500 && elites <= 5500, `elite distribution for seed ${seed}: ${elites}`);
    }
});
test("Actual BIRTH commands inherit from both parents across the saved family stream", () => {
    for (const seed of [0, 1]) {
        let familyState = seed, maternal = 0, paternal = 0;
        for (let i = 0; i < 1000; i++) {
            const state = createGame(seed); state.rng.family = familyState;
            state.people[0].trait = "trait_diligent"; state.people[1].trait = "trait_woodwise";
            applyCommand(state, { type: "BIRTH", family: state.families[0].id, carer: state.people[1].id });
            familyState = state.rng.family;
            if (state.people[6].trait === "trait_diligent") paternal++; else maternal++;
        }
        ok(paternal > 400 && maternal > 400, `actual inheritance: ${paternal}/${maternal}`);
    }
});
console.log(`${passed} seeded random tests passed`);
