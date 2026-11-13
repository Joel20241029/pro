const { test } = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const compiled = process.env.DAIDAI_TEST_BUILD;
if (!compiled) throw new Error('Set DAIDAI_TEST_BUILD to the compiled project under Downloads');
class Sprite {
    constructor() { this.children = []; this.graphics = { clear() {}, drawRect() {}, drawLine() {}, drawRoundRect() {} }; }
    pos(x, y) { this.x = x; this.y = y; } size(width, height) { this.width = width; this.height = height; }
    addChild(child) { this.children.push(child); child.parent = this; }
    destroyChildren() { for (const child of this.children) child.destroy(); this.children = []; }
    destroy() { this.destroyed = true; this.destroyChildren(); }
    get numChildren() { return this.children.length; }
    on() {}
    getChildByName(name) { return this.children.find(child => child.name === name); }
    getChildAt(index) { return this.children[index]; }
}
function fakeButton(parent, text, x, y, width, action, color, height) { const button = new Sprite(), face = new Sprite(), label = new Sprite(); button.pos(x, y); button.size(width, height); face.name = 'buttonFace'; label.name = 'buttonText'; label.text = text; face.addChild(label); button.addChild(face); parent.addChild(button); return button; }
let allocations = 0, uploads = [];
class Texture2D { constructor() { this._texture = { test: true }; } setImageData() { allocations++; } destroy() { this.destroyed = true; } }
class OpenDataContextView extends Sprite {
    constructor() { super(); this.texture = { bitmap: { destroy() {} }, setTo(bitmap) { this.bitmap = bitmap; }, destroy() { this.destroyed = true; } }; }
}
global.Laya = { Text: { SHRINK: 'shrink' }, Texture2D, TextureFormat: { R8G8B8A8: 1 }, SpriteUtils: { getTransformRelativeToWindow: () => ({ x: 0, y: 0, scaleX: 1, scaleY: 1 }) }, LayaGL: { textureContext: { setTextureSubImageData(...args) { uploads.push(args); } } }, Sprite, OpenDataContextView, Script: class {}, regClass: () => target => target, timer: { unscaledDelta: 0 }, Event: { CLICK: 'click' } };
const { WechatPlatform } = require(path.join(compiled, 'platform/WechatPlatform.js'));
const { Main } = require(path.join(compiled, 'Main.js'));
const { GameView } = require(path.join(compiled, 'view/GameView.js'));
const { GamePanels } = require(path.join(compiled, 'view/GamePanels.js'));
const { GameHud } = require(path.join(compiled, 'view/GameHud.js'));
const { VillageWorld } = require(path.join(compiled, 'view/VillageWorld.js'));
const { GameLayout } = require(path.join(compiled, 'view/GameLayout.js'));
const { layoutVillage } = require(path.join(compiled, 'view/VillageScene.js'));
const layout = new GameLayout({ windowWidth: 390, windowHeight: 844, screenTop: 0, statusBarHeight: 47, safeArea: { top: 47, bottom: 810 } }, { width: 88, height: 32, bottom: 76 });
const scene = layoutVillage(layout);
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
    session.enter(); session.claimDailyRation();
    const view = gameView(session, s.platform); let boards = 0;
    view.panels.current = { type: 'ranking' }; view.panels.draw = () => { boards++; };
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
    const view = Object.create(GameView.prototype), overlay = new Sprite(), art = { panel() {} };
    // This platform lifecycle fixture does not render glyphs; button/icon press coupling
    // is exercised with the real UiWidgets in gameplay-clarity.test.cjs.
    const ui = { image() {}, buttonIcon() {}, label: () => ({}), button: fakeButton, bindClick() {} };
    const panels = new GamePanels(session, art, platform, ui, overlay, layout, () => view.refresh(), { ready: () => true });
    panels.modal = () => { const box = new Sprite(); box.height = 860; overlay.addChild(box); return box; };
    const village = Object.create(VillageWorld.prototype);
    Object.assign(village, { game: session, layout, scene, motion: { sync() {} }, emotes: { sync() {} }, pressedTargets: new Map(), drawScenery() {} });
    Object.assign(view, { resources: { ready: () => true }, game: session, observedVillageRevision: session.villageRevision, platform, layout, panels, village,
        shownErrorRevision: 0, observedRun: 0, observedDawn: 0, overlay, tip: { show() {} }, anchoredTip: { hide() {} }, updateActors() {} });
    view.hud = new GameHud(session, art, ui, panels, () => view.refresh());
    return view;
}
test('ranking unlocks after first committed victory, stays unlocked after restart, and syncs one real wave', () => {
    const s = setup(), session = new GameSession(new SaveStore(s.platform)); session.load(); session.newVillage();
    const view = gameView(session, s.platform), main = new Main(); main.platform = s.platform; main.session = session;
    session.changed = () => view.refresh(); view.refresh(); assert.equal(view.hud.node.getChildByName('RankingButton'), undefined);
    session.command({ type: 'NIGHT' }); assert.equal(view.hud.node.getChildByName('RankingButton'), undefined);
    for (let step = 0; step < 1000 && session.state.phase === 'NIGHT'; step++) session.update(.25);
    assert.equal(session.state.completed, 1); assert(view.hud.node.getChildByName('RankingButton')); main.onUpdate(); assert.deepEqual(s.messages, [{ bestNight: 1 }]);
    session.newVillage(); assert.equal(session.state.completed, 0); assert(view.hud.node.getChildByName('RankingButton'));
});
test('failed first wave and an uncommitted victory do not unlock ranking', () => {
    const s = setup(), session = new GameSession(new SaveStore(s.platform)); session.load(); session.newVillage();
    const view = gameView(session, s.platform), failed = createGame(2); applyCommand(failed, { type: 'NIGHT' }); finishNight(failed, 0, failed.towers.map(t => t.operator));
    session.state = failed; view.refresh(); assert.equal(view.hud.node.getChildByName('RankingButton'), undefined);
    session.newVillage(); const candidate = JSON.parse(JSON.stringify(session.state)); applyCommand(candidate, { type: 'NIGHT' }); finishNight(candidate, 200, candidate.towers.map(t => t.operator));
    session.saves.prepare(candidate); view.refresh(); assert.equal(view.hud.node.getChildByName('RankingButton'), undefined);
});
test('ranking panel is a tall list with no extra controls and authorizes as soon as opened', () => {
    const s = setup(), session = new GameSession(new SaveStore(s.platform)); session.load(); session.newVillage();
    const view = gameView(session, s.platform), box = new Sprite(), controls = []; let subtitle;
    view.panels.modal = (title, sub) => { subtitle = sub; return box; }; view.panels.ui.button = (...args) => controls.push(args);
    view.panels.draw(session.state, { type: 'ranking' });
    const ranking = box.getChildByName('FriendRankingCanvas'); assert.deepEqual([ranking.x, ranking.y, ranking.width, ranking.height], [34, 132, 600, 680]);
    assert.equal(subtitle, ''); assert.equal(controls.length, 0); assert.equal(s.privacy.length, 1); assert.equal(s.settings.length, 0);
    s.privacy.shift().success(); s.authorization.shift().success(); assert(s.messages.some(m => m.refreshRanking));
});


test('pure restart of run one resets view schedules, pending panels and effects without a run-number change', () => {
    const env = setup(), session = new GameSession(new SaveStore(env.platform)); session.load(); session.newVillage();
    const view = gameView(session, env.platform), oldMotion = view.village.motion, oldEmotes = view.village.emotes;
    let houseTipHidden = false; view.anchoredTip.hide = () => { houseTipHidden = true; };
    view.panels.current = {type:'cleanStart'}; view.tip.visible = true; session.changed=()=>view.refresh();
    session.cleanStart(); assert.equal(session.state.run,1); assert.equal(view.panels.current,null); assert.notEqual(view.village.motion,oldMotion); assert.notEqual(view.village.emotes,oldEmotes); assert.equal(view.tip.visible,false);
    assert(houseTipHidden, 'pure restart must clear the house tip target as well');
});

test('ranking resize retains the live instance and pending authorization; closing invalidates it once', () => {
    const env = setup(), session = new GameSession(new SaveStore(env.platform)); session.load(); session.newVillage();
    const view = gameView(session, env.platform); view.root = { size() {} }; view.tip.pos = () => {};
    view.village.relayout = () => {}; Laya.timer.clearAll = () => {};
    env.wx.getWindowInfo = () => ({ windowWidth: 390, windowHeight: 900, statusBarHeight: 47, safeArea: { top: 47, bottom: 866 } });
    env.wx.getMenuButtonBoundingClientRect = () => ({ width: 88, height: 32, top: 51, bottom: 83, left: 292, right: 380 });
    view.panels.open({ type: 'ranking' });
    const box = view.overlay.getChildAt(0), ranking = box.getChildByName('FriendRankingCanvas');
    const privacy = env.privacy.shift(); assert(privacy); const initialMessages = env.messages.length;
    let destroyed = 0; const destroy = ranking.destroy.bind(ranking); ranking.destroy = (...args) => { destroyed++; destroy(...args); };
    view.resize();
    assert.equal(view.overlay.getChildAt(0), box); assert.equal(box.getChildByName('FriendRankingCanvas'), ranking);
    assert.equal(env.privacy.length, 0); assert.equal(env.authorization.length, 0); assert.equal(destroyed, 0);
    assert.deepEqual(env.messages.slice(initialMessages).map(message => message.type), ['updateViewPort']);
    view.panels.close(); assert.equal(destroyed, 1); assert.equal(ranking.destroyed, true);
    const messages = env.messages.length; privacy.success();
    assert.equal(env.authorization.length, 0); assert.equal(env.messages.length, messages);
});
