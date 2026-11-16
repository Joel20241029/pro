const { test } = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const compiled = process.env.DAIDAI_TEST_BUILD;
if (!compiled) throw new Error('Set DAIDAI_TEST_BUILD to the compiled project under Downloads');
class Sprite {
    constructor() { this.children = []; this.graphics = { clear() {}, drawRect() {}, drawLine() {}, drawRoundRect() {}, drawCircle() {}, drawLines() {} }; }
    pos(x, y) { this.x = x; this.y = y; } size(width, height) { this.width = width; this.height = height; }
    addChild(child) { this.children.push(child); child.parent = this; }
    destroyChildren() { for (const child of this.children) child.destroy(); this.children = []; }
    destroy() { this.destroyed = true; this.destroyChildren(); }
    get numChildren() { return this.children.length; }
    on() {}
    pivot(x,y) { this.pivotX=x; this.pivotY=y; return this; }
    scale(x,y) { this.scaleX=x; this.scaleY=y; return this; }
    getChildByName(name) { return this.children.find(child => child.name === name); }
    getChildAt(index) { return this.children[index]; }
}
function fakeButton(parent, text, x, y, width, action, color, height) { const button = new Sprite(), face = new Sprite(), label = new Sprite(); button.pos(x, y); button.size(width, height); face.name = 'buttonFace'; label.name = 'buttonText'; label.text = text; face.addChild(label); button.addChild(face); parent.addChild(button); return button; }
const renderSamples = new Map();
class Texture2D { constructor() { throw new Error('ranking must not create a texture'); } }
class OpenDataContextView extends Sprite { constructor() { super(); throw new Error('ranking must not use Laya open data view'); } }
global.Laya = { Text: { SHRINK: 'shrink' }, ColorFilter: class { gray() { return this; } }, Texture2D, TextureFormat: { R8G8B8A8: 1 }, SpriteUtils: { getTransformRelativeToWindow: () => ({ x: 0, y: 0, scaleX: 1, scaleY: 1 }) }, LayaGL: { textureContext: { setTextureSubImageData() { throw Error("ranking must not upload pixels"); } } }, Sprite, OpenDataContextView, Script: class {}, regClass: () => target => target, timer: { unscaledDelta: 0, once(delay, owner, fn) { renderSamples.set(owner, () => fn.call(owner)); }, clearAll(owner) { renderSamples.delete(owner); } }, Event: { CLICK: 'click' } };
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
    const canvas = { width: 390, height: 844, style: {} }, context = { canvas, postMessage: m => messages.push(m) }, contexts = [];
    const wx = { getAppBaseInfo: () => ({ SDKVersion: '3.17.6' }), getWindowInfo: () => ({}), getOpenDataContext: options => { contexts.push(options); return context; }, requirePrivacyAuthorize: o => privacy.push(o), authorize: o => authorization.push(o), openSetting: o => settings.push(o), getStorageInfoSync: () => ({ keys: [...storage.keys()] }), getStorageSync: k => storage.get(k), setStorageSync: (k,v) => storage.set(k,v) };
    global.wx = wx; return { wx, canvas, context, contexts, messages, privacy, authorization, settings, platform: new WechatPlatform() };
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
    session.state.legacy.bestNight = 9; s.context.postMessage = () => { throw new Error('network'); }; main.onUpdate(); assert.equal(session.error, ''); assert.equal(session.saves.pending, null);
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

test('score-first native initialization fixes screenCanvas mode, stays hidden and reuses one canvas', () => {
    const s = setup(); let widthWrites = 0, heightWrites = 0;
    Object.defineProperty(s.canvas, 'width', { get: () => 600, set: () => widthWrites++ });
    Object.defineProperty(s.canvas, 'height', { get: () => 680, set: () => heightWrites++ });
    s.platform.syncBestNight(1); s.platform.syncBestNight(2);
    assert.deepEqual(s.contexts, [{ sharedCanvasMode: 'screenCanvas' }]);
    assert.deepEqual(s.canvas.style, { width: '1px', height: '1px', left: '-100px', top: '-100px' });
    const native = s.platform.rankingCanvas;
    native.show('a', { x: 40, y: 100, width: 300, height: 340 }); native.hide('a');
    native.show('b', { x: 50, y: 110, width: 400, height: 450 });
    assert.equal(widthWrites, 1); assert.equal(heightWrites, 1); assert.equal(s.contexts.length, 1);
});
test('native SDK gate compares numeric versions and never creates default-mode canvas', () => {
    const { RankingCanvasUnsupported } = require(path.join(compiled, 'platform/WechatRankingCanvas.js'));
    for (const sdk of [undefined, 'invalid', '3.6.5', '3.6.6', '3.10.0', '4.0.0']) {
        const s = setup(); s.wx.getAppBaseInfo = () => ({ SDKVersion: sdk });
        if (['3.6.6', '3.10.0', '4.0.0'].includes(sdk)) assert.equal(s.platform.rankingCanvas.context, s.context);
        else { assert.throws(() => s.platform.rankingCanvas.context, RankingCanvasUnsupported); assert.equal(s.contexts.length, 0); }
    }
    const s = setup(); delete s.canvas.style;
    assert.throws(() => s.platform.rankingCanvas.context, RankingCanvasUnsupported);
    assert.deepEqual(s.contexts, [{ sharedCanvasMode: 'screenCanvas' }]);
    assert.throws(() => s.platform.rankingCanvas.context, RankingCanvasUnsupported);
    assert.equal(s.contexts.length, 1, 'an acquired native singleton remains owned even after preparation fails');
    s.canvas.style = {}; assert.equal(s.platform.rankingCanvas.context, s.context); assert.equal(s.contexts.length, 1);
    const missing = setup(); delete missing.wx.getOpenDataContext;
    assert.throws(() => missing.platform.rankingCanvas.context, RankingCanvasUnsupported);
});

function gameView(session, platform) {
    const view = Object.create(GameView.prototype), overlay = new Sprite(), art = { panel() {} };
    // This platform lifecycle fixture does not render glyphs; button/icon press coupling
    // is exercised with the real UiWidgets in gameplay-clarity.test.cjs.
    const ui = { image(parent,id,x,y,w,h=w) { const node=new Sprite(); node.pos(x,y); node.size(w,h); parent.addChild(node); return node; }, buttonIcon() {}, label: () => ({}), button: fakeButton, bindClick() {} };
    const panels = new GamePanels(session, art, platform, ui, overlay, layout, () => view.refresh(), { ready: () => true });
    panels.modal = () => { const box = new Sprite(); box.height = 860; overlay.addChild(box); return box; };
    const village = Object.create(VillageWorld.prototype);
    Object.assign(village, { game: session, layout, scene, motion: { sync() {} }, emotes: { sync() {} }, shield: { reset() {} }, interaction: { cancelPresses() {}, clearDepth() {} }, drawScenery() {} });
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
    view.village.relayout = () => {};
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

test('native initialization failure keeps frame closable and shows upgrade or retry text without authorizing', () => {
    const { drawJournalPanel } = require(path.join(compiled, 'view/panels/JournalPanels.js'));
    for (const unavailable of [false, true]) {
        const s = setup(), labels = [], logs = []; s.wx.getGameLogManager = () => ({ log: o => logs.push(o.value) });
        if (unavailable) s.wx.getOpenDataContext = () => { throw Error('native failed'); };
        else s.wx.getAppBaseInfo = () => ({ SDKVersion: '3.6.5' });
        s.platform = new WechatPlatform();
        assert.doesNotThrow(() => drawJournalPanel({ platform: s.platform, modal: () => new Sprite(), ui: { label: (box, text) => { labels.push(text); return {}; } } }, createGame(1), { type: 'ranking' }));
        assert(labels[0].includes(unavailable ? '重试' : '升级微信'));
        assert(logs.some(l => l.event === 'view_error')); assert.equal(logs.at(-1).event, 'close');
        assert.equal(s.privacy.length, 0); assert.equal(s.authorization.length, 0);
    }
});
test('native rendering sample observes screen placement and is cancelled on close', () => {
    const { RankingView } = require(path.join(compiled, 'view/RankingView.js'));
    const s = setup(), logs = []; s.wx.getGameLogManager = () => ({ log: o => logs.push(o.value) });
    s.platform = new WechatPlatform(); const request = s.platform.rankingDiagnostics.begin();
    const ranking = new RankingView(s.platform, 1, request); new Sprite().addChild(ranking);
    ranking.refreshRanking(); ranking.displayedInStage = true;
    const sample = renderSamples.get(ranking); assert(sample); renderSamples.delete(ranking); sample();
    const log = logs.find(x => x.event === 'render_sample'); assert.equal(log.request, request);
    assert.equal(log.canvasWidth, 600); assert.equal(log.canvasHeight, 680); assert(log.onStage); assert(log.visible);
    assert.equal(log.styleWidth, '600px'); assert.equal(log.uploads, undefined); assert.equal(ranking.texture, undefined);
    ranking.refreshRanking(); assert(renderSamples.has(ranking)); ranking.destroy(); assert(!renderSamples.has(ranking));
    sample(); assert.equal(logs.filter(x => x.event === 'render_sample').length, 1);
    assert.equal(s.canvas.style.width, '1px'); assert.equal(s.messages.at(-1).type, 'close');
});
test('old native board callbacks, movement and destruction cannot affect a newer board', () => {
    const { RankingView } = require(path.join(compiled, 'view/RankingView.js'));
    const s = setup(), parent = new Sprite();
    const old = new RankingView(s.platform, 2, 'old'); parent.addChild(old); old.refreshRanking();
    const oldPrivacy = s.privacy.shift(); oldPrivacy.success(); const oldFriend = s.authorization.shift();
    const current = new RankingView(s.platform, 2, 'current'); parent.addChild(current); current.refreshRanking();
    const count = s.messages.length; old.updateViewPort(); oldFriend.success(); old.destroy();
    assert.equal(s.messages.length, count); assert(s.platform.rankingCanvas.owns('current')); assert.equal(s.canvas.style.width, '600px');
    s.platform.syncBestNight(3); assert.deepEqual(s.messages.at(-1), { bestNight: 3 });
    current.destroy(); assert.equal(s.canvas.style.width, '1px');
});
test('same logical layout still updates native CSS bounds and Layout touch coordinates after screen scaling', () => {
    const s = setup(), session = new GameSession(new SaveStore(s.platform)); session.load(); session.newVillage();
    const view = gameView(session, s.platform); view.root = { size() {} }; view.tip.pos = () => {};
    view.panels.open({ type: 'ranking' });
    const box = view.overlay.getChildAt(0), ranking = box.getChildByName('FriendRankingCanvas');
    s.wx.getWindowInfo = () => ({ windowWidth: 390, windowHeight: 844, screenTop: 0, statusBarHeight: 47, safeArea: { top: 47, bottom: 810 } });
    s.wx.getMenuButtonBoundingClientRect = () => ({ width: 88, height: 32, bottom: 76 });
    const transform = Laya.SpriteUtils.getTransformRelativeToWindow;
    Laya.SpriteUtils.getTransformRelativeToWindow = () => ({ x: 61, y: 82, scaleX: .75, scaleY: .75 });
    try { view.resize(); } finally { Laya.SpriteUtils.getTransformRelativeToWindow = transform; }
    assert.equal(view.overlay.getChildAt(0), box); assert.equal(box.getChildByName('FriendRankingCanvas'), ranking);
    assert.deepEqual(s.messages.at(-1).box, { x: 61, y: 82, width: 450, height: 510 });
    assert.deepEqual(s.canvas.style, { left: '61px', top: '82px', width: '450px', height: '510px' });
    view.panels.close();
});
test('diagnostic native reads and timer failures never interrupt the original authorization', () => {
    const { RankingView } = require(path.join(compiled, 'view/RankingView.js'));
    const s = setup(), logs = []; s.wx.getGameLogManager = () => ({ log: o => logs.push(o.value) });
    s.platform = new WechatPlatform(); const request = s.platform.rankingDiagnostics.begin();
    const ranking = new RankingView(s.platform, 1, request); new Sprite().addChild(ranking);
    const once = Laya.timer.once;
    Laya.timer.once = () => { throw Error('diagnostic scheduling failed'); };
    try {
        assert.doesNotThrow(() => ranking.refreshRanking());
        s.privacy.shift().success(); s.authorization.shift().success();
        assert(s.messages.some(m => m.refreshRanking)); assert(logs.some(x => x.event === 'diagnostic_probe_error'));
        Object.defineProperty(s.canvas, 'width', { get() { throw Error('diagnostic canvas read'); }, configurable: true });
        assert.doesNotThrow(() => ranking.sampleRender());
    } finally { Laya.timer.once = once; ranking.destroy(); }
});
test('partially failed native placement is still hidden by failed-panel cleanup', () => {
    const { drawJournalPanel } = require(path.join(compiled, 'view/panels/JournalPanels.js'));
    const s = setup(), labels = [];
    void s.platform.rankingCanvas.context;
    let height = s.canvas.style.height;
    Object.defineProperty(s.canvas.style, 'height', { configurable: true, get: () => height, set: value => {
        if (value !== '1px') throw Error('native style update failed'); height = value;
    } });
    assert.doesNotThrow(() => drawJournalPanel({ platform: s.platform, modal: () => new Sprite(), ui: { label: (box, text) => { labels.push(text); return {}; } } }, createGame(1), { type: 'ranking' }));
    assert(labels[0].includes('重试')); assert.equal(s.canvas.style.width, '1px'); assert.equal(s.canvas.style.left, '-100px');
    assert.equal(s.platform.rankingCanvas.owner, null); assert.equal(s.privacy.length, 0);
});
