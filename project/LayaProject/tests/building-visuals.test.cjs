const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs');
const build = process.env.DAIDAI_TEST_BUILD;
const { buildingLayoutId, FARM_WHEEL_FOOTPRINT, PATROL_BOOTH_FRAME } = require(path.join(build, 'view/BuildingLayout.js'));
const { layouts } = require('../../../res/native/buildings.json');
const { VILLAGE_PROPS, TOWER_VIEW } = require(path.join(build, 'view/VillageScene.js'));
const recipe = require('../../../res/source/asset_recipe.json');
const frames = new Set(recipe.assets.filter(a => a.runtime).map(a => a.id));
const kinds = ['HOUSE', 'FARM', 'LOGGING', 'GATE', 'ARROW', 'STONE', 'SLOW', 'PATROL', 'HEARTH'];

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
   v.sync(kind, level, false, level);
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
 v.sync('HOUSE', 1, true, 3, false, 1, 3);
 const root = v.parts.children[0];
 v.sync('HOUSE', 1, false, 4, false, 1, 4);
 v.sync('HOUSE', 1, false, 5, false, 1, 5);
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

test('body upgrades preserve ground pivot, stable reuse and precise readable level badge', () => {
 const { owner, visual: v } = create(); owner.scaleX = -1;
 v.sync('ARROW', 13, true); assert.equal(v.badge.text, '13'); assert.equal(v.badge.scaleX, -1); assert.equal(v.upgrading, false);
 const root = v.parts.children[0]; v.sync('ARROW', 13, false); assert.equal(root, v.parts.children[0]);
 v.sync('ARROW', 14, false); assert.equal(v.upgrading, false); assert.equal(v.beginVisibleUpgrade(), true); assert.equal(v.beginVisibleUpgrade(), false); assert.equal(v.upgrading, true); v.advance(.3); assert.equal(v.body.scaleY, 1); assert.notEqual(v.parts.scaleY, v.bodyScale); assert.deepEqual([owner.x, owner.y, owner.pivotX, owner.pivotY], [200, 300, 64, 120]);
 v.advance(.3); assert.equal(v.upgrading, false); assert.equal(v.parts.scaleY, v.bodyScale); v.sync('ARROW', 15, false); v.sync('ARROW', 15, true); assert.equal(v.upgrading, false);
 v.sync('GATE', 1000, true); assert.equal(v.badge.text, '1000'); assert.equal(v.badge.wordWrap, false); assert.equal(v.badge.overflow, 'shrink');
 v.sync(null, 0, false); assert.equal(v.parts.children.length, 0); assert.equal(v.badge.visible, false);
});

test('replacing a queued or playing upgrade with an empty pad cancels it and permits later upgrades', () => {
 for (const playing of [false, true]) {
  const { visual: v } = create();
  v.sync('ARROW', 1, true); v.sync('ARROW', 2, false);
  if (playing) { assert(v.beginVisibleUpgrade()); v.advance(.1); }
  v.sync(null, 0, false);
  assert.equal(v.beginVisibleUpgrade(), false); assert.equal(v.upgrading, false);
  assert.doesNotThrow(() => v.advance(.3));
  v.sync('ARROW', 1, false); assert.equal(v.beginVisibleUpgrade(), false);
  v.sync('ARROW', 2, false); assert(v.beginVisibleUpgrade());
  v.advance(.6); assert.equal(v.upgrading, false);
 }
});

test('cosmetic rebuilds preserve queued upgrades while a fresh village cancels an identical key', () => {
 const { visual: v } = create();
 v.sync('GATE', 1, true); v.sync('GATE', 2, false); v.sync('GATE', 2, false, 1, true);
 assert(v.beginVisibleUpgrade()); v.advance(.6);
 v.sync('ARROW', 2, true); v.sync('ARROW', 3, false); v.sync('ARROW', 3, false, 1, false, -1);
 assert(v.beginVisibleUpgrade()); v.advance(.6);
 v.sync('ARROW', 4, false); v.sync('ARROW', 4, true);
 assert.equal(v.beginVisibleUpgrade(), false); assert.doesNotThrow(() => v.advance(.6));
});

test('every tower keeps its weapon below the HUD on the shortest screen', () => {
 const { GameLayout } = require(path.join(build, 'view/GameLayout.js'));
 const { frames: regions } = require('../../../res/atlases/frames.json');
 const layout = new GameLayout({windowWidth:320,windowHeight:568,statusBarHeight:20,safeArea:{top:20,bottom:568,left:0,right:320}}, {width:88,height:32,top:24,bottom:56,left:222,right:310});
 const { layoutVillage } = require(path.join(build, 'view/VillageScene.js'));
 const scene = layoutVillage(layout);
 for(const [padIndex, pad] of scene.pads.entries()) for(const kind of ['ARROW','STONE','SLOW']) for(const level of [1,12]) {
  const {world,owner,visual}=create();owner.size(TOWER_VIEW.size,TOWER_VIEW.size).pos(pad.x,pad.y+(TOWER_VIEW.top+TOWER_VIEW.size*15/16)*scene.towerScale);
  owner.scale(scene.towerScale,scene.towerScale);
  visual.sync(kind,level,true,1,false,TOWER_VIEW.facing[padIndex]);
  const shot = {tower: 0, tick:0};
  const { RULE } = require(path.join(build, 'game/GameConfig.js'));
  const battle = { outcome: null };
  const attack = clips.get('motion_'+kind.toLowerCase()+'_attack');
  for(let index=0;index<=attack.frameIds.length;index++) {
   visual.updateAttack(battle,0,[shot],RULE.step+(index+.01)/attack.fps);
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

test('visible arrow and stone feet sit in the tower deck center for either bank', () => {
 // Measured horizontal support centers in the rest textures, independent of the editor pivot.
 const supports = [['ARROW', 50 / 121], ['STONE', 24 / 69]];
 for (const [kind, supportCenter] of supports) for (const facing of [1, -1]) {
  const { visual, owner, world } = create();
  visual.sync(kind, 1, true, 1, false, facing);
  const weapon = visual.body.getChildByName('Weapon');
  const support = kind === 'ARROW' ? weapon.children.find(node => node.visible).children[0] : weapon.children[0];
  const at = support.localToGlobal({ x: support.width * supportCenter, y: support.height }, false, world);
  assert.equal(visual.weaponAnchor().x, owner.x);
  assert(Math.abs(at.x - owner.x) < 3, `${kind}/${facing} feet are off the deck center`);
 }
});

test('authored hard footprints remain inside the pre-reserved navigation base', () => {
 const propFor = { HOUSE: ['building:house-a'], FARM: ['building:farm'], LOGGING: ['building:logging'], GATE: ['building:gate'], ARROW: ['tower:0'], STONE: ['tower:0'], SLOW: ['tower:0'] };
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

test('three attack clips follow the presentation clock while launchPoint stays fixed', () => {
 const { RULE } = require(path.join(build, 'game/GameConfig.js'));
 for (const kind of ['ARROW', 'STONE', 'SLOW']) {
  const a=create(), b=create(); a.owner.size(108,108); b.owner.size(108,108); b.owner.scaleX=-1;
  a.visual.sync(kind,1,true); b.visual.sync(kind,1,true);
  const battle={outcome:null}, shot={tower:0,tick:1}, shots=[shot,{...shot}];
  const launch=a.visual.launchPoint(), mirror=b.visual.launchPoint();
  assert(Math.abs(launch.x+mirror.x-400)<1e-8);
  assert.equal(launch.y,mirror.y);
  const clip=clips.get('motion_'+kind.toLowerCase()+'_attack'), node=a.visual.attack[0].node;
  const start=(shot.tick+1)*RULE.step;
  a.visual.updateAttack(battle,0,shots,start); assert.equal(node.texture,clip.frameIds[0]);
  a.visual.updateAttack(battle,0,shots,start); assert.equal(node.texture,clip.frameIds[0]);
  battle.outcome='VICTORY';
  a.visual.updateAttack(battle,0,shots,start+1.2/clip.fps); assert.equal(node.texture,clip.frameIds[1]);
  assert.deepEqual(a.visual.launchPoint(),launch);
  a.visual.updateAttack(battle,0,[],start+1); assert.equal(node.texture,clip.restFrame);
  a.visual.updateAttack(null,0,[],0); assert.equal(a.visual.latestShot,null);
 }
});

test('all enlarged mechanisms stay attached at their editor mount and share that transform with the release point', () => {
 for(const kind of ['ARROW','STONE','SLOW']) for(const facing of [-1,1]){
  const {visual,world}=create();visual.sync(kind,1,true,1,false,facing);
  const weapon=visual.body.getChildByName('Weapon');
  assert.equal(weapon.scaleX,1.5);assert.equal(weapon.scaleY,1.5);
  const mount=weapon.localToGlobal(new Laya.Point(weapon.pivotX,weapon.pivotY),false,world);
  const {x,y}=visual.weaponAnchor();
  assert.equal(mount.x,x);assert.equal(mount.y,y);
  const raw=visual.muzzle, release=raw.localToGlobal(new Laya.Point(0,0),false,world);
  assert.deepEqual(visual.launchPoint(),release);
 }
});

test('right-hand arrow towers select actual left weapons without mirroring the body',()=>{
 const a=create(),b=create();a.visual.sync('ARROW',12,true,1,false,1);b.visual.sync('ARROW',12,true,1,false,-1);
 const right=descendants(a.owner).find(n=>n.name==='FacingRight'),left=descendants(b.owner).find(n=>n.name==='FacingLeft');
 assert(right.visible);assert(left.visible);assert(!descendants(a.owner).find(n=>n.name==='FacingLeft').visible);assert(!descendants(b.owner).find(n=>n.name==='FacingRight').visible);
 assert.equal(a.owner.scaleX,1);assert.equal(b.owner.scaleX,1);assert(a.visual.launchPoint().x>b.visual.launchPoint().x);
 assert(descendants(right).some(n=>n.texture===clips.get('motion_arrow_attack').restFrame));assert(descendants(left).some(n=>n.texture===clips.get('motion_arrow_attack').restFrame));
});


test('stone cups sit behind the tower facing; stone and frost launch points mirror with the body',()=>{
 for(const kind of ['STONE','SLOW']){
  const left=create(),right=create();
  left.visual.sync(kind,1,true,1,false,1);
  right.visual.sync(kind,1,true,1,false,-1);
  const leftScale=kind==='STONE'?-1:1;
  assert.equal(left.visual.body.scaleX,leftScale);
  assert.equal(right.visual.body.scaleX,-leftScale);
  if(kind==='STONE') assert(left.visual.launchPoint().x<left.owner.x && right.visual.launchPoint().x>right.owner.x);
  assert.equal(right.owner.scaleX,1);
  assert.equal(left.visual.launchPoint().x+right.visual.launchPoint().x,400);
  assert.equal(left.visual.launchPoint().y,right.visual.launchPoint().y);
  const leftAnchor=left.visual.weaponAnchor(), rightAnchor=right.visual.weaponAnchor();
  assert.equal(leftAnchor.x+rightAnchor.x,400);
  assert.equal(leftAnchor.y,rightAnchor.y);
  assert.equal(leftAnchor.scale,rightAnchor.scale);
 }
});

test('rage blades rotate on a fixed projected plane, freeze with battle time and remain outside building picking', () => {
 const {TowerRageEffects}=require(path.join(build,'view/TowerRageEffects.js'));
 const {RAGE_VISUAL}=require(path.join(build,'view/config/RageVisualConfig.js'));
 const {RULE}=require(path.join(build,'game/GameConfig.js'));
 for(const kind of ['ARROW','STONE','SLOW'])for(const level of [1,4,8,12]){
  const a=create();a.visual.sync(kind,level,true);const before=descendants(a.owner).slice();
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
