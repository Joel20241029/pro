import { applyCommand, assignOperator, autoAssignJobs, canMarry, capacity, createGame, economy, finishNight } from "../src/game/VillageRules";
import { clone, GameState, isElder, isWorkingAdult } from "../src/game/GameState";
import { CONFIG_VERSION, RULE } from "../src/game/GameConfig";
import { BattleSimulation } from "../src/game/BattleSimulation";
import { GameSession } from "../src/game/GameSession";
import { canonical, crc32, SaveStore, StoragePort } from "../src/storage/SaveStore";
import { validateState } from "../src/storage/StateValidation";

let passed = 0;
function ok(v: unknown, why = "assertion failed"): asserts v { if (!v) throw new Error(why); }
function equal(a: unknown, b: unknown) { ok(canonical(a) === canonical(b), `${JSON.stringify(a)} != ${JSON.stringify(b)}`); }
function rejects(f: () => void) { let rejected = false; try { f(); } catch { rejected = true; } ok(rejected, "expected rejection"); }
function test(name: string, f: () => void) { f(); passed++; console.log("PASS", name); }
function dawn(s: GameState) {
    while (s.choices.length) { const q = s.choices[0]; applyCommand(s, { type: "CHOOSE", value: q.kind === "SKILL" || q.kind === "POLICY" ? q.options[0] : q.kind === "TRAVELER" ? "decline" : "0" }); }
    applyCommand(s, { type: "FINALIZE" });
}
function win(s: GameState) { applyCommand(s, { type: "NIGHT" }); validateState(s); finishNight(s, RULE.gateMax, s.towers.map(t => t.operator)); validateState(s); }
class MemoryStore implements StoragePort {
    values = new Map<string, string>(); writes = 0; fail: "NONE" | "BEFORE" | "AFTER" = "NONE";
    read(key: string) { return this.values.get(key) ?? null; }
    write(key: string, raw: string) { if (this.fail === "BEFORE") throw new Error("quota"); this.values.set(key, raw); this.writes++; if (this.fail === "AFTER") throw new Error("lost ack"); }
}

test("Retirement preserves home and family, frees work/tower/care, and starts three full elder nights", () => {
    const s = createGame(3), p = s.people[0], spouse = s.people[1];
    applyCommand(s, { type: "BIRTH", family: s.families[0].id, carer: p.id }); p.nights = 1; assignOperator(s, 0, p.id);
    const child = s.people[6], count = s.people.length; win(s);
    ok(isElder(p) && !isWorkingAdult(p)); equal(p.elderNights, 3); equal(p.job, "WAITING"); equal(p.careChild, null);
    equal(s.people.length, count); equal(s.history.length, 0); equal(s.families.length, 1); ok(s.towers[0].operator !== null && s.towers[0].operator !== p.id); ok(isWorkingAdult(s.people.find(q => q.id === s.towers[0].operator)!));
    ok(child.ancestors.includes(p.id)); equal(child.growth, 1); ok(s.summary.includes("照料者荣休")); equal(s.stats.retirees, 1);
    dawn(s); const state = canonical(s); autoAssignJobs(s); equal(canonical(s), state);
    ok(!canMarry(s, spouse, s.people[4]), "living spouse still owns the family bond");
    for (const remaining of [2, 1]) { win(s); equal(p.elderNights, remaining); ok(s.people.includes(p)); equal(s.history.length, 0); equal(child.growth, 1); dawn(s); }
    win(s); equal(p.elderNights, 0); ok(!s.people.includes(p)); equal(s.history[0].id, p.id); equal(s.people.length, count - 1);
    equal(s.stats.retirees, 1); equal(s.legacy.retirees, 1); equal(s.families.length, 0); ok(!child.ancestors.includes(p.id)); ok(child.parents.includes(p.id));
    ok(s.summary.includes("安然辞世")); dawn(s); ok(canMarry(s, spouse, s.people.find(p => p.id === "1:5")!));
});
test("A new retiree is not aged with an existing elder, even when that elder departs tonight", () => {
    const s = createGame(1), old = s.people[0], next = s.people[1]; old.nights = 0; old.elderNights = 1; old.job = "WAITING"; next.nights = 1;
    win(s); equal(s.history[0].id, old.id); ok(isElder(next)); equal(next.elderNights, 3); equal(s.people.length, 5); equal(s.stats.retirees, 1);
});
test("Elder ration is included exactly once, honors frugal/winter/policy, and produces no resources", () => {
    const s = createGame(1); s.people.forEach(p => p.job = "WAITING");
    for (const p of s.people.slice(0, 2)) { p.nights = 0; p.elderNights = 3; }
    s.day = 4; s.policy = null; const base = economy(s); equal([base.food, base.wood, base.rations, base.elderRations], [0, 0, 11, 3]);
    s.day = 10; equal(economy(s).rations, Math.ceil(11 * 1.2));
    s.policy = "policy_rations"; equal(economy(s).rations, 11); equal(economy(s).elderRations, 3);
    s.food = 200; equal(economy(s).endFood, 189); s.food = 0; ok(economy(s).hungry); equal(economy(s).endFood, 0);
});
test("Failed nights and a replay do not decrement elder life or charge food again", () => {
    const s = createGame(2), p = s.people[0]; p.nights = 0; p.elderNights = 2; p.job = "WAITING";
    applyCommand(s, { type: "NIGHT" }); const before = clone(s); const a = new BattleSimulation(s), b = new BattleSimulation(s);
    a.step(); b.step(); equal([a.tick, a.gate], [b.tick, b.gate]); equal(s, before);
    finishNight(s, 0, s.towers.map(t => t.operator)); equal(p.elderNights, 2); equal(s.day, before.day); equal(s.food, before.food); equal(s.stats.retirees, 0); validateState(s);
});
test("Elders are rejected by jobs, childcare, marriage and daytime/nighttime tower entry points", () => {
    const s = createGame(3); applyCommand(s, { type: "BIRTH", family: s.families[0].id, carer: s.people[1].id });
    const p = s.people[4]; p.nights = 0; p.elderNights = 3; p.job = "WAITING";
    const before = canonical(s);
    for (const job of ["WAITING", "FARM", "LOGGING", "CARE"] as const) rejects(() => applyCommand(s, { type: "JOB", id: p.id, job, child: s.people[6].id }));
    rejects(() => applyCommand(s, { type: "FAMILY", a: p.id, b: s.people[5].id })); rejects(() => assignOperator(s, 0, p.id)); equal(canonical(s), before);
    applyCommand(s, { type: "NIGHT" }); const b = new BattleSimulation(s), op = b.operators[0]; rejects(() => b.reassign(0, p.id)); equal(b.operators[0], op);
});
test("Retired spouses cannot give birth and their families are kept until departure", () => {
    const s = createGame(1), p = s.people[0]; p.nights = 0; p.elderNights = 3; p.job = "WAITING";
    const before = canonical(s); rejects(() => applyCommand(s, { type: "BIRTH", family: s.families[0].id, carer: s.people[4].id })); equal(canonical(s), before); validateState(s);
});
test("Elders still occupy housing and block extra birth/traveler at full capacity", () => {
    const s = createGame(1); for (let i = 0; i < 2; i++) { const p = clone(s.people[4]); p.id = `1:${s.nextPerson++}`; p.job = "WAITING"; s.people.push(p); }
    s.people[0].nights = 0; s.people[0].elderNights = 3; s.people[0].job = "WAITING"; equal(s.people.length, capacity(s));
    applyCommand(s, { type: "FAMILY", a: s.people[4].id, b: s.people[5].id }); rejects(() => applyCommand(s, { type: "BIRTH", family: s.families[1].id, carer: s.people[3].id }));
    const traveler = clone(s.people[4]); traveler.id = `1:${s.nextPerson++}`; traveler.origin = "TRAVELER";
    s.phase = "DAWN"; s.wave = null; s.choices = [{ kind: "TRAVELER", person: traveler }]; validateState(s);
    const before = canonical(s); rejects(() => applyCommand(s, { type: "CHOOSE", value: "accept" })); equal(canonical(s), before);
});
test("Current-state validation rejects missing timers, working elders, stale tower and night references", () => {
    const base = createGame(1); base.people[0].nights = 0; base.people[0].elderNights = 3; base.people[0].job = "WAITING"; validateState(base);
    for (const mutate of [
        (s: GameState) => { delete (s.people[0] as Partial<typeof s.people[0]>).elderNights; },
        (s: GameState) => { s.people[0].elderNights = 0; },
        (s: GameState) => { s.people[0].job = "CARE"; s.people[0].careChild = s.people[1].id; },
        (s: GameState) => { s.people[1].elderNights = 1; },
        (s: GameState) => { s.towers[0].operator = s.people[0].id; }
    ]) { const s = clone(base); mutate(s); rejects(() => validateState(s)); }
    applyCommand(base, { type: "NIGHT" }); validateState(base); base.night!.elders = []; rejects(() => validateState(base));
});
test("Same-version day/night elder saves restore exactly without startup writes", () => {
    for (const night of [false, true]) {
        const s = createGame(3); s.people[0].nights = 0; s.people[0].elderNights = 2; s.people[0].job = "WAITING"; if (night) applyCommand(s, { type: "NIGHT" });
        const m = new MemoryStore(), store = new SaveStore(m); store.inspect(); store.prepare(s); store.commit();
        const g = new GameSession(new SaveStore(m)); g.load(); equal(g.state, s); equal(m.writes, 1); equal(g.battle?.tick ?? null, night ? 0 : null);
        const again = new GameSession(new SaveStore(m)); again.load(); equal(again.state, s); equal(m.writes, 1);
    }
});
test("Retirement save failures retry the same transition without repeating age, food or retirement count", () => {
    for (const failure of ["BEFORE", "AFTER"] as const) {
        const s = createGame(1); s.people[0].nights = 1; win(s); dawn(s); const m = new MemoryStore(), store = new SaveStore(m); store.inspect(); store.prepare(s);
        m.fail = failure; rejects(() => store.commit()); const raw = store.pending!.raw; m.fail = "NONE"; equal(store.commit(), s); equal(m.writes, 1); equal([...m.values.values()][0], raw); equal(s.people[0].elderNights, 3); equal(s.stats.retirees, 1);
    }
});
test("Only current save version is read; old/future data is not migrated or automatically deleted", () => {
    for (const version of [1, 2, 3, CONFIG_VERSION + 1]) {
        const m = new MemoryStore(), body = { schemaVersion: 2, configVersion: version, revision: 1, commitId: "other-version", commitType: "NORMAL", payload: createGame(1) };
        const raw = canonical({ ...body, checksum: crc32(canonical(body)) }); m.values.set("daidai_village.save.a", raw);
        const g = new GameSession(new SaveStore(m)); g.load(); equal(g.state, null); equal(g.boot?.kind, "incompatible"); equal(m.values.get("daidai_village.save.a"), raw); equal(m.writes, 0);
    }
});
console.log(`RESULT ${passed} elder/save checks passed`);
