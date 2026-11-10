import { applyCommand, birthUnavailableReason, createGame } from "../src/game/VillageRules";
import { clone, GameState } from "../src/game/GameState";
import { RULE } from "../src/game/GameConfig";

let passed = 0;
function ok(value: unknown, message = "assertion failed"): asserts value { if (!value) throw new Error(message); }
function equal(a: unknown, b: unknown) { ok(JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} != ${JSON.stringify(b)}`); }
function test(name: string, check: () => void) { check(); passed++; console.log("PASS", name); }
function blocked(s: GameState, expected: string, carer = s.people[1].id, family = s.families[0].id) {
    const before = JSON.stringify(s);
    equal(birthUnavailableReason(s, family, carer), expected);
    let message: string | null = null;
    try { applyCommand(s, { type: "BIRTH", family, carer }); } catch (error) { message = (error as Error).message; }
    equal(message, expected); equal(JSON.stringify(s), before);
}

test("First birth preview is pure and its enabled command creates exactly one cared child", () => {
    const s = createGame(21), before = JSON.stringify(s), family = s.families[0].id;
    for (let i = 0; i < 20; i++) equal(birthUnavailableReason(s, family), null);
    equal(JSON.stringify(s), before);
    applyCommand(s, { type: "BIRTH", family, carer: s.people[1].id });
    equal(s.people.length, 7); equal(s.food, RULE.initialResource - RULE.birthCost);
    equal(s.people[1].careChild, s.people[6].id); equal(s.people[1].job, "CARE");
});
test("Food 19 is blocked without mutation; exact birth cost is accepted", () => {
    const s = createGame(1); s.food = RULE.birthCost - 1;
    equal(birthUnavailableReason(s, s.families[0].id), `粮食不足 · ${s.food}/${RULE.birthCost}`);
    blocked(s, `粮食不足 · ${s.food}/${RULE.birthCost}`);
    s.food = RULE.birthCost; equal(birthUnavailableReason(s, s.families[0].id), null);
    applyCommand(s, { type: "BIRTH", family: s.families[0].id, carer: s.people[1].id }); equal(s.food, 0);
});
test("Last housing place is available and full housing is visibly blocked", () => {
    const s = createGame(2);
    const extra = clone(s.people[4]); extra.id = "1:7"; s.people.push(extra); s.nextPerson = 8;
    equal(birthUnavailableReason(s, s.families[0].id), null);
    const full = clone(s); const other = clone(extra); other.id = "1:8"; full.people.push(other); full.nextPerson = 9;
    blocked(full, "民居已满 · 8/8 人");
    applyCommand(s, { type: "BIRTH", family: s.families[0].id, carer: s.people[1].id }); equal(s.people.length, 8);
});
test("Each parent independently needs three remaining working nights", () => {
    for (const index of [0, 1]) {
        const s = createGame(3); s.people[index].nights = RULE.parentMinNights - 1;
        blocked(s, `双亲需至少余 ${RULE.parentMinNights} 夜`);
        s.people[index].nights = RULE.parentMinNights; equal(birthUnavailableReason(s, s.families[0].id), null);
    }
});
test("A retired partner is blocked even while still living in the village", () => {
    const s = createGame(4); s.people[0].nights = 0; s.people[0].elderNights = RULE.elderNights;
    blocked(s, "双亲需仍在劳作期");
});
test("An existing child remains a blocker and is not mistaken for cooldown alone", () => {
    const s = createGame(5); applyCommand(s, { type: "BIRTH", family: s.families[0].id, carer: s.people[1].id });
    blocked(s, "已有孩子未成年", s.people[5].id);
});
test("Cooldown reports remaining successful nights and unlocks at four", () => {
    const s = createGame(6); s.families[0].lastBirth = 7;
    for (const elapsed of [0, 1, 3]) {
        s.completed = 7 + elapsed;
        blocked(s, `再守住 ${RULE.birthCooldown - elapsed} 夜可迎接`);
    }
    s.completed = 7 + RULE.birthCooldown; equal(birthUnavailableReason(s, s.families[0].id), null);
    s.completed = 0; s.families[0].lastBirth = null; equal(birthUnavailableReason(s, s.families[0].id), null);
});
test("No free carer disables family selection; chosen busy carer remains rejected", () => {
    const s = createGame(7); s.people.forEach(p => { p.job = "CARE"; p.careChild = "other-child"; });
    const before = JSON.stringify(s); equal(birthUnavailableReason(s, s.families[0].id), "暂无可用照料者"); equal(JSON.stringify(s), before);
    blocked(s, "照料者正照顾其他孩子");
    s.people[5].job = "FARM"; s.people[5].careChild = null;
    equal(birthUnavailableReason(s, s.families[0].id), null); blocked(s, "照料者正照顾其他孩子");
    equal(birthUnavailableReason(s, s.families[0].id, s.people[5].id), null);
});
test("Invalid and nonworking chosen carers cannot be interpreted as an unchosen carer", () => {
    const s = createGame(8);
    blocked(s, "照料者已不在村中", ""); blocked(s, "照料者已不在村中", "missing");
    s.people[5].nights = 0; s.people[5].elderNights = RULE.elderNights;
    blocked(s, "照料者需在劳作期", s.people[5].id);
    blocked(s, "家庭不存在", s.people[1].id, "missing");
});
test("Night and dawn restrictions match command rejection and preserve all state", () => {
    const s = createGame(9); applyCommand(s, { type: "NIGHT" }); blocked(s, "请在白天安排村务");
    s.phase = "DAWN"; blocked(s, "请在白天安排村务");
});
test("Final command rechecks food after a previously available preview", () => {
    const s = createGame(10); equal(birthUnavailableReason(s, s.families[0].id, s.people[1].id), null);
    s.food = 0; blocked(s, `粮食不足 · 0/${RULE.birthCost}`);
});
console.log(`${passed} birth availability checks passed`);
