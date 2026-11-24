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
    assert.equal(rapid.damage, 20);
    assert(patrolRapidDamage(48) > rapid.damage);
    const origin = { x: 330, y: 610 }, head = { x: 330, y: 545 };
    const enemyStep = (id, dy) => ({
        enemy: { seq: id, kind: 'enemy_armored', hp: rapid.damage }, startProgress: 0, end: 1,
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
    assert.equal(behind.enemy.hp, rapid.damage);
});

test('two landed rounds defeat a full-health first-night raider with a level-one common captain', () => {
    const state = createGame(31);
    applyCommand(state, { type: 'PATROL_MODE', mode: 'rapid' });
    applyCommand(state, { type: 'NIGHT' });
    const battle = new BattleSimulation(state), rapid = battle.patrol.rapid;
    battle.base.towers.forEach(t => { t.operator = null; });
    for (let i = 0; i < 80 && !battle.enemies.length; i++) battle.step();
    const enemy = battle.enemies.find(e => e.kind === 'enemy_raider');
    assert(enemy && enemy.hp === enemy.maxHp);
    const foot = { x: 330, y: 545 + spec.ordinaryCenterHeight };
    const trace = { enemy, from: foot, to: foot, end: 1 };
    rapid.aim(up, { x: foot.x, y: 610 }, 0);
    const healthAfterHit = [];
    for (let i = 0; i < Math.ceil(1 / dt) && enemy.hp > 0; i++) {
        if (rapid.advance(dt, [trace]).length) healthAfterHit.push(enemy.hp);
    }
    assert.equal(healthAfterHit.length, 2);
    assert(healthAfterHit[0] > 0 && healthAfterHit[1] <= 0);
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

test('holding the roof slows the battle but retains four rounds and full projectile distance per real second', () => {
    const state = createGame(31);
    state.patrol.level = 5;
    applyCommand(state, { type: 'PATROL_MODE', mode: 'rapid' });
    applyCommand(state, { type: 'NIGHT' });
    const session = new GameSession(new SaveStore({read: () => null, write() {}}));
    session.state = state;
    const battle = session.battle = new BattleSimulation(state), rapid = battle.patrol.rapid;
    session.setPatrolAiming(true);
    const advance = frames => { for (let i = 0; i < frames; i++) session.update(1 / 60); };
    advance(60);
    assert.equal(battle.tick, Math.round(RULE.battleSpeed * PATROL.spin.aimSpeedRatio / RULE.step));
    assert.equal(rapid.shotsFired, 0);
    session.aimPatrolRapid({x:1,y:0},{x:20,y:960},0);
    advance(30);
    assert.equal(rapid.shotsFired, 2);
    assert(Math.abs(rapid.projectiles[0].at.x - (20 + spec.speed / 2)) < 1e-6);
    advance(210);
    assert.equal(rapid.shotsFired,16);
    advance(60);
    assert.equal(rapid.ammo,0);
    assert.equal(session.battleSpeed,RULE.battleSpeed);
    advance(240);
    assert.equal(rapid.ammo,rapid.capacity);
    assert.equal(session.patrolAiming,false);
    assert.equal(rapid.shotsFired,20);
    session.setPatrolAiming(true);
    session.pause('BACKGROUND'); session.resume('BACKGROUND');
    assert.equal(session.battleSpeed,RULE.battleSpeed);
});

test('a rapid round grazes the widened torso ellipse and misses just outside it on either axis', () => {
    for (const [kind, height, widthRadius, heightRadius] of [
        ['enemy_raider', spec.ordinaryCenterHeight, 48, 28.5],
        ['enemy_chief', spec.bossCenterHeight, 66, 37.5]
    ]) {
        for (const vertical of [true, false]) {
            const radius = vertical ? widthRadius : heightRadius;
            for (const [offset, expected] of [[radius - 1, 1], [radius + 1, 0]]) {
                const rapid = new PatrolRapid(16, 1);
                const torso = { x: 360, y: 510 };
                const foot = { x: torso.x, y: torso.y + height };
                const trace = { enemy: {seq: 1, kind, hp: 100}, from: foot, to: foot, end: 1 };
                const start = vertical ? { x: torso.x + offset, y: torso.y + 70 } : { x: torso.x - 70, y: torso.y + offset };
                rapid.aim(vertical ? up : {x: 1, y: 0}, start, 0);
                let hits = rapid.advance(dt, [trace]).length;
                rapid.stop();
                for (let i = 0; i < 20; i++) hits += rapid.advance(dt, [trace]).length;
                assert.equal(hits, expected, kind + ' offset ' + offset);
            }
        }
    }
});
