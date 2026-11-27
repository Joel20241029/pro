const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs');
const build = process.env.DAIDAI_TEST_BUILD;
const { buildingLayoutId, FARM_WHEEL_FOOTPRINT, PATROL_BOOTH_FRAME } = require(path.join(build, 'view/BuildingLayout.js'));
const { layouts } = require('../../../res/native/buildings.json');
const { VILLAGE_PROPS, TOWER_VIEW } = require(path.join(build, 'view/VillageScene.js'));
const recipe = require('../../../res/source/asset_recipe.json');
const frames = new Set(recipe.assets.filter(a => a.runtime).map(a => a.id));
const kinds = ['HOUSE', 'FARM', 'LOGGING', 'GATE', 'CANNON', 'PATROL', 'HEARTH'];

// Sprite matrix semantics are isolated here; actual .mc decoding/rendering is also checked in the editor.
class Sprite {
 constructor() { Object.assign(this, { children: [], x: 0, y: 0, width: 0, height: 0, scaleX: 1, scaleY: 1, rotation: 0, alpha: 1, visible: true, anchorX: 0, anchorY: 0 }); this.graphics = { calls: [], drawLines() {}, save() {}, restore() {}, alpha() {}, clear() { this.calls=[]; }, drawImage(...args) { this.calls.push(args); } }; }
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
global.Laya = { Sprite, Text: class extends Sprite { static SHRINK = 'shrink'; }, Point: class { constructor(x, y) { this.x = x; this.y = y; } }, Rectangle: class { constructor(x,y,width,height) { Object.assign(this,{x,y,width,height}); } }, AnimatorClip2D: class {} };
const { BuildingVisuals } = require(path.join(build, 'view/BuildingVisuals.js'));
const clips = new Map(recipe.animations.animations.map(clip => [clip.id, clip]));
const art = { get: id => { assert(frames.has(id), id); return id; }, animation: id => clips.get(id), frameId: (id, time, animated = true) => {
 const clip = clips.get(id); assert(clip, id); return animated ? clip.frameIds[Math.floor(time * clip.fps) % clip.frameIds.length] : clip.restFrame;
}, buildingLayouts: layouts, buildingUpgrade: { kind: 'upgrade', duration: () => .6 }, buildingAttack: { kind: 'attack', duration: () => .3 } };
const create = () => { const world = new Sprite(), owner = new Sprite().size(128, 128).pos(200, 300); owner.name = 'test'; world.addChild(owner); return { world, owner, visual: new BuildingVisuals(owner, art) }; };
const descendants = n => [n, ...n.children.flatMap(descendants)];

test('each native prefab has one fixed static body for all levels and rooms', () => {
 const source = path.resolve(__dirname, '../../../res/editor/BuildingWorkshop/assets/buildingAuthoring/prefabs');
 assert.deepEqual(fs.readdirSync(source).filter(f => f.endsWith('.lh')).sort(), kinds.map(k => k + '.lh').sort());
 assert.equal(Object.keys(layouts).length, kinds.length);
 for (const kind of kinds) {
  const id = buildingLayoutId(kind);
  assert.equal(id, `${kind}_1_1`);
  assert.deepEqual(layouts[id].sort, { x: 64, y: 120 });
  const { visual: v } = create();
  v.sync(kind, 1, true);
  const body = v.body, texture = body.getChildByName('Structure').texture;
  for (const level of [2, 12, 13, 50, 100, 1000, 9999]) {
   v.sync(kind, level, false);
   assert.equal(v.body, body);
   assert.equal(body.getChildByName('Structure').texture, texture);
   assert.equal(body.scaleY, 1);
   assert.equal(v.parts.scaleX, 1.25);
  }
 }
 assert(frames.has(PATROL_BOOTH_FRAME));
});

test('the approved animations only replace local components with small registered frames', () => {
 const assets = new Map(recipe.assets.map(a=>[a.id,a]));
 for (const kind of kinds) {
  const { visual: v, owner } = create();
  v.sync(kind, 25, true);
  const nodes = descendants(owner).filter(n=>/^Loop:|^Attack:|^GateDoors$/.test(n.name));
  if (kind === 'CANNON') {
   assert.equal(nodes.length, 0, 'the cannon uses its aiming frames and a separate map pennant');
   continue;
  }
  assert(nodes.length, kind);
  for (const node of nodes) {
   const id = node.name === 'GateDoors' ? 'motion_gate_doors' : node.name.split(':')[1];
   const anim = clips.get(id);
   assert(anim.frameIds.length > 1);
   assert(node.width * node.height < 128 * 128);
   assert(anim.frameIds.every(frame => assets.get(frame)?.runtime && assets.get(frame)?.animation===id));
   assert(anim.frameIds.every(frame => assets.get(frame).width===Math.round(node.width*1.25) && assets.get(frame).height===Math.round(node.height*1.25)));
  }
  const target = nodes.find(n=>n.name.startsWith('Loop:'));
  if (target) {
   const first = target.texture;
   v.advance(.49, true, true);
   assert.notEqual(target.texture, first);
  }
 }
 assert.equal(clips.has('hearth_burn'), false);
});

test('expanding without more visible rooms and consecutive upgrades each play a cue', () => {
 const { visual: v } = create();
 v.sync('HOUSE', 3, true);
 const root = v.parts.children[0];
 v.sync('HOUSE', 4, false);
 v.sync('HOUSE', 5, false);
 assert.equal(v.parts.children[0], root);
 for (let i = 0; i < 2; i++) {
  assert(v.beginVisibleUpgrade());
  assert(!v.beginVisibleUpgrade());
  v.advance(.3);
  assert(v.upgradeFlare() > .98);
  v.advance(.3);
  assert.equal(v.upgradeFlare(), 0);
 }
 assert(!v.beginVisibleUpgrade());
});

test('daytime crossings hold the leaves open; night closes them and dawn plays one opening cycle', () => {
 const {visual} = create();
 visual.sync('GATE', 1, true, true);
 const door = visual.body.getChildByName('GateDoors'), clip = clips.get('motion_gate_doors');
 const advance = (frames,night,traffic) => { for(let i=0;i<frames;i++) visual.advance(1/clip.fps,night,traffic); };
 advance(20,false,true);
 assert.equal(door.texture,clip.frameIds[Math.floor(clip.frameIds.length/2)]);
 advance(20,false,false);
 assert.equal(door.texture,clip.restFrame);
 advance(20,false,true); advance(1,true,true);
 assert.equal(door.texture,clip.restFrame);
 advance(5,false,false); assert.notEqual(door.texture,clip.restFrame);
 advance(20,false,false); assert.equal(door.texture,clip.restFrame);
});

test('body upgrades preserve ground pivot, stable reuse and precise readable level badge', () => {
 const { owner, visual: v } = create(); owner.scaleX = -1;
 v.sync('CANNON', 13, true); assert.equal(v.badge.text, '13'); assert.equal(v.badge.scaleX, -1); assert.equal(v.upgrading, false);
 const root = v.parts.children[0]; v.sync('CANNON', 13, false); assert.equal(root, v.parts.children[0]);
 v.sync('CANNON', 14, false); assert.equal(v.upgrading, false); assert.equal(v.beginVisibleUpgrade(), true); assert.equal(v.beginVisibleUpgrade(), false); assert.equal(v.upgrading, true); v.advance(.3); assert.equal(v.body.scaleY, 1); assert.notEqual(v.parts.scaleY, v.bodyScale); assert.deepEqual([owner.x, owner.y, owner.pivotX, owner.pivotY], [200, 300, 64, 120]);
 v.advance(.3); assert.equal(v.upgrading, false); assert.equal(v.parts.scaleY, v.bodyScale); v.sync('CANNON', 15, false); v.sync('CANNON', 15, true); assert.equal(v.upgrading, false);
 v.sync('GATE', 1000, true); assert.equal(v.badge.text, '1000'); assert.equal(v.badge.wordWrap, false); assert.equal(v.badge.overflow, 'shrink');
 v.sync(null, 0, false); assert.equal(v.parts.children.length, 0); assert.equal(v.badge.visible, false);
});

test('replacing a queued or playing upgrade with an empty pad cancels it and permits later upgrades', () => {
 for (const playing of [false, true]) {
  const { visual: v } = create();
  v.sync('CANNON', 1, true); v.sync('CANNON', 2, false);
  if (playing) { assert(v.beginVisibleUpgrade()); v.advance(.1); }
  v.sync(null, 0, false);
  assert.equal(v.beginVisibleUpgrade(), false); assert.equal(v.upgrading, false);
  assert.doesNotThrow(() => v.advance(.3));
  v.sync('CANNON', 1, false); assert.equal(v.beginVisibleUpgrade(), false);
  v.sync('CANNON', 2, false); assert(v.beginVisibleUpgrade());
  v.advance(.6); assert.equal(v.upgrading, false);
 }
});

test('cosmetic rebuilds preserve queued upgrades while a fresh village cancels an identical key', () => {
 const { visual: v } = create();
 v.sync('GATE', 1, true); v.sync('GATE', 2, false); v.sync('GATE', 2, false, true);
 assert(v.beginVisibleUpgrade()); v.advance(.6);
 v.sync('CANNON', 2, true); v.sync('CANNON', 3, false); v.sync('CANNON', 3, false, false, -1);
 assert(v.beginVisibleUpgrade()); v.advance(.6);
 v.sync('CANNON', 4, false); v.sync('CANNON', 4, true);
 assert.equal(v.beginVisibleUpgrade(), false); assert.doesNotThrow(() => v.advance(.6));
});

test('every tower keeps its weapon below the HUD on the shortest screen', () => {
 const { GameLayout } = require(path.join(build, 'view/GameLayout.js'));
 const { frames: regions } = require('../../../res/atlases/frames.json');
 const layout = new GameLayout({windowWidth:320,windowHeight:568,statusBarHeight:20,safeArea:{top:20,bottom:568,left:0,right:320}}, {width:88,height:32,top:24,bottom:56,left:222,right:310});
 const { layoutVillage } = require(path.join(build, 'view/VillageScene.js'));
 const scene = layoutVillage(layout);
 for(const [padIndex, pad] of scene.pads.entries()) for(const kind of ['CANNON']) for(const level of [1,12]) {
  const {world,owner,visual}=create();owner.size(TOWER_VIEW.size,TOWER_VIEW.size).pos(pad.x,pad.y+(TOWER_VIEW.top+TOWER_VIEW.size*15/16)*scene.towerScale);
  owner.scale(scene.towerScale,scene.towerScale);
  visual.sync(kind,level,true,false,TOWER_VIEW.facing[padIndex]);
  const shot = {tower: 0, tick:0};
  const { RULE } = require(path.join(build, 'game/GameConfig.js'));
  const battle = { outcome: null };
  const pivot=visual.weaponAnchor();
  for(let index=0;index<9;index++) {
   const angle=(index/8-.5)*Math.PI;
   visual.updateAttack(battle,0,[{...shot,tick:index,x:pivot.x+100*Math.cos(angle)*TOWER_VIEW.facing[padIndex],y:pivot.y-100*Math.sin(angle)}],(index+1)*RULE.step,y=>y);
   for(const node of descendants(owner).filter(n=>n.texture)) {
    let visible=true;for(let n=node;n;n=n.parent)if(!n.visible)visible=false;if(!visible)continue;
    const f=regions[node.texture],x=f.trimOffset.x/f.sourceSize.w*node.width,y=f.trimOffset.y/f.sourceSize.h*node.height;
    const right=x+(f.rotated ? f.rect.h : f.rect.w)/f.sourceSize.w*node.width;
    const bottom=y+(f.rotated ? f.rect.w : f.rect.h)/f.sourceSize.h*node.height;
    for(const [px,py] of [[x,y],[right,y],[x,bottom],[right,bottom]]) {
     const point=node.localToGlobal({x:px,y:py},false,world);
     assert(point.y>=layout.mapTop,`${kind}:${level} ${node.name} clips HUD by ${layout.mapTop-point.y}`);
    }
   }
  }
 }
});

test('cannon support remains within the center of its stone deck on either bank', () => {
 for(const facing of [-1,1]){
  const {visual,owner}=create();visual.sync('CANNON',1,true,false,facing);
  assert(Math.abs(visual.weaponAnchor().x-owner.x)<10);
 }
});

test('authored hard footprints remain inside the pre-reserved navigation base', () => {
 const propFor = { HOUSE: ['building:house-a'], FARM: ['building:farm'], LOGGING: ['building:logging'], GATE: ['building:gate'], CANNON: ['tower:0'] };
 for (const [id, layout] of Object.entries(layouts)) {
  for (const region of [layout.bounds, layout.footprint, ...(layout.aboveFootprint ? [layout.aboveFootprint] : [])]) {
   assert(Object.values(region).every(Number.isFinite), id); assert(region.width >= 0 && region.height >= 0, id);
  }
  const kind = id.split('_')[0], r = layout.footprint;
  if (kind === 'FARM') { assert.equal(r.width * r.height, 0); if (layout.aboveFootprint) assert.deepEqual(layout.aboveFootprint, FARM_WHEEL_FOOTPRINT); continue; }
  for (const name of propFor[kind] ?? []) {
   const p = VILLAGE_PROPS.find(p => p.id === name), s = p.size / 128, base = p.footprint;
   assert(p.x + (r.x - 64) * s >= base.left && p.x + (r.x + r.width - 64) * s <= base.right, id + ' width');
   assert(p.y + (r.y - 120) * s >= base.top && p.y + (r.y + r.height - 120) * s <= base.bottom, id + ' depth');
  }
 }
});

test('farm upper structure sorts independently and leaves no stale object through rebuild/resize/restart', () => {
 const { owner, world, visual: v } = create(); v.sync('FARM', 5, true);
 assert.deepEqual(layouts.FARM_1_1.aboveFootprint, FARM_WHEEL_FOOTPRINT);
 const upper = v.occluder(); assert.equal(upper.y, owner.y - 27 * 1.25); assert.equal(world.children.length, 2);
 owner.y += 80; assert.equal(v.occluder().y, upper.y + 80);
 v.sync('FARM', 6, false); assert.equal(world.children.length, 2); assert.equal(v.occluder().node, upper.node);
 v.sync('FARM', 1, true); assert.equal(v.occluder().node, upper.node);
 v.sync(null, 0, false); assert.equal(v.occluder(), null); assert.equal(world.children.length, 1);
});

test('both banks aim through nine authored poses, recoil and reset at dawn', () => {
 const {RULE}=require(path.join(build,'game/GameConfig.js'));
 for(const facing of [-1,1]){
  const {visual,owner}=create(); visual.sync('CANNON',1,true,false,facing);
  const pivot=visual.weaponAnchor(),rest=visual.launchPoint(),battle={},body=visual.body.getChildByName('Structure');
  const masonry=body.texture;
  for(let i=0;i<9;i++){
   const angle=(i/8-.5)*Math.PI, tick=i*12;
   const shot={tower:0,tick,x:pivot.x+100*Math.cos(angle)*facing,y:pivot.y-100*Math.sin(angle)};
   const start=(tick+1)*RULE.step;
   visual.updateAttack(battle,0,[shot],start,y=>y);
   assert(descendants(owner).some(n=>n.visible && n.texture==='cannon_yaw_'+i));
   const recoil=visual.launchPoint();
   visual.updateAttack(battle,0,[],start,y=>y); assert.deepEqual(visual.launchPoint(),recoil);
   visual.updateAttack(battle,0,[],start+.2,y=>y);assert.notDeepEqual(visual.launchPoint(),recoil);
   assert.equal(body.texture,masonry);
  }
  visual.updateAttack(null,0,[],0,y=>y);assert.deepEqual(visual.launchPoint(),rest);
 }
});

test('rage blades rotate on a fixed projected plane, freeze with battle time and remain outside building picking', () => {
 const {TowerRageEffects}=require(path.join(build,'view/TowerRageEffects.js'));
 const {RAGE_VISUAL}=require(path.join(build,'view/config/RageVisualConfig.js'));
 const {RULE}=require(path.join(build,'game/GameConfig.js'));
 for(const kind of ['ARROW','STONE','SLOW'])for(const level of [1,4,8,12]){
  const a=create();a.visual.sync('CANNON',level,true);const before=descendants(a.owner).slice();
  const art={ready:()=>true,get:id=>id}, fx=new TowerRageEffects(a.world,art);
  const battle={tick:15,bellTicks:285,tactic:{effect:'ATTACK_DAMAGE',ticks:300},outcome:null,base:{towers:[{kind,operator:'p'},...Array(3).fill({kind:null,operator:null})]}};
  const hosts=Array(4).fill({node:a.owner,visual:a.visual}), depth=fx.update(battle,hosts);
  assert.equal(depth.length,2);assert.deepEqual(descendants(a.owner),before);
  const anchor=a.visual.weaponAnchor();assert.equal(depth[0].node.x,anchor.x);assert.equal(depth[1].node.y,anchor.y-RAGE_VISUAL.centerTop[kind]*anchor.scale);
  assert(depth[0].y<a.owner.y&&depth[1].y>a.owner.y);
  // First observation after a 15-tick catch-up must still contain the casting flash.
  assert(depth[1].node.graphics.calls.some(c=>c[0]==='fx_rage_hit'));
  const snapshot=JSON.stringify(depth.map(d=>[d.node.x,d.node.y,d.node.alpha,d.node.graphics.calls]));
  fx.update(battle,hosts);assert.equal(JSON.stringify(depth.map(d=>[d.node.x,d.node.y,d.node.alpha,d.node.graphics.calls])),snapshot);
  const blades=descendants(a.world).filter(n=>n.texture==='fx_rage_orbit');assert.equal(blades.length,2);
  assert.equal(blades[0].rotation,blades[1].rotation);const angle=blades[0].rotation;
  fx.update(battle,hosts);assert.equal(blades[0].rotation,angle);
  for(const blade of blades){assert.equal(blade.parent.scaleY,RAGE_VISUAL.ringHeightRatio);assert.deepEqual({...blade.parent.parent.scrollRect},{x:0,y:0,width:RAGE_VISUAL.orbitCanvas,height:RAGE_VISUAL.orbitCanvas*RAGE_VISUAL.ringHeightRatio/2});}
  battle.tick+=Math.ceil(RAGE_VISUAL.castSeconds/RULE.step)+1;fx.update(battle,hosts);assert(!depth[1].node.graphics.calls.some(c=>c[0]==='fx_rage_hit'));
  assert(blades[0].rotation>angle);assert.equal(blades[0].rotation,blades[1].rotation);
  battle.bellTicks=0;fx.update(battle,hosts);battle.tick+=Math.ceil(RAGE_VISUAL.fadeSeconds/RULE.step)+1;
  assert.equal(fx.update(battle,hosts).length,0);assert(!depth[0].node.visible&&!depth[1].node.visible);
  battle.tactic.effect='ATTACK_SPEED';battle.bellTicks=300;assert.equal(fx.update(battle,hosts).length,0);
  assert.equal(fx.update(null,[]).length,0);
 }
});
