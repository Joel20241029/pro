const { test } = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const compiled = process.env.DAIDAI_TEST_BUILD;
if (!compiled) throw new Error('Set DAIDAI_TEST_BUILD to the compiled project under Downloads');
class Sprite {
    constructor() { this.children = []; this.graphics = { clear() {}, drawRect() {}, drawLine() {}, drawRoundRect() {}, drawCircle() {}, drawLines() {}, drawEllipse() {} }; }
    pos(x, y) { this.x = x; this.y = y; return this; } size(width, height) { this.width = width; this.height = height; return this; }
    addChild(child) { this.children.push(child); child.parent = this; return child; }
    get displayedInStage() { return !!this.parent; }
    localToGlobal(point, _copy, relative) {
        for (let node = this; node && node !== relative; node = node.parent) {
            point.x += node.x || 0; point.y += node.y || 0;
        }
        return point;
    }
    removeSelf() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; }
    destroyChildren() { for (const child of [...this.children]) child.destroy(); }
    destroy() { this.removeSelf(); this.destroyed = true; this.destroyChildren(); }
    get numChildren() { return this.children.length; }
    on() {}
    pivot(x,y) { this.pivotX=x; this.pivotY=y; return this; }
    scale(x,y) { this.scaleX=x; this.scaleY=y; return this; }
    getChildByName(name) { return this.children.find(child => child.name === name); }
    getChildAt(index) {
        if (index >= this.children.length) throw new Error("Index out of range: " + index);
        return this.children[index];
    }
}
function fakeButton(parent, text, x, y, width, action, color, height) { const button = new Sprite(), face = new Sprite(), label = new Sprite(); button.name = 'button:' + text; button.action = action; button.pos(x, y); button.size(width, height); face.name = 'buttonFace'; label.name = 'buttonText'; label.text = text; face.addChild(label); button.addChild(face); parent.addChild(button); return button; }
const renderSamples = new Map();
class Texture2D { constructor() { throw new Error('ranking must not create a texture'); } }
class OpenDataContextView extends Sprite { constructor() { super(); throw new Error('ranking must not use Laya open data view'); } }
global.Laya = { Text: { SHRINK: 'shrink' }, ColorFilter: class { gray() { return this; } }, Texture2D, TextureFormat: { R8G8B8A8: 1 }, SpriteUtils: { getTransformRelativeToWindow: () => ({ x: 0, y: 0, scaleX: 1, scaleY: 1 }) }, LayaGL: { textureContext: { setTextureSubImageData() { throw Error("ranking must not upload pixels"); } } }, Sprite, OpenDataContextView, Script: class {}, regClass: () => target => target, timer: { unscaledDelta: 0, once(delay, owner, fn) { renderSamples.set(owner, () => fn.call(owner)); }, clearAll(owner) { renderSamples.delete(owner); } }, Event: { CLICK: 'click' } };
const { WechatPlatform } = require(path.join(compiled, 'platform/WechatPlatform.js'));
const { Main } = require(path.join(compiled, 'Main.js'));
const { GameView } = require(path.join(compiled, 'view/GameView.js'));
const { GamePanels } = require(path.join(compiled, 'view/GamePanels.js'));
const { GameHud } = require(path.join(compiled, 'view/GameHud.js'));
const { NightResultPresentation } = require(path.join(compiled, 'view/NightResultPresentation.js'));
const { FEEDBACK } = require(path.join(compiled, 'view/config/FeedbackConfig.js'));
const { TacticNotices } = require(path.join(compiled, 'view/TacticNotices.js'));
Laya.Point = class { setTo(x, y) { this.x = x; this.y = y; return this; } };
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
    const wx = { getAppBaseInfo: () => ({ SDKVersion: '3.17.6' }), getWindowInfo: () => ({}), getOpenDataContext: options => { contexts.push(options); return context; }, requirePrivacyAuthorize: o => privacy.push(o), authorize: o => authorization.push(o), openSetting: o => settings.push(o), getStorageInfoSync: () => ({ keys: [...storage.keys()] }), getStorageSync: k => storage.get(k), setStorageSync: (k,v) => storage.set(k,v), removeStorageSync: k => storage.delete(k) };
    global.wx = wx; return { wx, canvas, context, contexts, messages, privacy, authorization, settings, storage, platform: new WechatPlatform() };
}
test('score sync is deduplicated and does not invoke friend/privacy APIs', () => {
    const s = setup(); s.platform.syncBestNight(0); s.platform.syncBestNight(3); s.platform.syncBestNight(3); s.platform.syncBestNight(2);
    assert.deepEqual(s.messages, [{ bestNight: 3 }]); assert.equal(s.privacy.length, 0); assert.equal(s.authorization.length, 0);
});
test('ranking messages carry the same diagnostic request into the open data context', () => {
    const s=setup(), request=s.platform.rankingDiagnostics.begin();
    s.platform.postRanking({showRanking:true},request);
    s.platform.postRanking({refreshRanking:true},request);
    s.platform.postRanking({type:'close'},request);
    assert(s.messages.every(message=>message.diagnosticRequest===request));
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
    view.handSpeed = { counting: false, update() {} };
    const itemGuide = { resetProgress() {}, tick() {}, node: { visible: false } };
    view.itemGuides = { backpack: itemGuide, shop: itemGuide };
    // This platform lifecycle fixture does not render glyphs; button/icon press coupling
    // is exercised with the real UiWidgets in gameplay-clarity.test.cjs.
    const ui = { image(parent,id,x,y,w,h=w) { return parent.addChild(new Sprite().pos(x,y).size(w,h)); },
        iconValue(parent,id,value,x,y,w,h){const node=parent.addChild(new Sprite().pos(x,y).size(w,h)); node.text=value; return node;},
        actionBadge(button, name) { const dot = button.getChildByName('buttonFace').addChild(new Sprite()); dot.name = name; return dot; },
        buttonIcon() {}, label: () => ({}), button: fakeButton,
        centerButton: require(path.join(compiled, 'view/UiWidgets.js')).UiWidgets.prototype.centerButton, bindClick() {} };
    const panels = new GamePanels(session, art, platform, ui, overlay, layout, () => view.refresh(), { ready: () => true });
    panels.modal = (title, sub, close, size = {width:668,height:860}) => {
        const box = new Sprite().size(size.width, size.height); box.name = 'panel:' + title; overlay.addChild(box); return box;
    };
    const village = Object.create(VillageWorld.prototype);
    Object.assign(village, { game: session, layout, scene, feedback: { hasPatrolImpact: false, deaths: new Map() }, motion: { sync() {} }, thoughts: { sync() {} }, crying: { sync() {} }, cryIcon: new Sprite(), speechTip: { hide() {} }, essenceArrow: new Sprite(), essenceTip: { hide() {} }, shield: { reset() {} }, summon: { reset() {} }, interaction: { cancelPresses() {}, clearDepth() {} }, drawScenery() {} });
    Object.assign(view, { resources: { ready: () => true }, game: session, observedVillageRevision: session.villageRevision, platform, layout, panels, village,
        shownErrorRevision: 0, observedRun: 0, observedDawn: 0, overlay, tip: { show() {} }, anchoredTip: { hide() {} },
        reminder: { reset() {}, tick() {}, hide() {} }, patrolGuide: { resetProgress() {}, hide() {}, tick() {}, node: { visible: false } }, starterGuide: { resetProgress() {}, hide() {}, tick() {}, node: { visible: false } },
        tacticNotices: new TacticNotices(platform), updateActors() {} });
    view.hud = new GameHud(session, art, ui, panels, () => view.refresh());
    view.results = new NightResultPresentation(ui, view.hud, () => view.refresh());
    const parent = new Sprite(); [view.hud.node,overlay,view.results.layer].forEach(node=>parent.addChild(node));
    return view;
}
test('the terminal patrol impact plays before both the victory and defeat panels', () => {
    for (const outcome of ['WIN', 'LOSE']) {
        for (const hitInFinalStep of [true, false]) {
            const base = createGame(7); applyCommand(base, { type: 'NIGHT' });
            const state = JSON.parse(JSON.stringify(base));
            finishNight(state, outcome === 'WIN' ? base.gate : 0, base.towers.map(t => t.operator));
            const battle = { outcome, base, feedback: hitInFinalStep ? [{ type: 'patrol' }] : [] };
            const game = { battle: null, presentationBattle: battle, saves: { pending: false } };
            let refreshes = 0;
            const view = new NightResultPresentation({}, {}, () => refreshes++);
            view.observe(game, state, !hitInFinalStep);
            assert(view.playingFinalImpact); assert(view.draw({}));
            view.advance(FEEDBACK.finalImpactSeconds, true);
            assert(view.playingFinalImpact); assert.equal(refreshes, 0);
            view.advance(outcome === "WIN" ? FEEDBACK.victoryClearSeconds : 0, false);
            assert(!view.playingFinalImpact); assert.equal(refreshes, 1);
            assert.equal(view.active, outcome === 'WIN');
            view.observe(game, state, false); assert(!view.playingFinalImpact);
        }
    }
});
test('first committed win retains the summary through collection and reveals only the ranking on landing', () => {
    const s = setup(), session = new GameSession(new SaveStore(s.platform)); session.load(); session.newVillage();
    const view = gameView(session, s.platform), main = new Main(); main.platform = s.platform; main.session = session;
    session.changed = () => view.refresh(); view.refresh(); assert.equal(view.hud.node.getChildByName('RankingButton'), undefined);
    session.command({ type: 'NIGHT' }); assert.equal(view.hud.node.getChildByName('RankingButton'), undefined);
    for (let step = 0; step < 1000 && session.state.phase === 'NIGHT'; step++) session.update(.25);
    const box = () => view.overlay.getChildAt(0), ranking = () => view.hud.node.getChildByName('RankingButton');
    const tactics = () => view.hud.node.getChildByName('TacticsButton');
    assert.equal(session.state.completed, 1, 'the win is committed before the presentation');
    assert.equal(view.overlay.numChildren, 0); assert(view.results.playingFinalImpact);
    view.results.advance(1, false, true); assert.equal(view.overlay.numChildren, 0);
    view.results.advance(FEEDBACK.victoryClearSeconds / 2, false, false);
    assert.equal(view.overlay.numChildren, 0);
    view.results.advance(FEEDBACK.victoryClearSeconds / 2, false, false);
    assert.equal(box().name, 'panel:守夜成功');
    assert.equal(ranking().visible, false); assert.equal(tactics(), undefined);
    main.onUpdate(); assert.deepEqual(s.messages, [{ bestNight: 1 }]);
    const stock = [session.state.food,session.state.wood];
    view.panels.advance(.24);
    const claim = box().getChildByName('button:收下').action;
    claim(); claim(); view.results.advance(.04);
    assert.equal(box().name, 'panel:守夜成功'); assert(view.results.layer.visible);
    const food = view.results.tiles[0];
    assert(food.scaleX < .61);
    view.results.advance(.22);
    assert.equal(food.width * food.scaleX, 315);
    assert(!view.results.tiles[1]?.visible);
    const hover = [food.x, food.y, food.scaleX];
    view.results.advance(.1);
    assert.deepEqual([food.x, food.y, food.scaleX], hover);
    view.results.advance(.38);
    assert(food.scaleX < 1);
    assert.equal(box().name, 'panel:守夜成功');
    view.results.advance(.33);
    const wood = view.results.tiles[1];
    assert(!food.visible); assert.equal(wood.width * wood.scaleX, 315);
    assert.equal(box().name, 'panel:守夜成功');
    view.results.advance(.64); view.panels.advance(.24);
    assert.equal(box().name, 'panel:功能解锁');
    view.results.advance(1.12);
    assert.equal(ranking().visible, true); assert.equal(tactics(), undefined);
    view.results.advance(.67);
    assert.equal(ranking().visible, true); assert.equal(tactics(), undefined);
    assert.deepEqual([session.state.food,session.state.wood],stock);
    assert.equal(s.privacy.length,0);
    session.newVillage(); assert.equal(session.state.completed, 0); assert.equal(view.hud.node.getChildByName('RankingButton'), undefined);
});
test('failed first wave and an uncommitted victory do not unlock ranking', () => {
    const s = setup(), session = new GameSession(new SaveStore(s.platform)); session.load(); session.newVillage();
    const view = gameView(session, s.platform), failed = createGame(2); applyCommand(failed, { type: 'NIGHT' }); finishNight(failed, 0, failed.towers.map(t => t.operator));
    session.state = failed; view.refresh(); assert.equal(view.hud.node.getChildByName('RankingButton'), undefined);
    session.newVillage(); const candidate = JSON.parse(JSON.stringify(session.state)); applyCommand(candidate, { type: 'NIGHT' }); finishNight(candidate, 200, candidate.towers.map(t => t.operator));
    session.saves.prepare(candidate); view.refresh(); assert.equal(view.hud.node.getChildByName('RankingButton'), undefined);
});
test('a committed defeat opens restart directly without collection or an unlock', () => {
    const env = setup(), session = new GameSession(new SaveStore(env.platform)); session.load(); session.newVillage();
    const view = gameView(session, env.platform);
    view.panels.ui.label = (parent, text, x, y, width, _size, _color, _bold, height) => {
        const label = new Sprite().pos(x, y).size(width, height);
        label.text = text;
        return parent.addChild(label);
    };
    session.changed = () => view.refresh();
    session.state.gate = 1;
    session.state.towers = session.state.towers.map(() => ({kind:null,level:0,operator:null}));
    session.command({ type: 'NIGHT' });
    for (let i=0;i<1000&&session.state.phase==='NIGHT';i++) session.update(.25);
    const box=()=>view.overlay.getChildAt(0);
    assert.equal(session.state.phase,'GAME_OVER');
    const stored=JSON.stringify([...env.storage]);
    assert.equal(box().name,'panel:守夜失败');
    const labels = name => box().getChildByName(name).children.flatMap(n => typeof n.text === 'string' ? [n.text] : []);
    assert.deepEqual(labels('DefeatScore'), ['城门失守', '本局守住', '0', '夜']);
    assert.deepEqual(labels('DefeatVillage'), ['本局村庄', '传承', '1 代', '迎来孩子', '0 人', '荣休村民', '0 位']);
    assert.deepEqual(labels('DefeatRecords'), ['历史纪录', '最长坚守', '0 夜', '累计出生', '0 人']);
    const cardBottom = box().getChildByName('DefeatRecords');
    const restart = box().getChildByName('button:重新开村');
    assert(cardBottom.y + cardBottom.height < restart.y);
    assert.equal(box().height - restart.y - restart.height, 48);
    assert.equal(box().getChildByName('button:收下'),undefined);
    view.results.advance(2); assert.equal(view.results.layer.visible,false);
    assert.equal(view.hud.node.getChildByName('RankingButton'),undefined);
    assert.equal(JSON.stringify([...env.storage]),stored);
    restart.action();
    assert.equal(box().name, 'panel:确认重新开村');
    assert.equal(JSON.stringify([...env.storage]),stored);
    box().getChildByName('button:确认重新开村').action();
    assert.equal(session.state.phase,'DAY');
    assert.equal(session.state.day,1);
});
test('new tactic marks survive reload and are cleared by viewing, rollback and a clean restart', () => {
    const local = new Map(), port = { read:k => local.get(k) ?? null, write:(k,v) => local.set(k,v) };
    const state = createGame(73); state.completed = 9;
    const notices = new TacticNotices(port); notices.observe(state, false); assert(!notices.unread);
    state.completed = 10; notices.observe(state, false); assert(notices.unread);
    let restored = new TacticNotices(port); restored.observe(state, false); assert(restored.unread);
    restored.markSeen(); restored = new TacticNotices(port); restored.observe(state, false); assert(!restored.unread);
    state.completed = 15; restored.observe(state, false); assert(restored.unread);
    state.completed = 14; restored.observe(state, false); assert(!restored.unread);
    state.completed = 15; restored.observe(state, false); assert(restored.unread);
    state.completed = 0; restored.observe(state, true); assert(!restored.unread);
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
    const view = gameView(session, env.platform), oldMotion = view.village.motion, oldThoughts = view.village.thoughts;
    let houseTipHidden = false; view.anchoredTip.hide = () => { houseTipHidden = true; };
    view.panels.current = {type:'restart'}; view.tip.visible = true; session.changed=()=>view.refresh();
    session.newVillage(); assert.equal(session.state.run,1); assert.equal(view.panels.current,null); assert.notEqual(view.village.motion,oldMotion); assert.notEqual(view.village.thoughts,oldThoughts); assert.equal(view.tip.visible,false);
    assert(houseTipHidden, 'pure restart must clear the house tip target as well');
});

test('ranking resize retains the live instance and pending authorization; closing invalidates it once', () => {
    const env = setup(), session = new GameSession(new SaveStore(env.platform)); session.load(); session.newVillage();
    session.state.legacy.bestNight = 1;
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
    assert.equal(env.messages.length, initialMessages);
    assert.equal(env.canvas.style.width, '1px');
    view.panels.advance(.24);
    assert.deepEqual(env.messages.slice(initialMessages).map(message => message.type), ['updateViewPort']);
    assert.equal(env.canvas.style.width, '600px');
    view.panels.close(); assert.equal(destroyed, 1); assert.equal(ranking.destroyed, true);
    const messages = env.messages.length; privacy.success();
    assert.equal(env.authorization.length, 0); assert.equal(env.messages.length, messages);
});

test('panel refresh keeps entry progress and exit blocks input until the backdrop is removed', () => {
    const env = setup(), session = new GameSession(new SaveStore(env.platform)); session.load(); session.newVillage();
    const view = gameView(session, env.platform), box = () => view.overlay.getChildAt(0);
    view.panels.modal = title => {
        const node = new Sprite(); node.name = 'panel:' + title; node.size(668, 860); view.overlay.addChild(node); return node;
    };
    view.panels.open({ type: 'settings' });
    assert.equal(box().scaleX, .82);
    assert.equal(box().mouseEnabled, false);
    assert.equal(view.overlay.mouseThrough, false);
    view.panels.advance(.17);
    const overshoot = box().scaleX;
    assert(overshoot > 1);
    view.refresh();
    assert.equal(box().scaleX, overshoot);
    view.panels.advance(.07);
    assert.equal(box().scaleX, 1);
    assert.equal(box().mouseEnabled, true);
    assert.equal(box().x + box().width / 2, 360);
    assert.equal(box().y + box().height / 2, (layout.safeTop + layout.safeBottom) / 2);
    view.refresh();
    assert.equal(box().scaleX, 1);
    view.panels.close();
    assert.equal(session.pauses.has('CHOICE'), false);
    assert.equal(box().mouseEnabled, false);
    view.panels.advance(.03);
    assert(box().scaleX > 1);
    view.panels.advance(.10);
    assert(box().scaleX < 1);
    assert(view.overlay.alpha < 1);
    assert.equal(view.overlay.mouseThrough, false);
    const leaving = box();
    view.refresh();
    assert.equal(box(), leaving);
    assert(view.panels.advance(.055));
    assert.equal(view.overlay.numChildren, 0);
    assert.equal(view.overlay.alpha, 1);
    assert.equal(view.overlay.mouseThrough, true);
});

test('closing ranking during entry hides the canvas and prevents stale authorization from claiming a reopened panel', () => {
    const env = setup(), session = new GameSession(new SaveStore(env.platform)); session.load(); session.newVillage();
    session.state.legacy.bestNight = 1;
    const view = gameView(session, env.platform);
    session.changed = () => view.refresh();
    view.panels.open({ type: 'ranking' });
    const leaving = view.overlay.getChildAt(0), old = leaving.getChildByName('FriendRankingCanvas');
    const stale = env.privacy.shift();
    assert(stale);
    assert.equal(env.canvas.style.width, '1px');
    assert.equal(env.messages.at(-2).type, 'updateViewPort');
    assert.equal(env.messages.at(-1).showRanking, true);
    view.panels.close();
    assert(old.destroyed);
    assert.equal(env.messages.at(-1).type, 'close');
    assert.equal(view.overlay.getChildAt(0), leaving);
    view.panels.open({ type: 'ranking' });
    assert(leaving.destroyed);
    const current = env.privacy.shift();
    stale.success();
    assert.equal(env.authorization.length, 0);
    current.success();
    env.authorization.shift().success();
    view.panels.advance(.24);
    assert.equal(env.canvas.style.width, '600px');
    session.hide();
    assert.equal(view.overlay.numChildren, 0);
    assert.equal(env.canvas.style.width, '1px');
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
    session.state.legacy.bestNight = 1;
    const view = gameView(session, s.platform); view.root = { size() {} }; view.tip.pos = () => {};
    view.panels.open({ type: 'ranking' });
    view.panels.advance(.24);
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
