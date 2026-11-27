const assert = require('node:assert/strict');
const { test } = require('node:test');
const read = name => require(`${process.env.DAIDAI_TEST_BUILD}/${name}.js`);
const { GameSession } = read('game/GameSession');
const { SaveStore } = read('storage/SaveStore');
const { validateState } = read('storage/StateValidation');
const { createGame, applyCommand, finishNight, economy, person } = read('game/VillageRules');
const { clone, isExploring } = read('game/GameState');
const { generateWave } = read('game/WaveGenerator');
const { storageCapacity } = read('game/Growth');
const { replacementOperators } = read('game/VillageJobs');
const { essenceTargets } = read('game/ShopRules');
const { expeditionClaimQuote, expeditionDeparturePreview, expeditionTotal, expeditionUnavailableReason } = read('game/Expedition');

function village(completed = 8) {
    const s = createGame(42);
    s.completed = s.legacy.bestNight = completed;
    s.day = completed + 1;
    s.wave = generateWave(s);
    const traveler = s.people.find(p => !expeditionUnavailableReason(s, p.id)) ??
        s.people.find(p => p.id !== s.patrol.captain && !s.towers.some(tower => tower.operator === p.id));
    return { s, id: traveler.id };
}

function acknowledge(s) {
    return { type: 'ACK_EXPEDITION_REPORT', run: s.run, departedAfter: s.expedition.departedAfter, reportCount: s.expedition.reports.length };
}

function night(s, victory = true, readReport = true) {
    applyCommand(s, { type: 'NIGHT' });
    validateState(s);
    finishNight(s, victory ? s.gate : 0, s.towers.map(t => t.operator));
    validateState(s);
    if (victory) {
        if (readReport && s.expedition?.reportPending) applyCommand(s, acknowledge(s));
        while (s.choices.length) {
            const first = s.choices[0];
            applyCommand(s, { type: 'CHOOSE', value: first.kind === 'TRAVELER' ? 'decline' : first.options[0] });
        }
        applyCommand(s, { type: 'FINALIZE' });
        validateState(s);
    }
}

function storage(s) {
    const data = new Map();
    let interrupted = false;
    const port = { read: key => data.get(key) ?? null, write(key, value) {
        if (interrupted) throw new Error('保存中断');
        data.set(key, value);
    } };
    const save = new SaveStore(port);
    save.inspect(); save.prepare(s, 'NORMAL', true); save.commit();
    return {
        open(date = '2026-11-26') {
            const game = new GameSession(new SaveStore(port), () => date);
            game.load();
            assert(game.state);
            return game;
        },
        interrupt(value) { interrupted = value; }
    };
}

test('521 unlocks using this village and previews the actual departure and replacement', () => {
    const { s, id } = village(7);
    s.legacy.bestNight = 60;
    const start = { type: 'START_EXPEDITION', id, route: 'lobby' };
    assert.throws(() => applyCommand(s, start), /第 8 波/);
    night(s);
    assert.match(expeditionUnavailableReason(s, s.patrol.captain), /队长/);
    assert.match(expeditionUnavailableReason(s, s.towers.find(t => t.operator).operator), /驻塔/);
    const count = s.people.length, before = economy(s);
    const preview = expeditionDeparturePreview(s, id, 'lobby');
    applyCommand(s, start);
    const after = economy(s);
    assert.equal(s.people.length, count);
    assert.deepEqual([after.wood - before.wood, after.food - before.food, after.rations - before.rations],
        [preview.wood, preview.food, preview.rations]);
    assert(isExploring(s, id));
    assert(!replacementOperators(s, 0).some(p => p.id === id));
    assert(!essenceTargets(s).some(p => p.id === id));
    assert.throws(() => applyCommand(s, { type: 'JOB', id, job: 'FARM' }), /探索中/);
    assert.throws(() => applyCommand(s, start), /已有村民/);
    validateState(s);
});

for (const [route, nights] of [['lobby', 3], ['overnight', 5]]) {
    test(`521 ${route} keeps age through return, draws once per win, and then resumes aging`, () => {
        const { s, id } = village();
        const originalAge = person(s, id).nights;
        applyCommand(s, { type: 'START_EXPEDITION', id, route });
        const replay = clone(s), noTrip = clone(s);
        delete noTrip.expedition;
        for (let i = 1; i <= nights; i++) {
            night(s); night(replay); night(noTrip);
            assert.deepEqual(replay.expedition, s.expedition);
            assert.equal(s.rng.world, noTrip.rng.world);
            assert.equal(s.expedition.reports.length, i);
            assert.equal(person(s, id).nights, originalAge);
            assert.equal(isExploring(s, id), i < nights);
        }
        assert.deepEqual(s.expedition.remaining, expeditionTotal(s.expedition));
        assert.equal(new Set(s.expedition.reports.map(report => report.event)).size, nights);
        night(s);
        assert.equal(person(s, id).nights, originalAge - 1);
        assert.equal(s.expedition.reports.length, nights);
    });
}

test('521 night exit, loss and restarting never progress an active trip', () => {
    const { s, id } = village();
    applyCommand(s, { type: 'START_EXPEDITION', id, route: 'lobby' });
    night(s);
    const lost = clone(s);
    night(lost, false);
    assert.deepEqual(lost.expedition, s.expedition);
    const fixture = storage(s), game = fixture.open();
    game.command({ type: 'NIGHT' });
    const reloaded = fixture.open();
    assert.equal(reloaded.state.phase, 'NIGHT');
    assert(!reloaded.state.night.adults.includes(id));
    reloaded.pause('CHOICE');
    reloaded.abandonNight();
    assert.deepEqual(reloaded.state.expedition, s.expedition);
    reloaded.newVillage();
    assert.equal(fixture.open().state.expedition, undefined);
});

test('521 partial warehouse claim is atomic across retries and survives reopening', () => {
    const { s, id } = village();
    applyCommand(s, { type: 'START_EXPEDITION', id, route: 'lobby' });
    for (let i = 0; i < 3; i++) night(s);
    const total = expeditionTotal(s.expedition), cap = storageCapacity(s);
    s.wood = cap; s.food = cap - 3;
    const fixture = storage(s), game = fixture.open();
    assert.deepEqual(expeditionClaimQuote(game.state), { food: 3, wood: 0 });
    fixture.interrupt(true);
    game.command({ type: 'CLAIM_EXPEDITION' });
    assert(game.saves.pending);
    assert.deepEqual(game.state.expedition.remaining, total);
    fixture.interrupt(false);
    game.retry();
    const reloaded = fixture.open();
    assert.deepEqual(reloaded.state.expedition.remaining, { food: total.food - 3, wood: total.wood });
    assert.equal(reloaded.state.expedition.noticed, true);
    assert.equal(reloaded.state.food, cap);
    assert.throws(() => applyCommand(reloaded.state, { type: 'CLAIM_EXPEDITION' }), /仓储已满/);
    assert.match(expeditionUnavailableReason(reloaded.state, id), /上一趟/);
    reloaded.state.food -= total.food; reloaded.state.wood -= total.wood;
    reloaded.command({ type: 'CLAIM_EXPEDITION' });
    assert.equal(fixture.open().state.expedition, undefined);
});

test('521 unread reports survive reload and retries, while a stale acknowledgement cannot consume the next report', () => {
    const { s, id } = village();
    applyCommand(s, { type: 'START_EXPEDITION', id, route: 'lobby' });
    night(s, true, false);
    const fixture = storage(s), game = fixture.open('2026-11-27');
    const first = acknowledge(game.state);
    assert.equal(game.state.expedition.reportPending, true);
    game.command({ type: 'NIGHT' });
    assert.match(game.error, /探索战报/);
    fixture.interrupt(true);
    game.command(first);
    assert(game.saves.pending);
    assert.equal(game.state.expedition.reportPending, true);
    fixture.interrupt(false);
    game.retry();
    assert.equal(fixture.open('2026-11-27').state.expedition.reportPending, undefined);

    const final = clone(game.state);
    night(final);
    night(final, true, false);
    const returned = storage(final).open();
    assert.throws(() => applyCommand(returned.state, first), /已处理/);
    assert.throws(() => applyCommand(returned.state, { type: 'CLAIM_EXPEDITION' }), /先查看探索战报/);
    const balance = { ...returned.state.expedition.remaining };
    returned.command(acknowledge(returned.state));
    assert.equal(returned.state.expedition.reportPending, undefined);
    assert.deepEqual(returned.state.expedition.remaining, balance);
});
