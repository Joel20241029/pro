const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const root = process.env.DAIDAI_TEST_BUILD;
const { GameLayout } = require(path.join(root, "view/GameLayout"));
const { PatrolThrowCue, rapidProjection, RAPID_ROOF_LIFT } = require(path.join(root, "view/PatrolThrowCue"));
const { PATROL } = require(path.join(root, "config/PatrolConfig"));

test("the editable roof muzzle and the battle projectile launch at the same pixel on short and tall screens", () => {
    for (const height of [600, 844, 960]) {
        const layout = new GameLayout({ windowHeight: height, windowWidth: 390, statusBarHeight: 22 }, { width: 0, height: 0 });
        for (const [ux, uy] of [[0, -1], [-.8, -.6], [1,0], [.6,.8]]) {
            const { origin, direction, muzzleDistance } = rapidProjection(layout, ux, uy);
            assert(Math.abs(Math.hypot(direction.x, direction.y) - 1) < 1e-9);
            assert(Math.abs(origin.x + direction.x * muzzleDistance - (PATROL.rapid.origin.x + ux * PATROL.rapid.muzzleDistance)) < 1e-9);
            assert(Math.abs(layout.worldY(origin.y + direction.y * muzzleDistance) - (layout.gateY - RAPID_ROOF_LIFT + uy * PATROL.rapid.muzzleDistance)) < 1e-9);
        }
    }
});

test("rear drag crosses threshold before firing, can sweep outside the gate, and ends on release, cancellation, or empty clip", () => {
    const old = global.Laya;
    class Point { setTo(x, y) { this.x = x; this.y = y; return this; } }
    class Rect { setTo(x, y, w, h) { Object.assign(this, { x, y, w, h }); } contains(x,y) { return this.x<=x && x<=this.x+this.w && this.y<=y && y<=this.y+this.h; } }
    class Sprite {
        constructor() { this.graphics = { clear() {} }; this.width = 720; this.height = 1200; }
        on() {}
        scale(x,y) { this.scaleX=x; this.scaleY=y; }
        pos(x,y) { this.x=x; this.y=y; }
        size(width, height) { this.width=width; this.height=height; }
        addChild(node) { node.parent = this; return node; }
        removeSelf() { this.parent = null; }
        globalToLocal(point) { return point; }
    }
    global.Laya = { Sprite, Point, Rectangle: Rect, Event: {}, InputManager: { cancelClick() {} } };
    try {
        const roots = new Sprite(), world = roots.addChild(new Sprite()), aims = [];
        let stops = 0, slow = false;
        const game = { patrolRapidReady: true, aimPatrolRapid(...args) { aims.push(args); return true; },
            stopPatrolRapid() { stops++; }, setPatrolAiming(active) { slow = active; }, get patrolAiming() { return slow; } };
        const art = { ready: () => true, applyFrame(node,id,size) { assert.equal(id,"fx_patrol_uh"); node.size(size,size); } };
        const cue = new PatrolThrowCue(world, game, art), battle = { patrol: { rapid: {} } };
        const layout = new GameLayout({ windowWidth: 390, windowHeight: 844, statusBarHeight: 22 }, { width: 0, height: 0 });
        const cy = layout.gateY - RAPID_ROOF_LIFT;
        const ev = (x, y, id=1) => ({ stageX:x, stageY:y, touchId:id, stopPropagation(){} });
        cue.update(layout, battle, [], 0, false);
        cue.down(ev(100, cy));
        assert.equal(cue.press, null);
        cue.down(ev(460, cy+55));
        assert.equal(slow,true);
        cue.move(ev(460, cy+59));
        assert.equal(aims.length, 0);
        cue.move(ev(460, cy+90));
        assert.deepEqual(aims[0][0], { x:0, y:-1 });
        cue.move(ev(500, cy+50, 9));
        assert.equal(aims.length, 1);
        cue.move(ev(460, cy+55));
        assert.equal(stops, 0);
        assert.deepEqual(cue.rapidAim, { x:0, y:-1 });
        cue.move(ev(680, layout.height-5));
        assert(aims[1][0].x<0 && aims[1][0].y<0);
        cue.up(ev(680, layout.height-5));
        assert.equal(stops, 1);
        assert.equal(slow,false);
        assert.equal(cue.press, null);
        cue.down(ev(360, cy));
        cue.move(ev(355, cy+80));
        cue.move({...ev(355,cy+80),nativeEvent:{type:"touchcancel"}});
        assert.equal(stops, 2);
        cue.down(ev(360, cy));
        cue.move(ev(370,cy+80));
        game.patrolRapidReady = false;
        cue.update(layout, battle, [], 1, false);
        assert.equal(stops, 3);
        game.patrolRapidReady = true;
        cue.update(layout, battle, [], 6, false);
        cue.move(ev(390, cy+80));
        assert.equal(aims.length, 4, "refill needs a fresh gesture");
        assert.equal(cue.hasRapidWords, false);
        const hit = (index, hp) => ({type:"patrol", index, enemy:{hp}, at:{x:355,y:504}});
        cue.update(layout, battle, [hit(0, 15), hit(1, 0)], 7, false);
        assert.equal(cue.rapidWords.filter(w => w.node.visible).length, 2);
        assert.notEqual(cue.rapidWords[0].node.x, cue.rapidWords[1].node.x);
        cue.update(layout, battle, [], 7.4, false);
        assert.equal(cue.hasRapidWords,false);
        cue.update(layout, battle, [hit(2,0)], 8, false);
        assert.equal(cue.rapidWords.length, 2, "reuse a finished sprite");
        cue.update(layout, null, [], 8, false);
        assert.equal(cue.hasRapidWords,false);
    } finally { global.Laya=old; }
});
