const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const load = file => require(path.join(process.env.DAIDAI_TEST_BUILD, file));
const { PATROL } = load('config/PatrolConfig');
const { PatrolRapid, patrolRapidDamage } = load('game/PatrolRapid');
const { createGame, applyCommand } = load('game/VillageRules');
const { GameSession } = load('game/GameSession');
const { BattleSimulation } = load('game/BattleSimulation');
const { SaveStore } = load('storage/SaveStore');
const { RULE } = load('config/RuleConfig');
const { generateWave } = load('game/WaveGenerator');

const up = { x: 0, y: -1 }, spec = PATROL.rapid, dt = RULE.step / RULE.battleSpeed;
const pull = rapid => rapid.aim(up, spec.origin, spec.muzzleDistance);
const run = (rapid, seconds) => {
    for (let tick = 0; tick < Math.round(seconds / dt); tick++) rapid.advance(dt, []);
};

test('partial pulls retain rounds and cadence; empty clip reloads once and requires a fresh pull', () => {
    const rapid = new PatrolRapid(16, 1);
    assert(pull(rapid)); run(rapid, .75);
    assert.equal(rapid.ammo, 5);
    rapid.stop(); run(rapid, 2);
    assert.equal(rapid.ammo, 5);
    assert(pull(rapid)); run(rapid, 1.05);
    assert.equal(rapid.shotsFired, 8);
    assert.equal(rapid.ammo, 0);
    assert(!pull(rapid));
    run(rapid, 3.8);
    assert(rapid.reloadRemaining > 0);
    run(rapid, .2);
    assert.equal(rapid.ammo, 8);
    run(rapid, .5);
    assert.equal(rapid.shotsFired, 8);
    assert(pull(rapid)); run(rapid, .1); rapid.stop();
    assert(pull(rapid)); run(rapid, .1);
    assert.equal(rapid.shotsFired, 9);
});

test('night starts with the booth magazine and refills to the same level-dependent capacity', () => {
    for (const [level, capacity] of [[1, 8], [2, 11], [3, 14], [5, 20], [10, 35]]) {
        const state = createGame(31);
        state.patrol.level = level;
        applyCommand(state, { type: 'PATROL_MODE', mode: 'rapid' });
        applyCommand(state, { type: 'NIGHT' });
        const rapid = new BattleSimulation(state).patrol.rapid;
        assert.equal(rapid.capacity, capacity);
        assert.equal(rapid.ammo, capacity);
        assert(pull(rapid));
        run(rapid, capacity / spec.shotsPerSecond);
        assert.equal(rapid.shotsFired, capacity);
        assert.equal(rapid.ammo, 0);
        run(rapid, spec.reloadSeconds);
        assert.equal(rapid.ammo, capacity);
        assert.equal(rapid.shotsFired, capacity);
    }
});

test('an in-flight actor retains its bearing; nearest enemy takes one hit even with overlapping targets', () => {
    const rapid = new PatrolRapid(16, 1);
    assert.equal(rapid.damage, 3);
    assert(patrolRapidDamage(48) > rapid.damage);
    const origin = { x: 330, y: 610 }, head = { x: 330, y: 545 };
    const enemyStep = (id, dy) => ({
        enemy: { seq: id, kind: 'enemy_armored', hp: 3 }, startProgress: 0, end: 1,
        from: { x: head.x, y: head.y + dy + spec.ordinaryCenterHeight },
        to: { x: head.x, y: head.y + dy + spec.ordinaryCenterHeight }
    });
    const behind = enemyStep(0, -15), first = enemyStep(1, 0);
    rapid.aim(up, origin, 0);
    rapid.advance(dt, []);
    rapid.aim({ x: 1, y: 0 }, origin, 0);
    assert.deepEqual(rapid.projectiles[0].direction, up);
    rapid.stop();
    const hits = [];
    for (let i = 0; i < 20; i++) hits.push(...rapid.advance(dt, [behind, first]));
    assert.equal(rapid.projectiles.length, 0);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].enemy.seq, 1);
    assert.equal(first.enemy.hp, 0);
    assert.equal(behind.enemy.hp, 3);
});

test('rapid and spin snapshots apply the same monster pressure, including after the initial grace period', () => {
    const state = createGame(43);
    state.day = 29; state.completed = 28; state.wave = generateWave(state);
    applyCommand(state, { type: 'NIGHT' });
    const spin = new BattleSimulation(state);
    delete state.night.patrolSpin; state.night.patrolMode = 'rapid';
    const rapid = new BattleSimulation(state);
    for (const battle of [spin,rapid]) {
        battle.base.towers.forEach(t => { t.operator = null; });
        for (let i = 0; i < 80 && !battle.enemies.length; i++) battle.step();
    }
    assert(spin.enemies.length);
    assert.deepEqual(rapid.enemies, spin.enemies);
    assert.equal(rapid.patrol.spin, null);
    assert.equal(rapid.patrol.units.length, 0);
    assert.equal(rapid.patrol.rapid.shotsFired, 0);
});

test('session only marks an actual first shot; pausing freezes reload and never resumes fire by itself', () => {
    const values = new Map();
    const store = new SaveStore({ read: k => values.get(k) ?? null, write: (k,v) => values.set(k,v) });
    const state = createGame(31); applyCommand(state, { type: 'NIGHT' });
    state.night.patrolMode = 'rapid'; delete state.night.patrolSpin;
    const session = new GameSession(store), battle = new BattleSimulation(state), rapid = battle.patrol.rapid;
    session.battle = battle; session.state = state;
    assert(session.aimPatrolRapid(up)); session.stopPatrolRapid();
    session.update(dt);
    assert(!session.hasFiredPatrolRapid);
    assert(session.aimPatrolRapid(up)); session.update(dt);
    assert(session.hasFiredPatrolRapid);
    assert(!session.hasLaunchedPatrol);
    assert(new GameSession(store).hasFiredPatrolRapid);
    session.pause('USER'); session.resume('USER');
    for (let i = 0; i < 20; i++) session.update(dt);
    assert.equal(rapid.shotsFired, 1);
    assert(session.aimPatrolRapid(up));
    for (let i = 0; i < 110; i++) session.update(dt);
    assert.equal(rapid.ammo, 0);
    const reload = rapid.reloadRemaining;
    session.hide();
    for (let i = 0; i < 60; i++) session.update(dt);
    assert.equal(rapid.reloadRemaining, reload);
    session.resume('BACKGROUND');
    for (let i = 0; i < 260; i++) session.update(dt);
    assert.equal(rapid.ammo, 8);
    assert.equal(rapid.shotsFired, 8);
});
