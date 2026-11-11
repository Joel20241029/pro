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
    getChildAt(i) { return this.children[i]; }
    getChildByName(name) { return this.children.find(n => n.name === name); }
    on(event, caller, fn) { this.handlers[event] = () => fn.call(caller); }
    event(event) { this.handlers[event]?.(); }
    off() {}
}
global.Laya = { Sprite, Rectangle: class {}, OpenDataContextView: class {}, Texture2D: class {}, Event: { CLICK: 'click', MOUSE_DOWN: 'down', MOUSE_UP: 'up', MOUSE_OUT: 'out', UNDISPLAY: 'undisplay' } };
const { GameView } = require(path.join(compiled, 'view/GameView.js'));
const { GUIDE_CHAPTERS } = require(path.join(compiled, 'view/GameGuide.js'));
function panelView(game) {
    const view = Object.create(GameView.prototype);
    Object.assign(view, {
        game, art: { panel() {} }, panel: null,
        modal() { this.box = new Sprite(); return this.box; },
        label(parent, text, x, y, w, font, color, bold, h) {
            const node = new Sprite().pos(x, y).size(w, h); node.text = text; node.textHeight = 200; parent.addChild(node); return node;
        },
        refresh() { if (this.panel) this.drawPanel(game.state, this.panel); }
    }); return view;
}

test('help entry and all five tabs are read-only; each chapter resets its own scrolling', () => {
    const { game, values } = session(), view = panelView(game), saved = canonical([...values]), state = canonical(game.state);
    view.open({ type: 'settings' }); view.box.getChildByName('button:玩法说明').event('click');
    assert.deepEqual(GUIDE_CHAPTERS.map(c => c.title), ['起步', '村民', '家庭', '建设', '守夜']);
    for (let i = 0; i < GUIDE_CHAPTERS.length; i++) {
        view.box.getChildByName(`button:${GUIDE_CHAPTERS[i].title}`).event('click'); assert.equal(view.panel.tab, i);
        const rows = view.box.getChildByName('ScrollList'); assert.equal(rows.offset, 0); assert(rows.maximum > 0);
        rows.setOffset(rows.maximum); assert.equal(view.panel.scroll, rows.maximum);
        const chapter = rows.content.children[0], last = chapter.children[chapter.children.length - 1];
        assert(last.y + last.height - rows.offset <= rows.height, 'last paragraph remains reachable');
    }
    view.close(); assert(!game.pauses.has('CHOICE')); assert.equal(canonical([...values]), saved); assert.equal(canonical(game.state), state);
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
    const { game } = session(), view = panelView(game); view.image = () => ({}); view.buildRow = () => {};
    game.state.wood = TOWERS.ARROW.cost - 1; view.open({ type: 'tower', index: 2 });
    const unavailable = view.box.children.find(n => n.name.startsWith('button:箭楼')); assert(unavailable.name.includes('还缺 1 木')); assert(!unavailable.handlers.click);
    game.state.wood++; view.open({ type: 'tower', index: 2 }); assert(view.box.children.find(n => n.name.startsWith('button:箭楼')).handlers.click);
    game.command({ type: 'NIGHT' }); view.open({ type: 'tower', index: 2 });
    assert(!view.box.children.find(n => n.name.startsWith('button:箭楼')).handlers.click);
});
