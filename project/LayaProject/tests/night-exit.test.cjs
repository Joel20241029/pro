const assert = require('node:assert/strict');
const { test } = require('node:test');
const read = name => require(`${process.env.DAIDAI_TEST_BUILD}/${name}.js`);
const { GameSession } = read('game/GameSession');
const { SaveStore } = read('storage/SaveStore');
const { createGame, applyCommand } = read('game/VillageRules');
const { clone } = read('game/GameState');
const { generateWave } = read('game/WaveGenerator');
const { KING_MERCY_TACTIC } = read('config/TacticConfig');

const date = '2026-11-25';
function village(completed = 6) {
    const s = createGame(42);
    s.completed = s.legacy.bestNight = completed;
    s.day = completed + 1;
    s.wave = generateWave(s);
    s.coins = 199;
    s.gate = 150;
    s.dailyTasks = { date, tasks: [{ kind: 'sewCoins', goal: 8, progress: 0, reward: 'gate_kit', claimed: false }] };
    return s;
}

function session(state) {
    const values = new Map();
    let fail = false;
    const port = {
        read: key => values.get(key) ?? null,
        write(key, value) {
            if (fail) throw new Error('写入中断');
            values.set(key, value);
        }
    };
    const store = new SaveStore(port);
    store.inspect();
    store.prepare(state, 'NORMAL', true);
    store.commit();
    const open = () => {
        const game = new GameSession(new SaveStore(port), () => date);
        game.load();
        return game;
    };
    return { game: open(), open, failWrites: value => { fail = value; } };
}

test('exiting after a cold read preserves wallet and tasks and keeps the same wave', () => {
    const f = session(village()), game = f.game;
    const before = clone(game.state);
    game.command({ type: 'NIGHT' });
    assert.equal(game.state.coins, before.coins);
    assert(game.state.night.reward.total > 0);
    assert.equal(game.state.dailyTasks.tasks[0].progress, 0);
    const restored = f.open();
    const battle = restored.battle;
    restored.abandonNight();
    assert.equal(restored.battle, battle);
    restored.pause('USER');
    restored.pause('CHOICE');
    restored.resume('CHOICE');
    assert(restored.pauses.has('USER') && restored.battle === battle);
    restored.resume('USER');
    restored.update(.2);
    assert(battle.tick > 0);
    restored.pause('CHOICE');
    restored.abandonNight();
    assert.deepEqual(restored.state, before);
    assert.deepEqual(f.open().state, before);
    assert.equal(restored.presentationBattle, null);
    assert.deepEqual(restored.takeCombatFeedback(), []);
    assert.equal(restored.pauses.size, 0);
    restored.command({ type: 'NIGHT' });
    assert.deepEqual(restored.battle.base.wave, battle.base.wave);
});

test('abandoning restores mercy and prepared items while retaining separately granted daily gifts', () => {
    const s = village(50);
    s.tactics.learned.push(KING_MERCY_TACTIC);
    s.tactics.equipped = KING_MERCY_TACTIC;
    s.tactics.mercyCooldown = { casts: 2, wavesLeft: 0 };
    s.patrol.rationReady = s.patrol.radiusReady = true;
    const { game } = session(s);
    game.command({ type: 'NIGHT' });
    game.command({ type: 'DAILY_RATION', date });
    assert.equal(game.villageItems.backpack().items.gate_kit, 1);
    assert.equal(game.state.coins, s.coins);
    game.pause('CHOICE');
    game.confirmMercy();
    assert.equal(game.state.night.mercySpent, true);
    assert.equal(game.state.tactics.mercyCooldown.casts, 3);
    game.pause('CHOICE');
    game.abandonNight();
    assert.equal(game.state.coins, s.coins);
    assert.equal(game.villageItems.backpack().items.gate_kit, 1);
    assert.equal(game.state.gate, s.gate);
    assert.equal(game.state.legacy.lastRationDate, date);
    assert.deepEqual(game.state.tactics.mercyCooldown, s.tactics.mercyCooldown);
    assert.equal(game.state.patrol.rationReady, true);
    assert.equal(game.state.patrol.radiusReady, true);
});

test('failed exit freezes the night and commits the same day on retry', () => {
    const { game, open, failWrites } = session(village());
    const before = clone(game.state);
    game.command({ type: 'NIGHT' });
    const battle = game.battle;
    game.pause('CHOICE');
    failWrites(true);
    game.abandonNight();
    const pending = game.saves.pending;
    assert(pending && game.pauses.has('SAVE_PENDING'));
    assert.equal(game.state.phase, 'NIGHT');
    assert.equal(game.battle, battle);
    game.abandonNight();
    assert.equal(game.saves.pending, pending);
    failWrites(false);
    game.retry();
    assert.deepEqual(game.state, before);
    assert.deepEqual(open().state, before);
    assert.equal(game.pauses.size, 0);
});

test('a cold-replayed coin night requires and retains an exact withdrawal snapshot', () => {
    const seed = village(), { game, open } = session(seed);
    game.command({ type: 'NIGHT' });
    const next = clone(game.state);
    delete next.night.returnPoint;
    assert.throws(() => read('storage/StateValidation').validateState(next));
    const restored = open();
    restored.pause('CHOICE'); restored.abandonNight();
    assert.equal(restored.state.phase, 'DAY');
    assert.equal(restored.state.coins, seed.coins);
});
