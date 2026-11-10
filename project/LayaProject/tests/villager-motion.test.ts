import { applyCommand, createGame } from "../src/game/VillageRules";
import { clone } from "../src/game/GameState";
import { BattleSimulation } from "../src/game/BattleSimulation";
import { LABOR_CLIPS, RULE } from "../src/game/GameConfig";
import { compareDepth, distance, MOTION, VillageNavigation, VILLAGE_PROPS, VILLAGE_STOPS, WEDDING } from "../src/view/VillageScene";
import { VillagerMotion, walkDirection, WalkDirection } from "../src/view/VillagerMotion";

let passed = 0;
function ok(v: unknown, reason = "assertion failed"): asserts v { if (!v) throw new Error(reason); }
function equal(a: unknown, b: unknown) { ok(JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} != ${JSON.stringify(b)}`); }
function test(name: string, f: () => void) { f(); passed++; console.log("PASS", name); }
const navigation = new VillageNavigation();

test("Walking faces the actual travel axis, keeps diagonal hysteresis and holds at rest", () => {
    for (const previous of ["UP", "DOWN", "LEFT", "RIGHT"] as WalkDirection[]) {
        equal(walkDirection(0, -4, previous), "UP"); equal(walkDirection(0, 4, previous), "DOWN");
        equal(walkDirection(-4, 0, previous), "LEFT"); equal(walkDirection(4, 0, previous), "RIGHT");
        equal(walkDirection(0, 0, previous), previous);
    }
    equal(walkDirection(10, -10.5, "RIGHT"), "RIGHT"); equal(walkDirection(10, -12, "RIGHT"), "UP");
    equal(walkDirection(10.5, -10, "UP"), "UP"); equal(walkDirection(12, -10, "UP"), "RIGHT");
});
test("Forest and palisades have shared collision blocks and preserve both gate passages", () => {
    ok(VILLAGE_PROPS.filter(p => p.id.startsWith("forest:")).length >= 40);
    ok(navigation.obstacles.length <= 16, "decorative trees must not each expand the route graph");
    ok(navigation.clear({ x: 274, y: 770 }, { x: 274, y: 850 }), "left gate passage blocked");
    ok(navigation.clear({ x: 446, y: 770 }, { x: 446, y: 850 }), "right gate passage blocked");
    ok(!navigation.clear({ x: 220, y: 780 }, { x: 220, y: 850 }), "wall has no collision");
    ok(!navigation.walkable({ x: 90, y: 600 }), "forest has no collision");
});

test("Every real map stop is reachable without crossing any footprint", () => {
    const stops = [...VILLAGE_STOPS.homes, ...VILLAGE_STOPS.farm, ...VILLAGE_STOPS.logging, ...VILLAGE_STOPS.rest, ...VILLAGE_STOPS.children, ...VILLAGE_STOPS.towers, ...VILLAGE_STOPS.wedding,
        ...VILLAGE_STOPS.homes.map(p => ({ x: p.x + 34, y: p.y + 8 }))];
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
test("Moving poses match signed displacement across a complete work and rest cycle", () => {
    const s = createGame(17), motion = new VillagerMotion(navigation), directions = new Set<WalkDirection>(); motion.sync(s, s.towers);
    for (let i = 0; i < 2400; i++) {
        const previous = s.people.map(p => ({ ...motion.get(p.id) })); motion.update(.05);
        s.people.forEach((p, index) => {
            const m = motion.get(p.id), old = previous[index], dx = m.x - old.x, dy = m.y - old.y;
            if (Math.hypot(dx, dy) < .001) { equal(m.direction, old.direction); return; }
            directions.add(m.direction);
            ok(m.direction === "UP" ? dy < 0 : m.direction === "DOWN" ? dy > 0 : m.direction === "LEFT" ? dx < 0 : dx > 0, "backward walking pose");
        });
    }
    equal(directions.size, 4);
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
    applyCommand(s, { type: "JOB", id: p.id, job: "LOGGING", replace: s.people[2].id }); motion.sync(s, s.towers);
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
test("Tower watch hides only after arrival and reappears on reassignment, release and dawn", () => {
    const s = createGame(7), motion = new VillagerMotion(navigation); motion.sync(s, s.towers);
    applyCommand(s, { type: "NIGHT" }); const battle = new BattleSimulation(s); motion.sync(s, battle.base.towers);
    const id = battle.base.towers[0].operator!;
    ok(motion.get(id).walking && !motion.get(id).insideTower);
    for (let i = 0; i < 1000; i++) motion.update(.05);
    ok(!motion.get(id).walking && motion.get(id).insideTower);
    for (const p of s.people) if (!battle.base.towers.some(t => t.operator === p.id)) ok(!motion.get(p.id).insideTower);
    const before = { ...motion.get(id) }; battle.reassign(1, id); motion.sync(s, battle.base.towers);
    ok(motion.get(id).walking && !motion.get(id).insideTower); equal([motion.get(id).x, motion.get(id).y], [before.x, before.y]);
    for (let i = 0; i < 1000; i++) motion.update(.05);
    ok(motion.get(id).insideTower); battle.reassign(1, null); motion.sync(s, battle.base.towers);
    ok(!motion.get(id).insideTower);
    battle.reassign(1, id); motion.sync(s, battle.base.towers); for (let i = 0; i < 1000; i++) motion.update(.05);
    ok(motion.get(id).insideTower); s.phase = "DAWN"; motion.sync(s, s.towers);
    for (const p of s.people) ok(!motion.get(p.id).insideTower);
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
test("New spouses walk to reachable meeting points, wait for each other, then show hearts without changing business state", () => {
    const s = createGame(17), motion = new VillagerMotion(navigation); motion.sync(s, s.towers);
    const pair = [s.people[4], s.people[5]]; applyCommand(s, { type: "FAMILY", a: pair[0].id, b: pair[1].id });
    const before = JSON.stringify(s); motion.sync(s, s.towers); let oneWaiting = false, together = false;
    for (let step = 0; step < 1200; step++) {
        const previous = pair.map(p => ({ ...motion.get(p.id) })); motion.update(.05);
        const poses = pair.map(p => motion.get(p.id));
        poses.forEach((m, i) => { ok(navigation.clear(previous[i], m)); ok(distance(previous[i], m) <= MOTION.adultSpeed * .05 + 1e-7); });
        if (poses[0].walking !== poses[1].walking) { oneWaiting = true; ok(poses.every(m => m.heartElapsed === null)); }
        if (poses.every(m => m.heartElapsed !== null)) { together = true; break; }
    }
    ok(oneWaiting && together); pair.forEach((p, i) => equal([motion.get(p.id).x, motion.get(p.id).y], [VILLAGE_STOPS.wedding[i].x, VILLAGE_STOPS.wedding[i].y]));
    equal(pair.map(p => motion.get(p.id).direction), ["RIGHT", "LEFT"]);
    motion.update(.1); const paused = JSON.stringify(pair.map(p => motion.get(p.id)));
    for (let i = 0; i < 20; i++) { motion.sync(clone(s), clone(s.towers)); motion.update(0); }
    equal(JSON.stringify(pair.map(p => motion.get(p.id))), paused);
    for (let i = 0; i < Math.ceil(WEDDING.heartSeconds / .05) + 1; i++) motion.update(.05);
    ok(pair.every(p => motion.get(p.id).heartElapsed === null)); equal(JSON.stringify(s), before);
});
test("Loading existing families never replays a wedding and repeated sync never queues it twice", () => {
    const s = createGame(1); applyCommand(s, { type: "FAMILY", a: s.people[4].id, b: s.people[5].id });
    const loaded = new VillagerMotion(navigation); loaded.sync(s, s.towers);
    for (let i = 0; i < 800; i++) { loaded.update(.1); ok(s.people.every(p => loaded.get(p.id).heartElapsed === null)); }
    const motion = new VillagerMotion(navigation), fresh = createGame(2); motion.sync(fresh, fresh.towers);
    applyCommand(fresh, { type: "FAMILY", a: fresh.people[4].id, b: fresh.people[5].id });
    let starts = 0, active = false;
    for (let i = 0; i < 1200; i++) {
        motion.sync(clone(fresh), clone(fresh.towers)); motion.update(.05);
        const heart = motion.get(fresh.people[4].id).heartElapsed !== null;
        if (heart && !active) starts++; active = heart;
    }
    equal(starts, 1);
});
test("Changing a spouse's job during the ceremony restores the latest daily routine", () => {
    const s = createGame(1), motion = new VillagerMotion(navigation); motion.sync(s, s.towers);
    const p = s.people[2]; applyCommand(s, { type: "FAMILY", a: p.id, b: s.people[3].id }); motion.sync(s, s.towers);
    for (let i = 0; i < 1200 && motion.get(p.id).heartElapsed === null; i++) motion.update(.05);
    ok(motion.get(p.id).heartElapsed !== null); const at = { ...motion.get(p.id) };
    applyCommand(s, { type: "JOB", id: p.id, job: "FARM", replace: s.people[0].id }); motion.sync(s, s.towers);
    equal([motion.get(p.id).x, motion.get(p.id).y], [at.x, at.y]); ok(motion.get(p.id).heartElapsed !== null);
    let farmed = false;
    for (let i = 0; i < 1400; i++) { motion.update(.05); const m = motion.get(p.id); ok(m.clip !== "villager_male_a_chop"); if (!m.walking && m.clip === "villager_male_a_farm") farmed = true; }
    ok(farmed);
});
test("Night cancels both meeting and queued weddings, and dawn does not replay them", () => {
    const s = createGame(1), motion = new VillagerMotion(navigation); motion.sync(s, s.towers);
    applyCommand(s, { type: "FAMILY", a: s.people[4].id, b: s.people[5].id }); applyCommand(s, { type: "FAMILY", a: s.people[2].id, b: s.people[3].id }); motion.sync(s, s.towers);
    for (let i = 0; i < 1200 && motion.get(s.people[4].id).heartElapsed === null; i++) motion.update(.05);
    ok(motion.get(s.people[4].id).heartElapsed !== null);
    applyCommand(s, { type: "NIGHT" }); motion.sync(s, s.towers);
    ok(s.people.every(p => motion.get(p.id).heartElapsed === null));
    for (let i = 0; i < 1200; i++) motion.update(.05);
    ok(motion.get(s.towers[0].operator!).insideTower);
    s.phase = "DAY"; motion.sync(s, s.towers);
    for (let i = 0; i < 800; i++) { motion.update(.05); ok(s.people.every(p => motion.get(p.id).heartElapsed === null)); }
});
test("Spouse removal and a new run clear all wedding state", () => {
    const s = createGame(1), motion = new VillagerMotion(navigation); motion.sync(s, s.towers);
    applyCommand(s, { type: "FAMILY", a: s.people[4].id, b: s.people[5].id }); motion.sync(s, s.towers); motion.update(.1);
    const removed = s.people[4].id; s.people = s.people.filter(p => p.id !== removed); s.families = s.families.filter(f => !f.partners.includes(removed)); motion.sync(s, s.towers);
    for (let i = 0; i < 800; i++) { motion.update(.05); ok(s.people.every(p => motion.get(p.id).heartElapsed === null)); }
    const next = createGame(2, s.legacy); motion.sync(next, next.towers);
    for (let i = 0; i < 800; i++) { motion.update(.05); ok(next.people.every(p => motion.get(p.id).heartElapsed === null)); }
    equal(motion.count, next.people.length);
});
test("Multiple new families celebrate one pair at a time with no lingering pooled hearts", () => {
    const s = createGame(1), motion = new VillagerMotion(navigation); motion.sync(s, s.towers);
    applyCommand(s, { type: "FAMILY", a: s.people[4].id, b: s.people[5].id }); applyCommand(s, { type: "FAMILY", a: s.people[2].id, b: s.people[3].id }); motion.sync(s, s.towers);
    const seen = new Set<string>();
    for (let i = 0; i < 2400; i++) {
        motion.sync(clone(s), clone(s.towers)); motion.update(.05);
        const showing = s.people.filter(p => motion.get(p.id).heartElapsed !== null);
        ok(showing.length === 0 || showing.length === 2); showing.forEach(p => seen.add(p.id));
    }
    equal([...seen].sort(), [s.people[2].id, s.people[3].id, s.people[4].id, s.people[5].id].sort());
    ok(s.people.every(p => motion.get(p.id).heartElapsed === null));
});
test("Both adult identities play farming, chopping and caring actions after arriving at their work stop", () => {
    for (const index of [0, 1]) for (const job of ["FARM", "LOGGING", "CARE"] as const) {
        const s = createGame(3), p = s.people[index];
        if (job === "CARE") applyCommand(s, { type: "BIRTH", family: s.families[0].id, carer: p.id });
        else if (job === "LOGGING") applyCommand(s, { type: "JOB", id: p.id, job, replace: s.people[2].id });
        const motion = new VillagerMotion(navigation); motion.sync(s, s.towers); let played = false;
        for (let i = 0; i < 1600; i++) { motion.update(.05); const m = motion.get(p.id); if (!m.walking && m.animated && m.elapsed > .5 && m.clip === LABOR_CLIPS[p.appearance][job]) played = true; }
        ok(played, `${p.appearance}/${job} never played`);
    }
});
test("Retiring in place switches to elder walks and idle without teleporting or mutating game state", () => {
    const s = createGame(1), motion = new VillagerMotion(navigation); motion.sync(s, s.towers);
    for (let i = 0; i < 30; i++) motion.update(.1);
    const elders = s.people.slice(0, 2), before = elders.map(p => ({ ...motion.get(p.id) }));
    elders.forEach(p => { p.nights = 0; p.elderNights = RULE.elderNights; p.job = "WAITING"; }); motion.sync(s, s.towers);
    elders.forEach((p, i) => equal([motion.get(p.id).x, motion.get(p.id).y], [before[i].x, before[i].y]));
    const state = JSON.stringify(s), walked = new Set<string>(), rested = new Set<string>();
    for (let i = 0; i < 2400; i++) {
        const last = elders.map(p => ({ ...motion.get(p.id) })); motion.update(.05);
        elders.forEach((p, index) => {
            const m = motion.get(p.id), identity = p.sex === "MALE" ? "male" : "female";
            ok(navigation.clear(last[index], m)); ok(distance(last[index], m) <= MOTION.elderSpeed * .05 + 1e-7);
            ok(m.animated); equal(m.clip, `villager_elder_${identity}_${m.walking ? "walk" : "idle"}`);
            (m.walking ? walked : rested).add(p.id); ok(!m.insideTower);
        });
    }
    equal(walked.size, 2); equal(rested.size, 2); equal(JSON.stringify(s), state);
    s.phase = "NIGHT"; motion.sync(s, s.towers); for (let i = 0; i < 1000; i++) motion.update(.05);
    elders.forEach(p => { const m = motion.get(p.id); ok(!m.walking && !m.insideTower && m.clip.endsWith("_idle")); });
});
console.log(`RESULT ${passed} motion checks passed`);
