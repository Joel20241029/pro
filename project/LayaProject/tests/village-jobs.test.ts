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
test("Two adult appearances retain all founder assignments and original starting production", () => {
    const s = createGame(17); equal(new Set(s.people.map(p => p.appearance)).size, 2);
    s.people.forEach(p => equal(p.appearance, ADULT_APPEARANCE[p.sex])); equal(s.people[4].job, "LOGGING"); equal(economy(s).wood, 14); validateState(s);
});
test("Auto assignment matches specialists first, then farm before logging, without moving workers or RNG", () => {
    const s = createGame(1); s.people.forEach(p => { p.job = "WAITING"; p.skill = "skill_archery"; });
    s.people[4].skill = "skill_logging"; s.people[5].skill = "skill_farming"; const rng = JSON.stringify(s.rng);
    autoAssignJobs(s); equal(s.people.map(p => p.job), ["FARM", "LOGGING", "WAITING", "WAITING", "LOGGING", "FARM"]);
    const before = JSON.stringify(s); autoAssignJobs(s); equal(JSON.stringify(s), before); equal(JSON.stringify(s.rng), rng);
    s.farm = 2; autoAssignJobs(s); equal(s.people[2].job, "FARM"); equal(s.people[3].job, "FARM"); validateState(s);
});
test("Birth and building free or add slots that auto-fill, while care remains a manual assignment", () => {
    const s = createGame(3); applyCommand(s, { type: "BIRTH", family: s.families[0].id, carer: s.people[1].id });
    equal(s.people[1].job, "CARE"); equal(s.people[5].job, "FARM"); equal(s.people[3].job, "WAITING");
    applyCommand(s, { type: "BUILD", kind: "FARM" }); equal(s.people[3].job, "FARM"); equal(s.people[6].job, "WAITING");
    equal(s.people.filter(p => p.job === "CARE").length, 1); validateState(s);
});
test("Full-slot replacement is atomic for either sex and rejects stale or unrelated workers", () => {
    const s = createGame(2); applyCommand(s, { type: "JOB", id: s.people[3].id, job: "LOGGING", replace: s.people[2].id });
    equal(s.people[3].job, "LOGGING"); equal(s.people[2].job, "WAITING"); validateState(s);
    const before = JSON.stringify(s);
    for (const c of [
        { type: "JOB" as const, id: s.people[3].id, job: "LOGGING" as const, replace: s.people[4].id },
        { type: "JOB" as const, id: s.people[2].id, job: "FARM" as const, replace: s.people[2].id },
        { type: "JOB" as const, id: s.people[2].id, job: "FARM" as const, replace: s.people[4].id },
        { type: "JOB" as const, id: s.people[2].id, job: "CARE" as const, replace: s.people[0].id }
    ]) { rejects(() => applyCommand(s, c)); equal(JSON.stringify(s), before); }
    applyCommand(s, { type: "JOB", id: s.people[2].id, job: "FARM", replace: s.people[0].id }); equal(s.people[2].job, "FARM"); validateState(s);
});
test("New adults wait for skill choice; retired workers free jobs while keeping their home", () => {
    const s = createGame(3); applyCommand(s, { type: "BIRTH", family: s.families[0].id, carer: s.people[1].id });
    const child = s.people[6]; child.growth = 1; s.farm = 3; s.logging = 3; s.people[0].nights = 1;
    applyCommand(s, { type: "NIGHT" }); finishNight(s, 200, s.towers.map(t => t.operator));
    ok(child.adult); equal(child.job, "WAITING"); equal(child.skill, null); equal(s.history.length, 0); ok(isElder(s.people[0])); equal(s.people.length, 7); ok(s.people[1].job !== "CARE");
    const q = s.choices[0]; ok(q.kind === "SKILL"); applyCommand(s, { type: "CHOOSE", value: q.options[0] });
    ok(child.job === "FARM" || child.job === "LOGGING"); validateState(s);
});
test("Accepted travelers receive work after joining; declined travelers never consume a slot", () => {
    const s = createGame(5); s.day = 4; s.completed = 3;  s.legacy.bestNight = 3; s.houses = 5; s.farm = 3; s.logging = 3;
    applyCommand(s, { type: "NIGHT" }); finishNight(s, 200, s.towers.map(t => t.operator));
    const q = s.choices[0]; ok(q.kind === "TRAVELER"); q.person.skill = "skill_logging";
    const declined = clone(s), count = declined.people.length; applyCommand(declined, { type: "CHOOSE", value: "decline" }); equal(declined.people.length, count);
    applyCommand(s, { type: "CHOOSE", value: "accept" }); equal(s.people[s.people.length - 1].job, "LOGGING"); validateState(s);
});
console.log(`RESULT ${passed} job checks passed`);
