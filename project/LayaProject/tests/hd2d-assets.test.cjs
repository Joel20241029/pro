const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const recipe=require('../../../res/source/asset_recipe.json'),defs=require('../../../res/native/enemies.json').definitions;
const source=path.resolve(__dirname,'../../../res');
test('each native enemy prefab owns one bottom-layer contact shadow and exports its actual layout',()=>{
 const exported=require('../../../res/native/enemies.json');
 assert.equal(exported.version,4);
 for(const [kind,d]of Object.entries(defs)){
  const prefab=JSON.parse(fs.readFileSync(path.join(source,'editor/BuildingWorkshop/assets/enemyAuthoring/prefabs',kind+'.lh')));
  const layers=prefab._$child,shadow=layers[0];assert.equal(shadow.name,'ContactShadow');
  assert.equal(layers.filter(c=>c.name==='ContactShadow').length,1);assert.equal(layers.length,d.frames.length+3);
  assert.equal(d.shadow.frame,'shadow_actor');
  for(const key of ['x','y','width','height','alpha'])assert.equal(d.shadow[key],shadow[key]);
  const texture=JSON.parse(fs.readFileSync(path.join(source,'editor/BuildingWorkshop/assets/enemyAuthoring/textures/shadow_actor.png.meta')));
  assert.equal(shadow.texture._$uuid,texture.uuid);
 }
});
test('HD replacement contains only selected source images; pixels and native prefab sources are traceable',()=>{
 const ids=new Set();for(const a of recipe.assets){assert(!ids.has(a.id));ids.add(a.id);assert.equal(typeof a.runtime,'boolean');assert(a.sourceSheet.startsWith('source/rendered2d/production/'));assert(fs.existsSync(path.join(source,a.sourceSheet)));assert.equal(a.sampling,'Lanczos');assert(a.provenance.sourceHash);assert(a.provenance.outputHash);if(a.category==='building-parts')assert.equal(a.bundle,'buildings');}
 assert.equal(Object.keys(recipe.animations.walkDirections).length,8);assert(!recipe.assets.some(a=>a.id.startsWith("emote_")));assert(recipe.assets.filter(a=>a.nineSlice).every(a=>a.height>=128 && a.nineSlice.scale>0));
 for (const kind of ['arrow','stone','slow']){
  const clip=recipe.animations.animations.find(a=>a.id==='fx_impact_'+kind);assert.equal(clip.frameCount,5);assert.equal(clip.loop,false);
  for(const id of clip.frameIds){const a=recipe.assets.find(f=>f.id===id); assert.equal(a.bundle,'battle'); assert.deepEqual(a.pivot,{x:40,y:40});}
 }
 assert.equal(recipe.assets.find(a=>a.id==='icon_tactic_shield').bundle,'base');
 for(const id of ['fx_shield_dome','fx_shield_ring','fx_shield_hit'])assert.equal(recipe.assets.find(a=>a.id===id).bundle,'battle');
 assert.equal(recipe.assets.find(a=>a.id==='icon_tactic_rage').bundle,'base');
 assert.equal(recipe.assets.find(a=>a.id==='fx_rage_orbit').bundle,'characters');
 for(const id of ['fx_rage_up','fx_rage_glow','fx_rage_hit'])assert.equal(recipe.assets.find(a=>a.id===id).bundle,'battle');
 assert(!recipe.assets.some(a=>/^fx_rage_ring_/.test(a.id)));
 assert(!recipe.assets.some(a=>a.tintLayer));assert(!recipe.assets.some(a=>/particle/.test(a.id)));
});
test('five minions have six frames and five bosses have eight; native ground points and the full source canvas agree',()=>{
 const {ENEMIES}=require(path.join(process.env.DAIDAI_TEST_BUILD,'config/EnemyConfig'));
 assert.equal(Object.keys(defs).length,10);for(const [kind,d]of Object.entries(defs)){assert.equal(recipe.animations.enemyNativeFacing[kind],'DOWN');assert.equal(d.frames.length,ENEMIES[kind].boss?8:6);assert.equal(d.frames.length/d.fps,2/3);assert(d.stride>0);
 const images=d.frames.map(f=>recipe.assets.find(a=>a.id===f.body));assert(images.every(Boolean));assert.equal(new Set(images.map(a=>a.provenance.sourceHash)).size,1);assert.equal(new Set(images.map(a=>a.provenance.outputHash)).size,images.length);for(const a of images){assert(a.provenance.fullCanvas);assert.equal(a.pivot.x/a.width,.5);assert(Math.abs(a.pivot.y/a.height-d.foot.y/d.canvas)<1e-12);}}
});
test('two stages cover the seven resource categories exactly once',()=>{
 const manifest=require('../../../res/manifest.json'), ids=new Set(), all=new Set();
 assert.deepEqual(Object.keys(manifest.stages),['village','night']);
 for (const [stage,files] of Object.entries(manifest.stages)) {
  const table=require(path.join(source,'bundles',stage==='village'?'map':'enemies','frames.json'));
  assert.equal(table.stage,stage);
  for(const id of Object.keys(table.frames)){assert(!ids.has(id));ids.add(id);}
  for(const file of files){assert(!all.has(file));assert(fs.existsSync(path.join(source,file)));all.add(file);}
  assert(table.pages.every(page=>files.includes('bundles/'+page.runtimeFile)));
 }
 assert.deepEqual([...new Set([...all].map(file=>file.split('/')[1]))].sort(),['buildings','characters','effects','enemies','map','music','ui']);
 assert.deepEqual([...all].sort(),[...manifest.runtimeWhitelist].sort());
 assert.deepEqual([...ids].sort(),recipe.assets.filter(a=>a.runtime).map(a=>a.id).sort());
});
test('the full-size terrain uses one village atlas page and keeps its gate alignment',()=>{
 const {LAYOUT}=require(path.join(process.env.DAIDAI_TEST_BUILD,'view/config/HudConfig'));
 const {WORLD_ART}=require(path.join(process.env.DAIDAI_TEST_BUILD,'view/config/WorldArtConfig'));
 const table=require(path.join(source,'bundles/map/frames.json'));
 const asset=recipe.assets.find(a=>a.id===WORLD_ART.terrain), frame=table.frames[asset.id];
 const fit=asset.provenance.registration;
 assert.equal(fit.referenceWidth,LAYOUT.width);
 assert.equal(fit.referenceTop,LAYOUT.referenceTop);
 assert.equal(fit.referenceGate,LAYOUT.referenceGate);
 assert.equal(fit.roadRows,593);
 assert(fit.minRoadMargin>=1);
 const sha=file=>require('node:crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 assert.equal(fit.corridorSha256,sha(path.join(__dirname,'../src/config/RoadGeometry.ts')));
 assert.equal(asset.provenance.sourceHash,sha(path.join(source,asset.provenance.source)));
 assert.deepEqual(frame.sourceSize,{w:1122,h:1402});
 assert.deepEqual(frame.trimOffset,{x:0,y:0});
 assert.deepEqual(frame.pivot,asset.pivot);
 assert.equal(Object.values(table.frames).filter(f=>f.page===frame.page).length,1);
 assert.equal(table.pages.find(p=>p.id===frame.page).runtimeFile,'map/terrain_0.png');
 const reserves=['deco_blossom_pink','deco_bush','deco_rocks','map_gate_lane','map_road','tile_ground_grass'];
 assert.deepEqual(recipe.assets.filter(a=>!a.runtime).map(a=>a.id).sort(),reserves);
 for(const id of reserves)assert(!table.frames[id],id);
});
test('resizing preserves normalized feet and stride; panel portraits retain their original resolution',()=>{
 const byId=new Map(recipe.assets.map(a=>[a.id,a]));
 for(const a of recipe.assets){
  const original=a.provenance.normalizedCanvas;if(!original)continue;
  assert.equal(a.width/original.width,a.provenance.runtimeScale);
  assert(Math.abs(a.pivot.x/a.width-original.pivot.x/original.width)<1e-12);
  assert(Math.abs(a.pivot.y/a.height-original.pivot.y/original.height)<1e-12);
 }
 for(const clip of recipe.animations.animations){
  const a=byId.get(clip.frameIds[0]);assert.deepEqual(clip.canvas,{w:a.width,h:a.height});assert.deepEqual(clip.pivot,a.pivot);
  if(clip.stridePixels===undefined)continue;
  if(a.category==='enemies') { const d=defs[a.id.replace(/_walk_\d+$/,'')];assert(Math.abs(clip.stridePixels/clip.canvas.w-d.stride/d.canvas)<1e-12);continue; }
  const role=clip.id.slice('villager_'.length).split('_walk_')[0],profile=require(path.join(source,`source/rendered2d/characters/v5/${role}/rig-profile.json`));
  assert(Math.abs(clip.stridePixels/clip.canvas.w-profile.walkCycle.strideCanvasPixels/256)<1e-12);
 }
 const portraits=recipe.assets.filter(a=>a.id.startsWith('portrait_'));assert.equal(portraits.length,9);
 for(const a of portraits){assert.equal(a.width,384);assert(!a.provenance.runtimeScale);assert(byId.has(a.id.slice('portrait_'.length)));}
});
test('enlarged enemies and every attachment retain two physical pixels per logical pixel plus five percent sampling margin',()=>{
 const {ENEMY_LOOKS,ENEMY_SCALES}=require(path.join(process.env.DAIDAI_TEST_BUILD,'view/config/EnemyVisualConfig'));
 const assets=new Map(recipe.assets.map(a=>[a.id,a])),sampling=2*1.05*Math.max(...ENEMY_SCALES);
 for(const [kind,look]of Object.entries(ENEMY_LOOKS))for(const frame of defs[kind].frames){
  assert(assets.get(frame.body).width>=look.size*sampling,frame.body);
  for(const [id,part]of Object.entries(frame.parts))assert(assets.get(id).width>=part.width/96*look.size*sampling,kind+'/'+id);
 }
});
