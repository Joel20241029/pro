const { test } = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const build = process.env.DAIDAI_TEST_BUILD;
class Point { constructor(x = 0, y = 0) { this.setTo(x, y); } setTo(x, y) { this.x = x; this.y = y; return this; } }
class Rectangle {
    constructor(x = 0, y = 0, width = 0, height = 0) { this.setTo(x, y, width, height); }
    setTo(x, y, width, height) { Object.assign(this, { x, y, width, height }); return this; }
    contains(x, y) { return x >= this.x && y >= this.y && x < this.x + this.width && y < this.y + this.height; }
}
class Sprite {
    constructor() {
        this.x = this.y = this.pivotX = this.pivotY = this.width = this.height = 0;
        this.scaleX = this.scaleY = this.alpha = 1; this.visible = true; this.name = '';
        this.children = []; this.events = {}; this.graphics = { clear() {} };
    }
    pos(x, y) { this.x = x; this.y = y; return this; }
    size(width, height) { this.width = width; this.height = height; return this; }
    pivot(x, y) { this.pivotX = x; this.pivotY = y; return this; }
    scale(x, y) { this.scaleX = x; this.scaleY = y; return this; }
    addChild(node) { this.children.push(node); node.parent = this; return node; }
    on(type, caller, fn) { (this.events[type] ||= []).push(fn.bind(caller)); }
    event(type, value) { for (const fn of this.events[type] || []) fn(value); }
    getGraphicBounds(_real, out = new Rectangle()) { return out.setTo(8, 4, this.width - 16, this.height - 8); }
    getSelfBounds(out = new Rectangle()) { return this.getGraphicBounds(false, out); }
    localToGlobal(point, copy = false, relative) {
        const result = copy ? new Point(point.x, point.y) : point;
        for (let node = this; node && node !== relative; node = node.parent) {
            result.x = (result.x - node.pivotX) * node.scaleX + node.x;
            result.y = (result.y - node.pivotY) * node.scaleY + node.y;
        }
        return result;
    }
    globalToLocal(point) {
        const chain = []; for (let node = this; node; node = node.parent) chain.push(node);
        for (const node of chain.reverse()) {
            point.x = (point.x - node.x) / node.scaleX + node.pivotX;
            point.y = (point.y - node.y) / node.scaleY + node.pivotY;
        }
        return point;
    }
}
class Text extends Sprite {}
const cancelled = [];
global.Laya = { Sprite, Text, Point, Rectangle, Event: { MOUSE_DOWN: 'down', MOUSE_UP: 'up', MOUSE_OUT: 'out', CLICK: 'click', UNDISPLAY: 'undisplay' }, InputManager: { cancelClick: id => cancelled.push(id) } };
const { VillageWorld } = require(path.join(build, 'view/VillageWorld.js'));
const { GameLayout } = require(path.join(build, 'view/GameLayout.js'));
const { UiWidgets } = require(path.join(build, 'view/UiWidgets.js'));
const { createGame } = require(path.join(build, 'game/VillageRules.js'));
const { compareDepth } = require(path.join(build, 'view/VillageScene.js'));
const art = {
    particles: require("./helpers/particles.cjs").library(),
    ready: () => true,
    get: id => id, frameId: clip => clip, walk: () => ({ clip: 'villager_male_a_walk', mirror: false }),
    applyFrame(node, _id, size) { node.size(size, size).pivot(size / 2, size * 15 / 16); }
};
function setup() {
    cancelled.length = 0;
    const state = createGame(7), game = { takeCombatFeedback: () => [], state, battle: null, pauses: new Set() }, opened = [], houses = [], poses = new Map();
    const layout = new GameLayout({ windowWidth: 390, windowHeight: 844, screenTop: 0, statusBarHeight: 47, safeArea: { top: 47, bottom: 810 } }, { bottom: 83, left: 292, width: 88, height: 32 });
    const world = new VillageWorld(game, art, new UiWidgets(art, () => {}), layout, name => houses.push(name), id => opened.push(id));
    // 仅此单元夹具移去场景建筑；遮挡分别显式构造，原生验收另用完整建筑和实际图集。
    world.props = [];
    world.motion = { get: id => poses.get(id) };
    state.people.forEach((p, i) => poses.set(p.id, { x: 250 + i * 70, y: 1000, insideTower: false, clip: 'villager_male_a_walk', direction: 'DOWN', elapsed: 0, animated: true, heartElapsed: null, mirror: false }));
    world.render(false);
    return { world, game, state, poses, opened, houses };
}
function point(node) { return node.localToGlobal(new Point(node.width / 2, node.height / 2)); }
function tap(source, at, touchId = 3) {
    const event = { touchId, stageX: at.x, stageY: at.y };
    source.event('down', event); source.event('up', event); source.event('click', event);
}
function obstacle(f, id, y, ground = false) {
    const node = new Sprite().size(100, 100).pivot(50, 95).pos(250, y);
    f.world.world.addChild(node);
    const item = { id, y, node, ground, visual: {} };
    f.world.pickDepth.push(item); f.world.pickDepth.sort(compareDepth); return item;
}

test('map person click uses the currently displayed identity and excludes the overhead heart', () => {
    const f = setup(), node = f.world.people[0], at = point(node);
    tap(node, at); assert.deepEqual(f.opened, [f.state.people[0].id]);
    const heart = f.world.hearts[0]; heart.visible = true; heart.size(80, 80).pos(0, -80);
    const heartAt = heart.localToGlobal(new Point(40, 40));
    assert.equal(f.world.pickAt(heartAt.x, heartAt.y), null);
});
test('overlapping people choose the front rendered person, independently of the input source pool slot', () => {
    const f = setup(), [front, back] = f.state.people;
    Object.assign(f.poses.get(back.id), { x: 250, y: 990 }); f.world.render(false);
    tap(f.world.people[1], point(f.world.people[1])); assert.deepEqual(f.opened, [front.id]);
});
test('foreground houses retain their bubble while other foreground objects block click-through', () => {
    const f = setup(), node = f.world.people[0], at = point(node);
    const house = obstacle(f, 'building:house-a', 1005);
    tap(node, at); assert.deepEqual(f.houses, ['佟楼']); assert.deepEqual(f.opened, []);
    house.id = 'tree:logging'; tap(node, at); assert.deepEqual(f.opened, []); assert(cancelled.includes(3));
});
test('farm ground permits person selection but the independent wheel blocks it', () => {
    const f = setup(), node = f.world.people[0], at = point(node);
    obstacle(f, 'building:farm', 1010, true); tap(node, at); assert.equal(f.opened.length, 1);
    obstacle(f, 'building:farm:above', 1015); tap(node, at); assert.equal(f.opened.length, 1);
});
test('person picking follows mirrored elite scale and parent transforms', () => {
    const f = setup(), node = f.world.people[0];
    f.world.world.pos(20, 70).scale(.7, .7); node.scale(-1.6, 1.6);
    tap(node, point(node)); assert.deepEqual(f.opened, [f.state.people[0].id]);
});
test('a hidden tower occupant and an already removed person are not selected', () => {
    const f = setup(), node = f.world.people[0], at = point(node), id = f.state.people[0].id;
    f.poses.get(id).insideTower = true; assert.equal(f.world.pickAt(at.x, at.y), null);
    f.poses.get(id).insideTower = false; node.visible = false; assert.equal(f.world.pickAt(at.x, at.y), null);
    node.visible = true; f.state.people.shift(); assert.equal(f.world.pickAt(at.x, at.y), null);
});
test('pool reassignment between press and release cancels the old touch rather than opening a new person', () => {
    const f = setup(), node = f.world.people[0], at = point(node), event = { touchId: 7, stageX: at.x, stageY: at.y };
    node.event('down', event); assert.equal(f.world.pressedTargets.size, 1);
    const first = f.state.people[0], replacement = { ...first, id: '1:99' };
    f.state.people[0] = replacement; f.poses.set(replacement.id, { ...f.poses.get(first.id) });
    f.world.render(false); assert(cancelled.includes(7)); assert.equal(f.world.pressedTargets.size, 0);
    node.event('up', event); node.event('click', event); assert.deepEqual(f.opened, []);
});
test('reassigning the native back-node source cancels a press even when the selected front person remains', () => {
    const f = setup(), back = f.state.people[1], node = f.world.people[1];
    Object.assign(f.poses.get(back.id), { x: 250, y: 990 }); f.world.render(false);
    const at = point(node), event = { touchId: 6, stageX: at.x, stageY: at.y };
    node.event('down', event);
    assert.equal(f.world.pressedTargets.get(6).target.personId, f.state.people[0].id);
    const replacement = { ...back, id: '1:98' };
    f.state.people[1] = replacement; f.poses.set(replacement.id, { ...f.poses.get(back.id) }); f.world.render(false);
    assert(cancelled.includes(6)); assert.equal(f.world.pressedTargets.size, 0);
    node.event('click', event); assert.deepEqual(f.opened, []);
});
test('entering a tower, moving off the original person, and resetting invalidate pending presses', () => {
    const f = setup(), node = f.world.people[0], at = point(node), event = { touchId: 4, stageX: at.x, stageY: at.y }, id = f.state.people[0].id;
    node.event('down', event); f.poses.get(id).insideTower = true; f.world.render(false);
    node.event('click', event); assert.deepEqual(f.opened, []); assert(cancelled.includes(4));
    f.poses.get(id).insideTower = false; f.world.render(false); node.event('down', event);
    f.poses.get(id).x += 150; f.world.render(false); node.event('click', event); assert.deepEqual(f.opened, []);
    f.poses.get(id).x -= 150; f.world.render(false); node.event('down', event); f.world.reset();
    assert.equal(f.world.pressedTargets.size, 0); assert.equal(f.world.pickDepth.length, 0);
    node.event('click', event); assert.deepEqual(f.opened, []);
});
