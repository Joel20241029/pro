const { test } = require('node:test');
const assert = require('node:assert/strict');
const read = name => require(`${process.env.DAIDAI_TEST_BUILD}/${name}.js`);
const { DEFAULT_TACTIC, KING_MERCY_TACTIC, TACTIC_USE, tacticDefinition } = read('config/TacticConfig');
const { BattleSimulation } = read('game/BattleSimulation');
const { GameSession } = read('game/GameSession');
const { SaveStore } = read('storage/SaveStore');
const { applyCommand, createGame, finishNight } = read('game/VillageRules');
const { generateWave } = read('game/WaveGenerator');
const { gateCapacity } = read('game/Growth');
const { CombatPresentation } = read('view/CombatPresentation');

const enemy = (seq, kind) => ({
    seq, kind, progress: 180, hp: 10000, maxHp: 10000, speed: 0,
    appearanceSeed: seq, walkDistance: 0, slow: 0, slowTicks: 0, born: 0, summoned: 0
});

function preparedDay(completed = 50) {
    const s = createGame(173);
    s.completed = s.legacy.bestNight = completed;
    s.day = completed + 1;
    s.wood = s.food = 200;
    s.wave = generateWave(s);
    return s;
}

function fixture(wood = 81, food = 51, cooldown) {
    const s = preparedDay();
    applyCommand(s, { type: 'TACTIC_LEARN', id: KING_MERCY_TACTIC });
    if (cooldown) s.tactics.mercyCooldown = { ...cooldown };
    applyCommand(s, { type: 'NIGHT' });
    Object.assign(s, { wood, food, gate: 37 });
    const data = new Map();
    let fault = null, failReadBack = false, writes = 0;
    const port = {
        read(key) {
            if (failReadBack) { failReadBack = false; throw Error('核对中断'); }
            return data.get(key) ?? null;
        },
        write(key, value) {
            writes++;
            if (fault === 'before') { fault = null; throw Error('写入中断'); }
            data.set(key, value);
            if (fault === 'after') { fault = null; failReadBack = true; }
        }
    };
    const store = new SaveStore(port);
    store.inspect(); store.prepare(s); store.commit();
    const game = new GameSession(store);
    game.load();
    const b = game.battle;
    b.gate = 12; b.base.towers.forEach(t => t.operator = null);
    b.enemies = [enemy(70, 'enemy_armored'), enemy(71, 'enemy_commander')];
    return { game, b, port, writeFault: phase => { fault = phase; }, writes: () => writes };
}

test('mercy learns on wave fifty, while generic, cancelled and empty-inventory casts spend nothing', () => {
    const def = tacticDefinition(KING_MERCY_TACTIC);
    assert.deepEqual([def.name, def.unlockWaves, def.wood, def.food], ['大王的怜悯', 50, 200, 120]);
    assert.throws(() => applyCommand(preparedDay(49), { type: 'TACTIC_LEARN', id: def.id }), /还需守住 1 波/);
    for (const [wood, food, reason] of [[0, 5, '木材不足'], [5, 0, '粮食不足'], [0, 0, '粮食和木材不足']]) {
        const { game, b, writes } = fixture(wood, food);
        const before = writes();
        assert(game.canCast(def.id));
        game.bell(def.id);
        assert(!b.bell(def.id));
        game.confirmMercy();
        game.pause('CHOICE');
        game.update(.25);
        assert.equal(b.tick, 0);
        game.confirmMercy();
        assert.match(game.error, new RegExp(reason));
        game.resume('CHOICE');
        assert.equal(writes(), before);
        assert.equal(b.tacticUsesLeft, b.tacticBudget);
        assert.equal(b.enemies.length, 2);
        assert.equal(b.gate, 12);
    }
});

test('unsuccessful verification never applies combat effects, retry charges once and saves the same-night marker', () => {
    for (const fault of ['before', 'after']) {
        const { game, b, port, writeFault, writes } = fixture();
        const before = writes(), queued = b.pendingCount;
        game.pause('CHOICE');
        writeFault(fault);
        game.confirmMercy();
        assert(game.pauses.has('SAVE_PENDING'));
        assert.equal(b.enemies.length, 2);
        assert.equal(b.gate, 12);
        assert.deepEqual([game.state.wood, game.state.food], [81, 51]);
        assert.deepEqual(game.takeCombatFeedback(), []);
        game.confirmMercy();
        game.retry();
        assert.equal(writes(), before + (fault === 'after' ? 1 : 2));
        assert.equal(game.battle, b);
        assert.deepEqual([game.state.wood, game.state.food], [40, 25]);
        assert.equal(b.gate, gateCapacity(game.state));
        assert.equal(game.state.gate, b.gate);
        assert.equal(b.pendingCount, queued);
        assert.equal(b.enemies.length, 0);
        assert(!game.pauses.size);
        assert.equal(game.state.night.mercySpent, true);
        assert.deepEqual(game.state.tactics.mercyCooldown, { casts: 1, wavesLeft: 6 });
        assert.equal(b.tacticUsesLeft, b.tacticBudget - 1);
        assert.equal(b.cooldownFor(DEFAULT_TACTIC), TACTIC_USE.recoveryTicks);
        const events = game.takeCombatFeedback();
        assert.equal(events.length, 1);
        assert.equal(events[0].type, 'mercy');
        assert.deepEqual(events[0].hurt.map(e => [e.seq, e.hp]), [[70, 0], [71, 0]]);
        const cue = new CombatPresentation();
        cue.sync(b, events);
        assert.equal(cue.burstAge(71), 0);
        assert(cue.deathPose(71));
        assert.deepEqual(game.takeCombatFeedback(), []);

        const restored = new GameSession(new SaveStore(port));
        restored.load();
        assert.deepEqual([restored.state.wood, restored.state.food], [40, 25]);
        assert.equal(restored.battle.gate, b.gate);
        assert.equal(restored.battle.tacticUsesLeft, restored.battle.tacticBudget - 1);
        assert(!restored.canCast(KING_MERCY_TACTIC));
        restored.pause('CHOICE'); restored.confirmMercy();
        assert.deepEqual(restored.takeCombatFeedback(), []);
    }
});

test('six victories charge the first cooldown while unequipped, and the next cast requires seven waves', () => {
    const { game, b } = fixture(1, 1);
    b.base.wave.entries = [];
    game.pause('CHOICE'); game.confirmMercy();
    assert.deepEqual([game.state.wood, game.state.food], [0, 0]);
    game.update(.05);
    assert.equal(game.state.completed, 51);
    assert.equal(game.state.tactics.mercyCooldown.wavesLeft, 6);
    const next = game.state;
    const day = () => {
        next.choices = [];
        next.phase = 'DAWN';
        applyCommand(next, { type: 'FINALIZE' });
    };
    day();
    applyCommand(next, { type: 'TACTIC_EQUIP', id: DEFAULT_TACTIC });
    for (let i = 0; i < 6; i++) {
        applyCommand(next, { type: 'NIGHT' });
        finishNight(next, gateCapacity(next), next.towers.map(t => t.operator));
        day();
        assert.equal(next.tactics.mercyCooldown.wavesLeft, 5 - i);
    }
    applyCommand(next, { type: 'TACTIC_EQUIP', id: KING_MERCY_TACTIC });
    applyCommand(next, { type: 'NIGHT' });
    assert(new BattleSimulation(next).canCast(KING_MERCY_TACTIC));
    const retry = fixture(5, 7, next.tactics.mercyCooldown);
    retry.game.pause('CHOICE'); retry.game.confirmMercy();
    assert.deepEqual(retry.game.state.tactics.mercyCooldown, { casts: 2, wavesLeft: 7 });
});
