import { autoAssignJobs, applyCommand, createGame, economy, finishNight } from "../src/game/VillageRules";
import { clone, isElder } from "../src/game/GameState";
import { ADULT_APPEARANCE } from "../src/game/GameConfig";
import { canonical } from "../src/storage/SaveStore";
import { validateState } from "../src/storage/StateValidation";

let passed = 0;
function ok(v: unknown, message = "assertion failed"): asserts v { if (!v) throw new Error(message); }
function equal(a: unknown, b: unknown) { ok(canonical(a) === canonical(b), `${JSON.stringify(a)} != ${JSON.stringify(b)}`); }
function rejects(f: () => void) { let threw = false; try { f(); } catch { threw = true; } ok(threw); }
function test(name: string, f: () => void) { f(); passed++; console.log("PASS", name); }
test("Two adult appearances use the same six starting factory jobs", () => {
    const s = createGame(17);
    equal(new Set(s.people.map(p => p.appearance)).size, 2);
    s.people.forEach(p => equal(p.appearance, ADULT_APPEARANCE[p.sex]));
    equal(s.people.filter(p => p.job === "SEWING").length, 6);
    equal(economy(s).sewing, 14); validateState(s);
});
test("Factory filling prefers Crafty, keeps incumbents and does not consume RNG", () => {
    const s = createGame(1);
    s.people.forEach(p => { p.job = "WAITING"; p.traits = ["trait_strong"]; });
    const skilled = { ...clone(s.people[5]), id: `1:${s.nextPerson++}`, traits: ["trait_crafty"] as const };
    s.people.push({ ...skilled, traits: [...skilled.traits] });
    const rng = JSON.stringify(s.rng);
    autoAssignJobs(s);
    equal(s.people.map(p => p.job), ["SEWING","SEWING","SEWING","SEWING","SEWING","WAITING","SEWING"]);
    const before = JSON.stringify(s); autoAssignJobs(s); equal(JSON.stringify(s), before); equal(JSON.stringify(s.rng), rng);
    applyCommand(s, { type: "BUILD", kind: "FACTORY" });
    equal(s.people[5].job, "SEWING"); validateState(s);
});
test("Newborns do not occupy slots even after a factory upgrade", () => {
    const s = createGame(3); applyCommand(s, { type: "BIRTH", family: s.families[0].id });
    equal(s.people.filter(p => p.job === "SEWING").length, 6);
    applyCommand(s, { type: "BUILD", kind: "FACTORY" });
    equal(s.people[6].job, "WAITING"); validateState(s);
});
test("Full-slot replacement is atomic and refuses stale or self replacement", () => {
    const s = createGame(2), worker = s.people[2];
    const next = { ...clone(s.people[5]), id: `1:${s.nextPerson++}`, job: "WAITING" as const };
    s.people.push(next);
    applyCommand(s, { type: "JOB", id: next.id, job: "SEWING", replace: worker.id });
    equal(next.job, "SEWING"); equal(worker.job, "WAITING"); validateState(s);
    const snapshot = JSON.stringify(s);
    for (const c of [
        { type: "JOB" as const, id: next.id, job: "SEWING" as const, replace: s.people[4].id },
        { type: "JOB" as const, id: worker.id, job: "SEWING" as const, replace: worker.id },
        { type: "JOB" as const, id: worker.id, job: "SEWING" as const }
    ]) { rejects(() => applyCommand(s, c)); equal(JSON.stringify(s), snapshot); }
});
test("New adults immediately take a free job; retired workers keep their home", () => {
    const s = createGame(3); applyCommand(s, { type: "BIRTH", family: s.families[0].id });
    const child = s.people[6]; child.growth = 1; s.people[0].nights = 1;
    applyCommand(s, { type: "NIGHT" }); finishNight(s, 200, s.towers.map(t => t.operator));
    ok(child.adult); ok(child.traits.length > 0); equal(s.history.length, 0); ok(isElder(s.people[0])); equal(s.people.length, 7);
    equal(s.choices, []); equal(child.job, "SEWING"); validateState(s);
});
test("Accepted travelers may fill a vacancy; declined travelers never take a slot", () => {
    const s = createGame(5); s.day = 4; s.completed = s.legacy.bestNight = 3; s.houses = 5; s.factory.level = 2;
    applyCommand(s, { type: "NIGHT" }); finishNight(s, 200, s.towers.map(t => t.operator));
    const q = s.choices[0]; ok(q.kind === "TRAVELER");
    const declined = clone(s), count = declined.people.length;
    applyCommand(declined, { type: "CHOOSE", value: "decline" }); equal(declined.people.length, count);
    applyCommand(s, { type: "CHOOSE", value: "accept" }); equal(s.people[s.people.length - 1].job, "SEWING"); validateState(s);
});
console.log(`RESULT ${passed} job checks passed`);
