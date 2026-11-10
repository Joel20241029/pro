import { applyCommand, createGame } from "../src/game/VillageRules";
import { clone } from "../src/game/GameState";
import { BattleSimulation } from "../src/game/BattleSimulation";
import { compareDepth, distance, MOTION, VillageNavigation, VILLAGE_PROPS, VILLAGE_STOPS } from "../src/view/VillageScene";
import { VillagerMotion } from "../src/view/VillagerMotion";

let passed = 0;
function ok(v: unknown, reason = "assertion failed"): asserts v { if (!v) throw new Error(reason); }
function equal(a: unknown, b: unknown) { ok(JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} != ${JSON.stringify(b)}`); }
function test(name: string, f: () => void) { f(); passed++; console.log("PASS", name); }
const navigation = new VillageNavigation();

test("Every real map stop is reachable without crossing any footprint", () => {
    const stops = [...VILLAGE_STOPS.homes, ...VILLAGE_STOPS.farm, ...VILLAGE_STOPS.logging, ...VILLAGE_STOPS.rest, ...VILLAGE_STOPS.children, ...VILLAGE_STOPS.towers,
        ...VILLAGE_STOPS.homes.map(p => ({ x: p.x + 14, y: p.y + 8 }))];
    for (const from of stops) for (const to of stops) {
        const route = navigation.route(from, to); let at = from;
        for (const p of route) { ok(navigation.clear(at, p), "path crosses building"); at = p; }
        equal(at, to);
    }
});
test("A walk from behind a house goes around its foundation", () => {
    const behind = VILLAGE_STOPS.rest[0], front = { x: 108, y: 970 };
    ok(!navigation.clear(behind, front)); const route = navigation.route(behind, front); ok(route.length > 1);
    const house = VILLAGE_PROPS.find(p => p.id === "building:house-a")!;
    ok(compareDepth({ id: "person:1:1", y: behind.y }, house) < 0);
    ok(compareDepth({ id: "person:1:1", y: front.y }, house) > 0);
    const tied = [{ id: "person:1:2", y: 950 }, { id: "enemy:2", y: 950 }, { id: "building:a", y: 950 }];
    equal(tied.slice().reverse().sort(compareDepth), tied.slice().sort(compareDepth));
});
test("All founders actually walk, work and rest while business data stays unchanged", () => {
    const s = createGame(17), before = JSON.stringify(s), motion = new VillagerMotion(navigation); motion.sync(s, s.towers);
    const initial = s.people.map(p => ({ ...motion.get(p.id) }));
    const traveled = new Set<string>(), working = new Set<string>(), rested = new Set<string>();
    for (let step = 0; step < 2400; step++) {
        const previous = s.people.map(p => ({ ...motion.get(p.id) })); motion.update(.05);
        s.people.forEach((p, i) => {
            const m = motion.get(p.id);
            ok(navigation.walkable(m)); ok(navigation.clear(previous[i], m));
            ok(distance(previous[i], m) <= MOTION.adultSpeed * .05 + 1e-7, "movement exceeds speed");
            if (distance(initial[i], m) > 40) traveled.add(p.id);
            if (!m.walking && (m.clip.endsWith("_farm") || m.clip.endsWith("_harvest") || m.clip.endsWith("_chop"))) working.add(p.id);
            if (!m.walking && VILLAGE_STOPS.rest.some(p => distance(p, m) < .01)) rested.add(p.id);
        });
    }
    equal(traveled.size, s.people.length); ok(working.size >= 3); equal(rested.size, s.people.length); equal(JSON.stringify(s), before);
});
test("Pause and unrelated UI sync preserve position, path and current animation time", () => {
    const s = createGame(1), motion = new VillagerMotion(navigation); motion.sync(s, s.towers); motion.update(.2);
    const first = JSON.stringify(motion.get(s.people[0].id));
    for (let i = 0; i < 60; i++) { motion.sync(clone(s), clone(s.towers)); motion.update(0); }
    equal(JSON.stringify(motion.get(s.people[0].id)), first);
    motion.update(.1); ok(JSON.stringify(motion.get(s.people[0].id)) !== first);
});
test("Changing jobs replans from current feet, without teleport or resetting other villagers", () => {
    const s = createGame(1), motion = new VillagerMotion(navigation); motion.sync(s, s.towers);
    for (let i = 0; i < 30; i++) motion.update(.1);
    const p = s.people[0], before = { ...motion.get(p.id) }, other = { ...motion.get(s.people[5].id) };
    applyCommand(s, { type: "JOB", id: p.id, job: "WAITING" }); motion.sync(s, s.towers);
    equal([motion.get(p.id).x, motion.get(p.id).y], [before.x, before.y]); equal(motion.get(s.people[5].id).x, other.x);
    for (let i = 0; i < 500; i++) { const previous = { ...motion.get(p.id) }; motion.update(.1); ok(navigation.clear(previous, motion.get(p.id))); }
});
test("Night watch uses live reassignment while towers already attack during travel", () => {
    const s = createGame(7), motion = new VillagerMotion(navigation); motion.sync(s, s.towers);
    applyCommand(s, { type: "NIGHT" }); const battle = new BattleSimulation(s); motion.sync(s, battle.base.towers);
    let attackedWhileWalking = false;
    for (let i = 0; i < 400 && !battle.outcome; i++) {
        battle.step(); motion.update(.05);
        if (battle.shots.some(shot => { const id = battle.base.towers[shot.tower].operator; return id && motion.get(id).walking; })) attackedWhileWalking = true;
    }
    ok(attackedWhileWalking, "visual arrival must not gate attacks");
    const id = s.people[0].id, before = { ...motion.get(id) }; battle.reassign(0, id); motion.sync(s, battle.base.towers);
    equal([motion.get(id).x, motion.get(id).y], [before.x, before.y]);
    for (let i = 0; i < 600; i++) motion.update(.05);
    equal([motion.get(id).x, motion.get(id).y], [VILLAGE_STOPS.towers[0].x, VILLAGE_STOPS.towers[0].y]);
    ok(s.towers[0].operator !== id, "test must distinguish live and saved assignments");
});
test("Babies stay home, children walk, growth retains position, retired people are removed", () => {
    const s = createGame(3); applyCommand(s, { type: "BIRTH", family: s.families[0].id, carer: s.people[1].id });
    const child = s.people[s.people.length - 1], motion = new VillagerMotion(navigation); motion.sync(s, s.towers);
    const baby = { ...motion.get(child.id) };
    for (let i = 0; i < 50; i++) motion.update(.1);
    equal([motion.get(child.id).x, motion.get(child.id).y], [baby.x, baby.y]); ok(!motion.get(child.id).walking);
    child.growth = 1; motion.sync(s, s.towers); motion.update(.1); ok(motion.get(child.id).walking);
    const feet = { ...motion.get(child.id) }; child.adult = true; child.job = "WAITING"; motion.sync(s, s.towers);
    equal([motion.get(child.id).x, motion.get(child.id).y], [feet.x, feet.y]);
    s.people.splice(0, 1); motion.sync(s, s.towers); equal(motion.count, s.people.length);
    const next = createGame(99); next.run = s.run + 1; next.people.forEach(p => p.id = `${next.run}:${p.id.split(":")[1]}`);
    motion.sync(next, next.towers); equal(motion.count, next.people.length);
});
test("Full population and maximum production slots stay bounded and outside buildings", () => {
    const s = createGame(1); s.people.forEach(p => p.job = "WAITING");
    for (let i = 7; i <= 20; i++) { const p = clone(s.people[i % 6]); p.id = `1:${i}`; s.people.push(p); }
    s.people.slice(0, 6).forEach(p => p.job = "FARM"); s.people.slice(6, 10).forEach(p => p.job = "LOGGING");
    const motion = new VillagerMotion(navigation); motion.sync(s, s.towers);
    for (let i = 0; i < 3600; i++) { motion.update(.05); for (const p of s.people) ok(navigation.walkable(motion.get(p.id))); }
    equal(motion.count, 20);
});
console.log(`RESULT ${passed} motion checks passed`);
