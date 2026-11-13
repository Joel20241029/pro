const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs');
const build = process.env.DAIDAI_TEST_BUILD;
const { buildingLayoutId, houseRooms, FARM_WHEEL_FOOTPRINT } = require(path.join(build, 'view/BuildingLayout.js'));
const { layouts } = require('../../../res/native/buildings.json');
const { VILLAGE_PROPS } = require(path.join(build, 'view/VillageScene.js'));
const recipe = require('../../../res/source/asset_recipe.json');
const frames = new Set(recipe.assets.filter(a => a.runtime).map(a => a.id));
const kinds = ['HOUSE', 'FARM', 'LOGGING', 'GATE', 'ARROW', 'STONE', 'SLOW'];

// Sprite matrix semantics are isolated here; actual .mc decoding/rendering is also checked in the editor.
class Sprite {
 constructor() { Object.assign(this, { children: [], x: 0, y: 0, width: 0, height: 0, scaleX: 1, scaleY: 1, rotation: 0, alpha: 1, visible: true, anchorX: 0, anchorY: 0 }); this.graphics = { drawLines() {} }; }
 get pivotX() { return this.anchorX * this.width; } get pivotY() { return this.anchorY * this.height; }
 addChild(n) { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = this; this.children.push(n); return n; }
 destroyChildren() { this.children.slice().forEach(n => n.destroy(true)); }
 destroy() { this.destroyChildren(); if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; }
 getChildByName(name) { return this.children.find(n => n.name === name); }
 pos(x, y) { this.x = x; this.y = y; return this; } size(w, h) { this.width = w; this.height = h; return this; }
 pivot(x, y) { this.anchorX = x / this.width; this.anchorY = y / this.height; return this; } scale(x, y) { this.scaleX = x; this.scaleY = y; return this; }
 addComponent() { const owner = this; return { autoPlay: false, clip: null, gotoAndStop(t) { this.time = t; const v = t <= .5 ? t * 2 : (t - .5) * 2; owner[this.clip.kind === 'upgrade' ? 'scaleY' : 'rotation'] = this.clip.kind === 'upgrade' ? (t <= .5 ? .3 + .78 * v : 1.08 - .08 * v) : (t <= .5 ? -18 + 23 * v : 5 - 5 * v); } }; }
 localToGlobal(point, copy, relative) { let n = this, x = point.x, y = point.y; while (n && n !== relative) { const r = n.rotation * Math.PI / 180, xx = (x - n.pivotX) * n.scaleX, yy = (y - n.pivotY) * n.scaleY; x = n.x + xx * Math.cos(r) - yy * Math.sin(r); y = n.y + xx * Math.sin(r) + yy * Math.cos(r); n = n.parent; } return { x, y }; }
}
global.Laya = { Sprite, Text: class extends Sprite { static SHRINK = 'shrink'; }, Point: class { constructor(x, y) { this.x = x; this.y = y; } }, AnimatorClip2D: class {} };
const { BuildingVisuals } = require(path.join(build, 'view/BuildingVisuals.js'));
const art = { get: id => { assert(frames.has(id), id); return id; }, buildingLayouts: layouts, buildingUpgrade: { kind: 'upgrade', duration: () => .6 }, buildingAttack: { kind: 'attack', duration: () => .3 } };
const create = () => { const world = new Sprite(), owner = new Sprite().size(128, 128).pos(200, 300); owner.name = 'test'; world.addChild(owner); return { world, owner, visual: new BuildingVisuals(owner, art) }; };
const descendants = n => [n, ...n.children.flatMap(descendants)];

test('seven independent native prefabs cover every level and real room count', () => {
 const source = path.resolve(__dirname, '../../../res/editor/BuildingWorkshop/assets/buildingAuthoring/prefabs');
 assert.deepEqual(fs.readdirSync(source).filter(f => f.endsWith('.lh')).sort(), kinds.map(k => k + '.lh').sort());
 assert.equal(Object.keys(layouts).length, 108);
 for (const kind of kinds) for (const rooms of kind === 'HOUSE' ? [1, 2, 3] : [1]) {
  let previous = '';
  for (let level = 1; level <= 12; level++) {
   const id = buildingLayoutId(kind, level, rooms), layout = layouts[id]; assert(layout, id); assert.deepEqual(layout.sort, { x: 64, y: 120 });
   assert.notEqual(JSON.stringify(layout.children), previous, id); previous = JSON.stringify(layout.children);
   assert.notEqual(layout.visible, false); assert(layout.children.every(n => !['Footprint', 'SortOrigin', 'VisualBounds'].includes(n.name)));
  }
 }
 for (const houses of [2, 3, 4, 5]) assert.equal(houseRooms(houses, false) + houseRooms(houses, true), houses);
 assert.deepEqual([2, 3, 4, 5].map(n => [houseRooms(n, false), houseRooms(n, true)]), [[1, 1], [2, 1], [2, 2], [3, 2]]);
 for (const level of [13, 20, 1000, 9999]) assert(layouts[buildingLayoutId('ARROW', level)]);
});

test('all authored variants and animation extremes fit their declared visible region', () => {
 for (const [id, layout] of Object.entries(layouts)) {
  const [kind, level, rooms] = id.split('_'), { world, owner, visual } = create(); visual.sync(kind, +level, true, +rooms); visual.occluder();
  for (const scaleY of [.3, 1, 1.08]) for (const rotation of [-18, 0, 5]) {
   visual.body.scaleY = scaleY; const weapon=descendants(owner).find(n=>n.name==='Weapon');if(weapon)weapon.rotation=rotation;
   for (const node of descendants(world).filter(n => n.texture)) for (const [x, y] of [[0, 0], [node.width, 0], [0, node.height], [node.width, node.height]]) {
    const p = node.localToGlobal({ x, y }, false, world), source = { x: p.x - owner.x + owner.pivotX, y: p.y - owner.y + owner.pivotY }, b = layout.bounds;
    assert(source.x >= b.x - 1 && source.x <= b.x + b.width + 1 && source.y >= b.y - 1 && source.y <= b.y + b.height + 1, `${id} / ${node.name}: ${JSON.stringify(source)}`);
   }
  }
 }
});

test('body upgrades preserve ground pivot, stable reuse and precise readable level badge', () => {
 const { owner, visual: v } = create(); owner.scaleX = -1;
 v.sync('ARROW', 13, true); assert.equal(v.badge.text, '13'); assert.equal(v.badge.scaleX, -1); assert.equal(v.upgrading, false);
 const root = v.parts.children[0]; v.sync('ARROW', 13, false); assert.equal(root, v.parts.children[0]);
 v.sync('ARROW', 14, false); assert.equal(v.upgrading, false); assert.equal(v.beginVisibleUpgrade(), true); assert.equal(v.beginVisibleUpgrade(), false); assert.equal(v.upgrading, true); v.advance(.3); assert.equal(v.body.scaleY, 1.08); assert.deepEqual([owner.x, owner.y, owner.pivotX, owner.pivotY], [200, 300, 64, 120]);
 v.advance(.3); assert.equal(v.upgrading, false); v.sync('ARROW', 15, false); v.sync('ARROW', 15, true); assert.equal(v.upgrading, false);
 v.sync('GATE', 1000, true); assert.equal(v.badge.text, '1000'); assert.equal(v.badge.wordWrap, false); assert.equal(v.badge.overflow, 'shrink');
 v.sync(null, 0, false); assert.equal(v.parts.children.length, 0); assert.equal(v.badge.visible, false);
});

test('the northern tower keeps every upgraded weapon below the HUD on the shortest screen', () => {
 const { GameLayout } = require(path.join(build, 'view/GameLayout.js'));
 const { PADS } = require(path.join(build, 'game/GameConfig.js'));
 const { frames: regions } = require('../../../res/atlases/frames.json');
 const layout = new GameLayout({windowWidth:320,windowHeight:568,statusBarHeight:20,safeArea:{top:20,bottom:568,left:0,right:320}}, {width:88,height:32,top:24,bottom:56,left:222,right:310});
 for(const kind of ['ARROW','STONE','SLOW']) for(let level=1;level<=12;level++) {
  const {world,owner,visual}=create();owner.size(108,108).pos(PADS[0].x,layout.worldY(PADS[0].y)+21.25);visual.sync(kind,level,true);
  for(const scale of [1,1.08]) for(const angle of [-18,0,5]) {
   visual.body.scaleY=scale;descendants(owner).find(n=>n.name==='Weapon').rotation=angle;
   for(const node of descendants(owner).filter(n=>n.texture)) {
    let visible=true;for(let n=node;n;n=n.parent)if(!n.visible)visible=false;if(!visible)continue;
    const f=regions[node.texture],x=f.trimOffset.x/f.sourceSize.w*node.width,y=f.trimOffset.y/f.sourceSize.h*node.height;
    const right=x+f.rect.w/f.sourceSize.w*node.width,bottom=y+f.rect.h/f.sourceSize.h*node.height;
    for(const [px,py] of [[x,y],[right,y],[x,bottom],[right,bottom]]) {
     const point=node.localToGlobal({x:px,y:py},false,world);
     assert(point.y>=layout.mapTop,`${kind}:${level} ${node.name} clips HUD by ${layout.mapTop-point.y}`);
    }
   }
  }
 }
});

test('authored hard footprints remain inside the pre-reserved navigation base', () => {
 const propFor = { HOUSE: ['building:house-a', 'building:house-b'], FARM: ['building:farm'], LOGGING: ['building:logging'], GATE: ['building:gate'], ARROW: ['tower:0'], STONE: ['tower:0'], SLOW: ['tower:0'] };
 for (const [id, layout] of Object.entries(layouts)) {
  for (const region of [layout.bounds, layout.footprint, ...(layout.aboveFootprint ? [layout.aboveFootprint] : [])]) {
   assert(Object.values(region).every(Number.isFinite), id); assert(region.width >= 0 && region.height >= 0, id);
  }
  const kind = id.split('_')[0], r = layout.footprint;
  if (kind === 'FARM') { assert.equal(r.width * r.height, 0); if (layout.aboveFootprint) assert.deepEqual(layout.aboveFootprint, FARM_WHEEL_FOOTPRINT); continue; }
  for (const name of propFor[kind]) {
   const p = VILLAGE_PROPS.find(p => p.id === name), s = p.size / 128, base = p.footprint;
   assert(p.x + (r.x - 64) * s >= base.left && p.x + (r.x + r.width - 64) * s <= base.right, id + ' width');
   assert(p.y + (r.y - 120) * s >= base.top && p.y + (r.y + r.height - 120) * s <= base.bottom, id + ' depth');
  }
 }
});

test('farm upper structure sorts independently and leaves no stale object through rebuild/resize/restart', () => {
 const { owner, world, visual: v } = create(); v.sync('FARM', 5, true);
 assert.deepEqual(layouts.FARM_5_1.aboveFootprint, FARM_WHEEL_FOOTPRINT);
 const upper = v.occluder(); assert.equal(upper.y, owner.y - 27); assert.equal(world.children.length, 2);
 owner.y += 80; assert.equal(v.occluder().y, upper.y + 80);
 v.sync('FARM', 6, false); assert.equal(world.children.length, 2); assert.notEqual(v.occluder().node, upper.node);
 v.sync('FARM', 1, true); assert.equal(v.occluder(), null); assert.equal(world.children.length, 1);
});

test('native muzzle includes nested weapon recoil, scale and facing; attack follows paused battle clock', () => {
 for (const kind of ['ARROW', 'STONE', 'SLOW']) {
  const a = create(), b = create(); a.owner.size(108, 108); b.owner.size(108, 108); b.owner.scaleX = -1;
  a.visual.sync(kind, 12, true); b.visual.sync(kind, 12, true);
  const battle = { tick: 2, outcome: null, shots: [{ tower: 0, tick: 1 }] };
  a.visual.updateAttack(battle, 0); b.visual.updateAttack(battle, 0);
  const left = a.visual.launchPoint(), right = b.visual.launchPoint(); assert(Math.abs(left.x + right.x - 400) < 1e-8); assert.equal(left.y, right.y);
  assert.equal(a.visual.attack.time, 0); a.visual.updateAttack(battle, 0); assert.equal(a.visual.attack.time, 0);
  battle.tick = 40; battle.shots = []; a.visual.updateAttack(battle, 0); assert.equal(a.visual.attack.time, 1);
  a.visual.updateAttack(null, 0); assert.equal(a.visual.latestShot, null);
 }
});

test('right-hand arrow towers select actual left weapons without mirroring the body',()=>{
 const a=create(),b=create();a.visual.sync('ARROW',12,true,1,false,1);b.visual.sync('ARROW',12,true,1,false,-1);
 const right=descendants(a.owner).find(n=>n.name==='FacingRight'),left=descendants(b.owner).find(n=>n.name==='FacingLeft');
 assert(right.visible);assert(left.visible);assert(!descendants(a.owner).find(n=>n.name==='FacingLeft').visible);assert(!descendants(b.owner).find(n=>n.name==='FacingRight').visible);
 assert.equal(a.owner.scaleX,1);assert.equal(b.owner.scaleX,1);assert(a.visual.launchPoint().x>b.visual.launchPoint().x);
 assert(descendants(right).some(n=>n.texture==='hd_part_bow_right'));assert(descendants(left).some(n=>n.texture==='hd_part_bow_left'));
});
