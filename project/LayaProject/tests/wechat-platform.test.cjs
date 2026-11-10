const { test } = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const compiled = process.env.DAIDAI_TEST_BUILD;
if (!compiled) throw new Error('Set DAIDAI_TEST_BUILD to the compiled project under Downloads');
class Sprite {
    constructor() { this.children = []; this.graphics = { clear() {}, drawRect() {} }; }
    pos(x, y) { this.x = x; this.y = y; } size(width, height) { this.width = width; this.height = height; }
    addChild(child) { this.children.push(child); child.parent = this; } destroyChildren() { this.children = []; } on() {}
    getChildByName(name) { return this.children.find(child => child.name === name); }
}
let allocations = 0, uploads = [];
class Texture2D { constructor() { this._texture = { test: true }; } setImageData() { allocations++; } }
class OpenDataContextView extends Sprite {
    constructor() { super(); this.texture = { bitmap: { destroy() {} }, setTo(bitmap) { this.bitmap = bitmap; } }; }
}
global.Laya = { Texture2D, TextureFormat: { R8G8B8A8: 1 }, SpriteUtils: { getTransformRelativeToWindow: () => ({ x: 0, y: 0, scaleX: 1, scaleY: 1 }) }, LayaGL: { textureContext: { setTextureSubImageData(...args) { uploads.push(args); } } }, Sprite, OpenDataContextView, Script: class {}, regClass: () => target => target, timer: { unscaledDelta: 0 }, Event: { CLICK: 'click' } };
const { WechatPlatform } = require(path.join(compiled, 'platform/WechatPlatform.js'));
const { Main } = require(path.join(compiled, 'Main.js'));
const { GameView } = require(path.join(compiled, 'view/GameView.js'));
const { GameSession } = require(path.join(compiled, 'game/GameSession.js'));
const { SaveStore } = require(path.join(compiled, 'storage/SaveStore.js'));
const { createGame, applyCommand, finishNight } = require(path.join(compiled, 'game/VillageRules.js'));
function setup() {
    const messages = [], privacy = [], authorization = [], settings = [], storage = new Map();
    const wx = { getWindowInfo: () => ({}), getOpenDataContext: () => ({ postMessage: m => messages.push(m) }), requirePrivacyAuthorize: o => privacy.push(o), authorize: o => authorization.push(o), openSetting: o => settings.push(o), getStorageInfoSync: () => ({ keys: [...storage.keys()] }), getStorageSync: k => storage.get(k), setStorageSync: (k,v) => storage.set(k,v) };
    global.wx = wx; return { wx, messages, privacy, authorization, settings, platform: new WechatPlatform() };
}
test('score sync is deduplicated and does not invoke friend/privacy APIs', () => {
    const s = setup(); s.platform.syncBestNight(0); s.platform.syncBestNight(3); s.platform.syncBestNight(3); s.platform.syncBestNight(2);
    assert.deepEqual(s.messages, [{ bestNight: 3 }]); assert.equal(s.privacy.length, 0); assert.equal(s.authorization.length, 0);
});
test('platform message exceptions do not propagate or retry every frame', () => {
    const s = setup(); let calls = 0; s.wx.getOpenDataContext = () => { calls++; throw new Error('SDK failed'); };
    assert.doesNotThrow(() => { s.platform.syncBestNight(3); s.platform.syncBestNight(3); }); assert.equal(calls, 1);
});
test('denied privacy never requests friend permission; closed panel never continues permission chain', () => {
    const s = setup(); let error, current = true;
    s.platform.authorizeRanking(() => current, e => error = e); s.privacy.shift().fail({ errMsg: 'deny' }); assert(error); assert.equal(s.authorization.length, 0);
    s.platform.authorizeRanking(() => current, () => {}); current = false; s.privacy.shift().success(); assert.equal(s.authorization.length, 0);
});
test('opening ranking requests friend authorization directly without a settings page', () => {
    const s = setup(); let error;
    s.platform.authorizeRanking(() => true, e => error = e); s.privacy.shift().success(); assert.equal(s.settings.length, 0);
    const request = s.authorization.shift(); assert.equal(request.scope, 'scope.WxFriendInteraction'); request.success(); assert.equal(error, null);
});
test('Main notifies accepted saves only and platform failures never become local save failures', () => {
    const s = setup(), store = new SaveStore(s.platform); store.inspect(); store.prepare(createGame(1)); store.commit();
    const session = new GameSession(new SaveStore(s.platform)); session.load(); const main = new Main(); main.platform = s.platform; main.session = session;
    const candidate = createGame(2); candidate.legacy.bestNight = 8; session.saves.prepare(candidate); main.onUpdate(); assert.equal(s.messages.length, 0);
    session.retry(); main.onUpdate(); assert.deepEqual(s.messages, [{ bestNight: 8 }]);
    session.state.legacy.bestNight = 9; s.wx.getOpenDataContext = () => { throw new Error('network'); }; main.onUpdate(); assert.equal(session.error, ''); assert.equal(session.saves.pending, null);
});
test('background refresh destroys old board without rebuilding; show waits for player continue', () => {
    const s = setup(), store = new SaveStore(s.platform); store.inspect(); store.prepare(createGame(1)); store.commit(); const session = new GameSession(new SaveStore(s.platform)); session.load();
    const view = Object.create(GameView.prototype); let boards = 0;
    Object.assign(view, { game: session, platform: s.platform, panel: { type: 'ranking' }, shownErrorRevision: 0, observedRun: 1, observedDawn: 0, chrome: new Sprite(), overlay: new Sprite(), motion: { sync() {} }, art: { panel() {} }, tip: {}, drawScenery() {}, image() {}, label: () => ({}), button() {}, modal: () => new Sprite(), updateActors() {}, drawPanel() { boards++; } });
    session.changed = () => view.refresh(); view.refresh(); assert.equal(boards, 1);
    session.hide(); assert.equal(boards, 1); session.show(); assert.equal(boards, 1);
    session.resume('WAIT_RESUME'); view.refresh(); assert.equal(boards, 2);
});

test('shared canvas allocates once, then uploads pixels without reallocation or CPU readback', () => {
    const { SharedCanvasTexture } = require(path.join(compiled, 'view/SharedCanvasTexture.js'));
    allocations = 0; uploads = []; const texture = new SharedCanvasTexture(); const source = { width: 600, height: 680 };
    for (let i = 0; i < 30; i++) texture.setImageData(source, true, false);
    assert.equal(allocations, 1); assert.equal(uploads.length, 29); assert.deepEqual(uploads[0], [texture._texture, source, 0, 0, true, false]);
});

function gameView(session, platform) {
    const view = Object.create(GameView.prototype);
    Object.assign(view, { game: session, platform, panel: null, shownErrorRevision: 0, observedRun: 0, observedDawn: 0, chrome: new Sprite(), overlay: new Sprite(), motion: { sync() {} }, art: { panel() {} }, tip: { show() {} }, drawScenery() {}, image() {}, label: () => ({}), button() {}, modal: () => new Sprite(), updateActors() {}, drawGameOver() {}, drawDawn() {}, drawPending() {} });
    return view;
}
test('ranking unlocks after first committed victory, stays unlocked after restart, and syncs one real wave', () => {
    const s = setup(), session = new GameSession(new SaveStore(s.platform)); session.load(); session.newVillage();
    const view = gameView(session, s.platform), main = new Main(); main.platform = s.platform; main.session = session;
    session.changed = () => view.refresh(); view.refresh(); assert.equal(view.chrome.getChildByName('RankingButton'), undefined);
    session.command({ type: 'NIGHT' }); assert.equal(view.chrome.getChildByName('RankingButton'), undefined);
    for (let step = 0; step < 1000 && session.state.phase === 'NIGHT'; step++) session.update(.25);
    assert.equal(session.state.completed, 1); assert(view.chrome.getChildByName('RankingButton')); main.onUpdate(); assert.deepEqual(s.messages, [{ bestNight: 1 }]);
    session.newVillage(); assert.equal(session.state.completed, 0); assert(view.chrome.getChildByName('RankingButton'));
});
test('failed first wave and an uncommitted victory do not unlock ranking', () => {
    const s = setup(), session = new GameSession(new SaveStore(s.platform)); session.load(); session.newVillage();
    const view = gameView(session, s.platform), failed = createGame(2); applyCommand(failed, { type: 'NIGHT' }); finishNight(failed, 0, failed.towers.map(t => t.operator));
    session.state = failed; view.refresh(); assert.equal(view.chrome.getChildByName('RankingButton'), undefined);
    session.newVillage(); const candidate = JSON.parse(JSON.stringify(session.state)); applyCommand(candidate, { type: 'NIGHT' }); finishNight(candidate, 200, candidate.towers.map(t => t.operator));
    session.saves.prepare(candidate); view.refresh(); assert.equal(view.chrome.getChildByName('RankingButton'), undefined);
});
test('ranking panel is a tall list with no extra controls and authorizes as soon as opened', () => {
    const s = setup(), session = new GameSession(new SaveStore(s.platform)); session.load(); session.newVillage();
    const view = gameView(session, s.platform), box = new Sprite(), controls = []; let subtitle;
    view.modal = (title, sub) => { subtitle = sub; return box; }; view.button = (...args) => controls.push(args);
    view.drawPanel(session.state, { type: 'ranking' });
    const ranking = box.getChildByName('FriendRankingCanvas'); assert.deepEqual([ranking.x, ranking.y, ranking.width, ranking.height], [34, 132, 600, 680]);
    assert.equal(subtitle, ''); assert.equal(controls.length, 0); assert.equal(s.privacy.length, 1); assert.equal(s.settings.length, 0);
    s.privacy.shift().success(); s.authorization.shift().success(); assert(s.messages.some(m => m.refreshRanking));
});
