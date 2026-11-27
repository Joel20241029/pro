const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const compiled = process.env.DAIDAI_TEST_BUILD;
const { GameSession } = require(path.join(compiled, 'game/GameSession.js'));
const { SaveStore } = require(path.join(compiled, 'storage/SaveStore.js'));
const { WechatPlatform } = require(path.join(compiled, 'platform/WechatPlatform.js'));
const { storageCapacity } = require(path.join(compiled, 'game/Growth.js'));
const { generateWave } = require(path.join(compiled, 'game/WaveGenerator.js'));
const { expeditionUnavailableReason, startExpedition } = require(path.join(compiled, 'game/Expedition.js'));

test('trial jumps to wave 30 in its own save and keeps the cloud leaderboard read-only', () => {
    const values = new Map();
    const messages = [];
    let environment = 'release';
    global.wx = {
        getAccountInfoSync: () => ({ miniProgram: { envVersion: environment } }),
        getAppBaseInfo: () => ({ SDKVersion: '3.18.0' }),
        getGameLogManager: () => ({ log() {} }),
        getStorageInfoSync: () => ({ keys: [...values.keys()] }),
        getStorageSync: key => values.get(key),
        setStorageSync: (key, value) => values.set(key, value),
        removeStorageSync: key => values.delete(key),
        getOpenDataContext: () => ({ canvas: { style: {} }, postMessage: message => messages.push(message) })
    };
    const open = () => {
        const platform = new WechatPlatform();
        const game = new GameSession(new SaveStore(platform), () => '2026-11-26', platform.testEntryEnabled);
        game.load();
        return { platform, game };
    };
    const release = open();
    release.game.newVillage();
    assert.equal(release.game.testEntryEnabled, false);
    const normal = new Map(values);
    release.game.jumpToTestNight();
    assert.equal(release.game.state.day, 1);
    assert.deepEqual(values, normal);
    release.platform.syncBestNight(3);
    assert.deepEqual(messages.splice(0), [{ bestNight: 3 }]);

    environment = 'trial';
    const trial = open();
    assert.equal(trial.game.testEntryEnabled, true);
    assert.equal(trial.game.boot.kind, 'new');
    trial.game.newVillage();
    assert(storageCapacity(trial.game.state) < 500);
    const people = trial.game.state.people, towers = trial.game.state.towers;
    trial.game.pause('CHOICE');
    trial.game.jumpToTestNight();
    assert.equal(trial.game.state.day, 1);
    trial.game.resume('CHOICE');
    trial.game.jumpToTestNight();
    const { state, error } = trial.game;
    assert.equal(error, '');
    assert.deepEqual([state.day, state.completed, state.food, state.wood], [30, 29, 500, 500]);
    assert.deepEqual(state.people, people);
    assert.deepEqual(state.towers, towers);
    assert(storageCapacity(state) >= 500);
    assert(state.wave.entries.length > 0);
    assert.deepEqual(open().game.state, state);
    for (const [key, value] of normal) assert.equal(values.get(key), value);

    trial.platform.syncBestNight(state.legacy.bestNight);
    trial.platform.postRanking({ showRanking: true, bestNight: state.legacy.bestNight }, 'test-1');
    trial.platform.postRanking({ refreshRanking: true, bestNight: state.legacy.bestNight }, 'test-1');
    assert.deepEqual(messages, [
        { showRanking: true, diagnosticRequest: 'test-1' },
        { refreshRanking: true, diagnosticRequest: 'test-1' }
    ]);

    const late = structuredClone(state);
    late.day = 42; late.completed = late.legacy.bestNight = 41;
    late.wave = generateWave(late);
    const explorer = late.people.find(person => expeditionUnavailableReason(late, person.id) === null);
    assert(explorer);
    startExpedition(late, explorer.id, 'lobby');
    trial.game.saves.prepare(late);
    trial.game.saves.commit();
    const reloaded = open().game;
    reloaded.jumpToTestNight();
    assert.equal(reloaded.error, '');
    assert.equal(reloaded.state.expedition.departedAfter, 29);
    assert.equal(reloaded.state.expedition.personId, explorer.id);
    const wave = reloaded.state.wave;
    reloaded.jumpToTestNight();
    assert.deepEqual(reloaded.state.wave, wave);
    for (const [key, value] of normal) assert.equal(values.get(key), value);
});
