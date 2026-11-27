import { applyCommand, createGame } from "../src/game/VillageRules";
import { clone } from "../src/game/GameState";
import { BattleSimulation } from "../src/game/BattleSimulation";
import { RULE } from "../src/game/GameConfig";
import { sewingDayCap } from "../src/game/Growth";
import { GameLayout } from "../src/view/GameLayout";
import { compareDepth, distance, layoutVillage, MOTION, VillageNavigation, VILLAGE_PROPS, VILLAGE_STOPS, WEDDING } from "../src/view/VillageScene";
import { VillagerMotion, walkDirection, WalkDirection } from "../src/view/VillagerMotion";
import { villagerModel } from "../src/view/VillagerAppearance";

let passed = 0;
function ok(v: unknown, reason = "assertion failed"): asserts v { if (!v) throw new Error(reason); }
function equal(a: unknown, b: unknown) { ok(JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} != ${JSON.stringify(b)}`); }
function createMotionVillage(seed: number, legacy?: Parameters<typeof createGame>[1]) {
    const state = createGame(seed, legacy);
    // Motion scenarios explicitly assign their work party and keep the remaining actors on waiting posts.
    state.people.forEach(p => p.job = "WAITING");
    return state;
}
function test(name: string, f: () => void) { f(); passed++; console.log("PASS", name); }
const navigation = new VillageNavigation();

test("Walking faces the actual travel axis, keeps hysteresis at the diagonal boundary and holds at rest", () => {
    for (const previous of ["UP", "DOWN", "LEFT", "RIGHT"] as WalkDirection[]) {
        equal(walkDirection(0, -4, previous), "UP"); equal(walkDirection(0, 4, previous), "DOWN");
        equal(walkDirection(-4, 0, previous), "LEFT"); equal(walkDirection(4, 0, previous), "RIGHT");
        equal(walkDirection(0, 0, previous), previous);
    }
    equal(walkDirection(10, -10, "RIGHT"), "RIGHT");
    equal(walkDirection(-10, -10, "UP"), "UP");
    equal(walkDirection(-10, 10, "DOWN"), "DOWN");
    equal(walkDirection(10, 10, "DOWN"), "DOWN");
    equal(walkDirection(10, -11, "RIGHT"), "RIGHT");
    equal(walkDirection(10, -13, "RIGHT"), "UP");
    equal(walkDirection(11, -10, "UP"), "UP");
    equal(walkDirection(13, -10, "UP"), "RIGHT");
});
test("Forest, posts and palisades block passage; residents can cross through the double gate", () => {
    ok(!VILLAGE_PROPS.some(p => p.id.startsWith("forest:") || p.id.startsWith("bush:")), "baked landscape must not create duplicate sprites");
    equal(VILLAGE_PROPS.filter(p => p.id.startsWith("tree:")).length, 5);
    ok(navigation.obstacles.length <= 20, "only the five working trees add trunk obstacles, not every forest decoration");
    ok(navigation.clear({ x: 360, y: 770 }, { x: 360, y: 850 }), "gate passage blocked");
    for (const x of [274, 309, 411, 446])
        ok(!navigation.clear({ x, y: 770 }, { x, y: 850 }), "new fence or post permits walking through");
    ok(!navigation.clear({ x: 220, y: 780 }, { x: 220, y: 850 }), "wall has no collision");
    ok(!navigation.walkable({ x: 90, y: 600 }), "forest has no collision");
});

test("Every real map stop is reachable without crossing any footprint", () => {
    const stops = [...VILLAGE_STOPS.homes, ...VILLAGE_STOPS.sewing, ...VILLAGE_STOPS.rest, ...VILLAGE_STOPS.children, ...VILLAGE_STOPS.towers, ...VILLAGE_STOPS.wedding];
    for (const from of stops) for (const to of stops) {
        const route = navigation.route(from, to); let at = from;
        for (const p of route) { ok(navigation.clear(at, p), "path crosses building"); at = p; }
        equal(at, to);
    }
});
test("A walk from behind a house goes around its foundation", () => {
    const house = VILLAGE_PROPS.find(p => p.id === "building:house-a")!;
    const behind = { x: house.x, y: house.footprint!.top - MOTION.clearance - 20 }, front = { x: house.x, y: house.footprint!.bottom + MOTION.clearance + 24 };
    ok(!navigation.clear(behind, front)); const route = navigation.route(behind, front); ok(route.length > 1);
    ok(compareDepth({ id: "person:1:1", y: behind.y }, house) < 0);
    ok(compareDepth({ id: "person:1:1", y: front.y }, house) > 0);
    const tied = [{ id: "person:1:2", y: 950 }, { id: "enemy:2", y: 950 }, { id: "building:a", y: 950 }];
    equal(tied.slice().reverse().sort(compareDepth), tied.slice().sort(compareDepth));
});
test("Working founders keep their routines while idle founders face forward at stationary posts", () => {
    const s = createMotionVillage(17), motion = new VillagerMotion(navigation);
    s.people.slice(0, 3).forEach(p => p.job = "SEWING");
    const before = JSON.stringify(s); motion.sync(s, s.towers);
    const initial = s.people.map(p => ({ ...motion.get(p.id) }));
    const traveled = new Set<string>(), working = new Set<string>();
    for (let step = 0; step < 2400; step++) {
        const previous = s.people.map(p => ({ ...motion.get(p.id) })); motion.update(.05);
        s.people.forEach((p, i) => {
            const m = motion.get(p.id);
            ok(navigation.walkable(m)); ok(navigation.clear(previous[i], m));
            ok(distance(previous[i], m) <= MOTION.adultSpeed * .05 + 1e-7, "movement exceeds speed");
            if (distance(initial[i], m) > 40) traveled.add(p.id);
            if (!m.walking && m.clip === "sewing") working.add(p.id);
        });
    }
    const waiting = s.people.filter(p => p.job === "WAITING");
    equal(traveled.size, s.people.length); equal(working.size, 3);
    const idle = waiting.map(p => ({ ...motion.get(p.id) }));
    idle.forEach(m => { ok(!m.walking && !m.animated && m.direction === "DOWN"); ok(VILLAGE_STOPS.waiting.some(p => distance(p, m) < .01)); });
    motion.update(.25); idle.forEach(m => equal([motion.get(m.id).x, motion.get(m.id).y], [m.x, m.y]));
    equal(JSON.stringify(s), before);
});
test("A committed sewing batch sends seated and indoor workers on a break before they return", () => {
    const s = createGame(42), motion = new VillagerMotion();
    motion.sync(s, s.towers);
    for (let i = 0; i < 120; i++) motion.update(.25);
    const seated = s.people.find(p => motion.get(p.id).clip === "sewing")!;
    const indoor = s.people.find(p => motion.get(p.id).insideFactory)!;
    ok(seated && indoor);
    s.factory.batches = 1;
    s.factory.earned = 10;
    motion.sync(s, s.towers);
    for (const p of [seated, indoor]) {
        const pose = motion.get(p.id);
        ok(pose.walking && pose.clip !== "sewing" && !pose.insideFactory);
    }
    for (let i = 0; i < 160 && motion.get(seated.id).walking; i++) motion.update(.25);
    const rest = { ...motion.get(seated.id) };
    ok(!rest.walking && rest.clip !== "sewing" && VILLAGE_STOPS.rest.some(at => distance(at, rest) < .01));
    for (let i = 0; i < MOTION.sewingBreakSeconds * 4 - 1; i++) { motion.sync(s, s.towers); motion.update(.25); }
    ok(distance(rest, motion.get(seated.id)) < .01);
    for (let i = 0; i < 120; i++) { motion.sync(s, s.towers); motion.update(.25); }
    equal(motion.get(seated.id).clip, "sewing");
    ok(motion.get(indoor.id).insideFactory);
});
test("Exhausted sewing stays closed after reloading, yields to the night route and opens on a new day", () => {
    const s = createGame(42), motion = new VillagerMotion(), person = s.people.find(p => p.id === s.towers[0].operator)!;
    s.factory.batches = 1;
    s.factory.earned = sewingDayCap(s);
    motion.sync(s, s.towers);
    for (let i = 0; i < 160; i++) motion.update(.25);
    for (const p of s.people) ok(!motion.get(p.id).walking && motion.get(p.id).clip !== "sewing" && !motion.get(p.id).insideFactory);
    applyCommand(s, { type: "NIGHT" });
    motion.sync(s, s.towers);
    for (let i = 0; i < 160; i++) motion.update(.25);
    ok(motion.get(person.id).insideTower);
    s.phase = "DAWN"; s.day++; s.factory.batches = s.factory.earned = 0;
    motion.sync(s, s.towers);
    for (let i = 0; i < 160; i++) motion.update(.25);
    equal(s.people.filter(p => motion.get(p.id).clip === "sewing").length, 3);
});
test("Moving poses match signed displacement across work, tower travel and return", () => {
    const s = createMotionVillage(17), motion = new VillagerMotion(navigation), directions = new Set<WalkDirection>(); motion.sync(s, s.towers);
    for (let i = 0; i < 4800; i++) {
        if (i === 2400) { applyCommand(s, { type: "NIGHT" }); motion.sync(s, s.towers); }
        if (i === 3600) { s.phase = "DAY"; motion.sync(s, s.towers); }
        const previous = s.people.map(p => ({ ...motion.get(p.id) })); motion.update(.05);
        s.people.forEach((p, index) => {
            const m = motion.get(p.id), old = previous[index], dx = m.x - old.x, dy = m.y - old.y;
            if (!m.walking && p.job === "WAITING" && s.phase === "DAY") { equal(m.direction, "DOWN"); return; }
            if (!m.walking) return; // 到站当帧可转向树干、耕作行或孩子。
            if (Math.hypot(dx, dy) < .001) { equal(m.direction, old.direction); return; }
            directions.add(m.direction);
            const facingX = m.direction.includes("RIGHT") ? 1 : m.direction.includes("LEFT") ? -1 : 0;
            const facingY = m.direction.includes("DOWN") ? 1 : m.direction.includes("UP") ? -1 : 0;
            ok(dx * facingX + dy * facingY > 0, "backward walking pose");
        });
    }
    equal(directions.size, 4);
});
test("Pause and unrelated UI sync preserve position, path and current animation time", () => {
    const s = createMotionVillage(1), motion = new VillagerMotion(navigation); motion.sync(s, s.towers); motion.update(.2);
    const first = JSON.stringify(motion.get(s.people[0].id));
    for (let i = 0; i < 60; i++) { motion.sync(clone(s), clone(s.towers)); motion.update(0); }
    equal(JSON.stringify(motion.get(s.people[0].id)), first);
    motion.update(.1); ok(JSON.stringify(motion.get(s.people[0].id)) !== first);
});
test("Changing jobs replans from current feet, without teleport or resetting other villagers", () => {
    const s = createMotionVillage(1), motion = new VillagerMotion(navigation); motion.sync(s, s.towers);
    for (let i = 0; i < 30; i++) motion.update(.1);
    const p = s.people[0], before = { ...motion.get(p.id) }, other = { ...motion.get(s.people[5].id) };
    p.job = "SEWING"; motion.sync(s, s.towers);
    equal([motion.get(p.id).x, motion.get(p.id).y], [before.x, before.y]); equal(motion.get(s.people[5].id).x, other.x);
    for (let i = 0; i < 500; i++) { const previous = { ...motion.get(p.id) }; motion.update(.1); ok(navigation.clear(previous, motion.get(p.id))); }
});
test("Night watch uses live reassignment while towers already attack during travel", () => {
    const s = createMotionVillage(7), motion = new VillagerMotion(navigation); motion.sync(s, s.towers);
    applyCommand(s, { type: "NIGHT" }); const battle = new BattleSimulation(s); motion.sync(s, battle.base.towers);
    let attackedWhileWalking = false;
    for (let i = 0; i < 400 && !battle.outcome; i++) {
        battle.step(); motion.update(.05);
        if (battle.shots.some(shot => { const id = battle.base.towers[shot.tower].operator; return id && motion.get(id).walking; })) attackedWhileWalking = true;
    }
    ok(attackedWhileWalking, "visual arrival must not gate attacks");
    const id = s.people[1].id, before = { ...motion.get(id) }; battle.reassign(0, id); motion.sync(s, battle.base.towers);
    equal([motion.get(id).x, motion.get(id).y], [before.x, before.y]);
    for (let i = 0; i < 600; i++) motion.update(.05);
    equal([motion.get(id).x, motion.get(id).y], [VILLAGE_STOPS.towers[0].x, VILLAGE_STOPS.towers[0].y]);
    ok(s.towers[0].operator !== id, "test must distinguish live and saved assignments");
});
test("Tower watch hides only after arrival and reappears on reassignment, replacement and dawn", () => {
    const s = createMotionVillage(7), motion = new VillagerMotion(navigation); motion.sync(s, s.towers);
    applyCommand(s, { type: "NIGHT" }); const battle = new BattleSimulation(s); motion.sync(s, battle.base.towers);
    const id = battle.base.towers[0].operator!;
    ok(motion.get(id).walking && !motion.get(id).insideTower);
    for (let i = 0; i < 1000; i++) motion.update(.05);
    ok(!motion.get(id).walking && motion.get(id).insideTower);
    for (const p of s.people) if (!battle.base.towers.some(t => t.operator === p.id)) ok(!motion.get(p.id).insideTower);
    const before = { ...motion.get(id) }; battle.reassign(1, id); motion.sync(s, battle.base.towers);
    ok(motion.get(id).walking && !motion.get(id).insideTower); equal([motion.get(id).x, motion.get(id).y], [before.x, before.y]);
    for (let i = 0; i < 1000; i++) motion.update(.05);
    const replacement = s.people.find(p => p.id !== s.patrol.captain && !battle.base.towers.some(t => t.operator === p.id))!.id;
    ok(motion.get(id).insideTower); battle.reassign(1, replacement); motion.sync(s, battle.base.towers);
    ok(!motion.get(id).insideTower);
    battle.reassign(1, id); motion.sync(s, battle.base.towers); for (let i = 0; i < 1000; i++) motion.update(.05);
    ok(motion.get(id).insideTower); s.phase = "DAWN"; motion.sync(s, s.towers);
    for (const p of s.people) ok(!motion.get(p.id).insideTower);
    s.phase = "DAY"; motion.sync(s, s.towers);
    let openedForReturn = false;
    for (let i = 0; i < 1200; i++) {
        motion.update(.05);
        if (motion.crossingGate(830)) openedForReturn = true;
    }
    ok(openedForReturn, "returning tower guards should open the gate when approaching it");
    ok(!motion.crossingGate(830), "the gate should close after the guards pass");
});
test("Babies stay home, children walk, growth retains position, retired people are removed", () => {
    const s = createMotionVillage(3); applyCommand(s, { type: "BIRTH", family: s.families[0].id });
    const child = s.people[s.people.length - 1], motion = new VillagerMotion(navigation); motion.sync(s, s.towers);
    const baby = { ...motion.get(child.id) };
    for (let i = 0; i < 50; i++) motion.update(.1);
    equal([motion.get(child.id).x, motion.get(child.id).y], [baby.x, baby.y]); ok(!motion.get(child.id).walking);
    child.growth = 1; motion.sync(s, s.towers);
    // 新儿童沿用自己的稳定活动位，先完成最多一次短驻足，再离开婴儿位置行走。
    for (let i = 0; i < 50 && !motion.get(child.id).walking; i++) motion.update(.1);
    ok(motion.get(child.id).walking);
    const feet = { ...motion.get(child.id) }; child.adult = true; child.nights = RULE.adultNights; child.job = "WAITING"; motion.sync(s, s.towers);
    equal([motion.get(child.id).x, motion.get(child.id).y], [feet.x, feet.y]);
    s.people.splice(0, 1); motion.sync(s, s.towers); equal(motion.count, s.people.length);
    const next = createMotionVillage(99); next.run = s.run + 1; next.people.forEach(p => p.id = `${next.run}:${p.id.split(":")[1]}`);
    motion.sync(next, next.towers); equal(motion.count, next.people.length);
});
test("Full population and maximum production slots stay bounded and outside buildings", () => {
    const s = createMotionVillage(1); s.people.forEach(p => p.job = "WAITING");
    for (let i = 7; i <= 20; i++) { const p = clone(s.people[i % 6]); p.id = `1:${i}`; s.people.push(p); }
    s.people.slice(0, 6).forEach(p => p.job = "SEWING");
    const motion = new VillagerMotion(navigation); motion.sync(s, s.towers);
    for (let i = 0; i < 3600; i++) { motion.update(.05); for (const p of motion.visiblePeople) ok(navigation.walkable(motion.get(p.id))); }
    equal(motion.count, 20); equal(s.people.length, 20);
    equal(motion.visiblePeople.filter(p => motion.get(p.id).insideFactory).length, 3);
});
test("New spouses walk to reachable meeting points, wait for each other, then show hearts without changing business state", () => {
    const s = createMotionVillage(17), motion = new VillagerMotion(navigation); motion.sync(s, s.towers);
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
    const s = createMotionVillage(1); applyCommand(s, { type: "FAMILY", a: s.people[4].id, b: s.people[5].id });
    const loaded = new VillagerMotion(navigation); loaded.sync(s, s.towers);
    for (let i = 0; i < 800; i++) { loaded.update(.1); ok(s.people.every(p => loaded.get(p.id).heartElapsed === null)); }
    const motion = new VillagerMotion(navigation), fresh = createMotionVillage(2); motion.sync(fresh, fresh.towers);
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
    const s = createMotionVillage(1), motion = new VillagerMotion(navigation); motion.sync(s, s.towers);
    const p = s.people[2]; applyCommand(s, { type: "FAMILY", a: p.id, b: s.people[3].id }); motion.sync(s, s.towers);
    for (let i = 0; i < 1200 && motion.get(p.id).heartElapsed === null; i++) motion.update(.05);
    ok(motion.get(p.id).heartElapsed !== null); const at = { ...motion.get(p.id) };
    p.job = "SEWING"; motion.sync(s, s.towers);
    equal([motion.get(p.id).x, motion.get(p.id).y], [at.x, at.y]); ok(motion.get(p.id).heartElapsed !== null);
    let worked = false;
    for (let i = 0; i < 1400; i++) { motion.update(.05); const m = motion.get(p.id); if (!m.walking && m.clip === "sewing") { worked = true; } }
    ok(worked);
});
test("Night cancels both meeting and queued weddings, and dawn does not replay them", () => {
    const s = createMotionVillage(1), motion = new VillagerMotion(navigation); motion.sync(s, s.towers);
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
    const s = createMotionVillage(1), motion = new VillagerMotion(navigation); motion.sync(s, s.towers);
    applyCommand(s, { type: "FAMILY", a: s.people[4].id, b: s.people[5].id }); motion.sync(s, s.towers); motion.update(.1);
    const removed = s.people[4].id; s.people = s.people.filter(p => p.id !== removed); s.families = s.families.filter(f => !f.partners.includes(removed)); motion.sync(s, s.towers);
    for (let i = 0; i < 800; i++) { motion.update(.05); ok(s.people.every(p => motion.get(p.id).heartElapsed === null)); }
    const next = createMotionVillage(2, s.legacy); motion.sync(next, next.towers);
    for (let i = 0; i < 800; i++) { motion.update(.05); ok(next.people.every(p => motion.get(p.id).heartElapsed === null)); }
    equal(motion.count, next.people.length);
});
test("Multiple new families celebrate one pair at a time with no lingering pooled hearts", () => {
    const s = createMotionVillage(1), motion = new VillagerMotion(navigation); motion.sync(s, s.towers);
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
test("Men and women work facing forward and keep the machine foot position on resize", () => {
    const menu = { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };
    const before = new GameLayout({ windowWidth: 360, windowHeight: 720, statusBarHeight: 24 }, menu);
    const after = new GameLayout({ windowWidth: 360, windowHeight: 800, statusBarHeight: 24 }, menu);
    const original = layoutVillage(before), resized = layoutVillage(after);
    ok(original.stops.sewing[0].y !== resized.stops.sewing[0].y);
    const s = createMotionVillage(3);
    const workers = s.people.slice(0, 3);
    workers.forEach(p => p.job = "SEWING");
    const motion = new VillagerMotion(new VillageNavigation(original.props, original.landscape, original.bounds), original.stops);
    motion.sync(s, s.towers);
    for (let i = 0; i < 1200; i++) motion.update(.05);
    for (const scene of [original, resized]) {
        for (const [i, worker] of workers.entries()) {
            const pose = motion.get(worker.id), stop = scene.stops.sewing[i];
            ok(pose.animated && !pose.walking && pose.elapsed > .5);
            equal([pose.clip, pose.direction, pose.x, pose.y], ["sewing", "DOWN", stop.x, stop.y]);
        }
        if (scene === original) motion.relayout(new VillageNavigation(resized.props, resized.landscape, resized.bounds), resized.stops,
            p => ({ x: p.x, y: after.worldY(before.referenceY(p.y)) }));
    }
});
test("Retirement seats elders in separate chairs that keep rocking in place from daytime to night", () => {
    const s = createMotionVillage(1), motion = new VillagerMotion(navigation); motion.sync(s, s.towers);
    for (let i = 0; i < 30; i++) motion.update(.1);
    const elders = s.people.slice(0, 2);
    elders.forEach(p => { p.nights = 0; p.elderNights = RULE.elderNights; p.job = "WAITING"; }); motion.sync(s, s.towers);
    const seats = elders.map(p => ({ ...motion.get(p.id) }));
    ok(distance(seats[0], seats[1]) > 0);
    for (const phase of ["DAY", "NIGHT"] as const) {
        s.phase = phase; motion.sync(s, s.towers);
        const state = JSON.stringify(s);
        motion.update(.4);
        elders.forEach((p, i) => {
            const m = motion.get(p.id);
            equal([m.x, m.y, m.walkDistance], [seats[i].x, seats[i].y, seats[i].walkDistance]);
            ok(navigation.walkable(m) && m.elapsed > 0 && m.animated && !m.walking && !m.insideTower);
            equal(m.clip, "hd_elder_chair");
        });
        equal(JSON.stringify(s), state);
    }
});
test("Many generations never alias home/rest slots by permanent person number", () => {
    const s = createMotionVillage(1); s.families = []; s.towers.forEach(t => t.operator = null);
    s.people = Array.from({ length: RULE.populationCap }, (_, i) => ({ ...clone(s.people[0]), id: `1:${1 + i * 20}`, job: "WAITING" as const }));
    const motion = new VillagerMotion(navigation); motion.sync(s, s.towers);
    const homes = motion.visiblePeople.map(p => { const at = motion.get(p.id); return `${at.x}:${at.y}`; });
    equal(new Set(homes).size, 20);equal(s.people.length,RULE.populationCap);
    const routines = [...(motion as any).people.values()].map((p: any) => p.routine[0].at);
    equal(new Set(routines.map((p: any) => `${p.x}:${p.y}`)).size, 20);
    const survivor = s.people[1].id, before = { ...motion.get(survivor) };
    s.people.shift(); s.people.push({ ...clone(s.people[0]), id: "1:501" }); motion.sync(s, s.towers);
    equal([motion.get(survivor).x, motion.get(survivor).y], [before.x, before.y]);
    for (let i = 0; i < 1200; i++) { motion.update(.05); for (const p of motion.visiblePeople) ok(navigation.walkable(motion.get(p.id))); }
});
test("Factory frontage leaves each staffed machine reachable in front of the building", () => {
    const factory = VILLAGE_PROPS.find(p => p.id === "building:factory")!;
    ok(factory.footprint && !navigation.walkable(factory));
    for (const p of VILLAGE_STOPS.sewing) { ok(navigation.walkable(p)); ok(p.y > factory.y); }
});
test("Mixed full village never parks unrelated home/rest/work routines on top of one another", () => {
    const s = createMotionVillage(1); s.families = [];
    s.people = Array.from({ length: RULE.populationCap }, (_, i) => ({ ...clone(s.people[i % 6]), id: `1:${i + 1}`, job: i < 6 ? "SEWING" as const : "WAITING" as const, nights: i < 10 ? 8 : 0, elderNights: i < 10 ? 0 : RULE.elderNights }));
    const motion = new VillagerMotion(navigation); motion.sync(s, s.towers);
    for (let step = 0; step < 3600; step++) {
        motion.update(.05); const parked = motion.visiblePeople.map(p => motion.get(p.id)).filter(p => !p.walking && !p.insideFactory);
        for (let i = 0; i < parked.length; i++) for (let j = 0; j < i; j++) ok(distance(parked[i], parked[j]) >= 24, `stationary overlap: ${parked[i].id}/${parked[j].id}`);
    }
});
console.log(`RESULT ${passed} motion checks passed`);
