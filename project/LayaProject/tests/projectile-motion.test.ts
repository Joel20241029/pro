import { BattleSimulation, Shot } from "../src/game/BattleSimulation";
import { PADS, RULE, TowerKind } from "../src/game/GameConfig";
import { createGame, applyCommand } from "../src/game/VillageRules";
import { ProjectileMotion, PROJECTILE_STYLE } from "../src/view/ProjectileMotion";

let passed = 0;
function ok(value: unknown, reason = "assertion failed"): asserts value { if (!value) throw new Error(reason); }
function near(a: number, b: number) { ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`); }
function equal(a: unknown, b: unknown) { ok(JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} != ${JSON.stringify(b)}`); }
function test(name: string, f: () => void) { f(); passed++; console.log("PASS", name); }
function battle() { const s = createGame(7); applyCommand(s, { type: "NIGHT" }); return new BattleSimulation(s); }
function shot(kind: TowerKind, tick = 0): Shot { return { tower: 0, x: PADS[0].x + 120, y: PADS[0].y - 15, kind, tick }; }

test("Arrow starts at the launcher, faces its target and becomes a short impact", () => {
    for (const [dx, dy, angle] of [[120, 0, 0], [-120, 0, 180], [0, -100, -90], [0, 100, 90]]) {
        const b = battle(), m = new ProjectileMotion(), s = shot("ARROW"); s.x = PADS[0].x + dx; s.y = PADS[0].y - 15 + dy;
        b.shots = [s]; b.tick = 1; m.update(b);
        const p = m.poses[0]; equal(p.frame, "fx_arrow"); near(p.x, PADS[0].x); near(p.y, PADS[0].y - 35); near(p.rotation, angle);
        b.tick = 3; m.update(b); near(p.x, PADS[0].x + dx * .1 / PROJECTILE_STYLE.ARROW.flight);
        b.tick = 6; m.update(b); equal(p.frame, "fx_hit"); near(p.x, s.x); near(p.y, s.y - 20); ok(p.alpha > 0 && p.alpha < 1);
        b.tick = 9; m.update(b); equal(m.poses.length, 0);
    }
});
test("Stone follows a rotating arc and survives removal from the five-tick event queue", () => {
    const b = battle(), m = new ProjectileMotion(), s = shot("STONE"); b.shots = [s]; b.tick = 1; m.update(b);
    b.tick = 5; m.update(b); const p = m.poses[0];
    near(p.x, (PADS[0].x + s.x) / 2); near(p.y, PADS[0].y - 35 - PROJECTILE_STYLE.STONE.arc); ok(p.rotation > 0);
    b.shots = []; b.tick = 7; m.update(b); equal(m.poses.length, 1); equal(p.frame, "fx_stone");
    b.tick = 9; m.update(b); equal(p.frame, "fx_hit"); near(p.x, s.x); near(p.y, s.y - 20);
    b.tick = 14; m.update(b); equal(m.poses.length, 0);
});
test("Repeated view refresh never duplicates or replays a Shot", () => {
    const b = battle(), m = new ProjectileMotion(); b.tick = 1; b.shots = [shot("ARROW")];
    for (let i = 0; i < 30; i++) m.update(b); equal(m.poses.length, 1);
    b.tick = 20; m.update(b); equal(m.poses.length, 0); m.update(b); equal(m.poses.length, 0);
});
test("Paused ticks freeze every property, batched ticks match individually advanced ticks", () => {
    const b = battle(), m = new ProjectileMotion(); b.tick = 1; b.shots = [shot("STONE")]; m.update(b);
    const before = JSON.stringify(m.poses); for (let i = 0; i < 60; i++) m.update(b); equal(JSON.stringify(m.poses), before);
    const c = battle(), n = new ProjectileMotion(); c.tick = 1; c.shots = [shot("STONE")]; n.update(c);
    b.tick = 5; m.update(b); for (let tick = 2; tick <= 5; tick++) { c.tick = tick; n.update(c); }
    equal(m.poses, n.poses);
});
test("First observation uses event age exactly once", () => {
    const b = battle(), m = new ProjectileMotion(), s = shot("STONE", 8); b.shots = [s]; b.tick = 11; m.update(b);
    near(m.poses[0].x, PADS[0].x + 120 * .1 / PROJECTILE_STYLE.STONE.flight);
    const before = JSON.stringify(m.poses); m.update(b); equal(JSON.stringify(m.poses), before);
});
test("Battle end, exit and a new night clear old effects", () => {
    const b = battle(), m = new ProjectileMotion(); b.shots = [shot("STONE")]; b.tick = 1; m.update(b); equal(m.poses.length, 1);
    const next = battle(); m.update(next); equal(m.poses.length, 0);
    next.shots = [shot("ARROW")]; next.tick = 1; m.update(next); equal(m.poses.length, 1);
    next.outcome = "WIN"; m.update(next); equal(m.poses.length, 0);
    m.update(null); equal(m.poses.length, 0); m.update(b); equal(m.poses.length, 1);
});
test("Effect pool is bounded and fully expires", () => {
    const b = battle(), m = new ProjectileMotion(); b.tick = 1;
    b.shots = Array.from({ length: RULE.effectCap + 10 }, (_, i) => ({ ...shot("STONE"), x: 200 + i }));
    m.update(b); equal(m.poses.length, RULE.effectCap); equal(m.poses[0].shot, b.shots[10]);
    b.shots = []; b.tick = 20; m.update(b); equal(m.poses.length, 0);
});
test("Frost projectile becomes the existing frost ring and fades", () => {
    const b = battle(), m = new ProjectileMotion(); b.shots = [shot("SLOW")]; b.tick = 1; m.update(b); equal(m.poses[0].frame, "fx_ice");
    b.tick = 8; m.update(b); equal(m.poses[0].frame, "fx_slow_ring"); ok(m.poses[0].alpha > 0 && m.poses[0].alpha < 1);
    b.tick = 12; m.update(b); equal(m.poses.length, 0);
});
test("Playing effects does not change damage, targeting, outcome or business state", () => {
    const a = battle(), b = battle(), m = new ProjectileMotion(); let observed = 0;
    while (!a.outcome && a.tick < 6000) {
        a.step(); b.step(); const before = JSON.stringify(a); m.update(a); m.update(a);
        equal(JSON.stringify(a), before); if (m.poses.length) observed++;
    }
    ok(observed > 0); equal([a.outcome, a.tick, a.gate, a.base], [b.outcome, b.tick, b.gate, b.base]); equal(m.poses.length, 0);
});
console.log(`${passed} projectile motion checks passed`);
