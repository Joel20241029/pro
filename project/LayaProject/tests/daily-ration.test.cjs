const { test } = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const compiled = process.env.DAIDAI_TEST_BUILD;
if (!compiled) throw new Error('Set DAIDAI_TEST_BUILD to the compiled project under Downloads');
const { RULE } = require(path.join(compiled, 'game/GameConfig.js'));
const { createGame, applyCommand, finishNight } = require(path.join(compiled, 'game/VillageRules.js'));
const { dailyRationAmount, localRationDate, validRationDate } = require(path.join(compiled, 'game/DailyRation.js'));
const { GameSession } = require(path.join(compiled, 'game/GameSession.js'));
const { SaveStore, canonical } = require(path.join(compiled, 'storage/SaveStore.js'));
const { validateState } = require(path.join(compiled, 'storage/StateValidation.js'));

function fixture(state = createGame(7)) {
    const values = new Map(); let day = '2026-11-11', failure = null, failRead = false, writes = 0;
    const port = {
        read(k) { if (failRead) { failRead = false; throw new Error('read-back failed'); } return values.get(k) ?? null; },
        write(k, v) {
            if (failure === 'before-write') { failure = null; throw new Error('write failed'); }
            values.set(k, v); writes++;
            if (failure === 'after-write') { failure = null; throw new Error('write result uncertain'); }
            if (failure === 'read-back') { failure = null; failRead = true; }
        }
    };
    const store = new SaveStore(port); store.inspect();
    if (state) { store.prepare(state); store.commit(); }
    const game = new GameSession(store, () => day); game.load();
    return { game, port, values, day: v => day = v, fail: v => failure = v, writes: () => writes };
}

test('calendar keys follow local midnight, validate leap days and never accept normalized invalid dates', () => {
    assert.equal(localRationDate(new Date(2026, 10, 11, 23, 59)), '2026-11-11');
    assert.equal(localRationDate(new Date(2026, 10, 12, 0, 0)), '2026-11-12');
    assert(validRationDate('2028-02-29'));
    for (const value of ['2026-02-29', '2026-11-31', '2026-13-01', '2026-1-01', '0000-01-01', '', undefined]) assert(!validRationDate(value));
});

test('20 food, partial capacity and full capacity share one atomic rule; no other resources or RNG change', () => {
    for (const [food, expected] of [[60, 20], [195, 5], [200, 0]]) {
        const s = createGame(7); s.food = food;
        const before = canonical({ ...s, food: 0, legacy: { ...s.legacy, lastRationDate: null } });
        assert.equal(dailyRationAmount(s, '2026-11-11'), expected);
        applyCommand(s, { type: 'DAILY_RATION', date: '2026-11-11' });
        assert.equal(s.food, food + expected); assert.equal(s.legacy.lastRationDate, '2026-11-11'); validateState(s);
        assert.equal(canonical({ ...s, food: 0, legacy: { ...s.legacy, lastRationDate: null } }), before);
        assert.equal(dailyRationAmount(s, '2026-11-11'), null);
    }
});

test('same-village date and clock rollback cannot grant another reward; a new village can claim today', () => {
    const s = createGame(1); applyCommand(s, { type: 'DAILY_RATION', date: '2026-11-11' });
    for (const date of ['2026-11-11', '2026-11-10', 'bad']) {
        const before = canonical(s); assert.throws(() => applyCommand(s, { type: 'DAILY_RATION', date })); assert.equal(canonical(s), before);
    }
    const next = createGame(2, s.legacy); assert.equal(next.legacy.lastRationDate, null);
    assert.equal(dailyRationAmount(next, '2026-11-11'), RULE.dailyFood);
    applyCommand(next, { type: 'DAILY_RATION', date: '2026-11-11' }); assert.equal(next.food, RULE.initialResource + RULE.dailyFood);
    assert.equal(dailyRationAmount(next, '2026-11-11'), null);
});

test('no village gets no reward; first successfully saved new village opens one offer', () => {
    const { game } = fixture(null); game.enter(); assert.equal(game.dailyRationDate, null); assert(!game.pauses.has('DAILY_RATION'));
    game.newVillage(); assert.equal(game.dailyRationDate, '2026-11-11'); assert(game.pauses.has('DAILY_RATION'));
    assert.equal(game.state.food, RULE.initialResource); game.claimDailyRation();
    assert.equal(game.state.food, RULE.initialResource + RULE.dailyFood); assert.equal(game.dailyRationDate, null);
});

test('confirmation is required, duplicate clicks do not save twice, reload remembers the claim', () => {
    const f = fixture(); f.game.enter(); const before = canonical([...f.values]);
    f.game.update(100); assert.equal(canonical([...f.values]), before); assert.equal(f.game.state.legacy.lastRationDate, null);
    f.game.claimDailyRation(); const saved = canonical([...f.values]), writes = f.writes();
    f.game.claimDailyRation(); assert.equal(f.writes(), writes); assert.equal(canonical([...f.values]), saved);
    const again = new GameSession(new SaveStore(f.port), () => '2026-11-11'); again.load(); again.enter();
    assert.equal(again.dailyRationDate, null); assert.equal(again.state.food, RULE.initialResource + RULE.dailyFood);
});

for (const failure of ['before-write', 'after-write', 'read-back']) test(`save ${failure}: retry accepts the same food/date candidate once and only then resumes`, () => {
    const f = fixture(); f.game.show(); f.fail(failure); f.game.claimDailyRation();
    assert(f.game.saves.pending); assert(f.game.pauses.has('SAVE_PENDING')); assert(f.game.pauses.has('DAILY_RATION')); assert(f.game.pauses.has('WAIT_RESUME'));
    assert.equal(f.game.state.food, RULE.initialResource); assert.equal(f.game.state.legacy.lastRationDate, null);
    const pending = f.game.saves.pending; f.game.claimDailyRation(); assert.equal(f.game.saves.pending, pending);
    f.game.retry(); assert.equal(f.game.saves.pending, null); assert.equal(f.game.dailyRationDate, null);
    assert.equal(f.game.state.food, RULE.initialResource + RULE.dailyFood); assert.equal(f.game.state.legacy.lastRationDate, '2026-11-11');
    assert(!f.game.pauses.has('DAILY_RATION')); assert(!f.game.pauses.has('WAIT_RESUME')); assert(!f.game.pauses.has('SAVE_PENDING'));
    f.game.claimDailyRation(); assert.equal(f.game.state.food, RULE.initialResource + RULE.dailyFood);
});

test('uncertain write followed by process restart loads the claimed state without another gift', () => {
    const f = fixture(); f.game.enter(); f.fail('after-write'); f.game.claimDailyRation();
    const next = new GameSession(new SaveStore(f.port), () => '2026-11-11'); next.load(); next.enter();
    assert.equal(next.state.food, RULE.initialResource + RULE.dailyFood); assert.equal(next.dailyRationDate, null);
});

test('natural date change is checked at entry; a running village is not interrupted at midnight', () => {
    const f = fixture(); f.game.enter(); f.game.claimDailyRation(); f.day('2026-11-12');
    f.game.command({ type: 'MUSIC', enabled: false }); f.game.update(5); assert.equal(f.game.dailyRationDate, null);
    f.game.hide(); f.game.show(); assert.equal(f.game.dailyRationDate, '2026-11-12');
    f.game.claimDailyRation(); assert.equal(f.game.state.food, RULE.initialResource + RULE.dailyFood * 2); assert(!f.game.pauses.has('WAIT_RESUME'));
    f.game.hide(); f.game.show(); assert.equal(f.game.dailyRationDate, null); assert(f.game.pauses.has('WAIT_RESUME'));
});

test('night claim preserves exact live battle, locked hunger, charge and bell; unrelated pauses survive', () => {
    const s = createGame(7); s.food = 0; s.people.forEach(p => p.job = 'WAITING');
    const f = fixture(s), game = f.game; game.command({ type: 'NIGHT' }); game.bell(); game.update(.1);
    const b = game.battle, live = JSON.stringify({ tick: b.tick, bell: b.bellTicks, charge: b.charge, shots: b.shots, base: b.base });
    assert(b.base.night.hungry); game.pause('USER'); game.pause('CHOICE'); game.show(); game.update(3);
    game.claimDailyRation(); assert.equal(game.battle, b);
    assert.equal(JSON.stringify({ tick: b.tick, bell: b.bellTicks, charge: b.charge, shots: b.shots, base: b.base }), live);
    assert.equal(game.state.food, 20); assert(game.state.night.hungry); assert(game.pauses.has('USER')); assert(game.pauses.has('CHOICE'));
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
    assert.equal(first.state.legacy.lastRationDate, null); assert.equal(first.dailyRationDate, '2026-11-11'); assert.equal(first.state.food, RULE.initialResource);
    first.claimDailyRation(); assert.equal(first.state.food, RULE.initialResource + RULE.dailyFood);
    const lost = createGame(3); lost.phase = 'GAME_OVER'; lost.gate = 0; lost.wave = null;
    const second = fixture(lost).game; second.enter(); assert.equal(second.dailyRationDate, null);
    second.newVillage(); assert.equal(second.dailyRationDate, '2026-11-11');
});

test('new schema requires an explicit null or valid saved date, with no old-data default', () => {
    const s = createGame(1); delete s.legacy.lastRationDate; assert.throws(() => validateState(s));
    s.legacy.lastRationDate = '2026-02-30'; assert.throws(() => validateState(s));
});
