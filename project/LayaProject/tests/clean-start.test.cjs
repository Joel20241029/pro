const { test } = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const compiled = process.env.DAIDAI_TEST_BUILD;
if (!compiled) throw new Error('Set DAIDAI_TEST_BUILD to the compiled project under Downloads');
const { RULE, TRAITS } = require(path.join(compiled, 'game/GameConfig.js'));
const { createGame, applyCommand } = require(path.join(compiled, 'game/VillageRules.js'));
const { GameSession } = require(path.join(compiled, 'game/GameSession.js'));
const { SaveStore, canonical, crc32 } = require(path.join(compiled, 'storage/SaveStore.js'));
const keys = ['daidai_village.save.a', 'daidai_village.save.b'], date = '2026-11-12', seed = 9001;

function fixture(state = createGame(1)) {
    const values = new Map(), writes = [];
    let attempts = 0;
    const port = {
        read(key) { return port.readOverride ? port.readOverride(key) : values.get(key) ?? null; },
        write(key, raw) {
            attempts++;
            const mode = port.fail?.(attempts);
            if (mode === 'before') throw new Error('write failed');
            if (mode === 'drop') return;
            if (mode === 'corrupt') { values.set(key, 'corrupt write'); return; }
            values.set(key, raw); writes.push([key, raw]);
            if (mode === 'after') throw new Error('write result uncertain');
        }
    };
    if (state) {
        const store = new SaveStore(port); store.inspect();
        for (let i = 0; i < 2; i++) { store.prepare(state); store.commit(); }
    }
    writes.length = attempts = 0;
    const reopen = (load = true) => {
        const game = new GameSession(new SaveStore(port), () => date);
        if (load) game.load();
        return game;
    };
    return { values, writes, port, reopen, game: reopen() };
}
function start(game) {
    const now = Date.now;
    Date.now = () => seed;
    try { game.cleanStart(); } finally { Date.now = now; }
}
function reencode(raw, changes) {
    const { checksum, ...body } = JSON.parse(raw);
    Object.assign(body, changes);
    return canonical({ ...body, checksum: crc32(canonical(body)) });
}
function assertMirrored(f, raw) {
    assert.deepEqual(keys.map(key => f.values.get(key)), [raw, raw]);
    assert.equal(JSON.parse(raw).commitType, 'CLEAN_START');
}

test('clean start equals a fresh village apart from its best night and schedules a fresh same-day ration', () => {
    const original = createGame(2), retired = { ...original.people[0], nights: 0, elderNights: 0, job: 'WAITING' };
    const extraTrait = Object.keys(TRAITS).find(trait => !original.legacy.traits.includes(trait));
    original.legacy.traits.push(extraTrait);
    Object.assign(original.legacy, { bestNight: 17, births: 8, retirees: 3, lastRationDate: date });
    const old = createGame(3, original.legacy, extraTrait, [retired], [retired.id]);
    Object.assign(old.legacy, { lastRationDate: date }); old.food = 125; old.settings.speed = 3;
    applyCommand(old, { type: 'NIGHT' });
    const f = fixture(old), { game } = f, expected = createGame(seed);
    f.values.set('external-rank-cache', 'untouched');
    assert.equal(game.villageRevision, 0); assert(game.battle);
    game.enter(); game.update(.01);
    for (const pause of ['USER', 'CHOICE', 'BACKGROUND', 'WAIT_RESUME', 'DISABLED']) game.pause(pause);
    start(game);
    expected.legacy.bestNight = 17;
    assert.deepEqual(game.state, expected);
    assert.equal(game.battle, null); assert.equal(game.accumulator, 0); assert.equal(game.villageRevision, 1);
    assert.deepEqual([...game.pauses].sort(), ['BACKGROUND', 'DAILY_RATION', 'DISABLED', 'WAIT_RESUME']);
    assert.equal(f.values.get('external-rank-cache'), 'untouched');
    assertMirrored(f, f.writes[0][1]);
    game.resume('BACKGROUND'); game.resume('DISABLED'); game.claimDailyRation();
    assert.equal(game.state.food, RULE.initialResource + RULE.dailyFood);
    assert.equal(game.state.legacy.lastRationDate, date); assert.equal(game.villageRevision, 1);
    assert.equal(f.writes.length, 3); assert.equal(JSON.parse(f.writes[2][1]).commitType, 'NORMAL');
    const reopened = f.reopen(); reopened.enter(); reopened.claimDailyRation();
    assert.equal(reopened.dailyRationDate, null); assert.deepEqual(reopened.state, game.state);
    assert.equal(f.writes.length, 3);
});

for (const failure of ['before', 'after']) for (const step of [1, 2]) {
    test(`clean start write ${step} fails ${failure} persisting; retry commits the same candidate once`, () => {
        const f = fixture(), { game } = f, old = game.state;
        f.port.fail = attempt => attempt === step && failure;
        start(game);
        const pending = game.saves.pending;
        assert(pending); assert.equal(game.state, old); assert.equal(game.villageRevision, 0); assert(game.pauses.has('SAVE_PENDING'));
        assert.equal(f.writes.length, step - (failure === 'before' ? 1 : 0));
        start(game); game.newVillage(); game.claimDailyRation();
        assert.equal(game.saves.pending, pending);
        game.retry();
        assertMirrored(f, pending.raw);
        assert(f.writes.every(([, raw]) => raw === pending.raw));
        assert.equal(f.writes.length, 2); assert.equal(game.villageRevision, 1); assert.equal(game.state, pending.state);
        assert.equal(game.saves.pending, null); assert(!game.pauses.has('SAVE_PENDING'));
        game.retry(); assert.equal(game.villageRevision, 1); assert.equal(f.writes.length, 2);
    });
}

test('a silently dropped first write leaves the active old slot intact until a new slot is verified', () => {
    const f = fixture(), old = keys.map(key => f.values.get(key));
    f.port.fail = attempt => attempt === 1 && 'drop'; start(f.game);
    assert.deepEqual(keys.map(key => f.values.get(key)), old);
    assert.equal(f.reopen().state.run, 1); assert.equal(f.game.villageRevision, 0);
    const pending = f.game.saves.pending;
    f.game.retry(); assertMirrored(f, pending.raw);
});

test('persistent corrupt writes can retry the same candidate without leaving the session', () => {
    for (const step of [1, 2]) {
        const f = fixture();
        f.port.fail = attempt => attempt === step && 'corrupt'; start(f.game);
        const pending = f.game.saves.pending;
        assert(pending); assert.equal(f.game.villageRevision, 0);
        if (step === 1) assert.equal(JSON.parse(f.values.get(keys[1])).commitType, 'NORMAL');
        f.game.retry();
        assertMirrored(f, pending.raw); assert.equal(f.game.villageRevision, 1);
        assert.equal(f.writes.length, 2);
    }
});

for (const stage of [1, 2]) for (const mode of ['throw', 'mismatch']) {
    test(`read-back ${mode} after slot ${stage} freezes until retry`, () => {
        const f = fixture(), old = f.game.state;
        f.port.readOverride = key => {
            if (f.writes.length === stage) {
                f.port.readOverride = null;
                if (mode === 'throw') throw new Error('read-back failed');
                return 'read-back mismatch';
            }
            return f.values.get(key) ?? null;
        };
        start(f.game);
        const pending = f.game.saves.pending;
        assert(pending); assert.equal(f.writes.length, stage); assert.equal(f.game.state, old); assert.equal(f.game.villageRevision, 0);
        f.game.retry(); assertMirrored(f, pending.raw); assert.equal(f.writes.length, 2); assert.equal(f.game.villageRevision, 1);
    });
}

test('restart after a durable first slot keeps completing the same candidate across repeated failures', () => {
    const f = fixture(), old = f.game.state;
    old.legacy.bestNight = 5;
    f.port.fail = attempt => attempt === 1 ? 'after' : 'before';
    start(f.game);
    const raw = f.writes[0][1], stored = JSON.parse(raw);
    assert.equal(stored.revision, 3); assert.equal(stored.payload.legacy.bestNight, 5);
    const probe = new SaveStore(f.port);
    assert.equal(probe.inspect().kind, 'complete-clean-start');
    assert.equal(probe.pending.raw, raw); assert.equal(probe.pending.revision, stored.revision);
    for (let i = 0; i < 2; i++) {
        const game = f.reopen();
        assert.equal(game.state, null); assert.equal(game.boot.kind, 'complete-clean-start');
        assert.equal(game.villageRevision, 0); assert(game.pauses.has('SAVE_PENDING'));
        const pending = game.saves.pending;
        assert.equal(pending.raw, raw); assert.deepEqual(pending.state, stored.payload);
        game.enter(); game.claimDailyRation(); game.load(); assert.equal(game.saves.pending, pending);
        assert.equal(f.writes.length, 1); assert.equal(game.dailyRationDate, null);
    }
    const final = f.reopen(); final.enter();
    f.port.fail = null; final.retry();
    assertMirrored(f, raw); assert.equal(f.writes.length, 2); assert.equal(final.villageRevision, 1);
    assert.equal(final.dailyRationDate, date); assert.equal(final.state.food, RULE.initialResource);
    final.claimDailyRation(); assert.equal(final.state.food, RULE.initialResource + RULE.dailyFood);
});

test('a completed clean start restores its new village after either slot becomes corrupt or missing', () => {
    for (const key of keys) for (const broken of ['corrupt', null]) {
        const old = createGame(1); old.legacy.bestNight = 9; old.food = 5;
        const f = fixture(old); start(f.game);
        const raw = f.values.get(key);
        if (broken === null) f.values.delete(key); else f.values.set(key, broken);
        const game = f.reopen();
        assertMirrored(f, raw); assert.equal(f.writes.length, 3);
        assert.deepEqual(game.state, f.game.state); assert.equal(game.villageRevision, 1);
        assert.equal(f.reopen().villageRevision, 0); assert.equal(f.writes.length, 3);
    }
});

test('a competing same-revision candidate or incompatible slot blocks clean-start completion', () => {
    for (const [patch, kind] of [
        [{ commitId: 'different-commit' }, 'blocked'], [{ configVersion: 99 }, 'incompatible']
    ]) {
        const f = fixture(); f.port.fail = attempt => attempt === 2 && 'before'; start(f.game);
        const [first, raw] = f.writes[0], other = keys.find(key => key !== first);
        const concurrent = reencode(raw, patch); f.values.set(other, concurrent);
        f.game.retry();
        const game = f.reopen(); assert.equal(game.boot.kind, kind); assert.equal(game.state, null);
        game.cleanStart(); assert.equal(f.writes.length, 1); assert.equal(f.values.get(other), concurrent);
        if (kind === 'blocked') assert.equal(game.boot.canReset, false);
    }
});

test('an invalid or tampered commit type is never treated as a normal or a clean-start candidate', () => {
    const f = fixture(), raw = f.values.get(keys[1]);
    for (const changed of [
        reencode(raw, { commitType: 'UNKNOWN' }),
        canonical({ ...JSON.parse(raw), commitType: 'CLEAN_START' }),
        (() => { const { checksum, commitType, ...body } = JSON.parse(raw); return canonical({ ...body, checksum: crc32(canonical(body)) }); })()
    ]) {
        f.values.set(keys[1], changed);
        const game = f.reopen(); assert.equal(game.boot.kind, 'recover'); assert.equal(game.saves.pending, null);
        assert.equal(f.writes.length, 0);
    }
});

test('ordinary run-one day-one startup and a higher normal save do not trigger clean-start completion', () => {
    const f = fixture(null); start(f.game);
    assert.equal(f.writes.length, 0);
    f.game.newVillage(); assert.equal(f.game.villageRevision, 1); assert.equal(f.writes.length, 1);
    const ordinary = f.reopen(); assert.equal(ordinary.state.run, 1); assert.equal(ordinary.state.day, 1);
    assert.equal(ordinary.villageRevision, 0); assert.equal(f.writes.length, 1);
    start(ordinary); ordinary.command({ type: 'SPEED', value: 3 });
    assert.notEqual(f.values.get(keys[0]), f.values.get(keys[1]));
    const reopened = f.reopen();
    assert.deepEqual(reopened.state, ordinary.state); assert.equal(reopened.villageRevision, 0);
    assert.equal(f.writes.length, 4);
});
