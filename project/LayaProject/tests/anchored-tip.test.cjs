const { test } = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const build = process.env.DAIDAI_TEST_BUILD;
class Point { constructor(x = 0, y = 0) { this.setTo(x, y); } setTo(x, y) { this.x = x; this.y = y; return this; } }
class Rectangle { constructor(x = 0, y = 0, width = 0, height = 0) { Object.assign(this, { x, y, width, height }); } }
class Sprite {
    constructor() { this.x = this.y = this.pivotX = this.pivotY = 0; this.scaleX = this.scaleY = 1; this.children = []; this.graphics = {}; }
    pos(x, y) { this.x = x; this.y = y; return this; }
    size(width, height) { this.width = width; this.height = height; return this; }
    pivot(x, y) { this.pivotX = x; this.pivotY = y; return this; }
    scale(x, y) { this.scaleX = x; this.scaleY = y; return this; }
    addChild(node) { this.children.push(node); node.parent = this; return node; }
    getChildByName(name) { return this.children.find(node => node.name === name); }
    localToGlobal(point, copy, relative) {
        const out = copy ? new Point(point.x, point.y) : point;
        for (let node = this; node && node !== relative; node = node.parent) {
            out.x = (out.x - node.pivotX) * node.scaleX + node.x;
            out.y = (out.y - node.pivotY) * node.scaleY + node.y;
        }
        return out;
    }
}
class Text extends Sprite {}
global.Laya = { Sprite, Text, Point, Rectangle, OpenDataContextView: Sprite, Texture2D: class {} };
const { AnchoredTip } = require(path.join(build, 'view/AnchoredTip.js'));
const { ANCHORED_TIP, HOUSE_TIP_NAMES } = require(path.join(build, 'view/config/AnchoredTipConfig.js'));
const { GameView } = require(path.join(build, 'view/GameView.js'));
const art = { panel() {}, get(id) { return id; } };
function setup() {
    const root = new Sprite(), house = root.addChild(new Sprite().pos(110, 700).scale(1.1, 1.1));
    const tip = root.addChild(new AnchoredTip(art));
    const target = { node: house, bounds: new Rectangle(8, 30, 110, 90) };
    return { root, house, tip, target };
}
const near = (a, b) => assert(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('bubble grows and shrinks around its fixed pointer, then disappears at two seconds', () => {
    const { root, tip, target } = setup(); tip.show('佟楼', () => target);
    assert(tip.visible); assert.equal(tip.scaleX, 0); assert.equal(tip.mouseEnabled, false);
    const x = tip.x, y = tip.y;
    for (const delta of [.08, .12, 1.6, .1]) {
        tip.advance(delta);
        const pointer = tip.localToGlobal(new Point(tip.pivotX, tip.pivotY), false, root);
        near(pointer.x, x); near(pointer.y, y);
        assert(tip.scaleX > 0 && tip.scaleX <= 1); near(tip.scaleX, tip.scaleY);
    }
    assert(tip.scaleX < 1); tip.advance(.11); assert.equal(tip.visible, false); assert.equal(tip.target, null);
});

test('repeated clicks restart the lifetime and another house replaces the single visible message', () => {
    const { tip, target } = setup();
    assert.equal(HOUSE_TIP_NAMES['building:house-a'], '佟楼'); assert.equal(HOUSE_TIP_NAMES['building:house-b'], '南楼');
    tip.show('佟楼', () => target); tip.advance(1.5); tip.show('佟楼', () => target); tip.advance(1);
    assert(tip.visible);
    const other = { node: new Sprite().pos(240, 720), bounds: new Rectangle(0, 20, 100, 100) };
    tip.show('南楼', () => other); tip.advance(.2);
    assert.equal(tip.getChildByName('AnchoredTipText').text, '南楼'); near(tip.x, 290);
    tip.advance(1.81); assert.equal(tip.visible, false); tip.advance(10); assert.equal(tip.visible, false);
});

test('roof attachment is re-read after a building replacement, movement and scale change', () => {
    const { root, tip, target } = setup(); let current = target;
    tip.show('佟楼', () => current); tip.advance(.2);
    current = { node: root.addChild(new Sprite().pos(108, 840).scale(1.4, .8)), bounds: new Rectangle(10, 13, 100, 105) };
    tip.advance(0);
    near(tip.x, 108 + 60 * 1.4); near(tip.y, 840 + 13 * .8 - ANCHORED_TIP.roofGap);
    current.node.y += 80; tip.advance(0); near(tip.y, 920 + 13 * .8 - ANCHORED_TIP.roofGap);
    tip.hide(); current.node.y += 80; tip.advance(0); assert.equal(tip.visible, false);
});

test('view clock ignores battle speed and stops advancing tips while backgrounded or disabled', () => {
    const { tip, target } = setup(), pauses = new Set();
    const view = Object.create(GameView.prototype);
    Object.assign(view, { game: { pauses, speed: 3 }, anchoredTip: tip, tip: { advance() {} }, village: { advance() { return false; } } });
    tip.show('佟楼', () => target);
    for (let i = 0; i < 30; i++) view.update(.05);
    assert(tip.visible);
    for (const reason of ['BACKGROUND', 'DISABLED']) {
        pauses.add(reason); for (let i = 0; i < 100; i++) view.update(.05); pauses.delete(reason);
        assert(tip.visible);
    }
    for (let i = 0; i < 11; i++) view.update(.05);
    assert.equal(tip.visible, false);
});

test('any actual modal hides a bubble, including automatic panels without a current panel type', () => {
    const { tip, target } = setup(), view = Object.create(GameView.prototype);
    Object.assign(view, { village: { render() {} }, hud: { update() {} }, panels: { current: null }, overlay: { numChildren: 0 }, anchoredTip: tip });
    tip.show('南楼', () => target); view.updateActors(); assert(tip.visible);
    view.overlay.numChildren = 1; view.updateActors(); assert.equal(tip.visible, false);
    view.overlay.numChildren = 0; view.updateActors(); assert.equal(tip.visible, false);
});
