import { BattleSimulation, Shot } from "../src/game/BattleSimulation";
import { PADS, RULE, TowerKind } from "../src/game/GameConfig";
import { createGame, applyCommand } from "../src/game/VillageRules";
import { ProjectileMotion, PROJECTILE_STYLE } from "../src/view/ProjectileMotion";
import { towerLaunch } from "../src/view/VillageScene";

let passed = 0;
function ok(value: unknown, reason = "assertion failed"): asserts value { if (!value) throw new Error(reason); }
function near(a: number, b: number) { ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`); }
function equal(a: unknown, b: unknown) { ok(JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} != ${JSON.stringify(b)}`); }
function test(name: string, f: () => void) { f(); passed++; console.log("PASS", name); }
function battle() { const s = createGame(7); applyCommand(s, { type: "NIGHT" }); return new BattleSimulation(s); }
function shot(kind: TowerKind, tick = 0): Shot { return { tower: 0, x: PADS[0].x + 120, y: PADS[0].y - 15, kind, tick, empowered: false }; }

test("Arrow starts at the launcher, faces its target and becomes a short impact", () => {
    for (const [dx, dy, angle] of [[120, 0, 0], [-120, 0, 180], [0, -100, -90], [0, 100, 90]]) {
        const b = battle(), m = new ProjectileMotion(), s = shot("ARROW"), start = towerLaunch(0, "ARROW"); s.x = start.x + dx; s.y = start.y + 20 + dy;
        b.shots = [s]; b.tick = 1; m.update(b);
        const p = m.poses[0]; equal(p.frame, "fx_arrow"); near(p.x, start.x); near(p.y, start.y); near(p.rotation, angle);
        b.tick = 3; m.update(b); near(p.x, start.x + dx * .1 / PROJECTILE_STYLE.ARROW.flight);
        b.tick = 6; m.update(b); equal(p.frame, "fx_arrow"); ok(p.contact); near(p.x, s.x); near(p.y, s.y - 20); near(p.alpha, 1);
        b.tick = 7; m.update(b); equal(p.frame, "fx_hit"); ok(p.alpha > 0 && p.alpha < 1);
        b.tick = 10; m.update(b); equal(p.impactFrame, "fx_impact_arrow_5");
        b.tick = 11; m.update(b); equal(m.poses.length, 0);
    }
});
test("Stone follows a rotating arc and survives removal from the five-tick event queue", () => {
    const b = battle(), m = new ProjectileMotion(), s = shot("STONE"); b.shots = [s]; b.tick = 1; m.update(b);
    b.tick = 5; m.update(b); const p = m.poses[0];
    const start = towerLaunch(0, "STONE");
    near(p.x, (start.x + s.x) / 2); near(p.y, (start.y + s.y - 20) / 2 - Math.min(PROJECTILE_STYLE.STONE.arc, Math.hypot(s.x - start.x, s.y - 20 - start.y) * .35)); ok(p.rotation > 0);
    b.shots = []; b.tick = 7; m.update(b); equal(m.poses.length, 1); equal(p.frame, "fx_stone");
    b.tick = 9; m.update(b); equal(p.frame, "fx_stone"); ok(p.contact); near(p.x, s.x); near(p.y, s.y - 20);
    equal(p.impactFrame, "fx_tower_stone_impact_1");
    equal(p.impactAt, { x: s.x, y: s.y });
    s.x += 25; s.y += 40;
    b.tick = 14; m.update(b); equal(p.impactFrame, "fx_tower_stone_impact_8");
    equal(p.impactAt, { x: s.x - 25, y: s.y - 40 });
    b.tick = 15; m.update(b); equal(m.poses.length, 0);
});
test("Repeated view refresh never duplicates or replays a Shot", () => {
    const b = battle(), m = new ProjectileMotion(); b.tick = 1; b.shots = [shot("ARROW")];
    for (let i = 0; i < 30; i++) m.update(b); equal(m.poses.length, 1);
    b.tick = 20; m.update(b); equal(m.arrivals.length, 1); m.update(b); equal(m.arrivals.length, 0); equal(m.poses.length, 1); ok(m.poses[0].contact); b.tick += 5; m.update(b); equal(m.poses.length, 0);
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
    const start = towerLaunch(0, "STONE");
    near(m.poses[0].x, start.x + (s.x - start.x) * .1 / PROJECTILE_STYLE.STONE.flight);
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
    b.shots = []; b.tick = 20; m.update(b); equal(m.arrivals.length, RULE.effectCap); m.update(b); equal(m.poses.length, RULE.effectCap); b.tick += 11; m.update(b); equal(m.poses.length, 0);
});
test("Frost projectile starts the dedicated hit clip on contact and follows the moving target", () => {
    const b = battle(), m = new ProjectileMotion(), s = shot("SLOW"); b.shots = [s]; b.tick = 1; m.update(b);
    equal(m.poses[0].frame, "fx_ice"); equal(m.poses[0].impactFrame, undefined);
    b.tick = 8; m.update(b); equal(m.poses[0].frame, "fx_ice"); ok(m.poses[0].contact);
    equal(m.poses[0].impactFrame, "fx_tower_frost_impact_1");
    s.y += 30;
    b.tick = 13; m.update(b); equal(m.poses[0].impactFrame, "fx_tower_frost_impact_8");
    near(m.poses[0].y, s.y - 20); equal(m.poses[0].impactAt, undefined);
    b.tick = 14; m.update(b); equal(m.poses.length, 0);
});
test("Playing effects does not change damage, targeting, outcome or business state", () => {
    const a = battle(), b = battle(), m = new ProjectileMotion(); let observed = 0;
    while (!a.outcome && a.tick < 6000) {
        a.step(); b.step(); const before = JSON.stringify(a); m.update(a); m.update(a);
        equal(JSON.stringify(a), before); if (m.poses.length) observed++;
    }
    ok(observed > 0); equal([a.outcome, a.tick, a.gate, a.base], [b.outcome, b.tick, b.gate, b.base]); equal(m.poses.length, 0);
});
test("All three tower types launch from their visible source anchor at all five pads", () => {
    for (let tower = 0; tower < PADS.length; tower++) for (const kind of ["ARROW", "STONE", "SLOW"] as TowerKind[]) {
        const b = battle(), m = new ProjectileMotion(), s = { ...shot(kind), tower };
        b.tick = 1; b.shots = [s]; m.update(b); const start = towerLaunch(tower, kind);
        near(m.poses[0].x, start.x); near(m.poses[0].y, start.y);
        const rightBank = [1, 3, 4].includes(tower);
        if (kind === "ARROW") ok(rightBank ? start.x < PADS[tower].x : start.x > PADS[tower].x);
        if (kind === "STONE") ok(rightBank ? start.x > PADS[tower].x : start.x < PADS[tower].x);
        if (kind === "SLOW") near(start.x, PADS[tower].x);
    }
});
console.log(`${passed} projectile motion checks passed`);
