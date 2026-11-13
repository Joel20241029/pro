import { applyCommand, assignOperator, createGame, economy, finishNight } from "../src/game/VillageRules";
import { clone, GameState, isElder } from "../src/game/GameState";
import { ELITE, RULE, TOWERS, TowerKind } from "../src/game/GameConfig";
import { SeededRandom } from "../src/game/SeededRandom";
import { BattleSimulation } from "../src/game/BattleSimulation";
import { generateWave } from "../src/game/WaveGenerator";
import { GameSession } from "../src/game/GameSession";
import { canonical, SaveStore, StoragePort } from "../src/storage/SaveStore";
import { validateState } from "../src/storage/StateValidation";
let passed = 0;
function ok(v: unknown, why = "assertion failed"): asserts v { if (!v) throw new Error(why); }
function eq(a: unknown, b: unknown) { ok(canonical(a) === canonical(b), `${JSON.stringify(a)} != ${JSON.stringify(b)}`); }
function rejects(fn: () => void) { let threw = false; try { fn(); } catch { threw = true; } ok(threw); }
function test(name: string, fn: () => void) { fn(); passed++; console.log("PASS", name); }
function dawn(s: GameState) { while (s.choices.length) { const q = s.choices[0]; applyCommand(s, { type: "CHOOSE", value: q.kind === "SKILL" || q.kind === "POLICY" ? q.options[0] : q.kind === "TRAVELER" ? "decline" : "0" }); } applyCommand(s, { type: "FINALIZE" }); }
function win(s: GameState) { applyCommand(s, { type: "NIGHT" }); finishNight(s, 200, s.towers.map(t => t.operator)); validateState(s); }
function birth(s: GameState) { applyCommand(s, { type: "BIRTH", family: s.families[0].id, carer: s.people[1].id }); return s.people[s.people.length - 1]; }
function seedForRoll(roll: number, traveler: boolean) {
    for (let seed = 1; seed < 10000; seed++) {
        const s = createGame(seed); if (traveler) { s.day = 4; s.wave = generateWave(s); }
        const rng = new SeededRandom(traveler ? s.rng.world : s.rng.family);
        rng.range(2); rng.range(traveler ? 5 : 2); if (!traveler) rng.range(7);
        if (rng.range(100) === roll) return seed;
    }
    throw new Error("boundary seed not found");
}
class Memory implements StoragePort {
    map = new Map<string, string>(); fail = false;
    read(key: string) { return this.map.get(key) ?? null; }
    write(key: string, value: string) { if (this.fail) throw new Error("quota"); this.map.set(key, value); }
}
test("Founders are ordinary; 4/100 is elite and 5/100 is ordinary for both birth and traveler", () => {
    for (const roll of [4, 5]) for (const traveler of [false, true]) {
        const s = createGame(seedForRoll(roll, traveler)); ok(s.people.every(p => !p.elite));
        if (!traveler) eq(birth(s).elite, roll === 4);
        else {
            s.day = 4; s.completed = s.legacy.bestNight = 3; s.wave = generateWave(s); win(s);
            const q = s.choices.find(q => q.kind === "TRAVELER"); ok(q && q.kind === "TRAVELER");
            eq(q.person.elite, roll === 4); eq(q.person.nights, roll === 4 ? 18 : 12); validateState(s);
        }
    }
});
test("Elite parents do not change the independent newborn draw", () => {
    for (const roll of [4, 5]) {
        const ordinary = createGame(seedForRoll(roll, false)), elite = clone(ordinary);
        elite.people.slice(0, 2).forEach(p => { p.origin = "TRAVELER"; p.elite = true; });
        eq(birth(ordinary).elite, birth(elite).elite); eq(ordinary.rng.family, elite.rng.family); validateState(elite);
    }
});
test("Birth pending commit retry and reload preserve the exact elite draw", () => {
    const m = new Memory(), store = new SaveStore(m); store.inspect(); store.prepare(createGame(seedForRoll(4, false))); store.commit();
    const g = new GameSession(new SaveStore(m)); g.load(); m.fail = true;
    g.command({ type: "BIRTH", family: g.state!.families[0].id, carer: g.state!.people[1].id });
    eq(g.state!.people.length, 6); const raw = g.saves.pending!.raw; m.fail = false; g.retry();
    eq(g.state!.people.length, 7); ok(g.state!.people[6].elite); ok([...m.map.values()].includes(raw));
    const again = new GameSession(new SaveStore(m)); again.load(); eq(again.state, g.state);
});
test("Traveler choice survives save/reload and accepting never rerolls", () => {
    const s = createGame(seedForRoll(4, true)); s.day = 4; s.completed = s.legacy.bestNight = 3; s.wave = generateWave(s); win(s);
    const q = s.choices[0]; ok(q.kind === "TRAVELER" && q.person.elite); const traveler = clone(q.person), rng = clone(s.rng);
    const m = new Memory(), store = new SaveStore(m); store.inspect(); store.prepare(s); store.commit(); const loaded = new SaveStore(m).inspect(); ok(loaded.kind === "ready");
    const restored = loaded.state; applyCommand(restored, { type: "CHOOSE", value: "accept" });
    const actual = restored.people.find(p => p.id === traveler.id)!; ok(actual.elite); eq(actual.nights, 18); eq(restored.rng, rng); validateState(restored);
});
test("Farm/logging multiply after additive bonuses and before one floor; rations unchanged", () => {
    const s = createGame(1); s.people.forEach(p => p.job = "WAITING"); const p = s.people[0]; p.origin = "TRAVELER";
    p.job = "FARM"; s.policy = "policy_harvest"; const rations = economy(s).rations; p.elite = true;
    eq(economy(s).food, Math.floor(8 * (1 + .2 + .2 + .1 + .25) * 1.5)); eq(economy(s).rations, rations);
    p.job = "LOGGING"; p.trait = "trait_woodwise"; p.skill = "skill_logging"; s.policy = "policy_logging"; s.day = 7;
    eq(economy(s).wood, Math.floor(6 * (1 + .2 + .2 + .15 + .25) * 1.5));
});
test("Elite carer adds one food only when caring and never accelerates two-night childhood", () => {
    const s = createGame(seedForRoll(4, false)), child = birth(s), carer = s.people[1]; const regular = economy(s);
    carer.elite = true; carer.origin = "TRAVELER"; eq(economy(s).food, regular.food + 1); eq(economy(s).rations, regular.rations);
    win(s); eq(child.growth, 1); ok(!child.adult); dawn(s); win(s); ok(child.adult && child.elite); eq(child.nights, 18); eq(carer.careChild, null);
});
test("All three tower types gain damage with unchanged speed/range/slow and armor applied before floor", () => {
    for (const kind of ["ARROW", "STONE", "SLOW"] as TowerKind[]) {
        const s = createGame(1); const p = s.people[0]; p.origin = "TRAVELER"; p.trait = "trait_frugal"; p.skill = "skill_farming";
        s.towers.forEach(t => { t.kind = null; t.level = 0; t.operator = null; }); s.towers[0].kind = kind; s.towers[0].level = 1; assignOperator(s, 0, p.id); applyCommand(s, { type: "NIGHT" });
        const normal = new BattleSimulation(s); s.people[0].elite = true; const elite = new BattleSimulation(s);
        // 固定靶放在首个弯道内（距路径入口200），确保调位后仍处于三塔基础射程内，只检验精英伤害。
        for (const b of [normal, elite]) { b.enemies.push({ appearanceSeed: 1, seq: 999, kind: "enemy_armored", progress: 200, hp: 500, speed: 0, slow: 0, slowTicks: 0, born: 0, summoned: 0 }); b.step(); }
        const a = normal.enemies.find(e => e.seq === 999)!, b = elite.enemies.find(e => e.seq === 999)!;
        eq(500 - b.hp, Math.floor(TOWERS[kind].damage * 1.25 * (1 - .4 / (kind === "STONE" ? 2 : 1))));
        ok(a.progress === b.progress && a.slow === b.slow && a.slowTicks === b.slowTicks && normal.shots.length === elite.shots.length);
    }
});
test("Elite has eighteen work nights and five full elder nights, then keeps badge in history", () => {
    const s = createGame(1), p = s.people[4]; p.elite = true; p.origin = "TRAVELER"; p.nights = 18;
    for (let i = 17; i >= 0; i--) { win(s); eq(p.nights, i); if (i) ok(!isElder(p)); else eq(p.elderNights, 5); dawn(s); }
    for (let i = 4; i >= 0; i--) { win(s); eq(p.elderNights, i); if (i) ok(s.people.includes(p)); else { ok(!s.people.includes(p)); ok(s.history.find(h => h.id === p.id)!.elite); } dawn(s); }
    validateState(s);
});
test("Failed night ages neither elite workers nor elders and does not raise best wave", () => {
    const s = createGame(1); for (const p of s.people.slice(4)) { p.elite = true; p.origin = "TRAVELER"; }
    s.people[4].nights = 18; s.people[5].nights = 0; s.people[5].elderNights = 5;
    applyCommand(s, { type: "NIGHT" }); finishNight(s, 0, s.towers.map(t => t.operator));
    eq([s.people[4].nights, s.people[5].elderNights, s.completed, s.legacy.bestNight], [18, 5, 0, 0]); validateState(s);
});
test("Strict save validation rejects missing badges, elite founders and ordinary overlong lives", () => {
    for (const mutate of [(s: GameState) => delete (s.people[0] as any).elite, (s: GameState) => s.people[0].elite = true, (s: GameState) => s.people[0].nights = 18, (s: GameState) => { s.people[4].nights = 0; s.people[4].elderNights = 5; s.people[4].job = "WAITING"; }]) { const s = createGame(1); mutate(s); rejects(() => validateState(s)); }
});
test("Successful waves and restarting use max of each run, never accumulate or include failed wave", () => {
    const s = createGame(1); win(s); eq(s.legacy.bestNight, 1); dawn(s); win(s); eq(s.legacy.bestNight, 2); dawn(s);
    applyCommand(s, { type: "NIGHT" }); finishNight(s, 0, s.towers.map(t => t.operator)); eq(s.legacy.bestNight, 2);
    const next = createGame(2, s.legacy); eq(next.completed, 0); eq(next.legacy.bestNight, 2); win(next); eq(next.legacy.bestNight, 2);
});
console.log(`RESULT ${passed} elite/ranking checks passed`);
