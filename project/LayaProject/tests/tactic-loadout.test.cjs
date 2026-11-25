const { test } = require('node:test');
const assert = require('node:assert/strict');
const read = name => require(`${process.env.DAIDAI_TEST_BUILD}/${name}.js`);
const { DEFAULT_TACTIC, RAGE_TACTIC, SHIELD_TACTIC, MIND_LOCK_TACTIC, TACTIC_USE, tacticDefinition } = read('config/TacticConfig');
const { RULE } = read('config/RuleConfig');
const { createGame, applyCommand } = read('game/VillageRules');
const { generateWave } = read('game/WaveGenerator');
const { BattleSimulation } = read('game/BattleSimulation');
const { SaveStore } = read('storage/SaveStore');
const { GameSession } = read('game/GameSession');
const { validateState } = read('storage/StateValidation');

function village(waves) {
    const s = createGame(42);
    s.completed = s.legacy.bestNight = waves;
    s.day = waves + 1;
    s.wave = generateWave(s);
    s.wood = s.food = 200;
    return s;
}
const unlock = (s, slot) => applyCommand(s, { type: 'TACTIC_UNLOCK_SLOT', slot });
const learn = (s, id, slot) => applyCommand(s, { type: 'TACTIC_LEARN', id, slot });
const equip = (s, id, slot) => applyCommand(s, { type: 'TACTIC_EQUIP', id, slot });

test('slot thresholds, each exact cost, duplicate validation and compatibility with the saved night', () => {
    assert.throws(() => unlock(village(14), 1), /还需守住 1 波/);
    const middle = village(15);
    middle.food = 39;
    assert.throws(() => unlock(middle, 1), /还缺 1 粮/);
    assert.deepEqual([middle.wood, middle.food], [200, 39]);
    middle.food = 40;
    unlock(middle, 1);
    assert.deepEqual([middle.wood, middle.food, middle.tactics.extraSlots], [120, 0, [null]]);
    assert.throws(() => unlock(middle, 1), /按顺序/);
    assert.throws(() => unlock(middle, 2), /还需守住 20 波/);
    applyCommand(middle, { type: 'NIGHT' });
    assert.equal(new BattleSimulation(middle).tacticUsesLeft, 2);

    const s = village(35);
    assert.throws(() => unlock(s, 2), /按顺序/);
    unlock(s, 1);
    s.wood = 160; s.food = 80;
    unlock(s, 2);
    assert.deepEqual([s.wood, s.food, s.tactics.extraSlots], [0, 0, [null, null]]);
    assert.throws(() => equip(s, DEFAULT_TACTIC, 2), /已携带/);
    s.wood = 100; s.food = 100;
    learn(s, RAGE_TACTIC, 1);
    learn(s, SHIELD_TACTIC, 2);
    applyCommand(s, { type: 'TACTIC_CLEAR_SLOT', slot: 1 });
    assert.deepEqual(s.tactics.extraSlots, [null, SHIELD_TACTIC]);
    assert(s.tactics.learned.includes(RAGE_TACTIC));
    equip(s, RAGE_TACTIC, 1);
    applyCommand(s, { type: 'NIGHT' });
    validateState(s);
    assert.notEqual(s.night.extraSlots, s.tactics.extraSlots);
    s.night.extraSlots[0] = null;
    assert.throws(() => validateState(s), /本夜战技槽/);
    s.night.extraSlots[0] = RAGE_TACTIC;
    const values = new Map();
    const port = { read: key => values.get(key) ?? null, write: (key, value) => values.set(key, value) };
    const store = new SaveStore(port);
    store.inspect(); store.prepare(s); store.commit();
    const game = new GameSession(new SaveStore(port));
    game.load();
    assert.deepEqual(game.battle.tactics.map(t => t.id), [DEFAULT_TACTIC, RAGE_TACTIC, SHIELD_TACTIC]);
    assert.equal(game.battle.tacticUsesLeft, 3);
    game.newVillage();
    assert.deepEqual(game.state.tactics, { learned: [DEFAULT_TACTIC], equipped: DEFAULT_TACTIC });
});

test('casts share a nightly pool, cannot overlap and allow a ready skill on the first step after expiry', () => {
    const s = village(50);
    s.tactics = { learned: [DEFAULT_TACTIC, SHIELD_TACTIC, MIND_LOCK_TACTIC], equipped: SHIELD_TACTIC, extraSlots: [MIND_LOCK_TACTIC, DEFAULT_TACTIC] };
    applyCommand(s, { type: 'NIGHT' });
    const b = new BattleSimulation(s);
    b.base.wave.entries = [{ kind: 'enemy_raider', tick: 2000, appearanceSeed: 10 }];
    b.bell(SHIELD_TACTIC);
    assert(b.gateProtected);
    b.bell(MIND_LOCK_TACTIC);
    assert.equal(b.tacticUsesLeft, 2);
    while (b.bellTicks) b.step();
    assert.equal(b.cooldownFor(MIND_LOCK_TACTIC), 0);
    assert.equal(b.cooldownFor(SHIELD_TACTIC) * RULE.step, 14);
    assert(b.canCast(MIND_LOCK_TACTIC));
    b.bell(MIND_LOCK_TACTIC);
    assert(b.mindLocked);
    assert.equal(b.tacticUsesLeft, 1);
    while (b.bellTicks || b.cooldownFor(DEFAULT_TACTIC)) b.step();
    assert(!b.canCast(MIND_LOCK_TACTIC));
    b.bell(DEFAULT_TACTIC);
    while (b.bellTicks || b.cooldownFor(SHIELD_TACTIC)) b.step();
    assert(!b.canCast(SHIELD_TACTIC));
    assert.equal(b.tacticUsesLeft, 0);
    assert.equal(new BattleSimulation(s).tacticUsesLeft, 3);
});

test('six-second hold stops walk and progress for live and newly spawned enemies while tower shots still land', () => {
    const s = village(50);
    learn(s, MIND_LOCK_TACTIC, 0);
    applyCommand(s, { type: 'NIGHT' });
    const b = new BattleSimulation(s);
    const boss = { seq: 999, kind: 'enemy_chief', appearanceSeed: 1, progress: 160, walkDistance: 45, hp: 4000, maxHp: 4000,
        speed: 45, slow: 0, slowTicks: 0, born: -60, summoned: 0 };
    b.enemies = [boss];
    b.base.wave.entries = [{ kind: 'enemy_raider', tick: 20, appearanceSeed: 2 }];
    const duration = tacticDefinition(MIND_LOCK_TACTIC).ticks;
    b.bell();
    for (let i = 0; i < duration; i++) b.step();
    assert.equal(duration * RULE.step, 6);
    assert.deepEqual([boss.progress, boss.walkDistance], [160, 45]);
    assert(boss.hp < boss.maxHp, 'towers continued firing');
    assert(boss.summoned > 0, 'boss still summons while rooted');
    assert.equal(b.enemies.find(e => e.appearanceSeed === 2).progress, 0);
    assert(!b.mindLocked);
    b.step();
    assert(boss.progress > 160);
    assert(b.enemies.find(e => e.appearanceSeed === 2).progress > 0);
});
