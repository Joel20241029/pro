const { test } = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const compiled = process.env.DAIDAI_TEST_BUILD;
if (!compiled) throw new Error('Set DAIDAI_TEST_BUILD to the compiled project under Downloads');
const { RULE, TOWERS, PADS } = require(path.join(compiled, 'game/GameConfig.js'));
const { createGame, applyCommand, birthUnavailableReason } = require(path.join(compiled, 'game/VillageRules.js'));
const { BattleSimulation, pointAt, PATH_LENGTH } = require(path.join(compiled, 'game/BattleSimulation.js'));
const { GameSession } = require(path.join(compiled, 'game/GameSession.js'));
const { SaveStore, canonical } = require(path.join(compiled, 'storage/SaveStore.js'));
const { upgradeCost, upgradeUnavailableReason } = require(path.join(compiled, 'game/Growth.js'));

function session() {
    const values = new Map(), store = new SaveStore({ read: k => values.get(k) ?? null, write: (k, v) => values.set(k, v) });
    const game = new GameSession(store); game.load(); game.newVillage();
    return { game, values };
}
// Keep a real simulation alive past the duration without relying on a particular generated wave.
function longBattle(s = createGame(7)) {
    applyCommand(s, { type: 'NIGHT' });
    s.wave.entries = [{ tick: RULE.bellTicks * 10, kind: 'enemy_raider' }];
    return new BattleSimulation(s);
}

test('bell lasts exactly 300 simulation steps; duplicate use never refreshes it', () => {
    const b = longBattle(); assert.equal(RULE.bellTicks * RULE.step, 15); b.bell();
    for (let i = 0; i < RULE.bellTicks - 1; i++) b.step();
    assert.equal(b.bellTicks, 1); b.bell(); assert.equal(b.bellTicks, 1);
    b.step(); assert.equal(b.bellTicks, 0); b.bell(); assert.equal(b.bellTicks, 0);
    assert.equal(b.bellUsed, true);
    const next = new BattleSimulation(b.base); assert.equal(next.bellUsed, false); assert.equal(next.bellTicks, 0);
});

test('1/2/3 speed changes real duration to 15/7.5/5 seconds, not combat duration', () => {
    for (const speed of [1, 2, 3]) {
        const { game } = session(); game.command({ type: 'NIGHT' }); game.command({ type: 'SPEED', value: speed });
        const b = game.battle; b.base.wave.entries = [{ tick: RULE.bellTicks * 10, kind: 'enemy_raider' }]; game.bell();
        const frames = RULE.bellTicks / speed;
        for (let i = 0; i < frames - 1; i++) game.update(RULE.step);
        assert.equal(b.bellTicks, speed); game.update(RULE.step);
        assert.equal(b.bellTicks, 0); assert.equal(b.tick, RULE.bellTicks); assert.equal(frames * RULE.step, 15 / speed);
    }
});

test('every pause freezes bell and attacks; tower swaps retain current charge and duration', () => {
    const { game } = session(); game.command({ type: 'NIGHT' }); game.bell(); game.update(.1);
    const b = game.battle, tick = b.tick, remaining = b.bellTicks;
    for (const reason of ['USER', 'CHOICE', 'BACKGROUND', 'WAIT_RESUME', 'SAVE_PENDING', 'DISABLED']) {
        game.pause(reason); game.update(20); game.bell(); assert.equal(b.tick, tick); assert.equal(b.bellTicks, remaining); game.resume(reason);
    }
    game.pause('CHOICE'); const charge = b.charge.slice();
    assert(game.reassign(0, b.operators[1])); assert.deepEqual(b.charge, charge); assert.equal(b.bellTicks, remaining);
    game.resume('CHOICE'); game.update(RULE.step); assert.equal(b.bellTicks, remaining - 1);
});

test('bell increases actual fire rate by 50%, hunger multiplies it, damage stays unchanged', () => {
    const results = [];
    for (const [bell, hungry] of [[false, false], [true, false], [true, true]]) {
        const b = longBattle(); b.base.towers.slice(1).forEach(t => t.operator = null);
        b.base.policy = null; b.base.night.hungry = hungry;
        const op = b.base.people.find(p => p.id === b.operators[0]); op.trait = 'trait_frugal'; op.skill = 'skill_farming'; op.elite = false;
        let progress = 0, distance = Infinity;
        for (let at = 0; at < PATH_LENGTH; at++) {
            const p = pointAt(at), d = Math.hypot(p.x - PADS[0].x, p.y - PADS[0].y);
            if (d < distance) { distance = d; progress = at; }
        }
        assert(distance < TOWERS.ARROW.range);
        const enemy = { seq: 1, kind: 'enemy_raider', progress, hp: 100000, speed: 0, slow: 0, slowTicks: 0, born: 0, summoned: 0 };
        b.enemies = [enemy]; b.charge[0] = 0; if (bell) b.bell(); let shots = 0;
        for (let i = 0; i < RULE.bellTicks; i++) { const tick = b.tick; b.step(); shots += b.shots.filter(s => s.tick === tick).length; }
        const speed = (bell ? 1.5 : 1) * (hungry ? .7 : 1);
        assert.equal(shots, Math.floor(15 * speed / TOWERS.ARROW.interval));
        assert.equal(100000 - enemy.hp, shots * TOWERS.ARROW.damage); results.push(shots);
    }
    assert(results[1] > results[0]); assert(results[2] < results[1]);
});

test('full population gives a feasible remedy; preview and execution share the same rejection', () => {
    const s = createGame(4); s.houses = RULE.houseMax;
    while (s.people.length < RULE.populationCap) s.people.push({ ...s.people[4], id: `test:${s.people.length}` });
    const before = canonical(s), reason = `人口已满 ${RULE.populationCap} 人，需等空出名额`;
    assert.equal(birthUnavailableReason(s, s.families[0].id), reason);
    assert.throws(() => applyCommand(s, { type: 'BIRTH', family: s.families[0].id, carer: s.people[0].id }), { message: reason });
    assert.equal(canonical(s), before);
});

test('upgrade preview explains both deficits, exact resources pass, storage is checked first', () => {
    const s = createGame(3), cost = upgradeCost('FARM', s.farm); s.food = 0; s.wood = 0;
    assert.equal(upgradeUnavailableReason(s, cost), `还缺 ${cost.wood} 木、${cost.food} 粮`);
    const before = canonical(s); assert.throws(() => applyCommand(s, { type: 'BUILD', kind: 'FARM' }), { message: upgradeUnavailableReason(s, cost) }); assert.equal(canonical(s), before);
    assert.equal(upgradeUnavailableReason(s, { wood: RULE.storageCap + 1, food: 1 }), `费用超出仓储 ${RULE.storageCap}，先修缮民居`);
    s.wood = cost.wood; s.food = cost.food; assert.equal(upgradeUnavailableReason(s, cost), null);
    applyCommand(s, { type: 'BUILD', kind: 'FARM' }); assert.equal(s.farm, 2); assert.equal(s.food, 0); assert.equal(s.wood, 0);
});

// Display-list test doubles verify interaction and scroll bounds, not native font measurements.
class Sprite {
    constructor() { this.name = ''; this.children = []; this.handlers = {}; this.graphics = { drawRect() {}, drawCircle() {}, clear() {} }; }
    pos(x, y) { this.x = x; this.y = y; return this; }
    size(w, h) { this.width = w; this.height = h; return this; }
    addChild(n) { this.children.push(n); return n; }
    destroyChildren() { this.children.length = 0; }
    getChildAt(i) { return this.children[i]; }
    get numChildren() { return this.children.length; }
    getChildByName(name) { return this.children.find(n => n.name === name); }
    on(event, caller, fn) { this.handlers[event] = (...args) => fn.apply(caller, args); }
    event(event, data) { this.handlers[event]?.(data); }
    off() {}
}
global.Laya = { Sprite, Text: { SHRINK: 'shrink' }, Rectangle: class {}, OpenDataContextView: class {}, Texture2D: class {}, Event: { CLICK: 'click', MOUSE_DOWN: 'down', MOUSE_UP: 'up', MOUSE_OUT: 'out', UNDISPLAY: 'undisplay' } };
const { GamePanels } = require(path.join(compiled, 'view/GamePanels.js'));
const { GameHud } = require(path.join(compiled, 'view/GameHud.js'));
const { UiWidgets } = require(path.join(compiled, 'view/UiWidgets.js'));
const { GUIDE_CHAPTERS } = require(path.join(compiled, 'view/GameGuide.js'));
function panelView(game) {
    const art = { panel() {} }, view = new GamePanels(game, art, {}, null, new Sprite(), {}, () => {
        if (view.current) view.draw(game.state, view.current);
    });
    const ui = new UiWidgets(art, () => view.clickSounds++);
    Object.assign(view, { ui, clickSounds: 0, modal() { this.box = new Sprite(); return this.box; } });
    ui.label = (parent, text, x, y, w, font, color, bold, h) => {
        const node = new Sprite().pos(x, y).size(w, h); node.text = text; node.textHeight = 200; parent.addChild(node); return node;
    };
    return view;
}

test('help entry and all five tabs are read-only; each chapter resets its own scrolling', () => {
    const { game, values } = session(), view = panelView(game), saved = canonical([...values]), state = canonical(game.state);
    view.open({ type: 'settings' }); view.box.getChildByName('button:玩法说明').event('click');
    assert.equal(view.clickSounds, 1);
    assert.deepEqual(GUIDE_CHAPTERS.map(c => c.title), ['起步', '村民', '家庭', '建设', '守夜']);
    for (let i = 0; i < GUIDE_CHAPTERS.length; i++) {
        view.box.getChildByName(`button:${GUIDE_CHAPTERS[i].title}`).event('click'); assert.equal(view.current.tab, i);
        const rows = view.box.getChildByName('ScrollList'); assert.equal(rows.offset, 0); assert(rows.maximum > 0);
        rows.setOffset(rows.maximum); assert.equal(view.current.scroll, rows.maximum);
        const chapter = rows.content.children[0], last = chapter.children[chapter.children.length - 1];
        assert(last.y + last.height - rows.offset <= rows.height, 'last paragraph remains reachable');
    }
    view.close(); assert(!game.pauses.has('CHOICE')); assert.equal(canonical([...values]), saved); assert.equal(canonical(game.state), state);
});

test('leaving a pressed button, ranking entry or tower cancels the engine click and its sound', () => {
    const { game } = session(), view = panelView(game), opened = [];
    game.state.legacy.bestNight = 1;
    const layout = { mapTop: 280, footerTop: 980, gateY: 680, height: 1280, safeTop: 0, dateY: 42, resourcesY: 124 };
    view.ui.image = () => ({}); view.open = panel => opened.push(panel);
    const hud = new GameHud(game, view.art, view.ui, view, () => {});
    hud.drawHeader(layout); hud.draw(game.state, layout, { pads: PADS });
    const tower = hud.node.children.find(n => n.x === PADS[0].x - 58 && n.y === PADS[0].y - 80 && n.width === 116);
    const entries = [hud.node.getChildByName('button:小记'), hud.node.getChildByName('RankingButton'), tower];
    const cancelled = [];
    Laya.InputManager = { cancelClick: id => cancelled.push(id) };
    for (const [index, entry] of entries.entries()) {
        assert(entry);
        const touch = { touchId: index };
        entry.event('down', touch);
        entry.event('out', { touchId: 9 }); // This pointer never pressed the entry.
        assert.equal(cancelled.length, index);
        entry.event('out', touch);
        assert.equal(cancelled.at(-1), touch.touchId);
        // A short release may still target the pressed node unless the engine click was cancelled.
        if (!cancelled.includes(touch.touchId)) entry.event('click', touch);
        assert.equal(view.clickSounds, index);
        assert.equal(opened.length, index);

        const tap = { touchId: 10 + index };
        entry.event('down', tap);
        entry.event('up', tap);
        entry.event('click', tap);
        entry.event('out', tap); // Native touch release emits a final MOUSE_OUT after CLICK.
        assert.equal(cancelled.length, index + 1);
        assert.equal(view.clickSounds, index + 1);
    }
    assert.deepEqual(opened, [{ type: 'settings' }, { type: 'ranking' }, { type: 'tower', index: 0 }]);
    assert.deepEqual(cancelled, [0, 1, 2]);

    const button = entries[0], face = button.getChildAt(0);
    button.event('down', { touchId: 16 }); assert.notEqual(face.y, 0);
    button.event('out'); // ScrollList already cancelled its pointer and sends a visual reset without event data.
    assert.equal(face.y, 0);
    assert.deepEqual(cancelled, [0, 1, 2]);
});

test('opening and closing help removes only CHOICE, leaving independent pauses intact', () => {
    const { game } = session(); game.command({ type: 'NIGHT' }); game.bell(); const view = panelView(game), tick = game.battle.tick;
    for (const reason of ['USER', 'BACKGROUND', 'WAIT_RESUME', 'SAVE_PENDING', 'DISABLED']) game.pause(reason);
    view.open({ type: 'guide', tab: 4 }); game.update(.25); assert.equal(game.battle.tick, tick);
    view.close(); assert.deepEqual([...game.pauses].sort(), ['USER', 'BACKGROUND', 'WAIT_RESUME', 'SAVE_PENDING', 'DISABLED'].sort());
    for (const reason of [...game.pauses]) game.resume(reason);
    game.update(RULE.step); assert.equal(game.battle.tick, tick + 1);
});

test('tower building is disabled before payment when short of wood or during night', () => {
    const { game } = session(), view = panelView(game); view.ui.image = () => ({}); view.ui.buildRow = () => {};
    game.state.wood = TOWERS.ARROW.cost - 1; view.open({ type: 'tower', index: 2 });
    const unavailable = view.box.children.find(n => n.name.startsWith('button:箭楼')); assert(unavailable.name.includes('还缺 1 木')); assert(!unavailable.handlers.click);
    game.state.wood++; view.open({ type: 'tower', index: 2 }); assert(view.box.children.find(n => n.name.startsWith('button:箭楼')).handlers.click);
    game.command({ type: 'NIGHT' }); view.open({ type: 'tower', index: 2 });
    assert(!view.box.children.find(n => n.name.startsWith('button:箭楼')).handlers.click);
});


test('clean-start choice requires confirmation, cancellation is read-only and inheritance stays available', () => {
    const {game,values}=session(),view=panelView(game); const initial=canonical(game.state),saved=canonical([...values]);
    view.open({type:'restart'}); assert(view.box.getChildByName('button:传承开村'));
    view.box.getChildByName('button:纯净开始').event('click'); assert.equal(view.current.type,'cleanStart');
    assert.equal(canonical(game.state),initial); assert.equal(canonical([...values]),saved);
    view.box.getChildByName('button:取消').event('click'); assert.equal(view.current.type,'restart');assert.equal(canonical([...values]),saved);
    view.box.getChildByName('button:纯净开始').event('click'); const revision=game.villageRevision;
    view.box.getChildByName('button:确认纯净开始').event('click');assert.equal(game.villageRevision,revision+1);assert.equal(game.state.run,1);assert.equal(game.state.legacy.lastRationDate,null);
});

test('resizing an open guide preserves its panel, scroll list, offset and pause without writing a save', () => {
    const { GameView } = require(path.join(compiled, 'view/GameView.js'));
    const { GameLayout } = require(path.join(compiled, 'view/GameLayout.js'));
    const { game, values } = session(), panels = panelView(game), overlay = new Sprite();
    panels.modal = () => { const box = new Sprite().size(668, 860); overlay.addChild(box); return box; };
    panels.open({ type: 'guide', tab: 4 });
    const box = overlay.getChildAt(0), rows = box.getChildByName('ScrollList'); rows.setOffset(rows.maximum);
    const panel = panels.current, offset = rows.offset, saved = canonical([...values]), state = canonical(game.state);
    const window = { windowWidth: 390, windowHeight: 844, statusBarHeight: 47, safeArea: { top: 47, bottom: 810 } };
    const menu = { width: 88, height: 32, top: 51, bottom: 83, left: 292, right: 380 };
    const view = Object.create(GameView.prototype);
    Object.assign(view, { game, panels, overlay, layout: new GameLayout(window, menu), platform: { window: { ...window, windowHeight: 900, safeArea: { top: 47, bottom: 866 } }, menu },
        root: new Sprite(), tip: { pos() {} }, observedVillageRevision: game.villageRevision,
        village: { scene: { pads: PADS }, relayout() {}, sync() {}, drawScenery() {} }, updateActors() {} });
    view.hud = new GameHud(game, panels.art, panels.ui, panels, () => view.refresh()); panels.ui.image = () => ({});
    view.resize();
    assert.equal(overlay.getChildAt(0), box); assert.equal(box.getChildByName('ScrollList'), rows);
    assert.equal(panels.current, panel); assert.equal(rows.offset, offset); assert.equal(panel.scroll, offset);
    assert(game.pauses.has('CHOICE')); assert.equal(canonical([...values]), saved); assert.equal(canonical(game.state), state);
});
