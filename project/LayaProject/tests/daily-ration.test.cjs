const { test } = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const compiled = process.env.DAIDAI_TEST_BUILD;
if (!compiled) throw new Error('Set DAIDAI_TEST_BUILD to the compiled project under Downloads');
const { RULE } = require(path.join(compiled, 'game/GameConfig.js'));
const { createGame, applyCommand, finishNight } = require(path.join(compiled, 'game/VillageRules.js'));
const { DAILY_GIFT_ITEM, dailyGiftAvailable, localGiftDate, validGiftDate } = require(path.join(compiled, 'game/DailyRation.js'));
const { GameSession } = require(path.join(compiled, 'game/GameSession.js'));
const { SaveStore, canonical } = require(path.join(compiled, 'storage/SaveStore.js'));
const { validateState } = require(path.join(compiled, 'storage/StateValidation.js'));

const giftCount = game => game.villageItems.backpack().items[DAILY_GIFT_ITEM] ?? 0;

function fixture(state = createGame(7)) {
    const values = new Map(); let day = '2026-11-11', failure = null, failRead = false, writes = 0;
    const port = {
        read(k) { if (failRead) { failRead = false; throw new Error('read-back failed'); } return values.get(k) ?? null; },
        write(k, v) {
            if (failure === 'before-write') { failure = null; throw new Error('write failed'); }
            values.set(k, v); writes++;
            if (failure === 'after-write') { failure = null; throw new Error('write result uncertain'); }
            if (failure === 'read-back') { failure = null; failRead = true; }
        },
        remove(k) { values.delete(k); }
    };
    const store = new SaveStore(port); store.inspect();
    if (state) { store.prepare(state); store.commit(); }
    const game = new GameSession(store, () => day); game.load();
    return { game, port, values, day: v => day = v, fail: v => failure = v, writes: () => writes };
}

test('calendar keys follow local midnight, validate leap days and never accept normalized invalid dates', () => {
    assert.equal(localGiftDate(new Date(2026, 10, 11, 23, 59)), '2026-11-11');
    assert.equal(localGiftDate(new Date(2026, 10, 12, 0, 0)), '2026-11-12');
    assert(validGiftDate('2028-02-29'));
    for (const value of ['2026-02-29', '2026-11-31', '2026-13-01', '2026-1-01', '0000-01-01', '', undefined]) assert(!validGiftDate(value));
});

test('gift date updates atomically without changing coins or RNG', () => {
    const s = createGame(7);
    const before = canonical(s);
    assert.equal(dailyGiftAvailable(s, '2026-11-11'), true);
    applyCommand(s, { type: 'DAILY_RATION', date: '2026-11-11' });
    assert.equal(s.legacy.lastRationDate, '2026-11-11');
    assert.equal(canonical({ ...s, legacy: { ...s.legacy, lastRationDate: null } }), before);
    assert.equal(dailyGiftAvailable(s, '2026-11-11'), false);
    validateState(s);
});

test('same-village date and clock rollback cannot grant another reward; a new village can claim today', () => {
    const s = createGame(1); applyCommand(s, { type: 'DAILY_RATION', date: '2026-11-11' });
    for (const date of ['2026-11-11', '2026-11-10', 'bad']) {
        const before = canonical(s); assert.throws(() => applyCommand(s, { type: 'DAILY_RATION', date })); assert.equal(canonical(s), before);
    }
    const next = createGame(2, s.legacy); assert.equal(next.legacy.lastRationDate, null);
    assert.equal(dailyGiftAvailable(next, '2026-11-11'), true);
    applyCommand(next, { type: 'DAILY_RATION', date: '2026-11-11' }); assert.equal(next.coins, RULE.initialCoins);
    assert.equal(dailyGiftAvailable(next, '2026-11-11'), false);
});

test('no village gets no reward; first successfully saved new village opens one offer', () => {
    const { game } = fixture(null); game.enter(); assert.equal(game.dailyRationDate, null); assert(!game.pauses.has('DAILY_RATION'));
    game.newVillage(); assert.equal(game.dailyRationDate, '2026-11-11'); assert(game.pauses.has('DAILY_RATION'));
    assert.equal(game.state.coins, RULE.initialCoins); assert.equal(giftCount(game), 0); game.claimDailyRation();
    assert.equal(giftCount(game), 1); assert.equal(game.dailyRationDate, null);
});

test('confirmation is required, duplicate clicks do not save twice, reload remembers the claim', () => {
    const f = fixture(); f.game.enter(); const before = canonical([...f.values]);
    f.game.update(100); assert.equal(canonical([...f.values]), before); assert.equal(f.game.state.legacy.lastRationDate, null);
    f.game.claimDailyRation(); const saved = canonical([...f.values]), writes = f.writes();
    f.game.claimDailyRation(); assert.equal(f.writes(), writes); assert.equal(canonical([...f.values]), saved);
    const again = new GameSession(new SaveStore(f.port), () => '2026-11-11'); again.load(); again.enter();
    assert.equal(again.dailyRationDate, null); assert.equal(giftCount(again), 1);
});

for (const failure of ['before-write', 'after-write', 'read-back']) test(`save ${failure}: retry accepts the same item/date candidate once and only then resumes`, () => {
    const f = fixture(); f.game.show(); f.fail(failure); f.game.claimDailyRation();
    assert(f.game.saves.pending); assert(f.game.pauses.has('SAVE_PENDING')); assert(f.game.pauses.has('DAILY_RATION')); assert(f.game.pauses.has('WAIT_RESUME'));
    assert.equal(f.game.state.coins, RULE.initialCoins); assert.equal(giftCount(f.game), 0); assert.equal(f.game.state.legacy.lastRationDate, null);
    const pending = f.game.saves.pending; f.game.claimDailyRation(); assert.equal(f.game.saves.pending, pending);
    f.game.retry(); assert.equal(f.game.saves.pending, null); assert.equal(f.game.dailyRationDate, null);
    assert.equal(giftCount(f.game), 1); assert.equal(f.game.state.legacy.lastRationDate, '2026-11-11');
    assert(!f.game.pauses.has('DAILY_RATION')); assert(!f.game.pauses.has('WAIT_RESUME')); assert(!f.game.pauses.has('SAVE_PENDING'));
    f.game.claimDailyRation(); assert.equal(giftCount(f.game), 1);
});

test('uncertain write followed by process restart loads the claimed state without another gift', () => {
    const f = fixture(); f.game.enter(); f.fail('after-write'); f.game.claimDailyRation();
    const next = new GameSession(new SaveStore(f.port), () => '2026-11-11'); next.load(); next.enter();
    assert.equal(giftCount(next), 1); assert.equal(next.dailyRationDate, null);
});

test('natural date change is checked at entry; a running village is not interrupted at midnight', () => {
    const f = fixture(); f.game.enter(); f.game.claimDailyRation(); f.day('2026-11-12');
    f.game.command({ type: 'MUSIC', enabled: false }); f.game.update(5); assert.equal(f.game.dailyRationDate, null);
    f.game.hide(); f.game.show(); assert.equal(f.game.dailyRationDate, '2026-11-12');
    f.game.claimDailyRation(); assert.equal(giftCount(f.game), 2); assert(!f.game.pauses.has('WAIT_RESUME'));
    f.game.hide(); f.game.show(); assert.equal(f.game.dailyRationDate, null); assert(f.game.pauses.has('WAIT_RESUME'));
});

test('night claim preserves exact live battle, charge and bell; unrelated pauses survive', () => {
    const s = createGame(7); s.coins = 0; s.people.forEach(p => p.job = 'WAITING');
    const f = fixture(s), game = f.game; game.command({ type: 'NIGHT' }); game.bell(); game.update(.1);
    const b = game.battle, live = JSON.stringify({ tick: b.tick, bell: b.bellTicks, charge: b.charge, shots: b.shots, base: b.base });
    game.pause('USER'); game.pause('CHOICE'); game.show(); game.update(3);
    game.claimDailyRation(); assert.equal(game.battle, b);
    assert.equal(JSON.stringify({ tick: b.tick, bell: b.bellTicks, charge: b.charge, shots: b.shots, base: b.base }), live);
    assert.equal(game.state.coins, 0); assert.equal(giftCount(game), 1); assert(game.pauses.has('USER')); assert(game.pauses.has('CHOICE'));
    assert(!game.pauses.has('DAILY_RATION')); assert(!game.pauses.has('WAIT_RESUME'));
});

test('background and disabled states cannot accept the visible reward', () => {
    for (const pause of ['BACKGROUND', 'DISABLED']) {
        const { game } = fixture(); game.enter(); game.pause(pause); game.claimDailyRation();
        assert.equal(game.state.legacy.lastRationDate, null); game.resume(pause); game.claimDailyRation();
        assert.equal(game.state.legacy.lastRationDate, '2026-11-11');
    }
});

test('dawn choices and game over finish before reward; a new village can claim again on the same day', () => {
    const dawn = createGame(7);
    dawn.day = 4; dawn.completed = dawn.legacy.bestNight = 3;
    applyCommand(dawn, { type: 'NIGHT' });
    finishNight(dawn, 200, dawn.towers.map(t => t.operator));
    assert.equal(dawn.choices[0].kind, 'TRAVELER');
    const first = fixture(dawn).game; first.enter(); assert.equal(first.dailyRationDate, null);
    first.command({ type: 'CHOOSE', value: 'decline' }); assert.equal(first.state.phase, 'DAY'); assert.equal(first.dailyRationDate, '2026-11-11');
    first.claimDailyRation(); first.newVillage();
    assert.equal(first.state.legacy.lastRationDate, null); assert.equal(first.dailyRationDate, '2026-11-11'); assert.equal(first.state.coins, RULE.initialCoins); assert.equal(giftCount(first), 0);
    first.claimDailyRation(); assert.equal(giftCount(first), 1);
    const lost = createGame(3); lost.phase = 'GAME_OVER'; lost.gate = 0; lost.wave = null;
    const second = fixture(lost).game; second.enter(); assert.equal(second.dailyRationDate, null);
    second.newVillage(); assert.equal(second.dailyRationDate, '2026-11-11');
});

test('new schema requires an explicit null or valid saved date, with no old-data default', () => {
    const s = createGame(1); delete s.legacy.lastRationDate; assert.throws(() => validateState(s));
    s.legacy.lastRationDate = '2026-02-30'; assert.throws(() => validateState(s));
});
