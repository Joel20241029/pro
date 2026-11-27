const { test } = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const compiled = process.env.DAIDAI_TEST_BUILD;
if (!compiled) throw new Error('Set DAIDAI_TEST_BUILD to the compiled project under Downloads');
const { RULE, TOWERS, PADS } = require(path.join(compiled, 'game/GameConfig.js'));
const { FIXED_NIGHT, TOWER_BUILD_WOOD } = require(path.join(compiled, 'config/DefenseConfig.js'));
const { tacticCooldownTicks } = require(path.join(compiled, 'config/TacticConfig.js'));
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
    delete s.night.activeHero;
    s.wave.entries = [{ tick: RULE.bellTicks * 10, kind: 'enemy_raider' }];
    return new BattleSimulation(s);
}

test('bell lasts 360 steps and the cooldown boundary permits repeat casts', () => {
    const b = longBattle(); assert.equal(RULE.bellTicks * RULE.step, 18); b.bell();
    for (let i = 0; i < RULE.bellTicks - 1; i++) b.step();
    assert.equal(b.bellTicks, 1); b.bell(); assert.equal(b.bellTicks, 1);
    b.step(); assert.equal(b.bellTicks, 0); b.bell(); assert.equal(b.bellTicks, 0);
    assert.equal(b.usesLeftFor(b.tactic), null);
    while (b.tick < tacticCooldownTicks(b.tactic) - 1) b.step();
    b.bell(); assert.equal(b.canCastTactic, false); assert.equal(b.tacticCooldownTicks, 1);
    b.step(); assert.equal(b.canCastTactic, true); b.bell();
    assert.equal(b.bellTicks, RULE.bellTicks); assert.equal(b.usesLeftFor(b.tactic), null);
    while (b.tacticCooldownTicks) b.step();
    assert(b.bell()); assert.equal(b.bellTicks, RULE.bellTicks);
    const next = new BattleSimulation(b.base);
    assert.equal(next.usesLeftFor(next.tactic), null); assert.equal(next.bellTicks + next.tacticCooldownTicks, 0);
});

test('18 combat seconds take exactly six real seconds for any saved speed', () => {
    for (const savedSpeed of [RULE.legacySlowSpeed, RULE.battleSpeed]) {
        const { game } = session(); game.command({ type: 'NIGHT' });
        game.state.settings.speed = savedSpeed;
        const b = game.battle; b.base.wave.entries = [{ tick: RULE.bellTicks * 10, kind: 'enemy_raider' }]; game.bell();
        const frames = RULE.bellTicks / RULE.battleSpeed;
        for (let i = 0; i < frames - 1; i++) game.update(RULE.step);
        assert.equal(b.bellTicks, RULE.battleSpeed); game.update(RULE.step);
        assert.equal(b.bellTicks, 0); assert.equal(b.tick, RULE.bellTicks); assert.equal(frames * RULE.step, 6);
    }
});

test('villages use fixed fast timing; legacy speeds remain valid and pauses survive a settings change', () => {
    const { game, values } = session();
    const { validateState } = require(path.join(compiled, 'storage/StateValidation.js'));
    assert.equal(game.state.settings.speed, RULE.battleSpeed);
    const legacy = JSON.parse(JSON.stringify(game.state)); legacy.settings.speed = RULE.legacySlowSpeed;
    validateState(legacy);
    legacy.settings.speed = 1; assert.throws(() => validateState(legacy));
    game.command({ type: 'NIGHT' }); const battle = game.battle;
    game.pause('USER'); game.command({ type: 'MUSIC', enabled: false }); game.update(1);
    assert.equal(game.battle, battle); assert.equal(battle.tick, 0);
    const reloaded = new GameSession(new SaveStore({ read: k => values.get(k) ?? null, write: (k, v) => values.set(k, v) }));
    reloaded.load(); assert.deepEqual(reloaded.state.settings, { speed: RULE.battleSpeed, music: false });
    game.resume('USER'); game.update(.25); assert.equal(battle.tick, 15);
    game.update(.25); assert.equal(battle.tick, 30);
});

test('every pause freezes bell and attacks; tower swaps retain current charge and duration', () => {
    const { game } = session(); game.command({ type: 'NIGHT' }); game.bell(); game.update(.1);
    const b = game.battle, tick = b.tick, remaining = b.bellTicks;
    for (const reason of ['USER', 'CHOICE', 'BACKGROUND', 'WAIT_RESUME', 'SAVE_PENDING', 'DISABLED']) {
        game.pause(reason); game.update(20); game.bell(); assert.equal(b.tick, tick); assert.equal(b.bellTicks, remaining); game.resume(reason);
    }
    game.pause('CHOICE'); const charge = b.charge.slice();
    assert(game.reassign(0, b.operators[1])); assert.deepEqual(b.charge, charge); assert.equal(b.bellTicks, remaining);
    game.resume('CHOICE'); game.update(RULE.step); assert.equal(b.bellTicks, remaining - RULE.battleSpeed);
});

test('bell increases actual fire rate by 50%, hunger multiplies it, damage stays unchanged', () => {
    const results = [];
    for (const [bell, hungry] of [[false, false], [true, false], [true, true]]) {
        const b = longBattle(); b.base.towers.slice(1).forEach(t => t.operator = null);
        b.base.night.hungry = hungry;
        const op = b.base.people.find(p => p.id === b.operators[0]); op.traits = ['trait_frugal']; op.quality = "COMMON";
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
        assert.equal(shots, Math.floor(RULE.bellTicks * RULE.step * speed * FIXED_NIGHT.towerFireRate / TOWERS.ARROW.interval));
        assert.equal(100000 - enemy.hp, shots * TOWERS.ARROW.damage); results.push(shots);
    }
    assert(results[1] > results[0]); assert(results[2] < results[1]);
});

test('full population gives a feasible remedy; preview and execution share the same rejection', () => {
    const s = createGame(4); s.houses = 100;
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
    assert.equal(upgradeUnavailableReason(s, { wood: RULE.storageCap + 1, food: 1 }), `费用超出仓储 ${RULE.storageCap}，先扩建民居`);
    s.wood = cost.wood; s.food = cost.food; assert.equal(upgradeUnavailableReason(s, cost), null);
    applyCommand(s, { type: 'BUILD', kind: 'FARM' }); assert.equal(s.farm, 2); assert.equal(s.food, 0); assert.equal(s.wood, 0);
});

// Display-list test doubles verify interaction and scroll bounds, not native font measurements.
class Sprite {
    constructor() { this.name = ''; this.children = []; this.handlers = {}; this.graphics = { drawRect() {}, drawCircle() {}, drawEllipse() {}, drawLine() {}, drawLines() {}, drawPath() {}, drawRoundRect() {}, drawPoly() {}, clear() {} }; }
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
global.Laya = { Sprite, Point: class { setTo(x,y) { Object.assign(this,{x,y}); return this; } }, Tween, Ease: { elasticOut: () => 1 }, ColorFilter: class { gray() { return this; } }, Text: { SHRINK: 'shrink' }, Rectangle: class {}, OpenDataContextView: class {}, Texture2D: class {}, Event: { CLICK: 'click', MOUSE_DOWN: 'down', MOUSE_UP: 'up', MOUSE_OUT: 'out', UNDISPLAY: 'undisplay' } };
const { GamePanels } = require(path.join(compiled, 'view/GamePanels.js'));
const { GameHud } = require(path.join(compiled, 'view/GameHud.js'));

test('night status names the equipped effect rather than calling every tactic attack speed', () => {
    const { game } = session();
    const hud = Object.create(GameHud.prototype); hud.game = game; hud.nightStatus = { text: '' };
    for (const [effect, name, label] of [['ATTACK_SPEED','大王之心','攻速'],['ATTACK_DAMAGE','百毅靓之怒','伤害']]) {
        game.battle = { outcome: null, bellTicks: 300, tactic: { effect, name, multiplier: 1.5 } };
        hud.update(); assert.equal(hud.nightStatus.text, `${name} · ${label} +50% · 还剩 5秒`);
    }
});
const { UiWidgets } = require(path.join(compiled, 'view/UiWidgets.js'));
const { GUIDE_CHAPTERS } = require(path.join(compiled, 'view/GameGuide.js'));
function panelView(game, overlay = new Sprite()) {
    const art = { panel() {}, get: id => id, contentBounds: () => ({rect:{w:64,h:64},sourceSize:{w:64,h:64},trimOffset:{x:0,y:0}}) }, view = new GamePanels(game, art, {}, null, overlay, { safeTop:40, safeBottom:1230 }, () => {
        if (view.current) view.draw(game.state, view.current);
    }, { ready: () => true });
    const ui = new UiWidgets(art, () => view.clickSounds++);
    Object.assign(view, { resources: { ready: () => true }, ui, clickSounds: 0, modal(title, subtitle, close, size = { width: 668, height: 860 }) {
        this.box = new Sprite().size(size.width, size.height);
        return this.box;
    } });
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

test('the patrol card opens from the construction list without materials and returns to the same list', () => {
    const { game } = session(), view = panelView(game);
    const { generateWave } = require(path.join(compiled, 'game/WaveGenerator.js'));
    view.ui.image = imageNode;
    view.art.portraitId = () => 'portrait';
    game.changed = () => { if (view.current) view.draw(game.state, view.current); };
    const list = () => view.box.getChildByName('ScrollList');
    const card = () => list().content.getChildByName('PatrolConstructionCard');
    const marker = () => card().getChildByName('buttonFace').getChildByName('BuildAction');
    const badge = () => marker().getChildByName('PatrolActionDot');
    view.open({ type: 'build' });
    assert(card());

    const s = game.state;
    s.food = s.wood = 0;
    const build = { type: 'build', scroll: 14 };
    view.open(build);
    assert(!view.box.getChildByName('button:淡紫儿之家'));
    const row = card(), before = canonical(s);
    assert(row.mouseEnabled);
    assert(!badge(), 'automatic appointments do not light the construction badge');
    assert.equal(row.getChildByName('buttonFace').getChildByName('BuildAction').getChildAt(0).text, '去查看');
    row.event('click');
    assert.equal(view.current.type, 'patrol');
    assert.equal(canonical(game.state), before);
    view.box.getChildByName('button:升级').event('click');
    assert.equal(view.current.type,'patrolUpgrade');
    assert(!view.box.getChildByName('button:确认升级').handlers.click);
    assert(view.box.children.some(n=>n.text?.includes('还缺 35 木、15 粮')));
    view.box.getChildByName('PatrolUpgradeBack').event('click');
    assert.equal(view.box.getChildByName('button:返回'), undefined);
    const detailBack = view.box.getChildByName('PatrolDetailBack');
    assert.equal(detailBack.getChildByName('buttonFace').getChildByName('icon_back').width, 34);
    detailBack.event('click');
    assert.equal(view.current, build);
    assert.equal(list().offset, 14);

    s.food = s.wood = 100;
    view.draw(s, build);
    assert(badge(), 'an affordable patrol upgrade lights the construction entry');
    assert(badge().x > marker().width / 2 && badge().x < marker().width);
    card().event('click');
    const detail = view.current;
    const upgrade = view.box.getChildByName('button:升级');
    assert(upgrade.getChildByName('buttonFace').getChildByName('PatrolUpgradeActionHint'));
    upgrade.event('click');
    assert.equal(game.state.patrol.level,1);
    const confirm=view.box.getChildByName('button:确认升级');
    assert(confirm.getChildByName('buttonFace').getChildByName('PatrolUpgradeActionHint'));
    confirm.event('click'); confirm.event('click');
    assert.equal(view.current,detail);
    assert.equal(game.state.patrol.level, 2);
    assert.deepEqual([game.state.wood, game.state.food], [65, 85]);
    game.state.food = game.state.wood = 0;
    const idle = game.state.people.find(p => p.id !== game.state.patrol.captain && p.adult && p.nights > 0 && !game.state.towers.some(t => t.operator === p.id));
    const free = game.state.people.find(p => p.traits.includes('trait_strong'));
    game.state.towers.find(t => t.operator === free.id).operator = idle.id;
    view.open(build,true);
    const { actionHints } = require(path.join(compiled, 'view/ActionHints.js'));
    assert.equal(actionHints(game.state, false).build, false);
    assert(!badge(), 'a stronger candidate alone does not light the construction card');
    card().event('click');
    const patrolHome=view.current;
    const manage = () => view.box.children.map(n=>n.getChildByName('button:换人')).find(Boolean);
    assert(!manage().getChildByName('buttonFace').getChildByName('PatrolCaptainActionHint'));
    manage().event('click');
    const nodes = n => [n, ...n.children.flatMap(nodes)];
    assert(!nodes(view.box).some(n => n.name === 'PatrolCaptainActionHint'));
    assert(nodes(view.box).some(n => n.name === 'tag_recommended'));
    const stationed = game.state.towers.find(t => t.operator).operator;
    const captainAction = id => nodes(view.box).find(n => n.name === `PatrolCaptain:${id}`).getChildByName('button:任命队长');
    const originalCaptain = game.state.patrol.captain;
    captainAction(stationed).event('click');
    assert.equal(view.current.type, 'patrolConfirm');
    assert.equal(game.state.patrol.captain, originalCaptain);
    assert(!nodes(view.box).some(n => n.name === 'PatrolCaptainActionHint'));
    view.open(view.current.back, true);
    assert.equal(view.box.getChildByName('button:返回'), undefined);
    view.box.getChildByName('PatrolCandidatesBack').event('click');
    assert.equal(view.current, patrolHome);
    assert(!manage().getChildByName('buttonFace').getChildByName('PatrolCaptainActionHint'));
    assert.equal(game.state.patrol.captain===free.id,false);
    manage().event('click');
    captainAction(free.id).event('click');
    assert.equal(game.error, '');
    assert.equal(view.current, patrolHome);
    assert.equal(game.state.patrol.captain, free.id);
    assert(!manage().getChildByName('buttonFace').getChildByName('PatrolCaptainActionHint'));
    view.box.getChildByName('PatrolDetailBack').event('click');
    assert.equal(view.current, build);
    assert.equal(list().offset, 14);
    assert(!badge());
    game.state.food = game.state.wood = 0;
    view.draw(game.state, build);
    assert(card().mouseEnabled && !badge());
    game.state.patrol.captain = null;
    view.draw(game.state, build);
    assert(actionHints(game.state, false).build && badge(), 'an open captain position still lights the construction entry');
    view.open({ type: 'patrol' });
    assert.equal(view.box.getChildByName('PatrolDetailBack'), undefined);
    const appoint = nodes(view.box).find(n => n.name === 'button:任命');
    assert(appoint.getChildByName('buttonFace').getChildByName('PatrolCaptainActionHint'));
    appoint.event('click');
    assert(nodes(view.box).some(n => n.name === 'PatrolCaptainActionHint'));
});

test('patrol house selection stays visible, fits a short screen and preserves prepared goods on rapid nights', () => {
    const { game } = session(), view = panelView(game);
    view.ui.image = imageNode;
    const detail = { type: 'patrol' };
    view.art.portraitId=p=>p.id;
    game.changed = () => { if (view.current) view.draw(game.state, view.current); };
    game.state.patrol.rationReady = game.state.patrol.radiusReady = true;
    view.open(detail);
    const nodes = n => [n,...n.children.flatMap(nodes)];
    const find = name => nodes(view.box).find(n=>n.name===name);
    const copy = () => nodes(view.box).map(n=>n.text).filter(Boolean).join(' ');
    const { GameLayout } = require(path.join(compiled, 'view/GameLayout.js'));
    const short = new GameLayout({windowWidth:600,windowHeight:760,statusBarHeight:0,safeArea:{top:15,bottom:735}},{width:0,height:0});
    assert(view.box.height <= short.safeBottom-short.safeTop);
    assert(find(game.state.patrol.captain));
    assert.match(copy(),/淡紫儿飞速旋转/); assert.doesNotMatch(copy(),/城门连发/);
    find('button:切换打法').event('click');
    assert.equal(view.current.type,'patrolModes');
    assert(find('PatrolMode:rapid').y >= find('PatrolMode:spin').y + find('PatrolMode:spin').height);
    assert.equal(view.box.getChildByName('button:选用'), undefined);
    assert.equal(find('PatrolMode:spin').getChildByName('button:选用'), undefined);
    const [food, wood] = [game.state.food, game.state.wood];
    find('PatrolMode:rapid').getChildByName('button:选用').event('click');
    assert.equal(game.state.patrol.mode,'rapid'); assert.equal(view.current,detail);
    assert.deepEqual([game.state.food,game.state.wood],[food,wood]);
    assert(find('PatrolBuffActionHint'));
    find('button:切换打法').event('click');
    assert(find('PatrolMode:spin').getChildByName('button:选用').getChildByName('buttonFace').getChildByName('PatrolBuffActionHint'));
    find('PatrolModesBack').event('click');
    assert.match(copy(),/城门连发/); assert.match(copy(),/伤害、范围提升 · 下次旋甩生效/);
    game.command({type:'NIGHT'}); view.open(detail);
    assert.match(copy(),/下次旋甩生效/);
    find('button:查看打法').event('click'); assert.equal(find('button:选用'), undefined);
    find('PatrolModesBack').event('click');
    find('button:升级').event('click'); assert(!find('button:确认升级').handlers.click);
    assert.equal(game.state.patrol.level,1);
});

test('night controls retain independent pause reasons and combat actions on the single-speed footer', () => {
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
    assert.deepEqual(controls().children.filter(n => n.name.startsWith('button:')).map(n => n.name), ['button:退出','button:暂停','button:大王之心']);
    for(const name of ['村民','家庭','建设','家谱']) assert.equal(hud.node.getChildByName('button:'+name),undefined);
    assert.equal(heartFace().getChildByName('HeartState').text, '就绪');
    button('大王之心').event('click'); assert.equal(game.battle.usesLeftFor(game.battle.tactic), null);
    assert.equal(heartFace().getChildByName('HeartState').text,'生效 6秒');
    assert.equal(button('大王之心').mouseEnabled,false);
    button('暂停').event('click'); assert(game.pauses.has('USER'));
    const remaining = game.battle.bellTicks; game.update(1); hud.update();
    assert.equal(game.battle.bellTicks,remaining);
    assert.equal(heartFace().getChildByName('buttonSkin').filters,undefined);
    assert.match(controls().getChildByName('NightStatus').text, /^已暂停 · 场上/);
    game.pause('CHOICE'); button('继续').event('click');
    assert(!game.pauses.has('USER')); assert(game.pauses.has('CHOICE'));
    game.resume('CHOICE'); draw();
    while (game.battle.bellTicks) game.update(RULE.step);
    hud.update(); assert.equal(heartFace().getChildByName('HeartState').text, '冷却 12秒');
    assert.equal(button('大王之心').mouseEnabled,false); assert.equal(heartFace().getChildByName('buttonSkin').filters.length,1);
    while (game.battle.tacticCooldownTicks) game.update(RULE.step);
    hud.update(); assert.equal(heartFace().getChildByName('HeartState').text, '就绪');
    button('大王之心').event('click'); assert.equal(game.battle.usesLeftFor(game.battle.tactic), null);
    while (game.battle.bellTicks) game.update(RULE.step);
    hud.update(); assert.equal(heartFace().getChildByName('HeartState').text, '冷却 12秒');
    game.newVillage(); assert.equal(hud.node.getChildByName('NightControls'),undefined);
    for(const name of ['村民','家庭','建设','家谱']) assert(hud.node.getChildByName('button:'+name));
});

test('night footer centers one to three equipped skills between separate exit and pause touch targets', () => {
    const { NightControls } = require(path.join(compiled, 'view/NightControls.js'));
    const { DEFAULT_TACTIC, SHIELD_TACTIC, RAGE_TACTIC } = require(path.join(compiled, 'config/TacticConfig.js'));
    const ids = [DEFAULT_TACTIC, SHIELD_TACTIC, RAGE_TACTIC];
    for (const count of [1, 2, 3]) {
        const { game } = session(), view = panelView(game);
        view.ui.image = imageNode;
        game.state.tactics = { learned: ids.slice(0, count), equipped: DEFAULT_TACTIC, extraSlots: ids.slice(1, count) };
        game.command({ type: 'NIGHT' });
        const controls = new NightControls(game, view.ui, view, () => {}), root = controls.node;
        const pause = root.getChildByName('button:暂停');
        const exit = root.getChildByName('button:退出');
        for (const control of [exit, pause])
            assert(control.width * 320 / root.width >= 44 && control.height * 320 / root.width >= 44);
        const buttons = root.children.filter(n => n.name.startsWith('button:') && n !== pause && n !== exit);
        assert.equal(buttons.length, count);
        assert.equal(buttons[0].x, root.width - buttons.at(-1).x - buttons.at(-1).width);
        for (const [index, button] of buttons.entries()) {
            assert.equal(button.width, button.height);
            assert(button.y + button.height < root.height && button.x + button.width < pause.x);
            assert(exit.x + exit.width < button.x);
            if (index) assert(buttons[index-1].x + buttons[index-1].width < button.x);
        }
        assert(!root.getChildByName('NightStatus').text.includes('战技剩余'));
        while (!game.patrolDragReady && game.battle.tick < 500) game.update(RULE.step);
        assert(game.patrolDragReady);
        game.setPatrolAiming(true); controls.update();
        assert.match(root.getChildByName('NightStatus').text, /^瞄准中 · /);
        game.setPatrolAiming(false); controls.update();
        assert.match(root.getChildByName('NightStatus').text, /^场上 /);
    }
});

test('paused unused heart can become actionable without binding its click twice', () => {
    const { NightControls } = require(path.join(compiled,'view/NightControls.js'));
    const { game }=session(), view=panelView(game); view.ui.image=imageNode;
    game.command({type:'NIGHT'}); game.pause('USER');
    const controls=new NightControls(game,view.ui,view,()=>{});
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
    game.state.gate=1;
    hud.draw(game.state,layout,{pads:PADS},anchors);
    for(const [name,panel] of [['家庭','families'],['建设','build']]) {
        const button=hud.node.getChildByName('button:'+name),face=button.getChildByName('buttonFace'),badge=face.getChildByName('ActionHint:'+panel);
        assert(badge);assert.equal(badge.mouseEnabled,false);assert(badge.width>20);assert(badge.y<0);assert(badge.x+badge.width>button.width);assert(badge.x+badge.width<button.width+8);
        button.event('down',{touchId:1});assert(face.scaleX>1&&face.scaleY<1);assert.equal(badge.parent,face);button.event('up',{touchId:1});assert.equal(face.scaleY,1);
    }
    const hotspot = i => hud.node.getChildByName(`TowerHotspot:${i}`);
    const empty = game.state.towers.findIndex(t => !t.kind);
    const built = game.state.towers.findIndex(t => t.kind);
    assert.equal(hotspot(empty).getChildByName(`TowerActionHint:${empty}`), undefined);
    assert.equal(hotspot(built).getChildByName(`TowerActionHint:${built}`), undefined);
    assert(hud.node.getChildByName(`BuildTowerHint:${empty}`));
    hotspot(empty).event('click', {});
    assert.deepEqual([view.current.type, view.current.index], ['tower', empty]);
    assert(view.box.getChildByName('button:建造石炮塔').getChildByName('buttonFace').getChildByName('TowerBuildActionHint'));
    assert.equal(hud.node.getChildByName('button:家谱').getChildByName('buttonFace').getChildByName('ActionHint:history'),undefined);
    applyCommand(game.state,{type:'PATROL_CAPTAIN',id:game.state.people[4].id});
    game.state.food=0;game.state.wood=0;hud.clear();hud.draw(game.state,layout,{pads:PADS},anchors);
    assert.equal(hud.node.getChildByName('button:建设').getChildByName('buttonFace').getChildByName('ActionHint:build'),undefined);
});

test('help topics preserve their directory, selected chapter and scroll position without writes', () => {
    const { game, values } = session(), view = panelView(game), saved = canonical([...values]), state = canonical(game.state);
    view.ui.image = imageNode;
    const nodes = node => [node, ...node.children.flatMap(nodes)];
    view.open({ type: 'settings' }); nodes(view.box).find(n => n.name === 'button:玩法说明').event('click');
    assert.equal(view.clickSounds, 1);
    assert.deepEqual(GUIDE_CHAPTERS.map(c => c.title), ['起步', '村民', '家庭', '建设', '守夜']);
    for (let i = 0; i < GUIDE_CHAPTERS.length; i++) {
        view.box.getChildByName(`button:${GUIDE_CHAPTERS[i].title}`).event('click');
        const panel = view.current, rows = view.box.getChildByName('ScrollList');
        assert.equal(panel.tab, i); assert.equal(rows.offset, 0);
        rows.setOffset(rows.maximum);
        const button = nodes(rows.content).filter(n => n.name.startsWith('button:')).at(-1);
        const section = GUIDE_CHAPTERS[i].sections.find(topic => 'button:' + topic.title === button.name);
        assert(section);
        assert(!nodes(view.box).some(n => n.text === section.body));
        button.event('click');
        assert.equal(view.current, panel);
        assert.equal(nodes(view.box).filter(n => n.text === section.body).length, 1);
        nodes(view.box).find(n => n.name === 'button:' + section.title).event('click');
        assert.equal(view.current, panel);
        assert.equal(panel.index, undefined);
        assert(!nodes(view.box).some(n => n.text === section.body));
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
    game.update(RULE.step); assert.equal(game.battle.tick, tick + RULE.battleSpeed);
});

test('tower building is disabled before payment when short of wood or during night', () => {
    const { game } = session(), view = panelView(game); view.ui.image = () => ({}); view.ui.buildRow = () => {};
    game.state.wood = TOWER_BUILD_WOOD - 1; view.open({ type: 'tower', index: 2 });
    const unavailable = view.box.children.find(n => n.name.startsWith('button:建造石炮塔')); assert.equal(view.box.children.find(n=>n.getChildByName('readout:icon_wood')).getChildByName('readout:icon_wood').getChildByName('readoutText').text, (TOWER_BUILD_WOOD-1)+'/'+TOWER_BUILD_WOOD); assert(!unavailable.handlers.click);
    game.state.wood++; view.open({ type: 'tower', index: 2 }); assert(view.box.children.find(n => n.name.startsWith('button:建造石炮塔')).handlers.click);
    game.command({ type: 'NIGHT' }); view.open({ type: 'tower', index: 2 });
    assert(!view.box.children.find(n => n.name.startsWith('button:建造石炮塔')).handlers.click);
});


test('settings restart asks once, cancellation is read-only and confirmation starts at day one', () => {
    const {game,values}=session(),view=panelView(game); const initial=canonical(game.state),saved=canonical([...values]);
    const nodes = node => [node, ...node.children.flatMap(nodes)];
    const restart = () => nodes(view.box).find(node => node.name === 'button:重新开村…');
    view.open({type:'settings'});
    restart().event('click'); assert.equal(view.current.type,'restart');
    assert.equal(canonical(game.state),initial); assert.equal(canonical([...values]),saved);
    view.box.getChildByName('button:取消').event('click'); assert.equal(view.current.type,'settings');assert.equal(canonical([...values]),saved);
    restart().event('click'); const revision=game.villageRevision;
    view.box.getChildByName('button:确认重新开村').event('click');assert.equal(game.villageRevision,revision+1);assert.equal(game.state.run,1);assert.equal(game.state.legacy.lastRationDate,null);
});

test('centered actions and paired confirmation buttons keep room above the lower gold frame', () => {
    const {game}=session(), view=panelView(game);
    view.ui.image=imageNode; view.art.portraitId=p=>p.id;
    view.open({type:'families'});
    const marriage=view.box.getChildByName('button:安排村民成家');
    assert.deepEqual([marriage.width,marriage.height,marriage.x*2+marriage.width],[320,92,view.box.width]);
    assert(view.box.getChildByName('ScrollList').y>marriage.y+marriage.height);
    for(const [type,secondary,primary] of [
        ['restart','取消','确认重新开村'],['mercyConfirm','暂缓','确认奉王'],['tacticSlotUnlock','取消','确认解锁']
    ]){
        view.draw(game.state,{type,index:1,back:{type:'tactics'}});
        const cancel=view.box.getChildByName('button:'+secondary);
        const confirm=view.box.getChildByName('button:'+primary);
        assert.equal(cancel.y,confirm.y);
        assert.equal(cancel.height,confirm.height);
        assert(confirm.width>cancel.width && confirm.x>cancel.x+cancel.width);
        assert.equal(view.box.height-confirm.y-confirm.height,48);
    }
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
    view.handSpeed = { update() {} };
    Object.assign(view, { resources: { ready: () => true }, game, panels, overlay, layout: new GameLayout(window, menu), platform: { window: { ...window, windowHeight: 900, safeArea: { top: 47, bottom: 866 } }, menu },
        root: new Sprite(), tip: { pos() {} }, results:{observe(){}}, tacticNotices:{observe(){}}, observedVillageRevision: game.villageRevision,
        village: { scene: { pads: PADS }, relayout() {}, sync() {}, drawScenery() {}, towerAnchor: i => PADS[i], gateAnchor: () => ({ x: 360, y: 680 }) }, updateActors() {} });
    view.hud = new GameHud(game, panels.art, panels.ui, panels, () => view.refresh()); panels.ui.image = imageNode;
    view.resize();
    assert.equal(overlay.getChildAt(0), box); assert.equal(box.getChildByName('ScrollList'), rows);
    assert.equal(panels.current, panel); assert.equal(rows.offset, offset); assert.equal(panel.scroll, offset);
    assert(game.pauses.has('CHOICE')); assert.equal(canonical([...values]), saved); assert.equal(canonical(game.state), state);
});

test('night preparation keeps its actions while details and controls open separately',()=>{
    const {game} = session(), view = panelView(game); view.ui.image = imageNode;
    view.resources = { ready:()=>true, states:{night:{phase:'READY'}}, ensure:()=>{} };
    const nodes = node => [node,...node.children.flatMap(nodes)];
    const texts = () => nodes(view.box).map(node => node.text).filter(Boolean);
    const panel = {type:'start'}; view.open(panel);
    assert(texts().includes('2/2 已驻守'));
    assert(texts().includes('淡紫儿飞速旋转'));
    assert(texts().includes('城门耐久') && texts().includes('本夜口粮'));
    assert(!texts().includes('入夜后库存'));
    view.layout.safeBottom = view.layout.safeTop + 650;
    view.refresh();
    const prepareList = view.box.getChildByName('ScrollList');
    const start = view.box.getChildByName('button:开始守夜');
    assert(prepareList.maximum > 0);
    assert(prepareList.y + prepareList.height < start.y);
    assert(start.y + start.height + 48 === view.box.height);
    game.state.patrol.mode='rapid'; game.state.towers[0].operator=null;
    view.box.getChildByName('button:敌情与收支').event('click',{});
    assert.equal(view.current.type,'nightDetails');
    assert.equal(view.current.back,panel);
    assert(texts().includes('入夜后库存'));
    assert(nodes(view.box).some(node => node.name === `${game.state.wave.entries[0].kind}_walk_00`));
    assert(!view.box.getChildByName('button:开始守夜'));
    view.box.getChildByName('PanelBack').event('click',{});
    assert.equal(view.current,panel);
    assert(texts().includes('还有 1 座塔无人驻守'));
    assert(texts().includes('淡紫儿突突队'));
    assert(!texts().includes('入夜后库存'));
    nodes(view.box).find(node => node.name === 'button:?').event('click',{});
    assert(texts().includes('按住城门枪架后拉，持续连发。'));
    view.box.getChildByName('PanelBack').event('click',{});
    assert.equal(view.current,panel); assert.equal(game.state.phase,'DAY');
});

test('disabled bulk repair has no clickable row behind it and a single repair stays available',()=>{
    const {game} = session(), view = panelView(game); view.ui.image=imageNode;
    game.state.gate=80; game.state.wood=29; view.open({type:'build'});
    const construction = view.current;
    const rows=view.box.getChildByName('ScrollList').content.children;
    const row=rows.find(node=>node.getChildByName('button:修一次'));
    assert(row); row.event('click',{}); row.getChildByName('RepairFull').event('click',{});
    assert.deepEqual([game.state.gate,game.state.wood],[80,29]);
    row.getChildByName('button:修一次').event('click',{});
    assert.equal(view.current.type,'spendConfirm');
    assert.deepEqual([game.state.gate,game.state.wood],[80,29]);
    view.box.getChildByName('button:确认修复').event('click',{});
    assert.equal(view.current, construction);
    assert.deepEqual([game.state.gate,game.state.wood],[120,19]);
    game.state.wood=20; view.refresh();
    const full=view.box.getChildByName('ScrollList').content.children.find(node=>node.getChildByName('RepairFull'));
    full.getChildByName('RepairFull').event('click',{});
    assert.equal(view.current.type,'spendConfirm');
    assert.deepEqual([game.state.gate,game.state.wood],[120,20]);
    view.box.getChildByName('button:确认修满').event('click',{});
    assert.equal(view.current,construction);
    assert.deepEqual([game.state.gate,game.state.wood],[200,0]);
});
test('construction orders available rows on entry but refreshes conditions in place after purchase',()=>{
    const {game}=session(),view=panelView(game);game.state.wood=30;game.state.food=10;
    let drawn=[];const buildRow=view.ui.buildRow.bind(view.ui);
    view.ui.buildRow=(...args)=>{const [,,,title,,,,reason,action]=args;drawn.push({title,reason,action});return buildRow(...args);};
    view.open({type:'build'});assert.deepEqual(view.current.rowOrder,['HERO_COMMITTEE','PATROL','GATE','HOUSE','FARM','LOGGING','REPAIR']);
    assert(drawn[3].title.startsWith('民居扩建'));assert.equal(drawn[3].reason,null);view.current.scroll=90;
    drawn[3].action();
    assert.equal(view.current.type,'spendConfirm');
    assert.deepEqual([game.state.wood,game.state.food],[30,10]);
    drawn=[];
    view.box.getChildByName('button:取消').event('click');
    assert.equal(view.current.type,'build');assert.equal(view.current.scroll,90);
    assert(drawn[3].title.startsWith('民居扩建'));
    drawn[3].action();view.box.getChildByName('button:确认增建').event('click');
    drawn=[];view.refresh();assert(drawn[3].title.startsWith('民居扩建'));assert(drawn[3].reason);assert.equal(view.current.scroll,90);
    view.close();view.open({type:'build'});assert.deepEqual(view.current.rowOrder,['HERO_COMMITTEE','PATROL','FARM','LOGGING','GATE','HOUSE','REPAIR']);
});
test('family readiness reorders on entry only; current card data and button state still refresh',()=>{
    const {game}=session(),view=panelView(game);view.ui.image=imageNode;view.art.portraitId=q=>q.id;
    applyCommand(game.state,{type:'FAMILY',a:game.state.people[4].id,b:game.state.people[5].id});
    const [a,b]=game.state.families;a.lastBirth=game.state.completed;
    view.open({type:'families',tab:1});assert.deepEqual(view.current.rowOrder,[b.id,a.id]);
    const cards=()=>view.box.getChildByName('ScrollList').content.children.map(row=>row.children[0]);
    assert.equal(cards()[0].name,'family:'+b.id);assert(cards()[0].getChildByName('button:迎接孩子'));
    view.layout.safeBottom=view.layout.safeTop+864;view.refresh();
    const list=view.box.getChildByName('ScrollList');
    assert.equal(view.box.height,816);assert(list.content.children[1].y + cards()[1].height <= list.height);
    assert(cards()[1].children.some(n=>n.text===birthUnavailableReason(game.state,a.id)));
    game.state.food=0;view.refresh();assert.equal(cards()[0].name,'family:'+b.id);
    assert(!cards()[0].getChildByName('button:迎接孩子'));assert(cards()[0].children.some(n=>n.text==='粮食不足'));
    view.close();view.open({type:'families',tab:1});assert.equal(cards()[0].name,'family:'+a.id);
    game.state.food=RULE.birthCost;view.refresh();
    cards()[1].getChildByName('button:迎接孩子').event('click',{});view.refresh();
    assert.equal(view.current.type,'spendConfirm');
    assert.equal(game.state.food,RULE.birthCost);
    assert(!game.state.people.some(q=>!q.adult));
    const origin=view.current.back;
    view.box.getChildByName('button:取消').event('click');
    assert.equal(view.current,origin);
    cards()[1].getChildByName('button:迎接孩子').event('click',{});view.refresh();
    view.box.getChildByName('button:确认迎接').event('click');view.refresh();
    const child=game.state.people.find(q=>!q.adult);
    assert(child.parents.includes(b.partners[0]));assert.equal(game.state.food,0);
    assert(cards()[1].children.some(n=>n.text?.includes(child.name) && n.text.includes('成长 0/'+RULE.growNights)));
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
    assert(view.box.getChildByName('ScrollList').content.children[0].children[0].name.startsWith('family:'));
    s.food = RULE.birthCost;
    view.refresh();
    assert.deepEqual([dot('成家'), dot('养育')], [true, false]);
    pick('成家'); assert.deepEqual([dot('成家'), dot('养育')], [false, true]);

    const adults = s.families[0].partners.map(id => s.people.find(p => p.id === id));
    s.houses = 39;
    s.people = []; s.families = [];
    for (let i = 0; i < 20; i++) {
        const parents = adults.map((p, j) => ({ ...p, id: `1:${2 * i + j + 1}`, nights: 1 }));
        s.people.push(...parents);
        s.families.push({ id: `1:f${i + 1}`, partners: parents.map(p => p.id), lastBirth: null });
    }
    view.open({ type: 'families' });
    assert.equal(view.current.tab,1);
    assert.deepEqual([dot('成家'), dot('养育')], [false, false]);
    const firstFamily=view.box.getChildByName('ScrollList').content.children[0].children[0];
    assert(firstFamily.getChildByName('button:迎接孩子').getChildByName('buttonFace').getChildByName('BirthActionHint'));
    pick('成家');
    const rows = () => view.box.getChildByName('ScrollList');
    rows().setOffset(710);
    pick('养育');
    assert.equal(rows().offset, 0);
    rows().setOffset(1030);
    assert(rows().content.children.length <= 6);
    pick('成家'); assert.equal(rows().offset, 710);
    pick('养育'); assert.equal(rows().offset, 1030);
    s.nextPerson = Number.MAX_SAFE_INTEGER;
    view.refresh();
    assert.deepEqual([dot('成家'), dot('养育')], [false, false]);
    assert.equal(rows().offset, 1030);
    assert.equal(canonical([...values]), save);
});
test('family candidates stay in the family tab and only the second card action commits marriage', () => {
    const { game, values } = session(), view = panelView(game), s = game.state;
    const { canMarry } = require(path.join(compiled, 'game/VillageRules.js'));
    view.ui.image = imageNode; view.art.portraitId = q => q.id;
    game.changed = view.refresh;
    const original = { type: 'families', tab: 0 };
    const first = s.people.find(a => s.people.some(b => canMarry(s, a, b)));
    const second = s.people.find(b => canMarry(s, first, b));
    const count = s.families.length, saved = canonical([...values]);
    const card = q => view.box.getChildByName('ScrollList').content.getChildByName(`FamilyCandidate:${q.id}`);
    view.open(original);
    view.box.getChildByName('button:安排村民成家').event('click');
    card(first).getChildByName('button:选为第一位').event('click');
    assert.equal(view.current, original);
    assert.equal(canonical([...values]), saved);
    card(second).getChildByName('button:确认成家').event('click');
    assert.equal(game.state.families.length, count + 1);
    assert(game.state.families.some(f => f.partners.includes(first.id) && f.partners.includes(second.id)));
    assert.equal(view.current.type, 'families');
    assert(!view.current.pairing);
});
test('night operator selection reads live reassignment and excludes the current guard',()=>{
    const {game}=session(),view=panelView(game), tagged=[];
    view.art.portraitId=q=>q.id;
    view.ui.listItem=(parent,_desc,portrait,_y,click)=>{
        const row = new Sprite().size(580, 118); row.name=portrait; row.on('click',null,click); parent.addChild(row); return row;
    };
    view.ui.personRibbon=(row,frame)=>{ assert.equal(frame,'tag_recommended'); tagged.push(row.name); };
    const pendingGuard=game.state.people[4], spare=game.state.people[5], released=game.state.towers[0].operator;
    pendingGuard.job='WAITING'; spare.job='WAITING'; spare.traits=['trait_nimble'];
    game.command({type:'NIGHT'});game.pause('CHOICE');const id=pendingGuard.id;assert(game.reassign(0,id));
    assert.notEqual(game.state.towers[0].operator,id);view.open({type:'operators',index:0});assert(!view.current.rowOrder.includes(id));
    assert.equal(view.current.rowOrder[0],released);
    assert.deepEqual(tagged,[released,spare.id]); assert.equal(view.current.rowOrder.length,game.state.people.length - 1);
    assert(view.current.rowOrder.includes(game.battle.base.patrol.captain));
    const card = () => view.box.getChildByName('ScrollList').content.children[0];
    card().getChildByName(released).event('click');
    assert.equal(game.battle.base.towers[0].operator,id);
    card().getChildByName('button:选此人').event('click');
    assert.equal(game.battle.base.towers[0].operator,released);
    assert.notEqual(game.state.towers[0].operator,id);
    assert.equal(view.current.type,'tower');
});
test('role recommendations shortlist three pending adults by benefit and retain stable ties',()=>{
    const { recommendedPeople }=require(path.join(compiled,'view/RoleRecommendations'));
    const s=createGame(7), template=s.people[0];
    const candidate=(id,extra={})=>({...template,id,job:'WAITING',traits:['trait_diligent'],...extra});
    const people=[candidate('working',{job:'FARM',quality:"ELITE"}),candidate('first'),candidate('second'),candidate('third'),
        candidate('elite',{quality:"ELITE"}),candidate('guard',{quality:"ELITE"}),candidate('elder',{nights:0})];
    const towers=[{...s.towers[0],operator:'guard'}];
    assert.deepEqual(recommendedPeople(people,'FARM',towers).map(p=>p.id),['elite','first','second']);
    assert.deepEqual(recommendedPeople(people,'LOGGING',towers).map(p=>p.id),['elite']);
});
test('job tabs show incumbents and suitable idle villagers; assignment respects full slots and nighttime', () => {
    const {game} = session(), view = panelView(game), s = game.state;
    view.art.portraitId = q => q.id;
    view.ui.image = imageNode;
    const byJob = job => s.people.filter(q => q.job === job);
    const farmers = byJob('FARM'), loggers = byJob('LOGGING'), idle = byJob('WAITING');
    // Pick an idle villager with a farming benefit, free of any nighttime tower post.
    const candidate = idle.find(q => q.traits.includes('trait_diligent'));
    s.towers.forEach(tower => { if (tower.operator === candidate.id) tower.operator = null; });
    const body = () => view.box.getChildByName('ScrollList').content;
    const action = label => body().getChildByName('JobCandidate:' + candidate.id).getChildByName('button:' + label);
    const incumbentRows = () => body().children.filter(row => !row.name && row.numChildren).map(row => row.getChildAt(0).name);
    const roster = {type:'people',tab:1};
    view.open(roster);
    assert.equal(incumbentRows().length, farmers.length);
    for (const q of farmers) assert(incumbentRows().some(name => name.includes(q.name)));
    for (const q of loggers) assert(!incumbentRows().some(name => name.includes(q.name)));
    assert(!body().getChildByName('JobCandidate:' + farmers[0].id));
    action('调岗').event('click'); assert.equal(view.current.type,'workers'); assert.equal(view.current.id,candidate.id); assert.equal(view.current.job,'FARM');
    assert.equal(candidate.job,'WAITING');
    view.box.getChildByName('WorkersBack').event('click');
    assert.equal(view.current, roster);
    assert.equal(view.current.tab, 1);
    const detail = {type:'person', id:candidate.id, scroll:40};
    const safeBottom = view.layout.safeBottom;
    view.layout.safeBottom = 620;
    view.open(detail);
    body().getChildByName('ResidentDetail:jobs').getChildByName('button:更换耕作').event('click');
    assert.equal(view.current.back, detail);
    view.box.getChildByName('WorkersBack').event('click');
    assert.equal(view.current, detail);
    assert.equal(view.box.getChildByName('ScrollList').offset, 40);
    view.layout.safeBottom = safeBottom;
    // Increasing the farm level opens a slot. Capture the actual outgoing command without saving a fixture.
    s.farm = 10; view.open({type:'people'});
    const farmTab = view.box.getChildByName('button:耕作');
    assert(farmTab.getChildByName('buttonFace').getChildByName('JobTabActionHint'));
    farmTab.event('click');
    let command; view.send = c => { command = c; };
    assert(action('安排').getChildByName('buttonFace').getChildByName('JobVacancyActionHint'));
    action('安排').event('click'); assert.deepEqual(command,{type:'JOB',id:candidate.id,job:'FARM'});
    view.box.getChildByName('button:伐木').event('click');
    assert(!body().getChildByName('JobCandidate:' + candidate.id));
    s.phase = 'NIGHT'; view.open({type:'people',tab:1});
    assert(!body().getChildByName('JobCandidate:' + candidate.id));
});
test('a 107-person roster mounts only the window and each remounted callback targets the correct person',()=>{
    const {game}=session(),view=panelView(game),template=game.state.people[0];
    game.state.people=Array.from({length:107},(_,i)=>({...template,id:`1:${i+1}`}));game.state.families=[];view.art.portraitId=q=>q.id;
    const clicks=[];view.ui.listItem=(parent,desc,portrait,y,fn)=>{const node=new Sprite();node.name=portrait;node.on('click',null,fn);parent.addChild(node);};
    const roster={type:'people'};view.open(roster);const rows=view.box.getChildByName('ScrollList');assert(rows.content.children.length<12);
    const old=rows.content.children[0];rows.setOffset(rows.maximum);assert(old.destroyed);assert(rows.content.children.length<12);
    const last=rows.content.children.at(-1).children[0];assert.equal(last.name,'1:107');view.open=p=>clicks.push(p);last.event('click');
    assert.deepEqual(clicks,[{type:'person',id:'1:107',back:roster}]);rows.setOffset(0);assert.equal(rows.content.children[0].children[0].name,'1:1');
});
test('the roster uses one arrangement button for weekday jobs and night towers', () => {
    const { game } = session(), view = panelView(game), s = game.state;
    view.ui.image = imageNode; view.art.portraitId = q => q.id;
    const target = s.people.find(q => q.job === 'WAITING');
    s.farm = 10;
    const panel = { type: 'people', tab: 3 };
    view.open(panel);
    const rows = () => view.box.getChildByName('ScrollList').content;
    const first = () => rows().children[0];
    assert.deepEqual(first().children.slice(1).map(node => node.name), ['button:安排']);
    first().getChildByName('button:安排').event('click');
    assert.equal(view.current, panel);
    assert.equal(panel.preview, target.id);
    assert.equal(target.job, 'WAITING');
    const assignment = () => rows().getChildByName('RosterAssignment:' + target.id);
    const tower = s.towers.findIndex(t => t.kind && t.operator !== target.id);
    const commands = []; view.send = c => { commands.push(c); };
    assignment().getChildByName('button:耕作').event('click');
    assignment().getChildByName(`button:${tower + 1}塔`).event('click');
    assert.deepEqual(commands, [
        { type: 'JOB', id: target.id, job: 'FARM' },
        { type: 'OPERATOR', id: target.id, index: tower }
    ]);
    first().getChildByName('button:收起').event('click');
    assert.equal(assignment(), undefined);
    assert.equal(view.current, panel);
    s.farm = 1;
    first().getChildByName('button:安排').event('click');
    assignment().getChildByName('button:换到耕作').event('click');
    assert.equal(view.current.type, 'workers');
    view.box.getChildByName('WorkersBack').event('click');
    assert.equal(view.current, panel);
    assert(assignment());
});
test('a history card can favorite in place and the saved favorite appears on its own tab', () => {
    const { game } = session(), view = panelView(game), s = game.state;
    view.ui.image = imageNode; view.art.portraitId = q => q.id;
    const ancestor = { ...s.people[0], id: `${s.run}:${s.nextPerson++}`, job: 'WAITING', nights: 0, elderNights: 0 };
    s.history.push(ancestor);
    game.changed = view.refresh;
    const card = () => view.box.getChildByName('ScrollList').content.children[0];
    view.open({ type: 'history' });
    card().getChildByName('button:珍藏').event('click');
    assert.deepEqual(game.state.favorites, [ancestor.id]);
    view.box.getChildByName('button:珍藏').event('click');
    assert.equal(view.current.tab, 1);
    card().getChildByName('button:取消珍藏').event('click');
    assert.deepEqual(game.state.favorites, []);
    assert.equal(view.box.getChildByName('emptyState').text, '暂无珍藏的先辈');
});
test('essence targets show retirement and uses before confirmation, soonest first',()=>{
    const {game}=session(),view=panelView(game),s=game.state;
    view.ui.image=imageNode;view.art.portraitId=()=> 'portrait';s.legacy.bestNight=50;
    game.villageItems.saveItems({liang_essence: 1});
    s.people.forEach(p=>p.retirementDelayUses=3);
    const [later,soon]=s.people;
    Object.assign(later,{nights:12,retirementDelayUses:0});Object.assign(soon,{nights:2,retirementDelayUses:2});
    const before=canonical(s);
    const bag={type:'backpack'};
    view.open(bag);
    const contents=()=>view.box.getChildByName('ScrollList').content;
    contents().getChildByName('BackpackItem:liang_essence').event('click');
    const rows=contents().children.filter(row=>row.name.startsWith('EssenceTarget:'));
    assert.deepEqual(rows.map(r=>r.name),[soon,later].map(p=>'EssenceTarget:'+p.id));
    assert(rows[0].children.some(c=>c.text==='距退休 2 夜 · 还可用 1 次'));
    assert.equal(view.current,bag);
    rows[0].getChildByName('button:使用').event('click');
    assert.equal(view.current.type,'essenceConfirm');assert.equal(view.current.id,soon.id);
    assert.equal(canonical(s),before);
});
test('the tactics page gives unread and affordable tactics one action badge and keeps unaffordable notices on the card',()=>{
    const {game}=session(),view=panelView(game),{TACTICS}=require(path.join(compiled,'config/TacticConfig'));
    view.ui.image=imageNode;game.state.completed=game.state.legacy.bestNight=50;
    const unread=new Set(TACTICS.slice(-2).map(t=>t.id));
    view.tacticsNotices={get unread(){return unread.size>0},hasUnread:id=>unread.has(id),markSeen:id=>unread.delete(id)};
    const panel={type:'tactics'}, focus=TACTICS.at(-2);
    view.open(panel);
    const list=()=>view.box.getChildByName('ScrollList');
    const row=id=>list().content.getChildByName('TacticCard:'+id);
    const inspect=id=>row(id).getChildByName('TacticInspect');
    const badge=id=>row(id).getChildByName('TacticReadHint');
    const action=id=>row(id).getChildByName('button:学习并装配').getChildByName('buttonFace').getChildByName('TacticChoiceActionHint');
    assert(badge(focus.id));assert(badge(TACTICS.at(-1).id));
    assert(!action(focus.id));
    game.state.wood=game.state.food=200;view.refresh();
    assert(!badge(focus.id) && action(focus.id));
    assert(!badge(TACTICS.at(-1).id) && action(TACTICS.at(-1).id));
    game.state.wood=game.state.food=0;view.refresh();
    list().setOffset(list().maximum);
    const saved=list().offset;
    inspect(focus.id).event('click');
    assert.equal(view.current,panel);assert.equal(panel.preview,focus.id);
    assert.deepEqual([...unread],[TACTICS.at(-1).id]);
    assert(!badge(focus.id));assert(badge(TACTICS.at(-1).id));
    assert(!action(focus.id));
    inspect(focus.id).event('click');
    assert.equal(view.current,panel);assert.equal(panel.preview,undefined);assert.equal(panel.scroll,saved);
});
test('the single list opens anonymous lore and revealed details inline and confirms learning separately',()=>{
    const {game}=session(),view=panelView(game),{TACTICS}=require(path.join(compiled,'config/TacticConfig'));
    view.ui.image=imageNode;const labels=n=>[n.text||'',...n.children.flatMap(labels)].join(' ');
    const nodes=n=>[n,...n.children.flatMap(nodes)];
    const list=()=>view.box.getChildByName('ScrollList');
    const card=id=>list().content.getChildByName(`TacticCard:${id}`);
    const expanded=()=>list().content.children.find(row=>nodes(row).some(node=>node.name==='TacticLore'));
    game.state.legacy.bestNight=3;
    for(const [waves,revealed]of [[3,1],[4,1],[5,2],[9,2],[10,3],[14,3],[15,4],[19,4],[20,5],[24,5],[25,6],[29,6],[30,7],[34,7],[35,8],[39,8],[40,9],[44,9],[45,10],[49,10],[50,11]]){
        game.state.completed=waves;view.open({type:'tactics'});const content=list().content;
        assert.equal(content.children.filter(c=>c.name.startsWith('TacticCard:')).length,revealed);
        assert.equal(content.children.filter(c=>c.name==='UnknownTactic').length,TACTICS.length-revealed);
        for(const t of TACTICS.slice(revealed))assert(!labels(view.box).includes(t.name));
        for(const t of TACTICS)assert(!labels(view.box).includes(t.lore));
    }
    game.state.completed=1;
    const panel={type:'tactics'};
    view.open(panel);
    const before=JSON.stringify(game.state.tactics);
    list().setOffset(list().maximum);
    const locked=()=>list().content.children.filter(row=>row.name==='UnknownTactic').at(-1);
    const last=TACTICS.at(-1);
    locked().getChildByName('TacticInspect').event('click');
    assert.equal(view.current,panel);assert.equal(panel.preview,last.id);
    const lockedLore=nodes(expanded()).find(node=>node.name==='TacticLore');
    assert.equal(lockedLore.text,last.lore);assert(lockedLore.height>=lockedLore.textHeight);
    assert(!labels(locked()).includes(last.name) && !labels(locked()).includes(last.summary));
    assert(!labels(expanded()).includes(last.name) && !labels(expanded()).includes(last.summary));
    assert(!locked().getChildByName('button:学习并装配'));
    locked().getChildByName('TacticInspect').event('click');
    assert.equal(expanded(),undefined);

    game.state.completed=50;view.refresh();
    for(const t of TACTICS){
        card(t.id).getChildByName('TacticInspect').event('click');
        const detail=labels(expanded()), lore=nodes(expanded()).find(node=>node.name==='TacticLore');
        assert.equal(view.current,panel);assert.equal(panel.preview,t.id);
        assert.equal(lore.text,t.lore);assert(lore.height>=lore.textHeight);
        assert(labels(card(t.id)).includes(t.summary));
        assert.equal(detail.includes(t.detail ?? t.summary), !!t.detail && t.detail !== t.summary);
        if(t.effect!=='KING_MERCY') assert(detail.includes(t.usesPerNight===undefined?`冷却型 · ${t.cooldownSeconds} 秒`:t.usesPerNight===1?'每夜 1 次':`每夜 2 次 · 冷却 ${t.cooldownSeconds} 秒`));
    }
    assert.equal(JSON.stringify(game.state.tactics),before);
    game.state.completed=10;const tactic=TACTICS[1];
    game.state.wood=1;view.open({type:'tactics'});
    assert(labels(card(tactic.id)).includes(String(tactic.wood)));
    assert(!labels(card(tactic.id)).includes(`1/${tactic.wood}`));
    assert(!card(tactic.id).getChildByName('button:学习并装配').handlers.click);
    game.state.wood=tactic.wood;game.state.food=tactic.food;
    const commands=[];view.send=command=>commands.push(command);
    view.open({type:'tactics'});
    view.box.getChildByName('TacticSlot:1').event('click');
    const source=view.current;
    const learn=()=>card(tactic.id).getChildByName('button:学习并装配').event('click');
    learn();
    assert.equal(view.current.type,'spendConfirm');
    assert.equal(view.current.back,source);
    assert.deepEqual(commands,[]);
    view.box.getChildByName('button:取消').event('click');
    assert.equal(view.current,source);
    assert.deepEqual(commands,[]);
    learn();
    view.box.getChildByName('button:确认学习').event('click');
    assert.equal(view.current,source);
    assert.deepEqual(commands,[{type:'TACTIC_LEARN',id:tactic.id,slot:0}]);
    game.state.completed=0;
    view.open({type:'guide',tab:4});for(const t of TACTICS.slice(1))assert(!labels(view.box).includes(t.name));
});

test('round slots open a separate confirmation, and the spotlight guide can be skipped across views', () => {
    const { game, values } = session(), view = panelView(game);
    view.ui.image = imageNode;
    const guide = () => view.box.getChildByName('TacticSlotGuide');
    const choose = i => view.box.getChildByName(`TacticSlot:${i}`).event('click');
    const confirm = () => view.box.getChildByName('button:确认解锁');
    const panel = { type: 'tactics', scroll: 186 };
    game.guides.mark('tacticChange');
    game.guides.mark('tacticAction');
    game.state.completed = game.state.legacy.bestNight = 14;
    view.open(panel);
    const icon = view.box.getChildByName('TacticSlot:1').getChildByName('buttonFace').getChildByName('TacticSlotIcon');
    assert.equal(icon.width, icon.height);
    assert(!guide() && !view.box.getChildByName('TacticSlotUnlock'));
    const before = canonical(game.state);
    choose(2);
    assert(!confirm().handlers.click);
    assert(view.box.children.some(node => node.text === '还需守住 1 波'));
    assert.equal(canonical(game.state), before);
    view.box.getChildByName('button:取消').event('click');
    assert.equal(view.current, panel);
    assert.equal(panel.scroll, 186);
    game.state.completed = 15; game.state.wood = 75; game.state.food = 100; view.refresh();
    assert(guide());
    assert(!view.box.getChildByName('TacticSlot:2').getChildByName('buttonFace').getChildByName('TacticSlotUnlockHint'));
    assert.equal(view.box.getChildByName('TacticSlotSpotlight').mouseEnabled, false);
    const list = view.box.getChildByName('ScrollList');
    assert(list.y + list.height <= guide().y && guide().y + guide().height < view.box.height);
    choose(2);
    assert(view.box.children.some(node => node.text === '还缺 5 木'));
    assert(!confirm().handlers.click);
    view.box.getChildByName('button:取消').event('click');
    choose(3);
    assert(view.box.children.some(node => node.text === '请按顺序解锁战技槽'));
    assert(!confirm().handlers.click);
    view.box.getChildByName('button:取消').event('click');
    view.box.getChildByName('button:跳过').event('click');
    assert(!guide());
    assert.equal(JSON.parse(values.get('daidai_village.guides')).progress.slot, 1);
    const reopened = panelView(game); reopened.ui.image = imageNode;
    reopened.open({ type: 'tactics' });
    assert(!reopened.box.getChildByName('TacticSlotGuide'));
    game.state.wood = 100; view.refresh();
    assert(view.box.getChildByName('TacticSlot:2').getChildByName('buttonFace').getChildByName('TacticSlotUnlockHint'));
    assert(!view.box.getChildByName('TacticSlot:3').getChildByName('buttonFace').getChildByName('TacticSlotUnlockHint'));
    game.state.phase = 'NIGHT'; view.refresh();
    assert(!view.box.getChildByName('TacticSlot:2').handlers.click && !guide());
});

test('slot purchase selects the new empty slot only after a successful save or retry', () => {
    const { game } = session(), view = panelView(game);
    const { generateWave } = require(path.join(compiled, 'game/WaveGenerator.js'));
    view.ui.image = imageNode;
    const panel = { type: 'tactics', scroll: 186 };
    const progress = wins => {
        Object.assign(game.state, { completed: wins, day: wins + 1, wood: 200, food: 200 });
        game.state.legacy.bestNight = wins;
        game.state.wave = generateWave(game.state);
    };
    progress(15);
    view.open(panel);
    game.changed = () => view.refresh();
    const original = game.saves.port.write;
    game.saves.port.write = () => { throw Error('一次写盘错误'); };
    view.box.getChildByName('TacticSlot:2').event('click');
    const confirmation = view.current;
    view.box.getChildByName('button:确认解锁').event('click');
    assert(game.saves.pending);
    assert.equal(view.current, confirmation);
    assert.equal(confirmation.pendingSlotUnlock, 1);
    assert.equal(panel.scroll, 186);
    assert.equal(game.state.wood, 200);
    game.saves.port.write = original;
    game.retry();
    assert.equal(view.current, panel);
    assert.equal(view.current.index, 1);
    assert.equal(panel.scroll, 0);
    assert.equal(confirmation.pendingSlotUnlock, undefined);
    assert.deepEqual([game.state.wood, game.state.food, game.state.tactics.extraSlots], [120, 160, [null]]);
    progress(35); view.open(panel, true);
    view.box.getChildByName('TacticSlot:3').event('click');
    view.box.getChildByName('button:确认解锁').event('click');
    assert.equal(view.current, panel);
    assert.equal(view.current.index, 2);
    assert.deepEqual([game.state.wood, game.state.food, game.state.tactics.extraSlots], [40, 120, [null, null]]);
    assert(!view.box.getChildByName('TacticSlotUnlock'));
});

test('tactic reminders continue from an actionable slot to the candidate and clear on filling it', () => {
    const { game } = session(), view = panelView(game);
    const { DEFAULT_TACTIC, SHIELD_TACTIC } = require(path.join(compiled, 'config/TacticConfig'));
    const { tacticActionReady } = require(path.join(compiled, 'view/panels/TacticLoadoutPanels'));
    view.ui.image = imageNode;
    const s = game.state;
    s.completed = s.legacy.bestNight = 5;
    s.food = s.wood = 100;
    const overview = { type: 'tactics' };
    view.open(overview);
    const badge = (button, name) => button.getChildByName('buttonFace').getChildByName(name);
    const slot = n => view.box.getChildByName(`TacticSlot:${n}`);
    const row = id => view.box.getChildByName('ScrollList').content.getChildByName('TacticCard:' + id);
    assert(tacticActionReady(s));
    assert(!badge(slot(1), 'TacticSlotActionHint'));
    slot(1).event('click');
    assert.equal(view.current, overview);
    assert(!row(DEFAULT_TACTIC).getChildByName('button:卸下'));
    assert(badge(row(SHIELD_TACTIC).getChildByName('button:学习并装配'), 'TacticChoiceActionHint'));
    row(SHIELD_TACTIC).getChildByName('button:学习并装配').event('click');
    assert(!s.tactics.learned.includes(SHIELD_TACTIC));
    assert(badge(view.box.getChildByName('button:确认学习'), 'SpendConfirmActionHint'));
    s.tactics.learned.push(SHIELD_TACTIC);
    s.tactics.extraSlots = [null];
    assert(tacticActionReady(s));
    view.open(overview);
    assert(!badge(slot(1), 'TacticSlotActionHint'));
    assert(badge(slot(2), 'TacticSlotActionHint'));
    slot(2).event('click');
    assert.equal(view.current, overview);
    assert.equal(overview.index, 1);
    assert(!badge(slot(2), 'TacticSlotActionHint'));
    assert(!row(DEFAULT_TACTIC).getChildByName('button:装配'));
    assert.equal(s.tactics.extraSlots[0],null);
    const equip = row(SHIELD_TACTIC).getChildByName('button:装配'), commands = [];
    assert(badge(equip, 'TacticChoiceActionHint'));
    view.send = command => commands.push(command);
    equip.event('click');
    assert.deepEqual(commands,[{type:'TACTIC_EQUIP',id:SHIELD_TACTIC,slot:1}]);
    assert.notEqual(view.current.type,'spendConfirm');
    s.tactics.extraSlots[0] = SHIELD_TACTIC;
    assert(!tacticActionReady(s));
    view.open(overview);
    assert(!badge(slot(2), 'TacticSlotActionHint'));
    row(SHIELD_TACTIC).getChildByName('button:卸下').event('click');
    assert.deepEqual(commands.at(-1), {type:'TACTIC_CLEAR_SLOT',slot:1});
    s.tactics.extraSlots[0] = null;
    game.pause('SAVE_PENDING'); view.refresh();
    assert(!badge(slot(2), 'TacticSlotActionHint'));
});

test('catch-up picks earlier eligible lessons and keeps the active step until it closes', () => {
    const { StarterGuide }=require(path.join(compiled,'view/StarterGuide.js'));
    const { game }=session(), view=panelView(game), layout={footerTop:920};
    const root=new Sprite().size(720,1200); view.ui.image=imageNode;
    const guide=new StarterGuide(game.guides.track('starter'),view.art,view.ui);root.addChild(guide.node);
    assert.equal(guide.nextEligible(10),1);
    guide.tick(1,layout,0);
    assert.equal(guide.nextEligible(10),1);
    guide.node.getChildByName('button:知道了').event('click');
    assert.equal(guide.nextEligible(10),2);
    assert.equal(game.guides.get('starter'),1);
});

test('Zhizhuo tips cover the first five waves, remember progress and allow skipping the rest',()=>{
    const { StarterGuide }=require(path.join(compiled,'view/StarterGuide.js'));
    const { STARTER_LESSONS }=require(path.join(compiled,'view/config/StarterGuideConfig.js'));
    const {game}=session(),view=panelView(game),records=new Map(),layout={footerTop:920};
    view.ui.image=imageNode;
    const root=new Sprite().size(720,1200),port={read:key=>records.get(key)??null,write:(key,value)=>records.set(key,value)};
    const attach=()=>{const guide=new StarterGuide(port,view.art,view.ui);root.addChild(guide.node);return guide;};
    const guide=attach();
    guide.tick(null,layout,0);assert(!guide.node.visible);assert.equal(records.size,0);
    guide.tick(6,layout,0);assert(!guide.node.visible);assert.equal(records.size,0);
    for(let wave=1;wave<=5;wave++){
        guide.tick(wave,layout,0);
        assert(guide.node.visible && guide.node.mouseThrough);
        assert(guide.node.children.some(node=>node.text===STARTER_LESSONS[wave-1].text));
        assert(guide.node.y+guide.node.height<layout.footerTop);
        assert.equal(game.pauses.size,0);
        if(wave===1)guide.tick(wave,layout,9);
        else guide.node.getChildByName('button:知道了').event('click');
        guide.tick(wave,layout,0);assert(!guide.node.visible);
    }
    const reopened=attach();reopened.tick(1,layout,0);assert(!reopened.node.visible);
    records.clear();const migrated=attach();migrated.tick(3,layout,0);
    assert(migrated.node.children.some(node=>node.text===STARTER_LESSONS[2].text));
    migrated.tick(null,layout,0);assert(!migrated.node.visible);
    migrated.tick(4,layout,0);migrated.node.getChildByName('button:跳过引导').event('click');
    const skipped=attach();skipped.tick(5,layout,0);assert(!skipped.node.visible);
    assert(STARTER_LESSONS.every(lesson=>GUIDE_CHAPTERS[0].sections[0].body.includes(lesson.text)));
});

test('guide shade leaves a live target window and disappears with the guide',()=>{
    const { StarterGuide }=require(path.join(compiled,'view/StarterGuide.js'));
    const view=panelView(session().game),root=new Sprite().size(720,1200),layout={footerTop:960,safeTop:40};
    const guide=new StarterGuide({read:()=>null,write(){}},view.art,view.ui),rects=[];
    root.addChild(guide.spotlight);root.addChild(guide.node);
    guide.spotlight.graphics.drawRect=(...args)=>rects.push(args);
    const target=new Sprite().pos(300,1020).size(120,110);
    target.visible=true;target.localToGlobal=point=>point.setTo(target.x+point.x,target.y+point.y);
    guide.tick(1,layout,0,target);
    assert(guide.spotlight.visible && !guide.spotlight.mouseEnabled);
    assert.deepEqual(rects.at(-1).slice(0,5),[292,1012,136,126,null]);
    target.y=650;
    guide.tick(1,layout,0,target);
    assert(guide.node.y+guide.node.height<target.y-8);
    target.visible=false;guide.tick(1,layout,0,target);
    assert(guide.node.visible && !guide.spotlight.visible);
    target.visible=true;guide.tick(1,layout,0,target);
    guide.tick(null,layout,0,target);
    assert(!guide.node.visible && !guide.spotlight.visible);
});

test('tower upgrade hints follow the initiating button and exact confirmation and disappear when unaffordable', () => {
    const {game} = session(), view = panelView(game);
    view.art.portraitId = person => person.id;
    view.ui.image = imageNode;
    const badge = (button, name) => button.getChildByName('buttonFace').getChildByName(name);
    const tower = {type:'tower', index:0};
    Object.assign(game.state, upgradeCost('TOWER', game.state.towers[0].level));
    const initialLevel = game.state.towers[0].level;
    view.open(tower);
    const upgrade = () => view.box.getChildByName('button:升级塔身');
    assert(badge(upgrade(), 'TowerUpgradeActionHint'));
    upgrade().event('click'); assert.equal(view.current.type, 'towerConfirm');
    const confirm = () => view.box.getChildByName('button:确认升级');
    assert(badge(confirm(), 'TowerConfirmActionHint'));
    confirm().event('click');
    assert.equal(game.state.towers[0].level, initialLevel + 1);
    view.open(tower);
    assert(!badge(upgrade(), 'TowerUpgradeActionHint'));
    upgrade().event('click');
    assert(!badge(confirm(), 'TowerConfirmActionHint'));
    assert(!confirm().handlers.click);
});

test('ammo actions stay in their cards and preserve the last visible row across upgrade and return', () => {
    const { game } = session(), view = panelView(game);
    const { TOWER_AMMO } = require(path.join(compiled, 'config/DefenseConfig.js'));
    const gameState = require(path.join(compiled, 'game/GameState.js')), owns = gameState.ownsTowerAmmo;
    const fixtures = Array.from({length: 21}, (_, i) => 'test_ammo_' + i);
    try {
        // Model a larger collection of unlocked types, retaining real starter types for swap and upgrade.
        const stone = TOWER_AMMO.STONE;
        gameState.ownsTowerAmmo = (s, kind) => fixtures.includes(kind) || owns(s, kind);
        for (const key of fixtures) {
            TOWER_AMMO[key] = { ...stone, name: key };
            game.state.ammoLevels[key] = 1;
        }
        delete TOWER_AMMO.STONE; TOWER_AMMO.STONE = stone;
        view.ui.image = imageNode;
        view.layout.safeBottom = 882;
        const menu = { type: 'towerAmmo', index: 0, id: 'ARROW', back: { type: 'tower', index: 0 } };
        view.open(menu);
        const list = () => view.box.getChildByName('ScrollList');
        const action = title => {
            const find = node => node.name === 'button:' + title ? node : node.children.map(find).find(Boolean);
            return find(view.box);
        };
        const labels = node => [node.text, ...node.children.flatMap(labels)];
        const compactHeight = view.box.height;
        assert(!labels(view.box).includes('换装预览'));
        assert(action('升级弓箭'));
        assert(list().maximum > 0 && view.box.height <= view.layout.safeBottom - view.layout.safeTop);
        list().setOffset(list().maximum);
        const offset = menu.scroll;
        list().content.children.at(-1).getChildByName('ammo:STONE').event('click');
        assert.equal(menu.id, 'STONE'); assert.equal(menu.scroll, offset);
        assert(view.box.height > compactHeight); assert(labels(view.box).includes('换装预览'));
        assert.equal(action('装备石弹').parent.name, 'ammo:STONE');
        assert(action('装备石弹').y + action('装备石弹').height < action('装备石弹').parent.height);
        action('升级石弹').event('click'); assert.equal(view.current.type, 'ammoUpgrade');
        action('取消').event('click'); assert.equal(view.current, menu); assert.equal(list().offset, offset);
        const {food, wood} = game.state;
        action('装备石弹').event('click'); assert.equal(game.state.towers[0].kind, 'STONE');
        assert.deepEqual([game.state.food, game.state.wood], [food, wood]);
    } finally {
        gameState.ownsTowerAmmo = owns;
        for (const key of fixtures) delete TOWER_AMMO[key];
        // Restore insertion order for later tests.
        const ice = TOWER_AMMO.SLOW; delete TOWER_AMMO.SLOW; TOWER_AMMO.SLOW = ice;
    }
});

test('the sole eligible couple can marry from the family tab with both portraits and talents visible', () => {
    const {game} = session(), view = panelView(game);
    view.ui.image = imageNode;
    view.art.portraitId = p => p.id;
    const [,,first,second,a,b] = game.state.people;
    game.command({type:'FAMILY', a:first.id, b:second.id});
    view.open({type:'families'});
    const nodes = node => [node, ...node.children.flatMap(nodes)];
    const button = nodes(view.box).find(n => n.name === 'button:确认成家');
    assert(button);
    const card = nodes(button.parent);
    for (const p of [a,b]) {
        assert(card.some(n => n.name === p.id));
        assert(card.some(n => n.text?.includes(p.name)));
    }
    assert(card.some(n => n.text === '伐木') && card.some(n => n.text === '农艺'));
    const count = game.state.families.length;
    button.event('click');
    assert.equal(game.state.families.length, count + 1);
    assert.deepEqual(game.state.families.at(-1).partners, [a.id,b.id]);
    button.event('click');
    assert.equal(game.state.families.length, count + 1);
});

test('regular full-house visits preserve the arrival clock, random draws, IDs after calendar removal', () => {
    const {finishNight} = require(path.join(compiled,'game/VillageRules.js'));
    for (const day of [4,12]) {
        const full = createGame(121);
        full.day = day; full.completed = day-1; full.legacy.bestNight = day-1;
        for (const p of full.people.slice(4)) full.people.push({...p,id:'1:'+full.nextPerson++,job:'WAITING'});
        const spare = JSON.parse(JSON.stringify(full)); spare.houses++;
        for (const state of [full,spare]) {
            applyCommand(state,{type:'NIGHT'}); finishNight(state,state.gate,state.towers.map(t=>t.operator));
        }
        assert.equal(spare.choices[0].kind,'TRAVELER');
        assert.deepEqual(full.choices,spare.choices.slice(1));
        assert.equal(full.choices.length,0);
        assert.deepEqual([full.rng,full.nextPerson,full.lastTraveler],[spare.rng,spare.nextPerson,day]);
        assert.equal(spare.lastTraveler,day);
        assert.match(full.summary,/有旅人经过，村中客满/);
        assert.doesNotMatch(spare.summary,/客满/);
        // 模拟上一候选版已保存的清晨。重复读档和自动进入白天均不得重复记入来访。
        const {game} = session(); spare.houses = full.houses;
        game.saves.prepare(spare); game.saves.commit(); game.load();
        assert.deepEqual(game.state.choices,full.choices);
        assert.equal(game.state.summary,full.summary);
        game.load(); assert.equal(game.state.phase,'DAY');
        assert.equal(game.state.summary,full.summary);
    }
});

test('backpack grid keeps inventory and confirmation tied to the selected item', () => {
    const {game} = session(), view = panelView(game);
    view.ui.image = imageNode;
    view.art.portraitId = () => 'portrait';
    game.state.legacy.bestNight = 13;
    const bag = {type:'backpack'};
    const contents = () => view.box.getChildByName('ScrollList').content;
    const row = id => contents().getChildByName('BackpackItem:' + id);
    const detail = id => contents().getChildByName('BackpackDetail:' + id);
    const use = id => detail(id).getChildByName('button:使用');
    const badge = (button, name) => button.getChildByName('buttonFace').getChildByName(name);
    const { itemActionHints } = require(path.join(compiled, 'view/panels/ItemPanels.js'));
    const hasText = (node, text) => node.children.some(child => child.text?.includes(text));
    game.villageItems.saveItems({liang_essence:2, patrol_ration:2, liang_indulgence:1, future_item:1});
    view.open(bag);
    assert(itemActionHints(game,game.state,false).backpack);
    assert(!itemActionHints(game,game.state,true).backpack);
    assert(row('liang_indulgence').getChildByName('BackpackUseHint'));
    assert.equal(row('liang_indulgence').y, row('liang_essence').y);
    assert.notEqual(row('future_item').y, row('liang_essence').y);
    row('future_item').event('click');
    assert(hasText(detail('future_item'), '库存已保留'));
    assert(!use('future_item'));
    row('liang_indulgence').event('click');
    use('liang_indulgence').event('click');
    assert.equal(view.current.type, 'spendConfirm');
    assert.equal(game.state.patrol.radiusReady, undefined);
    assert.equal(game.villageItems.backpack().items.liang_indulgence, 1);
    view.box.getChildByName('button:取消').event('click');
    assert.equal(view.current, bag);
    use('liang_indulgence').event('click');
    const confirm = view.box.getChildByName('button:确认使用');
    confirm.event('click');
    confirm.event('click');
    assert.equal(game.state.patrol.radiusReady, true);
    assert.equal(game.state.patrol.rationReady, undefined);
    view.refresh();
    assert.equal(row('liang_indulgence'), undefined);
    row('patrol_ration').event('click');
    use('patrol_ration').event('click');
    view.box.getChildByName('button:确认使用').event('click');
    view.refresh();
    assert(hasText(row('patrol_ration'), '×1'));
    assert(hasText(detail('patrol_ration'), '已获鼓舞'));
    assert(!use('patrol_ration').handlers.click);
    assert(!badge(use('patrol_ration'), 'BackpackUseHint'));
    row('liang_essence').event('click');
    assert.equal(view.current, bag);
    const chosen = contents().children.find(child=>child.name.startsWith('EssenceTarget:')).getChildByName('button:使用');
    assert(badge(chosen, 'EssenceSelectHint'));
    chosen.event('click');
    assert.equal(view.current.type, 'essenceConfirm');
    assert(badge(view.box.getChildByName('button:确认使用'), 'EssenceConfirmHint'));
    assert.equal(game.villageItems.backpack().items.liang_essence, 2);
    view.box.getChildByName('button:取消').event('click');
    assert.equal(view.current, bag);
    for (const p of game.state.people) p.retirementDelayUses = 3;
    view.refresh();
    assert(!contents().children.some(child=>child.name.startsWith('EssenceTarget:')));
    assert(!itemActionHints(game,game.state,false).backpack);
    assert(hasText(detail('liang_essence'), '没有可使用的成年村民'));
    game.villageItems.saveItems({});
    view.refresh();
    assert(hasText(view.box, '背包里还没有道具'));
});

test('ice ammo stays out of tower inventory until the shop purchase, then equips for free', () => {
    const {game} = session(), view = panelView(game), s = game.state;
    const { itemActionHints } = require(path.join(compiled, 'view/panels/ItemPanels.js'));
    assert.equal(s.completed, 0); s.food = 0; s.wood = 35;
    view.ui.image = imageNode;
    const openAmmo = () => view.open({type:'towerAmmo', id:'ARROW', index:0, back:{type:'tower', index:0}});
    const entry = kind => view.box.getChildByName('ScrollList').content.children.map(row => row.getChildByName('ammo:'+kind)).find(Boolean);
    openAmmo();
    assert(entry('ARROW') && entry('STONE'));
    assert(!entry('SLOW'));
    assert(itemActionHints(game,s,false).shop);
    assert(!itemActionHints(game,s,true).shop);
    const shop = {type:'shop'};
    view.open(shop);
    const rows = () => view.box.getChildByName('ScrollList');
    const tab = title => view.box.getChildByName('button:' + title);
    const tabBadge = title => tab(title).getChildByName('buttonFace').getChildByName('ShopTabActionHint');
    assert.deepEqual(rows().content.children.map(row => row.name), ['ShopProduct:liang_essence','ShopProduct:patrol_ration','ShopProduct:liang_indulgence','ShopProduct:yuexiu_dice']);
    assert(tabBadge('弹药') && !tabBadge('消耗品'));
    const safeBottom = view.layout.safeBottom;
    view.layout.safeBottom = 620;
    view.refresh();
    rows().setOffset(40);
    tab('弹药').event('click');
    assert.equal(rows().offset, 0);
    assert(!tabBadge('弹药'));
    tab('消耗品').event('click');
    assert.equal(rows().offset, 40);
    view.layout.safeBottom = safeBottom;
    tab('弹药').event('click');
    assert.deepEqual(rows().content.children.map(row => row.name), ['ShopProduct:ice_ammo']);
    const hasText = (node, text) => node.text === text || node.children.some(child => hasText(child, text));
    const effect = '永久解锁，可在石炮塔中装配';
    const offer = view.box.getChildByName('ScrollList').content.getChildByName('ShopProduct:ice_ammo');
    const purchase = offer.getChildByName('button:购买');
    assert(!offer.getChildByName('ShopOfferHint'));
    const badge = purchase.getChildByName('buttonFace').getChildByName('ShopOfferHint');
    assert(badge && purchase.x + badge.x + badge.width <= offer.width && purchase.y + badge.y >= 0);
    assert(!hasText(offer, effect));
    purchase.event('click');
    assert.equal(view.current.type, 'itemOffer');
    assert.equal(game.state.wood, 35);
    assert(!game.state.iceAmmoUnlocked);
    assert(hasText(view.box, effect));
    view.box.getChildByName('PanelBack').event('click');
    assert.equal(view.current, shop);
    assert.equal(rows().content.children[0].name, 'ShopProduct:ice_ammo');
    rows().content.children[0].getChildByName('button:购买').event('click');
    const confirm = view.box.getChildByName('button:确认购买');
    assert(!confirm.getChildByName('buttonFace').getChildByName('ShopBuyHint'));
    assert(!view.box.children.some(child => child.getChildByName('ShopBuyHint')));
    confirm.event('click');
    assert(game.state.iceAmmoUnlocked);
    assert(!itemActionHints(game,game.state,false).shop);
    assert.equal(game.state.wood, 0);
    openAmmo();
    assert(entry('SLOW').getChildByName('button:装备冰弹').getChildByName('buttonFace').getChildByName('AmmoEquipActionHint'));
    assert(!entry('SLOW').getChildByName('buttonFace').getChildByName('AmmoTileActionHint'));
    entry('SLOW').event('click');
    const action = entry('SLOW').getChildByName('button:装备冰弹');
    assert(action.getChildByName('buttonFace').getChildByName('AmmoEquipActionHint'));
    action.event('click');
    assert.equal(game.state.towers[0].kind, 'SLOW');
    assert.equal(game.state.wood, 0);
    game.state.phase = 'NIGHT';
    openAmmo();
    assert(entry('SLOW'));
    assert.equal(entry('ARROW').getChildByName('button:装备弓箭'), undefined);
    assert.equal(entry('ARROW').getChildByName('button:升级弓箭'), undefined);
});

test('traveler ability detail preserves the pending invitation, with a badge on Join only when housing is available', () => {
    const {game,values} = session(), view = panelView(game), s = game.state;
    const { drawSessionPanel } = require(path.join(compiled, 'view/panels/SessionPanels.js'));
    const { capacity } = require(path.join(compiled, 'game/VillageRules.js'));
    view.ui.image = imageNode; view.art.portraitId = () => 'portrait';
    const traveler = {...s.people[0], id:'1:70', name:'来客', quality:'ELITE', traits:['trait_strong','trait_diligent']};
    s.phase = 'DAWN'; s.choices = [{kind:'TRAVELER', person:traveler}];
    const before = canonical(s), saved = canonical([...values]);
    drawSessionPanel(view,s,690);
    const welcome = view.box.getChildByName('button:欢迎加入');
    assert(welcome.getChildByName('buttonFace').getChildByName('TravelerAcceptHint'));
    view.box.getChildByName('button:能力详情').event('click');
    drawSessionPanel(view,s,690);
    assert(view.box.getChildByName('ScrollList').content.getChildByName('Traveler:details'));
    assert(view.box.getChildByName('button:欢迎加入'));
    view.box.getChildByName('button:收起详情').event('click');
    drawSessionPanel(view,s,690);
    assert(!view.box.getChildByName('ScrollList').content.getChildByName('Traveler:details'));
    assert.equal(canonical(s),before); assert.equal(canonical([...values]),saved);
    while (s.people.length < capacity(s)) s.people.push({...traveler});
    drawSessionPanel(view,s,690);
    assert(!view.box.getChildByName('button:欢迎加入').handlers.click);
});

test('daily task detail keeps win conditions and storage shortage while marking only a usable claim', () => {
    const {game} = session(), view = panelView(game), s = game.state;
    view.ui.image = imageNode;
    s.legacy.bestNight = 13;
    s.dailyTasks = {date:game.taskDate, tasks:[
        {kind:'win', goal:2, progress:2, material:'food', reward:8, claimed:false},
        {kind:'gateHealth', goal:70, progress:0, material:'wood', reward:7, claimed:false}
    ]};
    view.open({type:'dailyTasks'});
    const win = () => view.box.getChildByName('DailyTask:win');
    assert(win().getChildByName('button:领取').getChildByName('buttonFace').getChildByName('ClaimRewardHint'));
    assert(view.box.getChildByName('DailyTask:gateHealth').children.some(n=>n.text==='守胜 · 耐久 ≥ 70%'));
    s.food = require(path.join(compiled, 'game/Growth.js')).storageCapacity(s)-2;
    view.refresh();
    assert(!win().getChildByName('button:领取'));
    assert.equal(win().getChildByName('TaskStorageNote').text,'需腾出 6 格');
    view.layout.safeBottom = 540;
    view.refresh();
    const list = view.box.getChildByName('ScrollList');
    assert(list.content.getChildByName('DailyTask:gateHealth'));
    assert(view.box.height <= view.layout.safeBottom - view.layout.safeTop);
    assert(view.box.children.some(node=>node.text==='每天 00:00 刷新'));
});

test('521 uses the route selected in the scroll list and dispatches from a candidate card', () => {
    const {game} = session(), view = panelView(game), s = game.state;
    s.completed = s.legacy.bestNight = 8;
    view.ui.image = imageNode;
    view.art.portraitId = p => p.id;
    view.layout.safeBottom = 640;
    const panel = {type:'expedition'};
    const list = () => view.box.getChildByName('ScrollList');
    const cards = () => list().content.children.flatMap(row=>row.children);
    view.open(panel);
    assert.equal(cards().filter(card=>card.name.startsWith('ExpeditionRoute:')).length,2);
    cards().find(card=>card.name==='ExpeditionRoute:overnight').event('click');
    assert.equal(panel.expeditionRoute,'overnight');
    list().setOffset(190);
    const candidate = cards().find(card=>card.name.startsWith('ExpeditionPerson:') && card.getChildByName('button:派出探索'));
    assert(candidate);
    const commands = [];
    view.send = command => commands.push(command);
    candidate.getChildByName('button:派出探索').event('click');
    assert.deepEqual(commands, []);
    assert.equal(view.current.type, 'spendConfirm');
    assert.match(view.current.spend.detail, /通宵区.*夜/);
    view.box.getChildByName('button:取消').event('click');
    assert.equal(view.current, panel);
    assert.equal(panel.expeditionRoute, 'overnight');
    assert.equal(list().offset, 190);
    cards().find(card => card.name === candidate.name).getChildByName('button:派出探索').event('click');
    view.box.getChildByName('button:确认派出').event('click');
    assert.deepEqual(commands,[{type:'START_EXPEDITION',id:candidate.name.slice('ExpeditionPerson:'.length),route:'overnight'}]);
});
