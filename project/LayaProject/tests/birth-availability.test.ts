import { applyCommand, birthUnavailableReason, createGame } from "../src/game/VillageRules";
import { clone, GameState } from "../src/game/GameState";
import { RULE } from "../src/game/GameConfig";

let passed = 0;
function ok(value: unknown, message = "assertion failed"): asserts value { if (!value) throw new Error(message); }
function equal(a: unknown, b: unknown) { ok(JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} != ${JSON.stringify(b)}`); }
function test(name: string, check: () => void) { check(); passed++; console.log("PASS", name); }
function blocked(s: GameState, expected: string, family = s.families[0].id) {
    const before = JSON.stringify(s);
    equal(birthUnavailableReason(s, family), expected);
    let message: string | null = null;
    try { applyCommand(s, { type: "BIRTH", family }); } catch (error) { message = (error as Error).message; }
    equal(message, expected); equal(JSON.stringify(s), before);
}

test("First birth preview is pure and its enabled command creates exactly one child without changing the parents’ jobs", () => {
    const s = createGame(21), before = JSON.stringify(s), family = s.families[0].id;
    for (let i = 0; i < 20; i++) equal(birthUnavailableReason(s, family), null);
    equal(JSON.stringify(s), before);
    applyCommand(s, { type: "BIRTH", family });
    equal(s.people.length, 7); equal(s.food, RULE.initialResource - RULE.birthCost);
    equal(s.people[1].job, "FARM");
});
test("Food 19 is blocked without mutation; exact birth cost is accepted", () => {
    const s = createGame(1); s.food = RULE.birthCost - 1;
    equal(birthUnavailableReason(s, s.families[0].id), `还缺 1 粮（现有 ${s.food}/${RULE.birthCost}）`);
    blocked(s, `还缺 1 粮（现有 ${s.food}/${RULE.birthCost}）`);
    s.food = RULE.birthCost; equal(birthUnavailableReason(s, s.families[0].id), null);
    applyCommand(s, { type: "BIRTH", family: s.families[0].id }); equal(s.food, 0);
});
test("Last housing place is available and full housing is visibly blocked", () => {
    const s = createGame(2);
    const extra = clone(s.people[4]); extra.id = "1:7"; s.people.push(extra); s.nextPerson = 8;
    equal(birthUnavailableReason(s, s.families[0].id), null);
    const full = clone(s); const other = clone(extra); other.id = "1:8"; full.people.push(other); full.nextPerson = 9;
    blocked(full, "住房已满 8/8 人，请增建民居");
    applyCommand(s, { type: "BIRTH", family: s.families[0].id }); equal(s.people.length, 8);
});
test("A working parent can welcome a child on the last working night", () => {
    for (const index of [0, 1]) {
        const s = createGame(3); s.people[index].nights = 1;
        equal(birthUnavailableReason(s, s.families[0].id), null);
    }
});
test("A retired partner is blocked even while still living in the village", () => {
    const s = createGame(4); s.people[0].nights = 0; s.people[0].elderNights = RULE.elderNights;
    blocked(s, `${s.people[0].name}已退休，不能迎接孩子`);
});
test("An existing child does not block another birth after the family cooldown", () => {
    const s = createGame(5); applyCommand(s, { type: "BIRTH", family: s.families[0].id });
    blocked(s, `再守住 ${RULE.birthCooldown} 夜`);
    s.completed = RULE.birthCooldown; applyCommand(s, { type: "BIRTH", family: s.families[0].id });
    equal(s.people.filter(p => !p.adult).length, 2);
});
test("Cooldown reports remaining successful nights and unlocks at four", () => {
    const s = createGame(6); s.families[0].lastBirth = 7;
    for (const elapsed of [0, 1, 3]) {
        s.completed = 7 + elapsed;
        blocked(s, `再守住 ${RULE.birthCooldown - elapsed} 夜`);
    }
    s.completed = 7 + RULE.birthCooldown; equal(birthUnavailableReason(s, s.families[0].id), null);
    s.completed = 0; s.families[0].lastBirth = null; equal(birthUnavailableReason(s, s.families[0].id), null);
});
test("Unknown family cannot spend resources", () => {
    blocked(createGame(8), "家庭不存在", "missing");
});
test("Night and dawn restrictions match command rejection and preserve all state", () => {
    const s = createGame(9); applyCommand(s, { type: "NIGHT" }); blocked(s, "请在白天安排村务");
    s.phase = "DAWN"; blocked(s, "请在白天安排村务");
});
test("Final command rechecks food after a previously available preview", () => {
    const s = createGame(10); equal(birthUnavailableReason(s, s.families[0].id), null);
    s.food = 0; blocked(s, `还缺 ${RULE.birthCost} 粮（现有 0/${RULE.birthCost}）`);
});
console.log(`${passed} birth availability checks passed`);
