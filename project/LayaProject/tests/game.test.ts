import { createGame, applyCommand, economy, finishNight, canMarry } from "../src/game/VillageRules";
import { clone, GameState } from "../src/game/GameState";
import { SeededRandom } from "../src/game/SeededRandom";
import { BattleSimulation, PATH_LENGTH } from "../src/game/BattleSimulation";
import { GameSession } from "../src/game/GameSession";
import { generateWave } from "../src/game/WaveGenerator";
import { ELITE, ENEMIES, RULE } from "../src/game/GameConfig";
import { canonical, crc32, SaveStore, StoragePort } from "../src/storage/SaveStore";
import { validateState } from "../src/storage/StateValidation";
let passed = 0;
function ok(v: unknown, message = "assertion failed"): asserts v { if (!v) throw new Error(message); }
function equal(a: unknown, b: unknown) { ok(JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} != ${JSON.stringify(b)}`); }
function rejects(f: () => void) { let threw = false; try { f(); } catch { threw = true; } ok(threw, "expected rejection"); }
function test(name: string, f: () => void) { f(); passed++; console.log("PASS", name); }
function dawn(s: GameState) {
    while (s.choices.length) { const q = s.choices[0]; applyCommand(s, { type: "CHOOSE", value: q.kind === "SKILL" || q.kind === "POLICY" ? q.options[0] : q.kind === "TRAVELER" ? "decline" : "0" }); }
    if (s.phase === "DAWN") applyCommand(s, { type: "FINALIZE" });
}
class MemoryStore implements StoragePort {
    values = new Map<string, string>(); writes = 0; fail: "NONE" | "BEFORE" | "AFTER" | "READ" = "NONE";
    read(key: string) { if (this.fail === "READ") throw new Error("read failure"); return this.values.has(key) ? this.values.get(key)! : null; }
    write(key: string, raw: string) { if (this.fail === "BEFORE") throw new Error("quota failure"); this.writes++; this.values.set(key, raw); if (this.fail === "AFTER") throw new Error("write completed, callback lost"); }
}
test("LCG fixed vector, canonical UTF8 and CRC", () => {
    const r = new SeededRandom(1); equal(Array.from({ length: 5 }, () => r.next()), [1015568748, 1586005467, 2165703038, 3027450565, 217083232]);
    equal(crc32("123456789"), "cbf43926"); equal(canonical({ b: 2, a: "村" }), '{"a":"村","b":2}'); rejects(() => canonical({ a: undefined }));
});
test("Fixed founders and valid first night", () => { const s = createGame(1); validateState(s); equal(s.people.length, 6); applyCommand(s, { type: "NIGHT" }); validateState(s); });
test("Consumption occurs before warehouse cap", () => {
    const s = createGame(1); s.food = 195; s.people.forEach(p => { p.job = "WAITING"; p.trait = "trait_farsight"; p.skill = "skill_archery"; });
    s.day = 4; s.people[0].job = s.people[1].job = "FARM";
    const child = clone(s.people[0]); child.id = "1:7"; child.adult = false; s.people.push(child);
    const e = economy(s); equal([e.food, e.rations, e.endFood], [16, 13, 198]);
});
test("Birth once, two cared wins, new adult receives its configured lifespan", () => {
    const s = createGame(6); applyCommand(s, { type: "BIRTH", family: s.families[0].id, carer: s.people[1].id }); equal(s.food, 40); validateState(s);
    const child = s.people[6]; ok(child.parents.length === 2); ok(child.trait === s.people[0].trait || child.trait === s.people[1].trait);
    rejects(() => applyCommand(s, { type: "BIRTH", family: s.families[0].id, carer: s.people[5].id }));
    applyCommand(s, { type: "NIGHT" }); finishNight(s, 200, s.towers.map(t => t.operator)); dawn(s); equal(child.growth, 1);
    applyCommand(s, { type: "NIGHT" }); finishNight(s, 200, s.towers.map(t => t.operator)); validateState(s); equal(child.nights, child.elite ? ELITE.adultNights : RULE.adultNights); ok(child.adult); equal(s.people[1].job, "WAITING"); ok(s.choices[0].kind === "SKILL"); dawn(s); validateState(s);
});
test("Uncared child does not grow; failed night does not age", () => {
    const s = createGame(3); applyCommand(s, { type: "BIRTH", family: s.families[0].id, carer: s.people[1].id }); applyCommand(s, { type: "JOB", id: s.people[1].id, job: "WAITING" });
    applyCommand(s, { type: "NIGHT" }); const nights = s.people[0].nights; finishNight(s, 0, s.towers.map(t => t.operator)); equal(s.people[0].nights, nights); equal(s.people[6].growth, 0); equal(s.day, 1); validateState(s);
});
test("Retiring carer can finish child's growth", () => {
    const s = createGame(3); applyCommand(s, { type: "BIRTH", family: s.families[0].id, carer: s.people[1].id }); s.people[1].nights = 1; s.people[6].growth = 1;
    applyCommand(s, { type: "NIGHT" }); finishNight(s, 200, s.towers.map(t => t.operator)); equal(s.people[6].nights, 12); equal(s.people[1].elderNights, 3); equal(s.history.length, 0); dawn(s); validateState(s);
});
test("Parents and siblings blocked, unrelated origins allowed", () => {
    const s = createGame(1); ok(canMarry(s, s.people[4], s.people[5])); s.people[4].parents = ["old:1", "old:2"]; s.people[5].parents = ["old:1", "old:3"]; ok(!canMarry(s, s.people[4], s.people[5])); s.people[5].parents = []; s.people[5].ancestors = [s.people[4].id]; ok(!canMarry(s, s.people[4], s.people[5]));
});
test("Wave budget and object limits over 10,000 days", () => {
    const s = createGame(11);
    for (let d = 1; d <= 10000; d++) { s.day = d; s.tier = d % 4; const w = generateWave(s); equal(w.entries.reduce((a, e) => a + ENEMIES[e.kind].cost, 0), w.budget); ok(w.budget <= 66 && w.entries.length <= 80); equal(w.entries.filter(e => e.kind === "enemy_chief").length, d % 12 === 0 ? 1 : 0); }
});
test("Initial battle is winnable, replay is deterministic", () => {
    const s = createGame(7); applyCommand(s, { type: "NIGHT" }); const a = new BattleSimulation(s), b = new BattleSimulation(s);
    while (!a.outcome && a.tick < 6000) a.step(); while (!b.outcome && b.tick < 6000) b.step();
    equal(a.outcome, "WIN"); equal([a.tick, a.gate], [b.tick, b.gate]); ok(a.enemies.length <= RULE.enemyCap);
});
test("Gate arrival loss precedes a tower firing in same tick", () => {
    const s = createGame(1); applyCommand(s, { type: "NIGHT" }); const b = new BattleSimulation(s); b.gate = 1;
    b.enemies.push({ seq: 100, kind: "enemy_raider", progress: PATH_LENGTH - .1, hp: 1, speed: 36, slow: 0, slowTicks: 0, born: 0, summoned: 0 }); b.step(); equal(b.outcome, "LOSE"); equal(b.shots.length, 0);
});
test("Save write-before failure preserves candidate and retries once", () => {
    const m = new MemoryStore(), store = new SaveStore(m); equal(store.inspect().kind, "new"); store.prepare(createGame(1)); m.fail = "BEFORE"; rejects(() => store.commit()); const raw = store.pending!.raw; m.fail = "NONE"; store.commit(); equal(m.writes, 1); equal([...m.values.values()][0], raw); equal(new SaveStore(m).inspect().kind, "ready");
});
test("Save write-after failure is acknowledged without second write", () => {
    const m = new MemoryStore(), store = new SaveStore(m); store.inspect(); store.prepare(createGame(1)); m.fail = "AFTER"; rejects(() => store.commit()); m.fail = "NONE"; store.commit(); equal(m.writes, 1);
});
test("Read errors, corruption, future versions and conflicts stay distinct", () => {
    const m = new MemoryStore(), store = new SaveStore(m); store.inspect(); store.prepare(createGame(1)); store.commit();
    m.fail = "READ"; rejects(() => store.inspect()); m.fail = "NONE";
    m.values.set("daidai_village.save.b", "broken"); equal(store.inspect().kind, "recover");
    m.values.set("daidai_village.save.b", JSON.stringify({ schemaVersion: 99, configVersion: 1 })); equal(store.inspect().kind, "incompatible");
});
test("Concurrent valid save is never overwritten", () => {
    const m = new MemoryStore(), a = new SaveStore(m), b = new SaveStore(m); a.inspect(); b.inspect(); a.prepare(createGame(1)); b.prepare(createGame(2)); b.commit(); const before = [...m.values.values()][0]; rejects(() => a.commit()); equal([...m.values.values()][0], before);
});
test("Night settings save keeps live battle; reload replays baseline", () => {
    const m = new MemoryStore(), g = new GameSession(new SaveStore(m)); g.load(); g.newVillage(); g.command({ type: "NIGHT" }); for (let i = 0; i < 100; i++) g.update(.05); const live = g.battle;
    g.command({ type: "SPEED", value: 2 }); ok(g.battle === live); const reloaded = new GameSession(new SaveStore(m)); reloaded.load(); equal(reloaded.battle!.tick, 0); equal(reloaded.state!.settings.speed, 2);
});
test("Background/resume and panel pause cannot erase user pause", () => {
    const g = new GameSession(new SaveStore(new MemoryStore())); g.load(); g.newVillage(); g.command({ type: "NIGHT" }); g.pause("USER"); g.hide(); g.show(); g.resume("CHOICE"); g.update(2); equal(g.battle!.tick, 0); g.resume("WAIT_RESUME"); g.update(2); equal(g.battle!.tick, 0); g.resume("USER"); g.update(.05); equal(g.battle!.tick, 1);
});
test("Tower dialog pause permits reassignment and resumes without changing the saved baseline", () => {
    const m = new MemoryStore(), g = new GameSession(new SaveStore(m)); g.load(); g.newVillage(); g.command({ type: "NIGHT" });
    const live = g.battle!, previous = live.operators[0], replacement = g.state!.people[4].id, baseline = JSON.stringify(g.state), writes = m.writes;
    g.reassign(0, replacement); equal(live.operators[0], previous);
    g.pause("CHOICE"); g.reassign(0, replacement); equal(live.operators[0], replacement); g.update(.1); equal(live.tick, 0);
    g.resume("CHOICE"); g.update(.05); equal(live.tick, 1); ok(g.battle === live); equal(g.pauses.size, 0);
    equal(JSON.stringify(g.state), baseline); equal(m.writes, writes);
});
test("Closing tower dialog preserves an earlier manual pause", () => {
    const g = new GameSession(new SaveStore(new MemoryStore())); g.load(); g.newVillage(); g.command({ type: "NIGHT" });
    const replacement = g.state!.people[4].id;
    g.pause("USER"); g.pause("CHOICE"); g.reassign(0, replacement); equal(g.battle!.operators[0], replacement);
    g.resume("CHOICE"); g.update(.1); equal(g.battle!.tick, 0); equal([...g.pauses], ["USER"]);
    g.resume("USER"); g.update(.05); equal(g.battle!.tick, 1);
});
test("Closing tower dialog does not clear background or return confirmation pauses", () => {
    const g = new GameSession(new SaveStore(new MemoryStore())); g.load(); g.newVillage(); g.command({ type: "NIGHT" });
    g.pause("CHOICE"); g.hide(); g.resume("CHOICE"); g.update(.1); equal(g.battle!.tick, 0); ok(g.pauses.has("BACKGROUND"));
    g.show(); g.update(.1); equal(g.battle!.tick, 0); ok(g.pauses.has("WAIT_RESUME"));
    g.resume("WAIT_RESUME"); g.update(.05); equal(g.battle!.tick, 1);
});
test("Pending save still blocks tower reassignment under dialog pause", () => {
    const m = new MemoryStore(), g = new GameSession(new SaveStore(m)); g.load(); g.newVillage(); g.command({ type: "NIGHT" }); g.pause("CHOICE");
    const operator = g.battle!.operators[0], replacement = g.state!.people[4].id; m.fail = "BEFORE"; g.command({ type: "SPEED", value: 2 }); ok(g.saves.pending);
    g.reassign(0, replacement); equal(g.battle!.operators[0], operator); g.resume("CHOICE"); g.update(.1); equal(g.battle!.tick, 0); ok(g.pauses.has("SAVE_PENDING"));
    m.fail = "NONE"; g.retry(); g.pause("CHOICE"); g.reassign(0, replacement); equal(g.battle!.operators[0], replacement);
});
test("Empty dawn resumes once without repeated age settlement", () => {
    const m = new MemoryStore(), st = new SaveStore(m); st.inspect(); const s = createGame(1); applyCommand(s, { type: "NIGHT" }); finishNight(s, 200, s.towers.map(t => t.operator)); st.prepare(s); st.commit();
    const g = new GameSession(new SaveStore(m)); g.load(); equal(g.state!.phase, "DAY"); equal(g.state!.people[0].nights, 3); equal(g.state!.day, 2);
});
test("Repeated command errors each notify the Tip without changing saved business state", () => {
    const m = new MemoryStore(), g = new GameSession(new SaveStore(m)); g.load(); g.newVillage();
    g.state!.wood = 0; const before = JSON.stringify(g.state), revision = g.errorRevision, writes = m.writes;
    g.command({ type: "BUILD", kind: "HOUSE" }); const message = g.error;
    ok(message.length > 0); equal(g.errorRevision, revision + 1);
    g.command({ type: "BUILD", kind: "HOUSE" }); equal(g.error, message); equal(g.errorRevision, revision + 2);
    g.hide(); g.show(); equal(g.errorRevision, revision + 2);
    equal(JSON.stringify(g.state), before); equal(m.writes, writes);
});
test("Malformed jobs and references fail validation", () => { const s = createGame(1); s.towers[0].operator = "missing"; rejects(() => validateState(s)); });
test("Favorite ancestor survives new village and save reload", () => {
    const s = createGame(1); s.people[0].nights = 1;
    for (let i = 0; i < 1 + RULE.elderNights; i++) { applyCommand(s, { type: "NIGHT" }); finishNight(s, 200, s.towers.map(t => t.operator)); dawn(s); }
    applyCommand(s, { type: "FAVORITE", id: s.history[0].id });
    const next = createGame(2, s.legacy, s.legacy.traits[0], s.history, s.favorites); validateState(next); equal(next.run, 2); equal(next.favorites, s.favorites);
    const m = new MemoryStore(), st = new SaveStore(m); st.inspect(); st.prepare(next); st.commit(); const loaded = new SaveStore(m).inspect(); ok(loaded.kind === "ready"); equal(loaded.state.history[0].id, "1:1");
});
test("Traveler uses world RNG without advancing family RNG", () => {
    const s = createGame(12); s.day = 4; s.completed = 3;  s.wave = generateWave(s); const family = s.rng.family, world = s.rng.world;
    applyCommand(s, { type: "NIGHT" }); finishNight(s, 200, s.towers.map(t => t.operator)); equal(s.rng.family, family); ok(s.rng.world !== world); ok(s.choices.some(q => q.kind === "TRAVELER"));
});
test("Annual tier selected before next wave", () => {
    const s = createGame(1); s.day = 12; s.completed = 11;  s.wave = generateWave(s);
    applyCommand(s, { type: "NIGHT" }); finishNight(s, 200, s.towers.map(t => t.operator));
    while (s.choices.length) { const q = s.choices[0]; applyCommand(s, { type: "CHOOSE", value: q.kind === "POLICY" || q.kind === "SKILL" ? q.options[0] : q.kind === "TRAVELER" ? "decline" : "3" }); }
    equal(s.wave, null); applyCommand(s, { type: "FINALIZE" }); equal(s.wave!.tier, 3); equal(s.wave!.budget, 38);
});
test("400 dawn settlements keep village and history bounded", () => {
    const s = createGame(1);
    for (let day = 0; day < 400; day++) {
        applyCommand(s, { type: "NIGHT" }); finishNight(s, 200, s.towers.map(t => t.operator));
        while (s.choices.length) { const q = s.choices[0]; applyCommand(s, { type: "CHOOSE", value: q.kind === "POLICY" || q.kind === "SKILL" ? q.options[0] : q.kind === "TRAVELER" ? "accept" : "0" }); }
        applyCommand(s, { type: "FINALIZE" }); validateState(s); ok(s.history.length <= 80 && s.people.length <= 20);
    }
    equal(s.day, 401); ok(s.history.length === 60);
});
console.log(`RESULT ${passed} checks passed`);
