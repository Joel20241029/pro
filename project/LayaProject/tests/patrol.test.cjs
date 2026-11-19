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
const { PATH_LENGTH } = load('game/BattleRoad');
const { lanePoint } = load('game/SummonCharge');
const { Patrol } = load('game/Patrol');
const { generateWave } = load('game/WaveGenerator');
const { validateState } = load('storage/StateValidation');
const { SaveStore } = load('storage/SaveStore');

function unlocked() {
    const s = createGame(245);
    s.completed = s.legacy.bestNight = PATROL.unlock;
    s.day = s.completed + 1;
    s.wave = generateWave(s);
    return s;
}

test('patrol costs inventory, preserves day jobs, and releases a retiring captain', () => {
    const initial = createGame(245);
    assert.throws(() => applyCommand(initial, { type: 'PATROL_BUILD' }), /守住 5 波/);
    const s = unlocked(), wood = s.wood, food = s.food;
    const tower = s.towers[0], p = s.people.find(p => p.id === tower.operator);
    p.nights = 1;
    applyCommand(s, { type: 'PATROL_BUILD' });
    applyCommand(s, { type: 'PATROL_CAPTAIN', id: p.id });
    assert.equal(s.wood, wood - PATROL.build.wood);
    assert.equal(s.food, food - PATROL.build.food);
    assert.equal(p.job, 'WAITING');
    assert(tower.operator && tower.operator !== p.id);
    assert.throws(() => applyCommand(s, { type: 'OPERATOR', index: 0, id: p.id }), /不能同时驻塔/);
    validateState(s);
    applyCommand(s, { type: 'NIGHT' });
    finishNight(s, s.gate, s.towers.map(t => t.operator));
    assert.equal(s.patrol.captain, null);
    assert.equal(s.patrol.level, 1);
    validateState(s);
});

test('old day wave is read back byte-for-byte and new village omits patrol', () => {
    const old = unlocked(), values = new Map();
    const port = { read: key => values.get(key) ?? null, write: (key, data) => values.set(key, data) };
    const saves = new SaveStore(port);
    saves.inspect(); saves.prepare(old); saves.commit();
    assert.deepEqual(new SaveStore(port).inspect().state, old);
    assert.equal(old.patrol, undefined);
    applyCommand(old, { type: 'PATROL_BUILD' });
    saves.prepare(old); saves.commit();
    assert.deepEqual(new SaveStore(port).inspect().state.patrol, { level: 1, captain: null });
    assert.equal(createGame(11).patrol, undefined);
});

test('guard resolves before gate damage even if the monster reaches the gate on the same step', () => {
    const s = unlocked();
    applyCommand(s, { type: 'PATROL_BUILD' });
    applyCommand(s, { type: 'PATROL_CAPTAIN', id: s.people[0].id });
    applyCommand(s, { type: 'NIGHT' });
    const stats = new DailyTaskCombat(), battle = new BattleSimulation(s, stats);
    battle.tick = Math.round(PATROL.first / RULE.step);
    battle.base.towers.forEach(t => { t.operator = null; });
    battle.enemies.push({ seq: 9000, kind: 'enemy_runner', progress: PATH_LENGTH - 2, hp: 24, maxHp: 24, speed: 60,
        appearanceSeed: 0, walkDistance: 0, slow: 0, slowTicks: 0, born: 0, summoned: 0 });
    battle.step();
    assert.equal(battle.patrol.deployments, 1);
    assert.equal(battle.patrol.kills, 1);
    assert.equal(stats.totalKills, 1);
    assert.equal(stats.towers.size, 0);
    assert.equal(battle.gate, s.gate);
    assert.equal(battle.feedback.filter(e => e.type === 'patrol').length, 1);
    assert.equal(patrolStats(1).damage, 26);
    assert.equal(patrolStats(13).seconds, 4.5);
});

test('each patrol unit hits one nearest overlapping live enemy regardless of lateral offset', () => {
    const s = unlocked();
    s.patrol = { level: 1, captain: s.people[0].id };
    const patrol = new Patrol(s), firstTick = Math.round(PATROL.first / RULE.step);
    const at = lanePoint(PATH_LENGTH - PATROL.speed * RULE.step, 0);
    const enemy = (seq, x) => ({
        enemy: { seq, kind: 'enemy_runner', hp: 1 },
        at: { x: at.x + x, y: at.y }
    });
    const outside = enemy(1, 30), farther = enemy(2, 14), closer = enemy(3, -8);
    const first = patrol.advance(firstTick, [outside, farther, closer]);
    assert.deepEqual(first.map(hit => hit.enemy.seq), [3]);
    assert.deepEqual([outside.enemy.hp, farther.enemy.hp, patrol.units.length], [1, 1, 0]);

    const gate = lanePoint(PATH_LENGTH, 0);
    patrol.units = [4, 5].map(index => ({ index, progress: PATH_LENGTH, lane: 0, at: gate, distance: 0 }));
    const newCloser = enemy(6, -8);
    const second = patrol.advance(firstTick + 1, [closer, farther, newCloser, outside]);
    assert.deepEqual(second.map(hit => hit.enemy.seq), [6, 2]);
    assert.equal(outside.enemy.hp, 1);
    assert.equal(patrol.units.length, 0);
});

test('reinforcements add to an existing wave without changing its spawn duration or randomness', () => {
    for (const day of [12, 13, 25, 48]) {
        const s = createGame(44);
        s.day = day;
        const before = structuredClone(s);
        const actual = generateWave(s);
        const { firstDay, secondDay } = PATROL.pressure;
        PATROL.pressure.firstDay = PATROL.pressure.secondDay = Infinity;
        try {
            const baseline = generateWave(before);
            assert.equal(actual.entries.length - baseline.entries.length, WAVE.density * (day < 13 ? 0 : day < 25 ? 1 : 2));
            assert.equal(actual.entries.at(-1).tick, baseline.entries.at(-1).tick);
            assert.deepEqual(s.rng, before.rng);
        } finally {
            Object.assign(PATROL.pressure, { firstDay, secondDay });
        }
    }
});
