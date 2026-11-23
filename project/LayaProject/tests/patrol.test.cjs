const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = process.env.DAIDAI_TEST_BUILD;
if (!root) throw new Error('Set DAIDAI_TEST_BUILD to the compiled project');
const load = name => require(path.join(root, name));
const { RULE } = load('config/RuleConfig');
const { PATROL } = load('config/PatrolConfig');
const { WAVE } = load('config/DefenseConfig');
const { createGame, applyCommand, finishNight } = load('game/VillageRules');
const { patrolStats } = load('game/PatrolRules');
const { BattleSimulation } = load('game/BattleSimulation');
const { DailyTaskCombat } = load('game/DailyTaskCombat');
const { PATH_LENGTH, onBattleRoad } = load('game/BattleRoad');
const { lanePoint } = load('game/SummonCharge');
const { Patrol } = load('game/Patrol');
const { generateWave } = load('game/WaveGenerator');
const { validateState } = load('storage/StateValidation');
const { SaveStore, canonical, crc32 } = load('storage/SaveStore');

function unlocked() {
    const s = createGame(245);
    s.completed = s.legacy.bestNight = 5;
    s.day = s.completed + 1;
    s.wave = generateWave(s);
    return s;
}

test('patrol is present on the first day, upgrade costs inventory and a retiring captain releases the post', () => {
    const s = createGame(245), wood = s.wood, food = s.food;
    assert.deepEqual(s.patrol, { level: 1, captain: null });
    const tower = s.towers[0], p = s.people.find(p => p.id === tower.operator);
    p.nights = 1;
    applyCommand(s, { type: 'PATROL_UPGRADE' });
    applyCommand(s, { type: 'PATROL_CAPTAIN', id: p.id });
    assert.equal(s.wood, wood - PATROL.upgrade.wood);
    assert.equal(s.food, food - PATROL.upgrade.food);
    assert.equal(p.job, 'WAITING');
    assert(tower.operator && tower.operator !== p.id);
    assert.throws(() => applyCommand(s, { type: 'OPERATOR', index: 0, id: p.id }), /不能同时驻塔/);
    validateState(s);
    applyCommand(s, { type: 'NIGHT' });
    assert.equal(s.night.patrolSquad, true);
    finishNight(s, s.gate, s.towers.map(t => t.operator));
    assert.deepEqual(s.patrol, { level: 2, captain: null });
    validateState(s);
});

test('an older slot without a patrol house loads level one without writing back, and existing patrol records are preserved', () => {
    const s = unlocked(), values = new Map();
    const port = { read: key => values.get(key) ?? null, write: (key, data) => values.set(key, data) };
    const saves = new SaveStore(port);
    saves.inspect(); saves.prepare(s); saves.commit();
    const [key] = values.keys(), old = JSON.parse(values.get(key));
    delete old.payload.patrol;
    delete old.checksum;
    old.checksum = crc32(canonical(old));
    const oldBytes = canonical(old); values.set(key, oldBytes);
    const inspection = new SaveStore(port).inspect();
    assert.equal(inspection.kind, 'ready');
    assert.deepEqual(inspection.state, s);
    assert.equal(values.get(key), oldBytes);
    const current = new SaveStore(port);
    current.inspect();
    applyCommand(s, { type: 'PATROL_UPGRADE' });
    applyCommand(s, { type: 'PATROL_CAPTAIN', id: s.people[0].id });
    current.prepare(s); current.commit();
    assert.deepEqual(new SaveStore(port).inspect().state.patrol, s.patrol);
});

test('guard resolves before gate damage even if the monster reaches the gate on the same step', () => {
    const s = unlocked();
    applyCommand(s, { type: 'PATROL_CAPTAIN', id: s.people[0].id });
    applyCommand(s, { type: 'NIGHT' });
    delete s.night.patrolSpin; // exercise the original in-progress night rule
    const stats = new DailyTaskCombat(), battle = new BattleSimulation(s, stats);
    battle.tick = Math.round(PATROL.first / RULE.step);
    battle.base.towers.forEach(t => { t.operator = null; });
    battle.enemies.push({ seq: 9000, kind: 'enemy_runner', progress: PATH_LENGTH - 2, hp: 12, maxHp: 12, speed: 60,
        appearanceSeed: 0, walkDistance: 0, slow: 0, slowTicks: 0, born: 0, summoned: 0 });
    battle.step();
    assert.equal(battle.patrol.deployments, 1);
    assert.equal(battle.patrol.kills, 1);
    assert.equal(stats.totalKills, 1);
    assert.equal(stats.towers.size, 0);
    assert.equal(battle.gate, s.gate);
    assert.equal(battle.feedback.filter(e => e.type === 'patrol').length, 1);
    assert.equal(patrolStats(1, undefined, false).damage, 26);
    assert.equal(patrolStats(13, undefined, false).seconds, 4.5);
    assert.equal(s.night.patrolSquad, true);
});

test('each patrol unit hits one nearest overlapping live enemy regardless of lateral offset', () => {
    const s = unlocked();
    s.patrol = { level: 1, captain: s.people[0].id };
    const patrol = new Patrol(s), firstTick = Math.round(PATROL.first / RULE.step);
    const at = lanePoint(PATH_LENGTH - PATROL.legacy.speed * RULE.step, 0);
    const enemy = (seq, x) => ({
        enemy: { seq, kind: 'enemy_runner', hp: 1 },
        at: { x: at.x + x, y: at.y }
    });
    const outside = enemy(1, 30), farther = enemy(2, 14), closer = enemy(3, -8);
    const first = patrol.advance(firstTick, [outside, farther, closer]);
    assert.deepEqual(first.map(hit => hit.enemy.seq), [3]);
    assert.deepEqual([outside.enemy.hp, farther.enemy.hp, patrol.units.length], [1, 1, 0]);

    const gate = lanePoint(PATH_LENGTH, 0);
    patrol.units = [4, 5].map(index => ({ index, progress: PATH_LENGTH, lane: 0, speed: PATROL.legacy.speed, at: gate, distance: 0 }));
    const newCloser = enemy(6, -8);
    const second = patrol.advance(firstTick + 1, [closer, farther, newCloser, outside]);
    assert.deepEqual(second.map(hit => hit.enemy.seq), [6, 2]);
    assert.equal(outside.enemy.hp, 1);
    assert.equal(patrol.units.length, 0);
});

test('fixed reinforcements use slots in the band budget without changing the arrival window', () => {
    for (const day of [12, 13, 25, 48]) {
        const s = createGame(44);
        s.day = day;
        const before = structuredClone(s);
        const actual = generateWave(s);
        const { firstDay, secondDay } = PATROL.pressure;
        PATROL.pressure.firstDay = PATROL.pressure.secondDay = Infinity;
        try {
            const baseline = generateWave(before);
            assert.equal(actual.entries.length, baseline.entries.length);
            if (day === 12) assert.deepEqual(actual, baseline);
            else assert.notDeepEqual(actual.entries, baseline.entries);
            assert.equal(actual.entries.at(-1).tick, baseline.entries.at(-1).tick);
        } finally {
            Object.assign(PATROL.pressure, { firstDay, secondDay });
        }
    }
});

test('each departure sends one, upgrade only increases damage, and consecutive arrivals vary pace and lane', () => {
    const stats = [1, 2, 3, 4, 5].map(level => patrolStats(level));
    assert.deepEqual(PATROL.squad.speeds, [19, 21.5, 24.5, 27]);
    assert.equal(PATROL.legacy.speed, 46);
    assert.deepEqual(stats.map(s => s.damage), [16, 20, 24, 29, 35]);
    assert(stats.every(s => s.seconds === 7.5));
    const firstTick = Math.round(PATROL.first / RULE.step);
    for (const level of [1, 2, 3, 5, 40]) {
        const state = unlocked();
        state.patrol = { level, captain: state.people[2].id };
        state.night = { patrolSquad: true };
        const patrol = new Patrol(state), launches = [];
        for (let tick = firstTick; tick < firstTick + patrol.stats.ticks * 4; tick++) {
            const deployed = patrol.deployments;
            patrol.advance(tick, []);
            const added = patrol.deployments - deployed;
            assert.equal(added, Number((tick - firstTick) % patrol.stats.ticks === 0));
            if (added) launches.push({ tick, active: patrol.units.length, ...patrol.units.at(-1) });
            assert(patrol.units.length <= PATROL.squad.maxActive);
            assert(patrol.units.every(unit => onBattleRoad(unit.at)));
        }
        assert.deepEqual(launches.map(unit => unit.speed), PATROL.squad.speeds);
        assert.deepEqual(launches.map(unit => unit.lane), PATROL.squad.lanes);
        assert.equal(launches[1].active, 2, "the previous patrol can still be on the road");
    }
});

test('modern patrol damage follows the first Y crossing including an endpoint, and ignores X only in modern nights', () => {
    const state = unlocked();
    state.patrol = { level: 1, captain: state.people[0].id };
    const firstTick = Math.round(PATROL.first / RULE.step);
    const gate = lanePoint(PATH_LENGTH, 0);
    const enemy = (seq, fromY, toY) => ({ enemy: { seq, kind: 'enemy_runner', hp: 1 }, fromY, at: { x: gate.x + 32, y: toY } });
    const alreadyPassed = enemy(1, gate.y + 1, gate.y + 2);
    const first = enemy(2, gate.y, gate.y), later = enemy(3, gate.y - 2, gate.y);
    const stillAhead = enemy(4, gate.y - 10, gate.y - 10);
    const targets = [later, stillAhead, alreadyPassed, first];
    const old = new Patrol(state);
    assert.deepEqual(old.advance(firstTick, targets), []);
    state.night = { patrolSquad: true };
    const patrol = new Patrol(state);
    const hits = patrol.advance(firstTick, targets);
    assert.deepEqual(hits.map(hit => hit.enemy.seq), [2]);
    assert.equal(hits[0].at.x, first.at.x);
    assert.equal(later.enemy.hp, 1);
    assert.equal(patrol.units.length, 0);
    assert.deepEqual(patrol.advance(firstTick + 1, targets), []);
});

test('new patrol pairs stop recruiting when ready and deal flat damage to every live target within the landing circle', () => {
    const { PatrolSpin, patrolArc } = load('game/PatrolSpin');
    const seconds = PATROL.spin.interval, readyTicks = seconds / RULE.step;
    const spin = new PatrolSpin({ damage: 16, ticks: readyTicks });
    const at = { x: 40, y: 985 }; // deliberately off the road and in the village
    const enemy = (seq, offset, kind = 'enemy_runner', hp = 40) =>
        ({ enemy: { seq, kind, hp }, at: { x: at.x + offset, y: at.y } });
    const crowd = Array.from({ length: 50 }, (_, i) => enemy(10 + i, i - 25));
    const targets = [enemy(4, PATROL.spin.radius), enemy(3, 80, 'enemy_armored'), enemy(2, 12, 'enemy_commander'),
        enemy(1, 0), enemy(5, PATROL.spin.radius + 1), enemy(6, 0, 'enemy_runner', 0), ...crowd];
    const originalHealth = targets.map(target => target.enemy.hp);
    assert.equal(spin.throwAt(0, at), false);
    for (let t = 1; t <= 400; t++) {
        const count = spin.deployments;
        assert.deepEqual(spin.advance(t, targets), []);
        if (spin.deployments !== count) {
            assert.equal(spin.deployments, 2);
            assert.equal(spin.actors.length, 2);
            assert(spin.actors.every(actor => Math.abs(actor.at.x-PATROL.spin.house.x) <= PATROL.spin.exitOffset));
            assert(spin.actors[0].at.x !== spin.actors[1].at.x);
        }
        assert.equal(spin.ready, t >= readyTicks);
    }
    assert(spin.center.y > 830);
    assert.equal(spin.throwAt(400, { x: 721, y: 985 }), false);
    const angle = -1.25, release = spin.orbit(1, angle).at;
    assert.equal(spin.throwAt(400, at, angle), true);
    assert.deepEqual(spin.actors[1].at, release);
    assert.deepEqual(spin.aimOrigin, release);
    assert.deepEqual(spin.advance(400, targets), []);
    assert.deepEqual({ x: spin.actors[1].at.x, y: spin.actors[1].at.y }, release);
    assert(spin.advance(401, targets).length === 0 && spin.flightProgress(401) > 0);
    assert.equal(spin.throwAt(400, at), false);
    const mid = patrolArc(spin.aimOrigin, at, .5);
    assert(mid.lift > 0);
    let hit, tick = 400;
    while (spin.flying) {
        hit = spin.advance(++tick, targets);
        if (spin.flying) assert.deepEqual(targets.map(target => target.enemy.hp), originalHealth);
    }
    assert.deepEqual(hit.map(h => h.enemy.seq), [4, 3, 2, 1, ...crowd.map(target => target.enemy.seq)]);
    assert(hit.every(h => h.enemy.hp === 24));
    assert.deepEqual(spin.landing.at, at);
    assert.equal(targets[4].enemy.hp, 40);
    assert.equal(targets[5].enemy.hp, 0);
    assert.equal(spin.actors.length, 0);
    for (let step = 1; step <= 400; step++) {
        spin.advance(tick + step, []);
        assert.equal(spin.ready, step >= readyTicks);
    }
    assert.equal(spin.deployments, 4);
    assert.equal(spin.throwAt(tick + 400, { x: 700, y: 150 }), true);
    let emptyHits;
    for (let step = tick + 401; spin.flying; step++) emptyHits = spin.advance(step, []);
    assert.deepEqual(emptyHits, []);
    assert.deepEqual(spin.landing.at, { x: 700, y: 150 });
});

test('new patrol has a distinct save rule and continuous damage growth with bounded replenishment', () => {
    const { patrolSpinStats } = load('game/PatrolRules');
    const s = unlocked();
    applyCommand(s, { type: 'PATROL_CAPTAIN', id: s.people[0].id });
    applyCommand(s, { type: 'NIGHT' });
    validateState(s);
    assert.equal(s.night.patrolSpin, true);
    assert(new Patrol(s).spin);
    const common = patrolSpinStats(1), strongLegend = patrolSpinStats(1, { quality: 'LEGENDARY', trait: 'trait_strong' });
    assert.equal(common.seconds, 4.5);
    assert(strongLegend.damage > common.damage && strongLegend.ticks < common.ticks);
    assert(patrolSpinStats(1000).damage > patrolSpinStats(999).damage);
    assert(patrolSpinStats(1000, { quality: 'LEGENDARY', trait: 'trait_nimble' }).seconds >= PATROL.spin.minimum);
    delete s.night.patrolSpin;
    assert.equal(new Patrol(s).spin, null);
});

test('the walking pair can gather immediately without firing or restarting their recruitment', () => {
    const { PatrolSpin } = load('game/PatrolSpin');
    const spin = new PatrolSpin({ damage: 16, ticks: 90 });
    assert.equal(spin.gather(), false);
    for (let tick = 1; tick < 90; tick++) {
        spin.advance(tick, []);
        if (!spin.canGather) continue;
        assert(!spin.ready);
        assert(spin.gather());
        const slots = spin.actors.map(({ at }) => ({ ...at }));
        spin.advance(tick + 1, []);
        assert.deepEqual(spin.actors.map(({ at }) => at), slots);
        assert(slots.every(({ y }) => y === spin.center.y));
        assert(!spin.flying && spin.ready);
        assert(spin.throwAt(tick + 1, { x: 360, y: 210 }));
        assert(!spin.gather());
        return;
    }
    assert.fail("the pair should be selectable while leaving the booth");
});

test('the tutorial is completed only by a successful cast and survives a new village on the same device', () => {
    const { GameSession } = load('game/GameSession');
    const { clearVillageGuides } = load('storage/VillageGuides');
    const data = new Map();
    const port = { read: key => data.get(key) ?? null, write: (key,value) => data.set(key,value), remove: key => data.delete(key) };
    const session = new GameSession(new SaveStore(port));
    const state = createGame(245);
    applyCommand(state, { type: 'PATROL_CAPTAIN', id: state.people[0].id });
    applyCommand(state, { type: 'NIGHT' });
    session.battle = new BattleSimulation(state);
    const spin = session.battle.patrol.spin;
    while (!spin.canGather) session.battle.step();
    spin.gather();
    assert(!session.hasLaunchedPatrol);
    assert.equal(session.throwPatrol({ x: -99, y: 430 }, 0), false);
    assert(!session.hasLaunchedPatrol);
    assert(session.throwPatrol({ x: 360, y: 430 }, 0));
    assert(session.hasLaunchedPatrol);
    clearVillageGuides(port);
    const next = new GameSession(new SaveStore(port));
    assert(next.hasLaunchedPatrol);
});

test('patrol pull scales from the actual finger start to the screen edge and lands along the reverse aim ray', () => {
    const { patrolPull } = load('view/PatrolThrowCue');
    const { GameLayout } = load('view/GameLayout');
    const near = (a, b) => assert(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
    for (const [windowWidth, windowHeight, safeBottom] of [[320, 568, 568], [390, 844, 810], [360, 880, 856]]) {
        const layout = new GameLayout({ windowWidth, windowHeight, statusBarHeight: 20,
            safeArea: { top: 20, bottom: safeBottom, left: 0, right: windowWidth } },
            { top: 24, bottom: 56, left: windowWidth - 98, right: windowWidth - 10, width: 88, height: 32 });
        const center = { x: 360, y: layout.worldY(PATROL.spin.center.y) };
        for (const delta of [-54, 14]) {
            const press = { x: 323, y: center.y + delta }, full = layout.height - press.y;
            const pull = (dx, dy) => patrolPull(press, { x: press.x + dx, y: press.y + dy }, center, layout);
            assert.equal(pull(3, 5), null);
            const half = pull(0, full / 2);
            near(half.power, .5);
            near(half.y, (center.y + layout.mapTop) / 2);
            near(half.x, center.x);
            assert(pull(0, layout.footerTop - press.y).y > layout.mapTop);
            assert(pull(0, full - 1).y > layout.mapTop);
            near(pull(0, full).power, 1);
            near(pull(0, full).y, layout.mapTop);
            near(pull(0, Math.round(layout.height) - press.y).y, layout.mapTop);
            const diagonal = pull(720 - press.x, 100);
            near(diagonal.power, 1);
            near(diagonal.x, 0);
            near((diagonal.y - center.y) / (diagonal.x - center.x), 100 / (720 - press.x));
            const horizontal = pull(-(press.x / 2), 0);
            near(horizontal.power, .5);
            near(horizontal.x, (center.x + 720) / 2);
            near(horizontal.y, center.y);
        }
    }
});
