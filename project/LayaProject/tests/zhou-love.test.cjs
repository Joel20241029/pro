const { test } = require('node:test');
const assert = require('node:assert/strict');
const read = name => require(`${process.env.DAIDAI_TEST_BUILD}/${name}.js`);
const { ZHOU_LOVE_TACTIC, ZHOU_LOVE_SPAWN_HEALTH_PERCENT, DEFAULT_TACTIC, tacticDefinition } = read('config/TacticConfig');
const { RULE } = read('config/RuleConfig');
const { createGame, applyCommand } = read('game/VillageRules');
const { generateWave } = read('game/WaveGenerator');
const { BattleSimulation } = read('game/BattleSimulation');
const { GameSession } = read('game/GameSession');
const { SaveStore } = read('storage/SaveStore');
const { CombatPresentation } = read('view/CombatPresentation');

function village() {
    const s = createGame(13);
    s.completed = 40; s.day = 41; s.legacy.bestNight = 40;
    s.coins = 225; s.wave = generateWave(s);
    s.tactics.extraSlots = [null];
    applyCommand(s, { type: 'TACTIC_LEARN', id: ZHOU_LOVE_TACTIC, slot: 1 });
    return s;
}

const enemy = (seq, kind, hp, maxHp) => ({ seq, kind, hp, maxHp, progress: 130, speed: 0,
    appearanceSeed: seq, walkDistance: 0, slow: .25, slowTicks: 5, born: 0, summoned: 0 });

function prepare(b) {
    b.base.towers.forEach(t => t.operator = null);
    b.base.wave.entries = [{ tick: 12, kind: 'enemy_raider', appearanceSeed: 3 }];
    b.enemies = [enemy(200, 'enemy_armored', 123, 1001), enemy(201, 'enemy_commander', 3900, 4000),
        enemy(202, 'enemy_boar', 140, 140), enemy(203, 'enemy_runner', 0, 120)];
    return b;
}

function battle() {
    const s = village();
    applyCommand(s, { type: 'NIGHT' });
    return prepare(new BattleSimulation(s));
}

test('Zhou Bo learns at wave 40, costs 205 coins and has four couplets of lore', () => {
    const s = village(), t = tacticDefinition(ZHOU_LOVE_TACTIC);
    assert.deepEqual([t.name, t.unlockWaves, t.ticks, t.usesPerNight, t.coins], ['周博的爱', 40, 0, 1, 205]);
    const couplets = t.lore.split('\n');
    assert.equal(couplets.length, 4);
    assert(couplets.every(line => /^[^，。]{7}，[^，。]{7}。$/.test(line)));
    assert.match(couplets[0], /为情所困/);
    assert.match(t.summary, /女村民更多：清场/);
    assert.deepEqual([s.coins, s.tactics.extraSlots[0]], [20, ZHOU_LOVE_TACTIC]);
    const early = createGame(13); early.completed = 39; early.day = 40; early.coins = 225;
    assert.throws(() => applyCommand(early, { type: 'TACTIC_LEARN', id: ZHOU_LOVE_TACTIC }), /还需守住 1 波/);
});

test('female-majority immediately defeats living enemies and bosses; elders and elites count while children and history do not', () => {
    const b = battle();
    const male = b.base.people.find(p => p.sex === 'MALE');
    Object.assign(male, { sex: 'FEMALE', nights: 0, elderNights: 3, quality:"ELITE" });
    b.base.people.push(...['child1', 'child2'].map(id => ({ ...male, id, sex: 'MALE', adult: false, elderNights: 0 })));
    b.base.history.push({ ...male, id: 'historical1', sex: 'MALE' }, { ...male, id: 'historical2', sex: 'MALE' });
    assert(b.bell(ZHOU_LOVE_TACTIC));
    assert.equal(b.enemies.length, 0);
    assert.equal(b.pendingCount, 1);
    assert.equal(b.outcome, null);
    const event = b.feedback.at(-1);
    assert.equal(event.cleared, true);
    assert.deepEqual(event.targets.map(e => [e.seq, e.hp]), [[200, 0], [201, 0], [202, 0]]);
    assert.equal(b.usesLeftFor(tacticDefinition(ZHOU_LOVE_TACTIC)), 0);
    assert.equal(b.cooldownFor(DEFAULT_TACTIC), 0);
    for (let i = 0; i <= 12; i++) b.step();
    assert.equal(b.enemies.length, 1);
    assert.notEqual(b.enemies[0].seq, 200);
    const [newcomer] = b.enemies;
    assert.equal(newcomer.hp, Math.floor(newcomer.maxHp * 65 / 100));
    assert(!b.bell(ZHOU_LOVE_TACTIC));
});

test('a successful clear also weakens a later boss and its summoned enemies, without changing maximum HP', () => {
    const b = battle(), control = battle();
    b.base.people.find(p => p.sex === 'MALE').sex = 'FEMALE';
    for (const current of [b, control]) {
        current.base.wave.entries = [{ tick: 1, kind: 'enemy_chief', appearanceSeed: 3 }];
        current.enemies = [];
        current.patrol = null;
        current.hero = null;
    }
    assert(b.bell(ZHOU_LOVE_TACTIC));
    for (let i = 0; i <= RULE.summonTicks[0] + 1; i++) {
        b.step();
        control.step();
    }
    assert.deepEqual(b.enemies.map(e => e.kind), ['enemy_chief', 'enemy_raider', 'enemy_raider']);
    assert.deepEqual(b.enemies.map(e => e.maxHp), control.enemies.map(e => e.maxHp));
    for (const e of b.enemies) assert.equal(e.hp, Math.floor(e.maxHp * ZHOU_LOVE_SPAWN_HEALTH_PERCENT / 100));
});

test('male-majority and parity cast without restrictions, heal 25% capped, and mark every living target', () => {
    for (const maleMajority of [false, true]) {
        const b = battle();
        if (maleMajority) b.base.people.find(p => p.sex === 'FEMALE').sex = 'MALE';
        assert(b.canCast(ZHOU_LOVE_TACTIC));
        assert(b.bell(ZHOU_LOVE_TACTIC));
        assert.deepEqual(b.enemies.map(e => e.hp), [373, 4000, 140, 0]);
        assert.deepEqual(b.enemies[0].slowTicks, 5);
        assert.equal(b.feedback.at(-1).cleared, false);
        assert.deepEqual(b.feedback.at(-1).targets.map(e => e.seq), [200, 201, 202]);
        const f = new CombatPresentation();
        f.sync(b, b.feedback);
        assert.deepEqual(f.zhouLoveCue(202), { cleared: false, age: 0 });
        assert.equal(f.zhouLoveCue(203), undefined);
        f.advance(1);
        assert.equal(f.zhouLoveCue(202), undefined);
        for (let i = 0; i <= 12; i++) b.step();
        const newcomer = b.enemies.find(e => e.seq < 200);
        assert(newcomer && newcomer.hp === newcomer.maxHp);
    }
});

test('session forwards instant effects once, then settles and persists a last-enemy win through the normal path', () => {
    const values = new Map(), port = { read: k => values.get(k) ?? null, write: (k,v) => values.set(k,v) };
    const store = new SaveStore(port); store.inspect(); store.prepare(village()); store.commit();
    const game = new GameSession(store); game.load();
    game.command({ type: 'NIGHT' });
    const b = prepare(game.battle);
    b.base.people.find(p => p.sex === 'MALE').sex = 'FEMALE';
    b.base.wave.entries = [];
    game.pause('USER'); game.bell(ZHOU_LOVE_TACTIC); assert.equal(b.usesLeftFor(tacticDefinition(ZHOU_LOVE_TACTIC)), 1);
    game.resume('USER'); game.bell(ZHOU_LOVE_TACTIC);
    const events = game.takeCombatFeedback();
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'zhouLove');
    const f = new CombatPresentation();
    f.sync(b, events);
    assert.equal(f.deaths.size, 3);
    assert.deepEqual(f.zhouLoveCue(201), { cleared: true, age: 0 });
    f.advance(.3); assert.equal(f.zhouLoveCue(201), undefined); assert(f.deaths.has(201));
    game.update(RULE.step);
    assert.equal(game.state.completed, 41);
    assert.equal(game.presentationBattle, b);
    assert(!game.takeCombatFeedback().some(e => e.type === 'zhouLove'));
    const reopened = new GameSession(new SaveStore(port)); reopened.load();
    assert.equal(reopened.state.completed, 41);
    assert.equal(reopened.state.tactics.extraSlots[0], ZHOU_LOVE_TACTIC);
});
