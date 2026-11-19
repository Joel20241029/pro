const { test } = require('node:test'), assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs');
const build = process.env.DAIDAI_TEST_BUILD, read = name => require(path.join(build, name));
const { CombatPresentation } = read('view/CombatPresentation'), { ProjectileMotion, PROJECTILE_STYLE } = read('view/ProjectileMotion');
const { GameSession } = read('game/GameSession'), { BattleSimulation, PATH_LENGTH } = read('game/BattleSimulation');
const { createGame, applyCommand, finishNight } = read('game/VillageRules'), { SaveStore } = read('storage/SaveStore');
const { enemyPoint } = read('game/BattleRoad'), { RULE, PADS } = read('game/GameConfig');
const { FEEDBACK } = read('view/config/FeedbackConfig');
const enemy = (seq = 1, hp = 0) => ({ seq, hp, kind: 'enemy_raider', appearanceSeed: 0, progress: 250, walkDistance: 30, speed: 0, slow: 0, slowTicks: 0, born: 0, summoned: 0 });
function battle() { const s = createGame(7); applyCommand(s, { type: 'NIGHT' }); return new BattleSimulation(s); }
function fatal(b, kind = 'ARROW') {
    const e = enemy(), at = enemyPoint(e), shot = { tower: 0, kind, tick: b.tick, x: at.x, y: at.y, empowered: false };
    return { type: 'shot', shot, target: e.seq, hurt: [e] };
}
const near = (a, b) => assert(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
test('death waits for impact, squashes at its fixed feet, holds a full half second, then fades', () => {
    const b = battle(), f = new CombatPresentation(), event = fatal(b); f.sync(b, [event]);
    f.advance(1); assert.equal(f.deathPose(1), undefined); assert(!f.flashing(1));
    f.impact(event.shot); assert.deepEqual(f.deathPose(1), { scaleY: 1, alpha: 1 }); assert(f.flashing(1));
    const snapshot = JSON.stringify(f.deaths.get(1).enemy);
    f.advance(.06); assert(f.deathPose(1).scaleY < 1 && f.deathPose(1).scaleY > .22);
    f.advance(.06); near(f.deathPose(1).scaleY, .22); near(f.deathPose(1).alpha, 1);
    f.advance(.499); near(f.deathPose(1).alpha, 1); assert.equal(JSON.stringify(f.deaths.get(1).enemy), snapshot);
    const held = f.deathPose(1); f.advance(0); f.sync(b, []); assert.deepEqual(f.deathPose(1), held);
    f.advance(.121); near(f.deathPose(1).alpha, .5); near(f.deathPose(1).scaleY, .22);
    f.advance(.121); assert.equal(f.deaths.size, 0); assert(!f.flashing(1));
});
for (const kind of ['ARROW', 'STONE', 'SLOW']) test(`${kind}: actual contact and flash coincide, repeated refresh cannot erase contact`, () => {
    for (const speed of [2, 3]) {
        const b = battle(), f = new CombatPresentation(), p = new ProjectileMotion(), event = fatal(b, kind); f.sync(b, [event]);
        b.tick = 1; p.update(b, undefined, undefined, undefined, f); assert(!f.flashing(1)); assert(!p.poses[0].contact);
        b.tick = Math.ceil(PROJECTILE_STYLE[kind].flight / RULE.step); f.advance(.02);
        p.update(b, undefined, undefined, undefined, f); assert(!f.flashing(1));
        b.tick += speed * 5; f.advance(.1); p.update(b, undefined, undefined, undefined, f);
        const contact = p.poses[0]; assert(contact.contact); assert(f.flashing(1));
        assert.equal(contact.frame, PROJECTILE_STYLE[kind].frame); near(contact.x, event.shot.x); near(contact.y, event.shot.y - 20); near(contact.alpha, 1);
        const state = JSON.stringify(p.poses); for (let i = 0; i < 4; i++) p.update(b, undefined, undefined, undefined, f);
        assert.equal(JSON.stringify(p.poses), state); assert.equal(p.arrivals.length, 0);
        f.advance(.02); p.update(b, undefined, undefined, undefined, f); assert(p.poses[0].contact);
        f.advance(.04); p.update(b, undefined, undefined, undefined, f); assert(!p.poses[0].contact);
    }
});
test('a late projectile cannot reflash or restart a dying enemy; gate exit animates without an attack flash', () => {
    const b = battle(), f = new CombatPresentation(), event = fatal(b), late = { ...fatal(b), hurt: [enemy(1, 10)] };
    f.sync(b, [event, late]); f.impact(event.shot); f.advance(.3); const before = f.deathPose(1);
    f.impact(late.shot); assert(!f.flashing(1)); assert.deepEqual(f.deathPose(1), before);
    f.sync(b, [{ type: 'gate', enemy: { ...enemy(2), progress: PATH_LENGTH }, blocked: false, tick: b.tick, x: 360, y: 760 }]);
    assert(f.deathPose(2)); assert(!f.flashing(2)); f.sync(null, []); assert.equal(f.deaths.size, 0);
});

function endingSession(day, lose = false) {
    const values = new Map(); let fail = false;
    const store = new SaveStore({ read: k => values.get(k) ?? null, write(k, v) { if (fail) throw Error('disk'); values.set(k, v); } });
    store.inspect(); const g = new GameSession(store), s = createGame(7); s.day = day; s.completed = day - 1; s.legacy.bestNight = day - 1;
    applyCommand(s, { type: 'NIGHT' }); store.prepare(s); store.commit(); g.load();
    const b = g.battle; b.cursor = b.base.wave.entries.length;
    let progress = 0, closest = Infinity;
    for (let i = 0; i < PATH_LENGTH; i++) { const at = enemyPoint({ ...enemy(), progress: i }), d = Math.hypot(at.x - PADS[0].x, at.y - PADS[0].y); if (d < closest) { closest = d; progress = i; } }
    b.enemies = [{ ...enemy(1, 1), progress: lose ? PATH_LENGTH : progress }]; if (lose) b.gate = 1;
    return { g, b, values, failWrites(value) { fail = value; } };
}
for (const day of [1, 3]) test(`last kill on day ${day} preserves final events through settlement without delaying business state`, () => {
    const { g, b } = endingSession(day), expected = JSON.parse(JSON.stringify(g.state));
    const baseline = new BattleSimulation(b.base); baseline.cursor = b.cursor; baseline.enemies = b.enemies.map(e => ({ ...e })); baseline.step();
    finishNight(expected, baseline.gate, baseline.operators); if (!expected.choices.length) applyCommand(expected, { type: 'FINALIZE' });
    g.update(.05); assert.equal(g.battle, null); assert.equal(g.presentationBattle, b); assert.deepEqual(g.state, expected);
    const events = g.takeCombatFeedback(); assert(events.some(e => e.type === 'shot')); assert.deepEqual(g.takeCombatFeedback(), []);
    const f = new CombatPresentation(), p = new ProjectileMotion(); f.sync(g.presentationBattle, events); p.update(g.presentationBattle, undefined, undefined, undefined, f);
    const tick = b.tick; f.advance(.45); p.update(g.presentationBattle, undefined, undefined, undefined, f); assert(f.deathPose(1)); assert.equal(b.tick, tick);
    f.advance(.87); p.update(g.presentationBattle, undefined, undefined, undefined, f); assert.equal(f.deaths.size, 0); assert.equal(p.poses.length, 0);
    g.load(); assert.equal(g.presentationBattle, null); assert.deepEqual(g.takeCombatFeedback(), []);
});
test('failed final save retries without duplicating damage or feedback; pure restart clears the tail', () => {
    const { g, b, failWrites } = endingSession(1); failWrites(true); g.update(.05);
    assert(g.saves.pending); assert.equal(g.presentationBattle, b); const tick = b.tick;
    const events = g.takeCombatFeedback(); assert(events.length); failWrites(false); g.retry();
    assert.equal(g.battle, null); assert.equal(g.presentationBattle, b); assert.equal(b.tick, tick); assert.deepEqual(g.takeCombatFeedback(), []);
    g.newVillage(); assert.equal(g.presentationBattle, null);
});
test('defeat preserves the gate death snapshot but does not keep living monsters displayed', () => {
    const { g, b } = endingSession(1, true); g.update(.05); assert.equal(g.state.phase, 'GAME_OVER'); assert.equal(g.battle, null);
    const f = new CombatPresentation(); f.sync(g.presentationBattle, g.takeCombatFeedback()); assert.equal(g.presentationBattle, b); assert(f.deathPose(1));
    f.advance(.87); assert.equal(f.deaths.size, 0);
});

class Sprite {
    constructor() { this.children = []; this.graphics = { clear() {}, drawTexture() {}, drawImage() {} }; }
    addChild(n) { this.children.push(n); return n; } size(w, h) { this.width = w; this.height = h; return this; }
    pivot(x, y) { this.pivotX = x; this.pivotY = y; return this; } scale(x, y) { this.scaleX = x; this.scaleY = y; return this; }
    pos(x, y) { this.x = x; this.y = y; return this; }
}
global.Laya = { Sprite, Script: class {}, regClass: () => c => c, timer: { currFrame: 0 } };
const { EnemyVisuals } = read('view/EnemyVisuals'), { ProjectileVisuals } = read('view/ProjectileVisuals'), { VillageWorld } = read('view/VillageWorld');
const project = path.resolve(__dirname, '..');
const layouts = JSON.parse(fs.readFileSync(path.join(project, 'assets/resources/gameplay/enemies/enemies.bin'))).definitions;
test('last-kill synchronous render cannot spend the old frame delta before contact reaches the screen', () => {
    for (const delta of [.05, .15, .25]) {
        const b = battle(), f = new CombatPresentation(), p = new ProjectileMotion(), event = fatal(b);
        const world = Object.create(VillageWorld.prototype);
        Object.assign(world, { feedback: f, feedbackFrame: -1, props: [{ id: 'building:patrol', node: new Sprite() }], people: [], enemies: [], actorShadows: [], qualityRings: [], hearts: [],
            bellAura: new Sprite(), cryIcon: new Sprite(), crying: { dismiss() {} }, hideSpeech() {}, projectileVisuals: { clear() {} }, rage: { update() {} }, patrolVisuals: { update() { return []; } }, shield: { reset() {} },
            interaction: { clearDepth() {} }, blast: { update() {} }, handSpeed: { update() {} }, renderDelta: 0, lastBattle: null, lastBattleTick: 0,
            game: { state: null, battle: null, presentationBattle: b, pauses: new Set(), takeCombatFeedback: () => [event] } });
        b.tick = 20; b.outcome = 'WIN'; Laya.timer.currFrame = 100;
        world.render(false); p.update(b, undefined, undefined, undefined, f);
        assert(p.poses[0].contact); assert(f.flashing(1)); assert(f.hitShake(1) > 0);
        assert.equal(p.poses[0].impactFrame, 'fx_impact_arrow_1');
        assert.equal(p.poses[0].impactShift, 0);
        world.advance(delta); p.update(b, undefined, undefined, undefined, f);
        assert.equal(f.time, 0); assert(p.poses[0].contact); assert(f.flashing(1));
        Laya.timer.currFrame++; world.advance(delta); assert.equal(f.time, delta);
        world.game.pauses.add('USER'); Laya.timer.currFrame++; world.advance(delta); assert.equal(f.time, delta);
    }
});
test('all ten monsters retain the same foot pivot and restore full scale/alpha when a dead pool slot is reused', () => {
    for (const kind of Object.keys(layouts)) {
        const n = new Sprite(), v = new EnemyVisuals(n, { enemyLayouts: layouts, get: id => id });
        v.draw(kind, 0, 0, true); const normal = { x: n.scaleX, y: n.scaleY, px: n.pivotX, py: n.pivotY };
        v.draw(kind, 0, 0, true, false, { scaleY: .22, alpha: .3 });
        near(n.scaleX, normal.x); near(n.scaleY, normal.y * .22); near(n.alpha, .3); assert.deepEqual([n.pivotX, n.pivotY], [normal.px, normal.py]);
        v.draw(kind, 0, 0, true); near(n.scaleY, normal.y); near(n.alpha, 1);
    }
});
test('a burst exceeding eighty visible bodies expands reusable slots instead of truncating deaths', () => {
    const world = Object.create(VillageWorld.prototype); Object.assign(world, { world: new Sprite(), enemies: [], enemyVisuals: [], art: { enemyLayouts: layouts, get: id => id } });
    world.reserveEnemies(125); assert.equal(world.enemies.length, 125); assert.equal(world.enemyVisuals.length, 125);
    world.reserveEnemies(40); assert.equal(world.enemies.length, 125); assert.equal(world.world.children.length, 125);
});
test('rotated arrow tip and stone/ice image centers land on the same target point used by hit feedback', () => {
    const table = JSON.parse(fs.readFileSync(path.join(project, 'assets/resources/gameplay/enemies/frames.bin'))).frames;
    const art = { contentBounds: id => table[id], applyFrame(n, id, size) { const f = table[id]; n.size(size, size * f.sourceSize.h / f.sourceSize.w); n.pivot(f.pivot.x * size / f.sourceSize.w, f.pivot.y * size / f.sourceSize.w); }, get: id => id };
    const visual = new ProjectileVisuals(new Sprite(), art);
    for (const kind of ['ARROW', 'STONE', 'SLOW']) for (const rotation of [-90, 0, 90, 180]) {
        const style = PROJECTILE_STYLE[kind], pose = { shot: { kind, tower: 0, tick: 0, empowered: false }, impacted: true, contact: true, frame: style.frame, size: style.size, x: 300, y: 450, rotation, alpha: 1 };
        visual.clear(); visual.draw([pose]); const n = visual.projectileNodes[0], f = table[style.frame]; assert(n.visible);
        const x = kind === 'ARROW' ? 124 : f.trimOffset.x + f.rect.w / 2, y = kind === 'ARROW' ? 8 : f.trimOffset.y + f.rect.h / 2;
        near(x * style.size / f.sourceSize.w - n.pivotX, 0); near(y * style.size / f.sourceSize.w - n.pivotY, 0);
        near(n.x, 300); near(n.y, 450);
    }
});
