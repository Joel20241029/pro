const { test } = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const compiled = process.env.DAIDAI_TEST_BUILD;
if (!compiled) throw new Error('Set DAIDAI_TEST_BUILD to the compiled project under Downloads');
const { SaveStore, canonical, crc32 } = require(path.join(compiled, 'storage/SaveStore.js'));
const { GameSession } = require(path.join(compiled, 'game/GameSession.js'));
const { createGame } = require(path.join(compiled, 'game/VillageRules.js'));
const { CONFIG_VERSION } = require(path.join(compiled, 'game/GameConfig.js'));
global.Laya = { Sprite: class {}, OpenDataContextView: class {}, Texture2D: class {} };
const { GameView } = require(path.join(compiled, 'view/GameView.js'));
const keys = ['daidai_village.save.a', 'daidai_village.save.b'];

function envelope(configVersion, revision = 1, seed = 1, schemaVersion = 1) {
    const body = { schemaVersion, configVersion, revision, commitId: `fixture:${seed}:${revision}`, payload: createGame(seed) };
    return canonical({ ...body, checksum: crc32(canonical(body)) });
}
class MemoryStore {
    constructor(slots) {
        this.values = new Map(slots.flatMap((raw, i) => raw === null ? [] : [[keys[i], raw]]));
        this.writes = []; this.attempts = 0; this.fail = null; this.readFailure = false; this.verifyFailure = null;
    }
    read(key) {
        if (this.readFailure) throw new Error('storage unavailable');
        if (this.verifyFailure && this.writes.length >= 2) {
            const mode = this.verifyFailure; this.verifyFailure = null;
            if (mode === 'throw') throw new Error('verification read failed');
            return 'unexpected read-back';
        }
        return this.values.get(key) ?? null;
    }
    write(key, raw) {
        const failure = ++this.attempts === this.fail?.attempt ? this.fail.mode : null;
        if (failure === 'before') throw new Error('write failed');
        this.values.set(key, raw); this.writes.push([key, raw]);
        if (failure === 'after') throw new Error('write completed but acknowledgement lost');
    }
}
function session(storage) { const game = new GameSession(new SaveStore(storage)); game.load(); return game; }
function assertNewVillage(game, storage) {
    assert.equal(game.boot, null); assert.equal(game.state.day, 1); assert.equal(game.state.people.length, 6);
    assert.equal(game.state.completed, 0); assert.equal(game.saves.pending, null);
    const raw = storage.values.get(keys[0]); assert.equal(storage.values.get(keys[1]), raw);
    assert.deepEqual(JSON.parse(raw).payload, game.state); assert.equal(JSON.parse(raw).configVersion, CONFIG_VERSION);
    const writes = storage.writes.length, reopened = session(storage);
    assert.deepEqual(reopened.state, game.state); assert.equal(storage.writes.length, writes);
}

test('old/future config and schema mismatches preserve both original slots until explicit reset', () => {
    for (const raw of [envelope(CONFIG_VERSION - 1), envelope(CONFIG_VERSION + 1), envelope(CONFIG_VERSION, 1, 1, 2)]) {
        const storage = new MemoryStore([raw, raw]), game = session(storage);
        assert.equal(game.boot.kind, 'incompatible'); assert.equal(game.state, null);
        game.retry(); assert.equal(game.boot.kind, 'incompatible');
        assert.deepEqual([...storage.values.values()], [raw, raw]); assert.equal(storage.writes.length, 0);
    }
});

test('incompatible popup offers a working explicit reset instead of an ineffective reload action', () => {
    const storage = new MemoryStore([envelope(CONFIG_VERSION - 1), envelope(CONFIG_VERSION - 1)]), game = session(storage);
    const buttons = [], modals = [], view = Object.create(GameView.prototype);
    Object.assign(view, {
        game, modal(title, reason, close) { modals.push({ title, reason, close }); return {}; }, label() { return {}; },
        button(parent, text, x, y, width, action) { buttons.push({ text, action }); }
    });
    view.drawBoot(); assert.equal(modals[0].close, false); assert.match(modals[0].reason, /替换旧进度/);
    assert.equal(buttons.length, 1); assert.match(buttons[0].text, /确认放弃旧进度/); assert.doesNotMatch(buttons[0].text, /重新读取/);
    buttons[0].action(); assertNewVillage(game, storage);
});

test('confirmed reset handles both foreign, mixed, missing and corrupt slots and preserves other storage', () => {
    const foreign = envelope(CONFIG_VERSION - 1), current = envelope(CONFIG_VERSION, 100);
    for (const slots of [[foreign, foreign], [foreign, current], [current, foreign], [foreign, null], [null, foreign], [foreign, 'broken'], ['broken', foreign]]) {
        const storage = new MemoryStore(slots), game = session(storage);
        storage.values.set('ranking-independent-record', 'untouched'); game.newVillage(undefined, true);
        assertNewVillage(game, storage); assert.equal(storage.values.get('ranking-independent-record'), 'untouched');
        assert.equal(storage.writes.length, 2);
        game.command({ type: 'SPEED', value: 3 }); assert.equal(storage.writes.length, 3);
        assert.equal(session(storage).state.settings.speed, 3);
    }
});

test('confirmed corrupt-save reset also replaces both slots and no longer asks for recovery on next startup', () => {
    const storage = new MemoryStore(['broken-a', 'broken-b']), game = session(storage);
    assert.equal(game.boot.kind, 'blocked'); assert.equal(game.boot.canReset, true); assert.equal(storage.writes.length, 0);
    game.newVillage(undefined, true); assertNewVillage(game, storage);
});

for (const attempt of [1, 2]) for (const mode of ['before', 'after']) {
    test(`reset write ${attempt} ${mode}-write failure retries the same candidate without duplicate village creation`, () => {
        const storage = new MemoryStore([envelope(CONFIG_VERSION - 1), envelope(CONFIG_VERSION - 1)]), game = session(storage);
        storage.fail = { attempt, mode }; game.newVillage(undefined, true);
        assert.equal(game.state, null); assert(game.pauses.has('SAVE_PENDING'));
        const pending = game.saves.pending, raw = pending.raw;
        game.newVillage(undefined, true); assert.equal(game.saves.pending, pending);
        storage.fail = null; game.retry(); assertNewVillage(game, storage);
        assert.equal(game.state, pending.state); assert.equal(storage.writes.length, 2);
        assert(storage.writes.every(([, value]) => value === raw)); assert.equal(game.pauses.has('SAVE_PENDING'), false);
    });
}

for (const mode of ['throw', 'mismatch']) {
    test(`reset final verification ${mode} keeps the pending candidate until both slots are verified`, () => {
        const storage = new MemoryStore([envelope(CONFIG_VERSION - 1), envelope(CONFIG_VERSION - 1)]), game = session(storage);
        storage.verifyFailure = mode; game.newVillage(undefined, true);
        assert.equal(game.state, null); assert(game.saves.pending); assert.equal(storage.writes.length, 2);
        const candidate = game.saves.pending.state;
        assert.deepEqual(session(storage).state, candidate);
        game.retry(); assert.equal(game.state, candidate); assert.equal(storage.writes.length, 2); assertNewVillage(game, storage);
    });
}

test('mixed-version reset interrupted between writes never resurrects the old high-revision village', () => {
    for (const foreignIndex of [0, 1]) {
        const slots = [envelope(CONFIG_VERSION, 100), envelope(CONFIG_VERSION, 100)]; slots[foreignIndex] = envelope(CONFIG_VERSION - 1);
        const storage = new MemoryStore(slots), game = session(storage);
        storage.fail = { attempt: 2, mode: 'before' }; game.newVillage(undefined, true);
        assert.equal(storage.writes[0][0], keys[1 - foreignIndex]);
        assert.equal(storage.values.get(keys[foreignIndex]), slots[foreignIndex]);
        const restarted = session(storage); assert.equal(restarted.state, null); assert.equal(restarted.boot.kind, 'incompatible');
        storage.fail = null; restarted.newVillage(undefined, true); assertNewVillage(restarted, storage);
    }
});

test('both foreign slots still require explicit reset after an interruption between writes', () => {
    const storage = new MemoryStore([envelope(CONFIG_VERSION - 1), envelope(CONFIG_VERSION - 1)]), game = session(storage);
    storage.fail = { attempt: 2, mode: 'before' }; game.newVillage(undefined, true);
    const restarted = session(storage); assert.equal(restarted.state, null); assert.equal(restarted.boot.kind, 'incompatible');
    assert.equal(storage.writes.length, 1);
});

test('reset refuses any concurrent slot change, including deletion or corruption, before either write', () => {
    for (const index of [0, 1]) for (const changed of [null, 'other-corruption', envelope(CONFIG_VERSION, 200, 9)]) {
        const storage = new MemoryStore([envelope(CONFIG_VERSION - 1), envelope(CONFIG_VERSION - 1)]), game = session(storage);
        if (changed === null) storage.values.delete(keys[index]); else storage.values.set(keys[index], changed);
        const before = [...storage.values]; game.newVillage(undefined, true);
        assert.equal(game.state, null); assert.match(game.error, /确认重开后发生变化/);
        assert.equal(storage.writes.length, 0); assert.deepEqual([...storage.values], before);
    }
});

test('pending reset retry refuses a new concurrent record after a partial write', () => {
    const storage = new MemoryStore([envelope(CONFIG_VERSION - 1), envelope(CONFIG_VERSION - 1)]), game = session(storage);
    storage.fail = { attempt: 2, mode: 'before' }; game.newVillage(undefined, true);
    const concurrent = envelope(CONFIG_VERSION, 200, 9); storage.values.set(keys[1], concurrent); storage.fail = null;
    game.retry(); assert.equal(game.state, null); assert.equal(storage.writes.length, 1); assert.equal(storage.values.get(keys[1]), concurrent);
});

test('reset cannot bypass unavailable reads, conflicting valid saves, or normal loaded progress', () => {
    const unreadable = new MemoryStore([null, null]); unreadable.readFailure = true;
    const conflict = new MemoryStore([envelope(CONFIG_VERSION, 10, 1), envelope(CONFIG_VERSION, 10, 2)]);
    const valid = new MemoryStore([envelope(CONFIG_VERSION), null]);
    for (const storage of [unreadable, conflict, valid, new MemoryStore([null, null])]) {
        const game = session(storage), original = game.state; game.newVillage(undefined, true);
        assert.equal(storage.writes.length, 0); assert.equal(game.state, original); assert.equal(game.saves.pending, null);
    }
});

test('temporary read failure still retries the existing progress without resetting it', () => {
    const storage = new MemoryStore([envelope(CONFIG_VERSION), null]); storage.readFailure = true;
    const game = session(storage); assert.equal(game.boot.kind, 'blocked'); assert.equal(game.boot.canReset, false);
    storage.readFailure = false; game.retry(); assert.equal(game.state.day, 1); assert.equal(storage.writes.length, 0);
});

test('explicit incompatible reset does not inherit stale in-memory legacy or history', () => {
    const storage = new MemoryStore([envelope(CONFIG_VERSION), null]), game = session(storage);
    game.state.legacy.bestNight = 99; game.state.legacy.births = 12;
    const foreign = envelope(CONFIG_VERSION - 1); storage.values.set(keys[0], foreign); storage.values.set(keys[1], foreign); game.load();
    assert.equal(game.boot.kind, 'incompatible'); game.newVillage(undefined, true); assertNewVillage(game, storage);
    assert.equal(game.state.legacy.bestNight, 0); assert.equal(game.state.legacy.births, 0); assert.deepEqual(game.state.history, []);
});
