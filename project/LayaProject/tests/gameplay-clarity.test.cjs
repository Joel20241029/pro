const { test } = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const compiled = process.env.DAIDAI_TEST_BUILD;
if (!compiled) throw new Error('Set DAIDAI_TEST_BUILD to the compiled project under Downloads');
const { RULE, TOWERS, PADS } = require(path.join(compiled, 'game/GameConfig.js'));
const { TACTIC_USE } = require(path.join(compiled, 'config/TacticConfig.js'));
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

test('bell lasts 300 steps and only the cooldown boundary permits a second cast', () => {
    const b = longBattle(); assert.equal(RULE.bellTicks * RULE.step, 15); b.bell();
    for (let i = 0; i < RULE.bellTicks - 1; i++) b.step();
    assert.equal(b.bellTicks, 1); b.bell(); assert.equal(b.bellTicks, 1);
    b.step(); assert.equal(b.bellTicks, 0); b.bell(); assert.equal(b.bellTicks, 0);
    assert.equal(b.tacticUsesLeft, 1);
    while (b.tick < TACTIC_USE.cooldownTicks - 1) b.step();
    b.bell(); assert.equal(b.canCastTactic, false); assert.equal(b.tacticCooldownTicks, 1);
    b.step(); assert.equal(b.canCastTactic, true); b.bell();
    assert.equal(b.bellTicks, RULE.bellTicks); assert.equal(b.tacticUsesLeft, 0);
    while (b.tacticCooldownTicks) b.step();
    b.bell(); assert.equal(b.bellTicks, 0); assert.equal(b.canCastTactic, false);
    const next = new BattleSimulation(b.base);
    assert.equal(next.tacticUsesLeft, TACTIC_USE.perNight); assert.equal(next.bellTicks + next.tacticCooldownTicks, 0);
});

test('two speed levels keep 15 combat seconds and take 7.5/5 real seconds', () => {
    for (const speed of [2, 3]) {
        const { game } = session(); game.command({ type: 'NIGHT' }); game.command({ type: 'SPEED', value: speed });
        const b = game.battle; b.base.wave.entries = [{ tick: RULE.bellTicks * 10, kind: 'enemy_raider' }]; game.bell();
        const frames = RULE.bellTicks / speed;
        for (let i = 0; i < frames - 1; i++) game.update(RULE.step);
        assert.equal(b.bellTicks, speed); game.update(RULE.step);
        assert.equal(b.bellTicks, 0); assert.equal(b.tick, RULE.bellTicks); assert.equal(frames * RULE.step, 15 / speed);
    }
});

test('new villages default to actual 2x; only actual 2x/3x can be saved and resumed', () => {
    const { game, values } = session();
    const { validateState } = require(path.join(compiled, 'storage/StateValidation.js'));
    assert.equal(game.state.settings.speed, 2);
    assert.throws(() => applyCommand(game.state, { type: 'SPEED', value: 1 }), /无效倍速/);
    const invalid = JSON.parse(JSON.stringify(game.state)); invalid.settings.speed = 1;
    assert.throws(() => validateState(invalid));
    game.command({ type: 'NIGHT' }); const battle = game.battle;
    game.pause('USER');
    for (const speed of [3, 2]) {
        game.command({ type: 'SPEED', value: speed }); game.update(1);
        assert.equal(game.battle, battle); assert.equal(battle.tick, 0);
        const reloaded = new GameSession(new SaveStore({ read: k => values.get(k) ?? null, write: (k, v) => values.set(k, v) }));
        reloaded.load(); assert.equal(reloaded.state.settings.speed, speed);
    }
    game.resume('USER'); game.update(.25); assert.equal(battle.tick, 10);
    game.command({ type: 'SPEED', value: 3 }); game.update(.25); assert.equal(battle.tick, 25);
});

test('every pause freezes bell and attacks; tower swaps retain current charge and duration', () => {
    const { game } = session(); game.command({ type: 'NIGHT' }); game.bell(); game.update(.1);
    const b = game.battle, tick = b.tick, remaining = b.bellTicks;
    for (const reason of ['USER', 'CHOICE', 'BACKGROUND', 'WAIT_RESUME', 'SAVE_PENDING', 'DISABLED']) {
        game.pause(reason); game.update(20); game.bell(); assert.equal(b.tick, tick); assert.equal(b.bellTicks, remaining); game.resume(reason);
    }
    game.pause('CHOICE'); const charge = b.charge.slice();
    assert(game.reassign(0, b.operators[1])); assert.deepEqual(b.charge, charge); assert.equal(b.bellTicks, remaining);
    game.resume('CHOICE'); game.update(RULE.step); assert.equal(b.bellTicks, remaining - RULE.minSpeed);
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
        const enemy = { seq: 1, kind: 'enemy_raider', progress, hp: 100000, speed: 0, slow: 0, slowTicks: 0, walkDistance: 0, born: 0, summoned: 0 };
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
    constructor() { this.name = ''; this.children = []; this.handlers = {}; this.graphics = { drawRect() {}, drawCircle() {}, drawLine() {}, drawLines() {}, drawPath() {}, drawRoundRect() {}, drawPoly() {}, clear() {} }; }
    pos(x, y) { this.x = x; this.y = y; return this; }
    size(w, h) { this.width = w; this.height = h; return this; }
    scale(x,y) { this.scaleX=x; this.scaleY=y; return this; }
    pivot(x,y) { this.pivotX=x; this.pivotY=y; return this; }
    addChild(n) { this.children.push(n); n.parent = this; return n; }
    destroyChildren() { this.children.length = 0; }
    destroy() { this.destroyChildren();this.destroyed=true;if(this.parent)this.parent.children.splice(this.parent.children.indexOf(this),1);this.parent=null;this.handlers={}; }
    getChildAt(i) { return this.children[i]; }
    get numChildren() { return this.children.length; }
    getChildByName(name) { return this.children.find(n => n.name === name); }
    on(event, caller, fn) { this.handlers[event] = (...args) => fn.apply(caller, args); }
    event(event, data) { this.handlers[event]?.(data); }
    off() {}
}
const Tween = { killAll() {}, create(target) {
    return { duration() { return this; }, to(key, value) { target[key] = value; return this; }, ease() { return this; } };
} };
global.Laya = { Sprite, Tween, Ease: { elasticOut: () => 1 }, ColorFilter: class { gray() { return this; } }, Text: { SHRINK: 'shrink' }, Rectangle: class {}, OpenDataContextView: class {}, Texture2D: class {}, Event: { CLICK: 'click', MOUSE_DOWN: 'down', MOUSE_UP: 'up', MOUSE_OUT: 'out', UNDISPLAY: 'undisplay' } };
const { GamePanels } = require(path.join(compiled, 'view/GamePanels.js'));
const { GameHud } = require(path.join(compiled, 'view/GameHud.js'));

test('night status names the equipped effect rather than calling every tactic attack speed', () => {
    const { game } = session();
    const hud = Object.create(GameHud.prototype); hud.game = game; hud.nightStatus = { text: '' };
    for (const [effect, name, label] of [['ATTACK_SPEED','大王之心','攻速'],['ATTACK_DAMAGE','百毅靓之怒','伤害']]) {
        game.battle = { outcome: null, bellTicks: 300, tactic: { effect, name, multiplier: 1.5 } };
        hud.update(); assert.equal(hud.nightStatus.text, `${name} · ${label} +50% · 还剩 8秒`);
    }
});
const { UiWidgets } = require(path.join(compiled, 'view/UiWidgets.js'));
const { GUIDE_CHAPTERS } = require(path.join(compiled, 'view/GameGuide.js'));
function panelView(game, overlay = new Sprite()) {
    const art = { panel() {}, get: id => id, contentBounds: () => ({rect:{w:64,h:64},sourceSize:{w:64,h:64},trimOffset:{x:0,y:0}}) }, view = new GamePanels(game, art, {}, null, overlay, {}, () => {
        if (view.current) view.draw(game.state, view.current);
    }, { ready: () => true });
    const ui = new UiWidgets(art, () => view.clickSounds++);
    Object.assign(view, { resources: { ready: () => true }, ui, clickSounds: 0, modal() { this.box = new Sprite(); return this.box; } });
    ui.label = (parent, text, x, y, w, font, color, bold, h) => {
        const node = new Sprite().pos(x, y).size(w, h); node.text = text; node.fontSize = font; node.textHeight = 200; node.textWidth = text.replace(/<[^>]*>/g, '').length * (font || 28); parent.addChild(node); return node;
    };
    return view;
}
function imageNode(parent, id, x, y, width, height = width) {
    const node = new Sprite().pos(x, y).size(width, height); node.name = id;
    node.pivot = (x,y) => { node.pivotX=x; node.pivotY=y; return node; };
    node.scale = (x,y) => { node.scaleX=x; node.scaleY=y; return node; };
    parent.addChild(node); return node;
}

test('night controls preserve pause/speed/bell rules and restore village navigation after night', () => {
    const { game } = session(), view = panelView(game); view.ui.image = imageNode;
    const layout = {mapTop:280,footerTop:980,gateY:680,height:1280,safeTop:0,dateY:42,resourcesY:124};
    const anchors = {towerAnchor:i=>PADS[i],gateAnchor:()=>({x:360,y:680})};
    let hud;
    const draw = () => { hud.clear(); hud.draw(game.state,layout,{pads:PADS},anchors); hud.update(); };
    hud = new GameHud(game, view.art, view.ui, view, draw); game.changed = draw;
    draw(); assert(hud.node.getChildByName('button:家庭'));
    game.command({type:'NIGHT'});
    game.battle.base.wave.entries = [{tick:RULE.bellTicks*10,kind:'enemy_raider'}];
    const controls = () => hud.node.getChildByName('NightControls');
    const button = name => controls().getChildByName('button:'+name);
    const heartFace = () => button('大王之心').getChildByName('buttonFace');
    assert.equal(controls().children.filter(n=>n.name.startsWith('button:')).length,3);
    for(const name of ['村民','家庭','建设','家谱']) assert.equal(hud.node.getChildByName('button:'+name),undefined);
    assert.equal(heartFace().getChildByName('HeartState').text, '可用 2 次');
    button('大王之心').event('click'); assert.equal(game.battle.tacticUsesLeft, 1);
    assert.equal(heartFace().getChildByName('HeartState').text,'生效 8秒');
    assert.equal(button('大王之心').mouseEnabled,false);
    button('暂停').event('click'); assert(game.pauses.has('USER'));
    const remaining = game.battle.bellTicks; game.update(1); hud.update();
    assert.equal(game.battle.bellTicks,remaining);
    assert.equal(heartFace().getChildByName('buttonSkin').filters,undefined);
    assert.equal(game.state.settings.speed,2); assert(button('速度 ×1'));
    for(const value of [3,2,3,2]) {
        button('速度 ×'+(game.state.settings.speed === RULE.minSpeed ? 1 : 2)).event('click');
        assert.equal(game.state.settings.speed,value); assert.equal(game.battle.bellTicks,remaining);
        assert.equal(button('速度 ×3'),undefined);
    }
    game.pause('CHOICE'); button('继续守夜').event('click');
    assert(!game.pauses.has('USER')); assert(game.pauses.has('CHOICE'));
    game.resume('CHOICE'); draw();
    for(let i=0;i<RULE.bellTicks / RULE.minSpeed;i++) game.update(RULE.step);
    hud.update(); assert.equal(heartFace().getChildByName('HeartState').text,'冷却 3秒');
    assert.equal(button('大王之心').mouseEnabled,false); assert.equal(heartFace().getChildByName('buttonSkin').filters.length,1);
    const cooling = game.battle.tacticCooldownTicks;
    button('速度 ×1').event('click'); assert.equal(game.battle.tacticCooldownTicks, cooling);
    assert.equal(heartFace().getChildByName('HeartState').text, '冷却 2秒');
    while (game.battle.tacticCooldownTicks) game.update(RULE.step);
    hud.update(); assert.equal(heartFace().getChildByName('HeartState').text, '可用 1 次');
    button('大王之心').event('click'); assert.equal(game.battle.tacticUsesLeft, 0);
    while (game.battle.bellTicks) game.update(RULE.step);
    hud.update(); assert.equal(heartFace().getChildByName('HeartState').text, '已用完');
    game.newVillage(); assert.equal(hud.node.getChildByName('NightControls'),undefined);
    for(const name of ['村民','家庭','建设','家谱']) assert(hud.node.getChildByName('button:'+name));
});

test('paused unused heart can become actionable without binding its click twice', () => {
    const { NightControls } = require(path.join(compiled,'view/NightControls.js'));
    const { game }=session(), view=panelView(game); view.ui.image=imageNode;
    game.command({type:'NIGHT'}); game.pause('USER');
    const controls=new NightControls(game,game.state,view.ui,view,()=>{});
    const button=controls.node.getChildByName('button:大王之心'), face=button.getChildByName('buttonFace');
    assert.equal(button.mouseEnabled,false); assert.equal(face.getChildByName('HeartState').text,'暂停中');
    const firstFilter=face.getChildByName('buttonSkin').filters[0];
    assert.notEqual(firstFilter,face.getChildByName('buttonIcon').filters[0]);
    game.resume('USER'); controls.update();
    assert.equal(button.mouseEnabled,true); assert.equal(face.getChildByName('buttonSkin').filters,null);
    game.pause('USER'); controls.update();
    assert.notEqual(firstFilter,face.getChildByName('buttonSkin').filters[0]);
    game.resume('USER'); controls.update();
    button.event('click'); controls.update();
    assert.equal(game.battle.bellTicks,RULE.bellTicks); assert.equal(view.clickSounds,1); assert.equal(button.mouseEnabled,false);
    game.update(RULE.step); const ticks=game.battle.bellTicks;
    button.event('click'); assert.equal(game.battle.bellTicks,ticks);
});

test('empty tower plus keeps its phase, fixed hit bounds and disappears after construction', () => {
    const { game }=session(),view=panelView(game);view.ui.image=imageNode;
    const hud=new GameHud(game,view.art,view.ui,view,()=>{});
    const layout={mapTop:280,footerTop:980,gateY:680,height:1280,safeTop:0,dateY:42,resourcesY:124};
    const anchors={towerAnchor:i=>PADS[i],gateAnchor:()=>({x:360,y:680})};
    hud.draw(game.state,layout,{pads:PADS},anchors);
    const id=game.state.towers.findIndex(t=>!t.kind),hint=hud.node.getChildByName(`BuildTowerHint:${id}`);
    assert(hint);const size=[hint.width,hint.height,hint.x,hint.y];hud.advance(.45);
    assert(hint.scaleX>1);const scale=hint.scaleX;hud.advance(0);assert.equal(hint.scaleX,scale);assert.deepEqual([hint.width,hint.height,hint.x,hint.y],size);
    hud.clear();hud.draw(game.state,layout,{pads:PADS},anchors);hud.advance(0);assert.equal(hud.node.getChildByName(`BuildTowerHint:${id}`).scaleX,scale);
    game.state.towers[id]={kind:'ARROW',level:1,operator:game.state.people[0].id};hud.clear();hud.draw(game.state,layout,{pads:PADS},anchors);hud.advance(.1);
    assert.equal(hud.node.getChildByName(`BuildTowerHint:${id}`),undefined);
});
test('action badges follow the pressed button face, sit on its upper-right corner and update after resources change',()=>{
    const {game}=session(),view=panelView(game),hud=new GameHud(game,view.art,view.ui,view,()=>{});
    view.art.contentBounds=()=>({rect:{w:64,h:64},sourceSize:{w:64,h:64},trimOffset:{x:0,y:0}});view.art.get=()=>({});
    const layout={mapTop:280,footerTop:980,gateY:680,height:1280,safeTop:0,dateY:42,resourcesY:124};
    const anchors={towerAnchor:i=>PADS[i],gateAnchor:()=>({x:360,y:680})};
    hud.draw(game.state,layout,{pads:PADS},anchors);
    for(const [name,panel] of [['家庭','families'],['建设','build']]) {
        const button=hud.node.getChildByName('button:'+name),face=button.getChildByName('buttonFace'),badge=face.getChildByName('ActionHint:'+panel);
        assert(badge);assert.equal(badge.mouseEnabled,false);assert(badge.width>20);assert(badge.y<0);assert(badge.x+badge.width>button.width);assert(badge.x+badge.width<button.width+8);
        button.event('down',{touchId:1});assert(face.scaleX>1&&face.scaleY<1);assert.equal(badge.parent,face);button.event('up',{touchId:1});assert.equal(face.scaleY,1);
    }
    assert(!hud.node.children.some(n=>n.name.startsWith('TowerActionHint:')));
    assert.equal(hud.node.getChildByName('button:家谱').getChildByName('buttonFace').getChildByName('ActionHint:history'),undefined);
    game.state.food=0;game.state.wood=0;hud.clear();hud.draw(game.state,layout,{pads:PADS},anchors);
    assert.equal(hud.node.getChildByName('button:建设').getChildByName('buttonFace').getChildByName('ActionHint:build'),undefined);
});

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
    view.ui.image = imageNode; view.open = panel => opened.push(panel);
    const hud = new GameHud(game, view.art, view.ui, view, () => {});
    // Label anchors are a fixture; touch targets retain the 2D scene pad offset.
    const anchors = { towerAnchor: i => PADS[i], gateAnchor: () => ({ x: 360, y: 680 }) };
    hud.drawHeader(layout); hud.draw(game.state, layout, { pads: PADS }, anchors);
    const { tower: target } = require(path.join(compiled, 'view/config/HudConfig.js')).HUD;
    const tower = hud.node.children.find(n => n.x === PADS[0].x + target.hitX && n.y === PADS[0].y + target.hitY && n.width === target.hitWidth);
    const entries = [hud.node.getChildByName('button:设置'), hud.node.getChildByName('RankingButton'), tower];
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
    const icon = face.getChildByName('buttonIcon'); assert(icon); assert.equal(icon.parent, face);
    const localIconPosition = [icon.x, icon.y];
    button.event('down', { touchId: 16 }); assert(face.scaleX > 1 && face.scaleY < 1);
    assert.deepEqual([icon.x, icon.y], localIconPosition, 'icon remains on the same pressed face rather than shifting separately');
    button.event('out'); // ScrollList already cancelled its pointer and sends a visual reset without event data.
    assert.deepEqual([face.scaleX,face.scaleY],[1,1]);
    assert.deepEqual(cancelled, [0, 1, 2]);
});

test('opening and closing help removes only CHOICE, leaving independent pauses intact', () => {
    const { game } = session(); game.command({ type: 'NIGHT' }); game.bell(); const view = panelView(game), tick = game.battle.tick;
    for (const reason of ['USER', 'BACKGROUND', 'WAIT_RESUME', 'SAVE_PENDING', 'DISABLED']) game.pause(reason);
    view.open({ type: 'guide', tab: 4 }); game.update(.25); assert.equal(game.battle.tick, tick);
    view.close(); assert.deepEqual([...game.pauses].sort(), ['USER', 'BACKGROUND', 'WAIT_RESUME', 'SAVE_PENDING', 'DISABLED'].sort());
    for (const reason of [...game.pauses]) game.resume(reason);
    game.update(RULE.step); assert.equal(game.battle.tick, tick + RULE.minSpeed);
});

test('tower building is disabled before payment when short of wood or during night', () => {
    const { game } = session(), view = panelView(game); view.ui.image = () => ({}); view.ui.buildRow = () => {};
    game.state.wood = TOWERS.ARROW.cost - 1; view.open({ type: 'tower', index: 2 });
    const unavailable = view.box.children.find(n => n.name.startsWith('button:箭楼')); assert.equal(unavailable.getChildByName('buttonFace').getChildByName('readout:icon_wood').getChildByName('readoutText').text, (TOWERS.ARROW.cost-1)+'/'+TOWERS.ARROW.cost); assert(!unavailable.handlers.click);
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
    const { game, values } = session(), overlay = new Sprite(), panels = panelView(game, overlay);
    panels.modal = () => { const box = new Sprite().size(668, 860); overlay.addChild(box); return box; };
    panels.open({ type: 'guide', tab: 4 });
    const box = overlay.getChildAt(0), rows = box.getChildByName('ScrollList'); rows.setOffset(rows.maximum);
    const panel = panels.current, offset = rows.offset, saved = canonical([...values]), state = canonical(game.state);
    const window = { windowWidth: 390, windowHeight: 844, statusBarHeight: 47, safeArea: { top: 47, bottom: 810 } };
    const menu = { width: 88, height: 32, top: 51, bottom: 83, left: 292, right: 380 };
    const view = Object.create(GameView.prototype);
    Object.assign(view, { resources: { ready: () => true }, game, panels, overlay, layout: new GameLayout(window, menu), platform: { window: { ...window, windowHeight: 900, safeArea: { top: 47, bottom: 866 } }, menu },
        root: new Sprite(), tip: { pos() {} }, results:{observe(){}}, tacticNotices:{observe(){}}, observedVillageRevision: game.villageRevision,
        village: { scene: { pads: PADS }, relayout() {}, sync() {}, drawScenery() {}, towerAnchor: i => PADS[i], gateAnchor: () => ({ x: 360, y: 680 }) }, updateActors() {} });
    view.hud = new GameHud(game, panels.art, panels.ui, panels, () => view.refresh()); panels.ui.image = imageNode;
    view.resize();
    assert.equal(overlay.getChildAt(0), box); assert.equal(box.getChildByName('ScrollList'), rows);
    assert.equal(panels.current, panel); assert.equal(rows.offset, offset); assert.equal(panel.scroll, offset);
    assert(game.pauses.has('CHOICE')); assert.equal(canonical([...values]), saved); assert.equal(canonical(game.state), state);
});

test('construction orders available rows on entry but refreshes conditions in place after purchase',()=>{
    const {game}=session(),view=panelView(game);game.state.wood=30;game.state.food=10;
    let drawn=[];view.ui.buildRow=(parent,y,icon,title,effect,owned,cost,reason,action)=>drawn.push({title,reason,action});
    view.open({type:'build'});assert.deepEqual(view.current.rowOrder,['HOUSING','GATE','HOUSE','FARM','LOGGING','REPAIR']);
    assert(drawn[0].title.startsWith('民居修缮'));assert.equal(drawn[0].reason,null);view.current.scroll=90;
    drawn[0].action();drawn=[];view.refresh();assert(drawn[0].title.startsWith('民居修缮'));assert(drawn[0].reason);assert.equal(view.current.scroll,90);
    view.close();view.open({type:'build'});assert.deepEqual(view.current.rowOrder,['FARM','LOGGING','HOUSING','GATE','HOUSE','REPAIR']);
});
test('family readiness reorders on entry only; current card data and button state still refresh',()=>{
    const {game}=session(),view=panelView(game);view.ui.image=imageNode;view.art.portraitId=q=>q.id;
    applyCommand(game.state,{type:'FAMILY',a:game.state.people[4].id,b:game.state.people[5].id});
    const [a,b]=game.state.families;a.lastBirth=game.state.completed;
    view.open({type:'families',tab:1});assert.deepEqual(view.current.rowOrder,[b.id,a.id]);
    const cards=()=>view.box.getChildByName('ScrollList').content.children.map(row=>row.children[0]);
    assert.equal(cards()[0].name,'family:'+b.id);assert(cards()[0].getChildByName('button:迎接孩子'));
    game.state.food=0;view.refresh();assert.equal(cards()[0].name,'family:'+b.id);assert(cards()[0].getChildByName('button:暂不可迎接'));
    view.close();view.open({type:'families',tab:1});assert.equal(cards()[0].name,'family:'+a.id);
});
test('family tabs isolate actionable dots and preserve their own scroll positions without writes', () => {
    const { game, values } = session(), view = panelView(game), s = game.state;
    view.ui.image = imageNode; view.art.portraitId = p => p.id;
    const tab = caption => view.box.getChildByName('button:' + caption);
    const dot = caption => !!tab(caption).getChildByName('buttonFace').getChildByName('FamilyTabActionHint');
    const pick = caption => tab(caption).event('click');
    s.food = 0;
    const panel = { type: 'families' }, save = canonical([...values]);
    view.open(panel);
    assert.deepEqual([dot('成家'), dot('养育')], [false, false]);
    assert(view.box.getChildByName('button:安排村民成家').getChildByName('buttonFace').getChildByName('MarriageActionHint'));
    pick('养育');
    assert.equal(view.current, panel);
    assert.equal(view.box.getChildByName('button:安排村民成家'), undefined);
    assert(view.box.children.some(n=>n.text==='家庭养育'));
    s.food = RULE.birthCost;
    view.refresh();
    assert.deepEqual([dot('成家'), dot('养育')], [true, false]);
    pick('成家'); assert.deepEqual([dot('成家'), dot('养育')], [false, true]);

    const adults = s.families[0].partners.map(id => s.people.find(p => p.id === id));
    s.houses = 39;
    s.people = []; s.families = [];
    for (let i = 0; i < 20; i++) {
        const parents = adults.map((p, j) => ({ ...p, id: `1:${2 * i + j + 1}`, nights: RULE.parentMinNights }));
        s.people.push(...parents);
        s.families.push({ id: `1:f${i + 1}`, partners: parents.map(p => p.id), lastBirth: null });
    }
    view.open({ type: 'families' });
    assert.deepEqual([dot('成家'), dot('养育')], [false, true]);
    const rows = () => view.box.getChildByName('ScrollList');
    rows().setOffset(710);
    pick('养育');
    assert.equal(rows().offset, 0);
    rows().setOffset(1030);
    assert(rows().content.children.length < 6);
    pick('成家'); assert.equal(rows().offset, 710);
    pick('养育'); assert.equal(rows().offset, 1030);
    s.nextPerson = Number.MAX_SAFE_INTEGER;
    view.refresh();
    assert.deepEqual([dot('成家'), dot('养育')], [false, false]);
    assert.equal(rows().offset, 1030);
    assert.equal(canonical([...values]), save);
});
test('night operator selection reads live reassignment and puts the current guard last',()=>{
    const {game}=session(),view=panelView(game), tagged=[];
    view.art.portraitId=q=>q.id;
    view.ui.listItem=(_parent,_desc,portrait)=>portrait;
    view.ui.personRibbon=(id,frame)=>{ assert.equal(frame,'tag_recommended'); tagged.push(id); };
    const pendingGuard=game.state.people[4], spare=game.state.people[5], released=game.state.towers[0].operator;
    pendingGuard.job='WAITING'; spare.job='WAITING'; spare.skill='skill_archery';
    game.command({type:'NIGHT'});game.pause('CHOICE');const id=pendingGuard.id;assert(game.reassign(0,id));
    assert.notEqual(game.state.towers[0].operator,id);view.open({type:'operators',index:0});assert.equal(view.current.rowOrder.at(-1),id);
    assert.equal(view.current.rowOrder[0],released);
    assert.deepEqual(tagged,[released,spare.id]); assert.equal(view.current.rowOrder.length,game.state.people.length);
});
test('role recommendations shortlist three pending adults by benefit and retain stable ties',()=>{
    const { recommendedPeople }=require(path.join(compiled,'view/RoleRecommendations'));
    const s=createGame(7), template=s.people[0];
    const candidate=(id,extra={})=>({...template,id,job:'WAITING',trait:'trait_frugal',skill:'skill_farming',...extra});
    const people=[candidate('working',{job:'FARM',elite:true}),candidate('first'),candidate('second'),candidate('third'),
        candidate('elite',{elite:true}),candidate('guard',{elite:true}),candidate('elder',{nights:0})];
    const towers=[{...s.towers[0],operator:'guard'}];
    assert.deepEqual(recommendedPeople(people,'FARM',towers).map(p=>p.id),['elite','first','second']);
    assert.deepEqual(recommendedPeople(people,'CARE',towers).map(p=>p.id),['elite']);
});
test('a 107-person roster mounts only the window and each remounted callback targets the correct person',()=>{
    const {game}=session(),view=panelView(game),template=game.state.people[0];
    game.state.people=Array.from({length:107},(_,i)=>({...template,id:`1:${i+1}`}));game.state.families=[];view.art.portraitId=q=>q.id;
    const clicks=[];view.ui.listItem=(parent,desc,portrait,y,fn)=>{const node=new Sprite();node.name=portrait;node.on('click',null,fn);parent.addChild(node);};
    view.open({type:'people'});const rows=view.box.getChildByName('ScrollList');assert(rows.content.children.length<12);
    const old=rows.content.children[0];rows.setOffset(rows.maximum);assert(old.destroyed);assert(rows.content.children.length<12);
    const last=rows.content.children.at(-1).children[0];assert.equal(last.name,'1:107');view.open=p=>clicks.push(p);last.event('click');
    assert.deepEqual(clicks,[{type:'person',id:'1:107'}]);rows.setOffset(0);assert.equal(rows.content.children[0].children[0].name,'1:1');
});
test('tactic list reveals only the next mystery card and guide/direct detail never leak future names',()=>{
    const {game}=session(),view=panelView(game),{TACTICS}=require(path.join(compiled,'config/TacticConfig'));
    view.ui.image=imageNode;const labels=n=>[n.text||'',...n.children.flatMap(labels)].join(' ');
    for(const [waves,revealed]of [[0,1],[12,2],[36,3],[72,4]]){
        game.state.completed=waves;view.open({type:'tactics'});const content=view.box.getChildByName('ScrollList').content;
        assert.equal(content.children.filter(c=>c.name.startsWith('TacticCard:')).length,revealed);
        assert.equal(content.children.filter(c=>c.name==='UnknownTactic').length,revealed<4?1:0);
        for(const t of TACTICS.slice(revealed))assert(!labels(view.box).includes(t.name));
    }
    game.state.completed=0;view.open({type:'tactic',id:TACTICS[3].id});assert(!labels(view.box).includes(TACTICS[3].name));
    view.open({type:'guide',tab:4});for(const t of TACTICS.slice(1))assert(!labels(view.box).includes(t.name));
});
