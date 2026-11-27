const assert = require('node:assert/strict');
const { test } = require('node:test');
const read = file => require(`${process.env.DAIDAI_TEST_BUILD}/${file}.js`);
const { GameSession } = read('game/GameSession');
const { SaveStore } = read('storage/SaveStore');
const { createGame, applyCommand, economy, finishNight } = read('game/VillageRules');
const { sewingDayCap, sewingSlots, sewingYield, upgradeCost } = read('game/Growth');
const { SEWING } = read('config/RuleConfig');
const { VILLAGER_QUALITY } = read('config/VillagerQuality');
const { generateWave } = read('game/WaveGenerator');
const { validateState } = read('storage/StateValidation');

function openVillage(initial = createGame(42)) {
    let fail = false;
    const values = new Map();
    const port = { read: key => values.get(key) ?? null, write(key, value) {
        if (fail) throw new Error('模拟写入中断');
        values.set(key, value);
    } };
    const store = new SaveStore(port);
    store.inspect();
    store.prepare(initial, 'NORMAL', true);
    store.commit();
    const open = () => {
        const game = new GameSession(new SaveStore(port), () => '2026-11-27');
        game.load();
        return game;
    };
    return { open, failWrites: enabled => { fail = enabled; } };
}
function advance(game, ms) {
    for (let elapsed = 0; elapsed < ms; elapsed += 250) game.update(.25);
}

test('factory raises jobs and both types of output without replacing the current staff', () => {
    const s = createGame(5), p = s.people[0];
    const crew = s.people.filter(q => q.job === 'SEWING');
    assert.equal(crew.length, 6);
    assert.equal(sewingSlots(s.factory.level), 6);
    assert.equal(sewingYield(s, p, 'day'), 6);
    assert.equal(sewingYield(s, p, 'night'), 3);
    s.coins = 500;
    const price = upgradeCost('FACTORY', s.factory.level).coins;
    applyCommand(s, { type: 'BUILD', kind: 'FACTORY' });
    assert.equal(s.coins, 500 - price);
    assert.equal(sewingSlots(s.factory.level), 8);
    assert.equal(sewingYield(s, p, 'day'), 7);
    assert.equal(sewingYield(s, p, 'night'), 3);
    applyCommand(s, { type: 'BUILD', kind: 'FACTORY' });
    assert.equal(sewingYield(s, p, 'day'), 8);
    assert.equal(sewingYield(s, p, 'night'), 4);
    assert.deepEqual(s.people.filter(q => q.job === 'SEWING'), crew);
    const yields = Object.keys(VILLAGER_QUALITY).map(quality => sewingYield(s, { ...p, quality }, 'day'));
    assert.deepEqual(yields, [8, 9, 10, 11]);
    validateState(s);
});

test('a daytime batch credits once after a successful retry, shares the cap, and survives a reload', () => {
    const fixture = openVillage(), game = fixture.open(), cap = sewingDayCap(game.state);
    advance(game, SEWING.batchMs - 250);
    assert.equal(game.state.coins, 90);
    fixture.failWrites(true);
    advance(game, 250);
    assert(game.saves.pending);
    assert.equal(game.state.coins, 90);
    assert.deepEqual(game.takeSewingFeedback(), []);
    fixture.failWrites(false);
    game.retry();
    const shares = game.takeSewingFeedback();
    assert.equal(shares.length, 6);
    assert.equal(shares.reduce((sum, share) => sum + share.coins, 0), cap);
    assert.equal(game.state.coins, 90 + cap);
    assert.deepEqual(game.takeSewingFeedback(), []);
    advance(game, SEWING.batchMs * 3);
    assert.equal(game.state.coins, 90 + cap);
    assert.equal(fixture.open().state.factory.earned, cap);
});

test('partial foreground work resumes at the saved point and is frozen during battle', () => {
    const fixture = openVillage(), first = fixture.open();
    first.pause('CHOICE');
    advance(first, 5000);
    first.resume('CHOICE');
    first.hide();
    advance(first, 10_000);
    const reloaded = fixture.open();
    assert.equal(reloaded.sewingProgressMs, 5000);
    reloaded.command({ type: 'NIGHT' });
    reloaded.pause('CHOICE');
    reloaded.abandonNight();
    assert.equal(reloaded.state.phase, 'DAY');
    assert.equal(reloaded.sewingProgressMs, 5000);
    advance(reloaded, SEWING.batchMs - 5000);
    assert.equal(reloaded.state.factory.batches, 1);
});

test('victory chooses the locked payout and refreshes work; losses keep earnings and the cap', () => {
    const state = createGame(9);
    state.factory.earned = sewingDayCap(state);
    state.factory.batches = 1;
    const forecast = economy(state), initial = state.coins;
    assert.deepEqual(forecast, { base: 30, sewing: 14, boss: 0, total: 44 });
    applyCommand(state, { type: 'NIGHT' });
    assert.equal(state.coins, initial);
    assert.deepEqual(state.night.reward, forecast);
    const lost = structuredClone(state);
    finishNight(lost, 0, lost.towers.map(t => t.operator));
    assert.equal(lost.coins, initial);
    assert.equal(lost.factory.earned, sewingDayCap(lost));
    finishNight(state, 200, state.towers.map(t => t.operator));
    assert.equal(state.coins, initial + forecast.total);
    assert.deepEqual(state.factory, { level: 1, batches: 0, earned: 0, elapsedMs: 0 });
    validateState(state);
});

test('boss pay remains separate and the dice can only stake up to 80 base coins', () => {
    const state = createGame(11);
    state.day = 48; state.completed = 47; state.wave = generateWave(state);
    const normal = economy(state);
    assert(normal.boss > 0);
    state.rewardDie = 6;
    const doubled = economy(state);
    state.rewardDie = 1;
    const halved = economy(state);
    assert.equal(doubled.total - normal.total, 80);
    assert.equal(normal.total - halved.total, 40);
    assert.equal(doubled.sewing, halved.sewing);
    assert.equal(doubled.boss, halved.boss);
});
