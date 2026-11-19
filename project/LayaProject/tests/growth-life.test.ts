import { createGame, applyCommand, economy, finishNight } from "../src/game/VillageRules";
import { clone } from "../src/game/GameState";
import { RULE } from "../src/game/GameConfig";
import { enemyPower, gateCapacity, laborSlots, storageCapacity, upgradeCost } from "../src/game/Growth";
import { maleBirthProbability, nextSex, travelerDue } from "../src/game/Population";
import { SeededRandom } from "../src/game/SeededRandom";
import { validateState } from "../src/storage/StateValidation";
import { generateWave } from "../src/game/WaveGenerator";
import { BattleSimulation } from "../src/game/BattleSimulation";
import { GameSession } from "../src/game/GameSession";
import { SaveStore } from "../src/storage/SaveStore";
import { CAMP_STOPS, distance, VillageNavigation } from "../src/view/VillageScene";
import { VillagerMotion } from "../src/view/VillagerMotion";
import { VillagerThoughts } from "../src/view/VillagerThoughts";
import { SPEECH, VILLAGER_LINES } from "../src/view/config/VillagerSpeechConfig";
let passed = 0;
function ok(value: unknown, message = "assertion failed"): asserts value { if (!value) throw new Error(message); }
function equal(a: unknown, b: unknown) { ok(JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} != ${JSON.stringify(b)}`); }
function test(name: string, run: () => void) { run(); passed++; console.log("PASS", name); }

test("Higher buildings improve yield and add work slots; upgrades charge both resources", () => {
    const s = createGame(1); s.housing = 4; s.food = s.wood = storageCapacity(s); s.farm = 3; s.logging = 3;
    const before = economy(s), cost = upgradeCost("FARM", s.farm), food = s.food, wood = s.wood;
    applyCommand(s, { type: "BUILD", kind: "FARM" }); equal(s.farm, 4); equal([s.food, s.wood], [food - cost.food, wood - cost.wood]); ok(economy(s).food > before.food);
    equal([laborSlots("FARM", 3), laborSlots("LOGGING", 3)], [6, 4]);
    equal([laborSlots("FARM", 5), laborSlots("LOGGING", 5)], [7, 5]);
    equal([laborSlots("FARM", 1000), laborSlots("LOGGING", 1000)], [504, 502]); validateState(s);
    const snapshot = JSON.stringify(s); s.food = 0; const denied = JSON.stringify(s);
    try { applyCommand(s, { type: "BUILD", kind: "FARM" }); throw new Error("must reject"); } catch (e) { ok(String(e).includes(`还缺 ${upgradeCost("FARM", s.farm).food - s.food} 粮食`)); }
    equal(JSON.stringify(s), denied); ok(snapshot !== denied);
});
test("Housing self-upgrade always fits its current warehouse; gate upgrades preserve existing damage", () => {
    const s = createGame(1);
    for (const level of [1, 2, 50, 10000, 1000000]) { s.housing = level; const c = upgradeCost("HOUSING", level); ok(c.wood < storageCapacity(s) && c.food < storageCapacity(s)); }
    s.housing = 3; s.food = s.wood = 300; s.gate = 110;
    applyCommand(s, { type: "BUILD", kind: "GATE" }); equal([gateCapacity(s), s.gate], [300, 210]);
    applyCommand(s, { type: "REPAIR" }); equal(s.gate, 270); validateState(s);
});
test("Stopped upgrading loses against a late wave; large progress stays finite and bounded", () => {
    for (const day of [1000, 10000, 1000000]) {
        const s = createGame(9); s.day = day; s.completed = day - 1; s.legacy.bestNight = s.completed; s.wave = generateWave(s);
        ok(Number.isFinite(enemyPower(day)) && enemyPower(day) > enemyPower(day - 1)); validateState(s);
        applyCommand(s, { type: "NIGHT" }); const b = new BattleSimulation(s);
        while (!b.outcome && b.tick < 6000) b.step(); equal(b.outcome, "LOSE"); ok(b.enemies.length <= s.wave!.entries.length && s.wave!.entries.length <= RULE.planCap);
        ok(b.enemies.every(e => Number.isSafeInteger(e.hp)));
    }
});
test("Sex sampling avoids low-bit locking for same/different parental traits and skill draws", () => {
    for (const draws of [3, 4, 7, 10]) {
        const rng = new SeededRandom(123), sexes = new Set<string>(), s = createGame(1);
        for (let birth = 0; birth < 60; birth++) { sexes.add(nextSex(s.people, rng)); for (let i = 1; i < draws; i++) rng.next(); }
        equal(sexes.size, 2);
    }
    const s = createGame(1), allWomen = s.people.map(p => ({ ...p, sex: "FEMALE" as const }));
    equal(maleBirthProbability(s.people), .5); equal(maleBirthProbability(allWomen), .75); ok(Math.abs(maleBirthProbability(allWomen, true) - .85) < 1e-10);
    const a = new SeededRandom(25), b = new SeededRandom(25); nextSex(allWomen, a); b.next(); equal(a.state, b.state);
    const rng = new SeededRandom(71); let males = 0;
    for (let i = 0; i < 10000; i++) if (nextSex(allWomen, rng) === "MALE") males++;
    ok(males > 7200 && males < 7800, `biased distribution: ${males}`);
});
test("Emergency traveler fills missing adults, respects cooldown/capacity and does not reroll on reload", () => {
    const s = createGame(3); s.people = s.people.filter(p => p.sex === "MALE"); s.families = []; s.towers.forEach(t => t.operator = null);
    applyCommand(s, { type: "NIGHT" }); finishNight(s, s.gate, s.towers.map(t => t.operator));
    const q = s.choices.find(q => q.kind === "TRAVELER"); ok(q && q.kind === "TRAVELER"); equal(q.person.sex, "FEMALE"); equal(s.lastTraveler, 1);
    const reload = clone(s); validateState(reload); equal(reload.choices, s.choices); equal(reload.rng, s.rng);
    applyCommand(s, { type: "CHOOSE", value: "decline" }); equal(s.lastTraveler, 1);
    s.completed = 3; s.day = 4; equal(travelerDue(s, 8), false);
    s.completed = 4; s.day = 5; equal(travelerDue(s, 8), true);
    s.lastTraveler = 7; s.completed = 8; s.day = 9; equal(travelerDue(s, 8), false);
    s.lastTraveler = null; s.day = 3; equal(travelerDue(s, s.people.length), false);
});
test("Two speed levels give identical battle ticks and result, including low-frame-rate step budget", () => {
    const results: string[] = [];
    for (const speed of [2, 3] as const) {
        const values = new Map<string, string>(), game = new GameSession(new SaveStore({ read: key => values.get(key) ?? null, write: (key, value) => { values.set(key, value); } }));
        const store = game.saves; store.inspect(); store.prepare(createGame(123)); store.commit(); game.load(); game.command({ type: "NIGHT" }); game.command({ type: "SPEED", value: speed });
        const b = game.battle!; for (let i = 0; i < 120 / speed; i++) game.update(.05);
        equal(b.tick, 120); results.push(JSON.stringify({ gate: b.gate, enemies: b.enemies, operators: b.operators }));
        game.pause("USER"); game.update(100); equal(b.tick, 120); game.resume("USER"); game.update(.25); equal(b.tick, 120 + 5 * speed);
        const live = game.battle; game.command({ type: "MUSIC", enabled: false }); ok(game.battle === live); equal(game.state!.settings.music, false);
    }
    equal(results[0], results[1]);
});
test("Camp has 20 unique navigable stops; baby stays still and carers face the baby", () => {
    const nav = new VillageNavigation(); equal(new Set(CAMP_STOPS.map(p => `${p.x}:${p.y}`)).size, 20); ok(CAMP_STOPS.every(p => nav.walkable(p)));
    for (const carerIndex of [0, 1]) {
        const s = createGame(4); applyCommand(s, { type: "BIRTH", family: s.families[0].id, carer: s.people[carerIndex].id });
        const motion = new VillagerMotion(nav); motion.sync(s, s.towers); const baby = s.people[s.people.length - 1], original = { ...motion.get(baby.id) }; let observed = false;
        for (let i = 0; i < 500; i++) { motion.update(.1); const p = motion.get(s.people[carerIndex].id); if (!p.walking && !p.animated && p.clip.endsWith("_walk") && distance(p, original) < 55) { const child = motion.get(baby.id); ok(p.direction.includes(child.x < p.x ? "LEFT" : "RIGHT")); ok(Math.abs(child.x - p.x) > Math.abs(child.y - p.y), "carer must stand to baby's side"); observed = true; } }
        ok(observed); equal([motion.get(baby.id).x, motion.get(baby.id).y], [original.x, original.y]);
        applyCommand(s, { type: "NIGHT" }); motion.sync(s, s.towers); for (let i = 0; i < 2000; i++) motion.update(.1);
        s.people.forEach(p => { const pose = motion.get(p.id); if (s.towers.some(t => t.operator === p.id)) ok(pose.insideTower); else ok(CAMP_STOPS.some(at => distance(at, pose) < .01)); });
        equal([motion.get(baby.id).x, motion.get(baby.id).y], [original.x, original.y]);
    }
});
test("Thoughts use short configurable lines, skip hidden speakers and keep a village-wide cooldown", () => {
    const s = createGame(7), thoughts = new VillagerThoughts(); thoughts.sync(s); const before = JSON.stringify(s);
    thoughts.update(s, SPEECH.initialWait + .1, () => false); equal(thoughts.current, null); equal(JSON.stringify(s), before);
    const p = s.people[0]; p.nights = 2; thoughts.sync(s); thoughts.update(s, .1, () => true);
    ok(thoughts.current?.priority); equal(thoughts.current!.id, p.id);
    ok(VILLAGER_LINES.retire.some(line => line === thoughts.current!.text));
    thoughts.update(s, 0, () => true); equal(thoughts.current!.remaining, 2);
    s.people = s.people.filter(q => q.id !== p.id); thoughts.sync(s); equal(thoughts.current, null);
    thoughts.update(s, SPEECH.idleMin - .1, () => true); equal(thoughts.current, null);
});
test("Full camps with many babies keep lateral carers and stable birth locations across repeated syncs", () => {
    for (const adults of [1, 4, 10]) for (let target = adults; target < 20; target++) {
        const s = createGame(4), template = s.people[0]; s.families = []; s.towers.forEach(t => t.operator = null); s.phase = "NIGHT";
        s.people = Array.from({ length: 20 }, (_, i) => ({ ...clone(template), id: `1:${20000 + i}`, adult: i < adults,
            job: i < adults ? "CARE" as const : "WAITING" as const, nights: i < adults ? 12 : 0, growth: 0,
            careChild: i < adults ? `1:${20000 + adults + (target - adults + i) % (20 - adults)}` : null }));
        const motion = new VillagerMotion(); motion.sync(s, s.towers);
        const babies = s.people.filter(p => !p.adult).map(p => ({ id: p.id, x: motion.get(p.id).x, y: motion.get(p.id).y }));
        for (let i = 0; i < 800; i++) { if (i % 40 === 0) motion.sync(s, s.towers); motion.update(.1); }
        for (const baby of babies) equal([motion.get(baby.id).x, motion.get(baby.id).y], [baby.x, baby.y]);
        for (const p of s.people.filter(p => p.adult)) {
            const at = motion.get(p.id), child = motion.get(p.careChild!); ok(!at.walking && !at.animated && at.clip.endsWith("_walk"));
            ok(Math.abs(at.x - child.x) > Math.abs(at.y - child.y)); ok(at.direction.includes(child.x < at.x ? "LEFT" : "RIGHT"));
        }
        for (let i = 0; i < s.people.length; i++) for (let j = i + 1; j < s.people.length; j++) ok(distance(motion.get(s.people[i].id), motion.get(s.people[j].id)) >= 22, "camp occupants overlap");
    }
});
console.log(`RESULT ${passed} growth/life checks passed`);
