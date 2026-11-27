const { test, after } = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const compiled = process.env.DAIDAI_TEST_BUILD;
if (!compiled) throw new Error('Set DAIDAI_TEST_BUILD to the compiled project under Downloads');
const read = name => require(path.join(compiled, name + '.js'));
const { tacticCooldownTicks, TACTICS, DEFAULT_TACTIC, RAGE_TACTIC, SHIELD_TACTIC, SPLIT_TACTIC, SUMMON_TACTIC, MIND_LOCK_TACTIC, BLAST_TACTIC, ZHOU_LOVE_TACTIC, DRAGON_POISON_TACTIC, KING_MERCY_TACTIC, validateTactics, tacticDefinition } = read('config/TacticConfig');
const { RULE } = read('game/GameConfig');
const { createGame, applyCommand } = read('game/VillageRules');
const { clone } = read('game/GameState');
const { GameSession } = read('game/GameSession');
const { BattleSimulation, PATH_LENGTH } = read('game/BattleSimulation');
const { tacticUnavailableReason, canLearnTactic } = read('game/Tactics');
const { SaveStore } = read('storage/SaveStore');
const { validateState } = read('storage/StateValidation');

// 这些定义只存在 Node 测试进程，不属于正式技能目录或发布资源。
const production = TACTICS.slice();
const learnedId = 'TEST_TACTIC_PAID', lateId = 'TEST_TACTIC_LATE', expensiveId = 'TEST_TACTIC_EXPENSIVE';
TACTICS.push(...[
    { id: learnedId, unlockWaves: 3, coins: 50, order: 1 },
    { id: lateId, unlockWaves: 9, coins: 70, order: 2 },
    { id: expensiveId, unlockWaves: 3, coins: 211, order: 3 }
].map(value => ({ ...production[0], ...value, name: '仅测试使用' })));
after(() => TACTICS.splice(0, TACTICS.length, ...production));

function state(waves = 3) {
    const s = createGame(12345); s.completed = waves; s.day = waves + 1;
    s.legacy.bestNight = waves; s.coins = 110; return s;
}
function fixture(s = state()) {
    const values = new Map(), writes = [];
    const port = {
        failure: null,
        read(key) { return values.get(key) ?? null; },
        write(key, raw) {
            if (port.failure === 'before') throw new Error('test before write');
            values.set(key, raw); writes.push(raw);
            if (port.failure === 'after') throw new Error('test after write');
        }
    };
    const saves = new SaveStore(port); saves.inspect(); saves.prepare(s); saves.commit(); writes.length = 0;
    const reopen = () => { const game = new GameSession(new SaveStore(port)); game.load(); return game; };
    return { game: reopen(), reopen, port, values, writes };
}

test('production includes the summon while preserving the free heart combat parameters', () => {
    assert.deepEqual(production.map(t => t.id), [DEFAULT_TACTIC, SHIELD_TACTIC, RAGE_TACTIC, SPLIT_TACTIC, BLAST_TACTIC, MIND_LOCK_TACTIC, "MINGBO_HAND_SPEED", SUMMON_TACTIC, ZHOU_LOVE_TACTIC, DRAGON_POISON_TACTIC, KING_MERCY_TACTIC]);
    const t = production[0];
    assert.equal(t.coins + t.unlockWaves, 0);
    assert.equal(t.ticks, RULE.bellTicks); assert.equal(t.multiplier, RULE.bellSpeedMultiplier);
    assert.equal(t.ticks * RULE.step, 18); assert.equal(t.multiplier, 1.5);
});

test('new village has a valid equipped tactic and config rejects unknown or duplicate definitions', () => {
    assert.deepEqual(createGame(1).tactics, { learned: [DEFAULT_TACTIC], equipped: DEFAULT_TACTIC });
    assert.doesNotThrow(() => validateTactics());
    assert.throws(() => tacticDefinition('NO_SUCH_TACTIC'));
    assert.throws(() => validateTactics([production[0], production[0]]));
    for (const patch of [{ coins: -1 }, { unlockWaves: 1.2 }, { ticks: 0 }, { effect: 'UNKNOWN' }, { multiplier: NaN }, { icon: 'missing_tactic_icon' }, { id: 3 }])
        assert.throws(() => validateTactics([{ ...production[0], ...patch }]));
    assert.throws(() => validateTactics([]));
});

test('learning uses this village completed waves rather than best record; rejections do not mutate', () => {
    const s = state(2); s.legacy.bestNight = 200;
    const before = clone(s);
    assert.match(tacticUnavailableReason(s, learnedId, 'LEARN'), /还需守住 1 波/);
    assert.throws(() => applyCommand(s, { type: 'TACTIC_LEARN', id: learnedId }));
    assert.deepEqual(s, before);
});

test('coin shortages are precise and pure, and an affordable tactic has no storage prerequisite', () => {
    const s = state();
    for (const [coins, reason] of [[0, '还缺 50 尔币'], [48, '还缺 2 尔币'], [49, '还缺 1 尔币'], [50, null]]) {
        s.coins = coins; const before = clone(s);
        assert.equal(tacticUnavailableReason(s, learnedId, 'LEARN'), reason);
        assert.equal(canLearnTactic(s), reason === null); assert.deepEqual(s, before);
    }
    assert.equal(tacticUnavailableReason(s, expensiveId, 'LEARN'), '还缺 161 尔币');
    applyCommand(s, { type: 'TACTIC_LEARN', id: learnedId });
    assert.equal(s.coins, 0);
    assert.equal(s.tactics.equipped, learnedId); assert.equal(canLearnTactic(s), false);
    s.coins = 211;
    applyCommand(s, { type: 'TACTIC_LEARN', id: expensiveId });
    assert.equal(s.coins, 0); assert.equal(s.tactics.equipped, expensiveId);
});

test('learn, equip and save are a single transaction; duplicate clicks never charge twice', () => {
    const { game, reopen, writes } = fixture();
    game.command({ type: 'TACTIC_LEARN', id: learnedId });
    assert.equal(writes.length, 1); assert.equal(game.state.coins, 60);
    assert.equal(game.state.tactics.equipped, learnedId); assert.deepEqual(reopen().state, game.state);
    game.command({ type: 'TACTIC_LEARN', id: learnedId });
    assert.match(game.error, /重复/); assert.equal(writes.length, 1); assert.equal(game.state.coins, 60);
    game.command({ type: 'TACTIC_EQUIP', id: DEFAULT_TACTIC });
    assert.equal(game.state.coins, 60); assert.equal(writes.length, 2);
});

for (const failure of ['before', 'after']) test(`failed save ${failure} write retries exactly the original purchase`, () => {
    const f = fixture(), old = f.game.state;
    f.port.failure = failure; f.game.command({ type: 'TACTIC_LEARN', id: learnedId });
    assert.equal(f.game.state, old); assert(f.game.pauses.has('SAVE_PENDING'));
    const pending = f.game.saves.pending; assert(pending);
    assert.equal(pending.state.coins, 60);
    f.game.command({ type: 'TACTIC_LEARN', id: learnedId }); f.game.command({ type: 'TACTIC_EQUIP', id: DEFAULT_TACTIC });
    assert.equal(f.game.saves.pending, pending);
    f.port.failure = null; f.game.retry();
    assert.equal(f.writes.length, 1); assert.equal(f.writes[0], pending.raw);
    assert.equal(f.game.state, pending.state); assert.equal(f.game.saves.pending, null);
    assert.deepEqual(f.reopen().state, f.game.state);
    assert.deepEqual(f.game.state.tactics.learned, [DEFAULT_TACTIC, learnedId]);
});

test('unlearned equip is rejected and learned equip does not recheck former wave requirement', () => {
    const s = state(0);
    assert.throws(() => applyCommand(s, { type: 'TACTIC_EQUIP', id: learnedId }), /先学习/);
    s.tactics.learned.push(learnedId); const coins = s.coins;
    applyCommand(s, { type: 'TACTIC_EQUIP', id: learnedId });
    assert.equal(s.tactics.equipped, learnedId); assert.equal(s.coins, coins);
});

test('night snapshots equipment and forbids changing or learning even while paused', () => {
    const f = fixture(); f.game.command({ type: 'TACTIC_LEARN', id: learnedId }); f.game.command({ type: 'NIGHT' });
    assert.equal(f.game.state.night.tactic, learnedId); assert.equal(f.game.battle.tactic.id, learnedId);
    f.game.pause('USER'); const before = clone(f.game.state);
    for (const cmd of [{ type: 'TACTIC_EQUIP', id: DEFAULT_TACTIC }, { type: 'TACTIC_LEARN', id: lateId }]) {
        f.game.command(cmd); assert(f.game.error); assert.deepEqual(f.game.state, before);
    }
    assert.equal(canLearnTactic(f.game.state), false);
});

test('heart still casts with no visible enemies, and pause or reassign keep its independent clock', () => {
    const f = fixture(); f.game.command({ type: 'NIGHT' });
    const battle = f.game.battle; assert.equal(battle.enemies.length, 0); assert(f.game.canRingBell);
    f.game.bell(); assert.equal(battle.bellTicks, RULE.bellTicks);
    f.game.pause('CHOICE'); f.game.update(.1); assert.equal(battle.bellTicks, RULE.bellTicks);
    assert(f.game.reassign(0, f.game.state.people[2].id));
    f.game.resume('CHOICE');
    assert.equal(f.game.battle, battle); f.game.update(.1);
    assert.equal(battle.bellTicks, RULE.bellTicks - 6); assert.equal(f.game.canRingBell, false);
    f.game.bell(); assert.equal(battle.bellTicks, RULE.bellTicks - 6);
    const reopened = f.reopen(); assert.equal(reopened.battle.tick, 0);
    assert.equal(reopened.battle.usesLeftFor(battle.tactic), null); assert.equal(reopened.battle.tacticCooldownTicks, 0);
    assert.equal(reopened.battle.tactic.id, battle.tactic.id);
});

test('all five timed cooldown-only tactics can activate three times at their own exact boundaries', () => {
    const timed = production.filter(t => t.usesPerNight === undefined && t.effect !== 'HAND_SPEED');
    assert.equal(timed.length, 5);
    for (const tactic of timed) {
        const s = state(tactic.unlockWaves); s.tactics.learned = [...new Set([DEFAULT_TACTIC, tactic.id])];
        s.tactics.equipped = tactic.id; s.wave.entries = [{...s.wave.entries[0], tick: 4500}];
        applyCommand(s, { type: 'NIGHT' });
        const b = new BattleSimulation(s);
        b.bell(); assert.equal(b.bellTicks, tactic.ticks);
        while (b.tick < tacticCooldownTicks(tactic) - 1) b.step();
        assert(!b.canCastTactic);
        b.step();
        assert.equal(b.bellTicks, 0); assert.equal(b.canCastTactic, true);
        b.bell(); assert.equal(b.bellTicks, tactic.ticks); assert.equal(b.canCastTactic, false);
        const gate = b.gate;
        if (tactic.effect === 'GATE_INVULNERABLE') {
            b.enemies = [{seq: 0, kind: 'enemy_raider', appearanceSeed: 87, progress: PATH_LENGTH - .01, hp: 100,
                speed: 1, slow: 0, slowTicks: 0, walkDistance: 0, born: 0, summoned: 0}];
            b.step(); assert.equal(b.gate, gate); assert(b.feedback.some(e => e.type === 'gate' && e.blocked));
        }
        while (b.tacticCooldownTicks) b.step();
        assert(b.bell()); assert.equal(b.usesLeftFor(tactic), null);
    }
});

test('ongoing battle owns a copy of its tactic config', () => {
    const s = state(); applyCommand(s, { type: 'NIGHT' });
    const battle = new BattleSimulation(s), original = production[0].ticks;
    try { production[0].ticks = original + 100; battle.bell(); assert.equal(battle.bellTicks, original); }
    finally { production[0].ticks = original; }
});

test('a new village starts with the heart and clears the local record and learned tactics', () => {
    const f = fixture(); f.game.command({ type: 'TACTIC_LEARN', id: learnedId }); f.game.state.legacy.bestNight = 8;
    f.game.newVillage();
    assert.deepEqual(f.game.state.tactics, { learned: [DEFAULT_TACTIC], equipped: DEFAULT_TACTIC });
    assert.equal(f.game.state.completed, 0);
    assert.equal(f.game.state.legacy.bestNight, 0);
    assert.deepEqual(f.reopen().state, f.game.state);
});

test('save validation refuses unknown IDs, missing initial, duplicates and mismatched night snapshot', () => {
    for (const tactics of [null, { learned: [], equipped: DEFAULT_TACTIC },
        { learned: [DEFAULT_TACTIC, DEFAULT_TACTIC], equipped: DEFAULT_TACTIC },
        { learned: [DEFAULT_TACTIC], equipped: learnedId },
        { learned: [DEFAULT_TACTIC, 'UNKNOWN'], equipped: DEFAULT_TACTIC }]) {
        const s = state(); s.tactics = tactics; assert.throws(() => validateState(s));
    }
    const s = state(); applyCommand(s, { type: 'NIGHT' }); s.night.tactic = learnedId;
    assert.throws(() => validateState(s), /战技快照/);
});

test('committed learning stays on the same tactics page with expanded card and scroll intact', () => {
    // 绘图函数以记录器替换，测试真实 GamePanels 生命周期，不需要伪造 Canvas 的像素行为。
    global.Laya = { Sprite: class {}, Text: class {}, Texture2D: class {}, OpenDataContextView: class {} };
    const tacticPanels = read('view/panels/TacticPanels'), buildingPanels = read('view/panels/WavePanel');
    const originalTactic = tacticPanels.drawTacticPanel, originalBuilding = buildingPanels.drawWavePanel;
    const { GamePanels } = read('view/GamePanels'); const drawn = [];
    tacticPanels.drawTacticPanel = (_ctx, _s, p) => drawn.push(p);
    buildingPanels.drawWavePanel = (_ctx, _s, p) => drawn.push(p);
    try {
        for (const fromStart of [false, true]) {
            const f = fixture(), start = { type: 'start' }, order = [DEFAULT_TACTIC, learnedId];
            const list = { type: 'tactics', index: 0, preview: learnedId, rowOrder: order, scroll: 84, ...(fromStart ? { back: start } : {}) };
            const render = () => { if (panels.current) panels.draw(f.game.state, panels.current); };
            const panels = new GamePanels(f.game, {}, {}, {}, {}, {}, render, { ready: () => true, ensure() {} });
            f.game.changed = render; panels.open(list, true);
            list.pendingTactic = {id: learnedId, slot: 0}; f.port.failure = 'before';
            panels.send({ type: 'TACTIC_LEARN', id: learnedId });
            assert.equal(panels.current, list); assert.deepEqual(list.pendingTactic, {id: learnedId, slot: 0});
            f.port.failure = null; f.game.retry();
            assert.equal(panels.current, list);
            assert.equal(list.pendingTactic, undefined); assert.equal(list.preview, learnedId);
            assert.equal(list.back, fromStart ? start : undefined);
            assert.equal(list.rowOrder, order); assert.equal(list.scroll, 84);
            assert(f.game.pauses.has('CHOICE')); assert.equal(f.writes.filter(raw => JSON.parse(raw).payload).length, 1);
            if (fromStart) {
                panels.open(list.back, true);
                assert.equal(panels.current, start); assert.equal(drawn.at(-1), start);
            }
            f.game.pause('USER'); panels.close();
            assert(!f.game.pauses.has('CHOICE')); assert(f.game.pauses.has('USER'));
        }
    } finally { tacticPanels.drawTacticPanel = originalTactic; buildingPanels.drawWavePanel = originalBuilding; }
});
