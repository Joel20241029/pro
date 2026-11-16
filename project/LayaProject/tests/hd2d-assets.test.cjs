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
 const ids=new Set();for(const a of recipe.assets){assert(!ids.has(a.id));ids.add(a.id);assert(a.runtime);assert(a.sourceSheet.startsWith('source/rendered2d/production/'));assert(fs.existsSync(path.join(source,a.sourceSheet)));assert.equal(a.sampling,'Lanczos');assert(a.provenance.sourceHash);assert(a.provenance.outputHash);if(a.category==='building-parts')assert.equal(a.bundle,'buildings');}
 assert.equal(recipe.assets.length,391);assert(recipe.assets.filter(a=>a.nineSlice).every(a=>a.height>=128 && a.nineSlice.scale>0));
 assert.equal(recipe.assets.find(a=>a.id==='icon_tactic_shield').bundle,'base');
 for(const id of ['fx_shield_dome','fx_shield_ring','fx_shield_hit'])assert.equal(recipe.assets.find(a=>a.id===id).bundle,'battle');
 assert.equal(recipe.assets.find(a=>a.id==='icon_tactic_rage').bundle,'base');
 for(const id of ['fx_rage_orbit','fx_rage_up','fx_rage_glow','fx_rage_hit'])assert.equal(recipe.assets.find(a=>a.id===id).bundle,'battle');
 assert(!recipe.assets.some(a=>/^fx_rage_ring_/.test(a.id)));
 assert(!recipe.assets.some(a=>a.tintLayer));assert(!recipe.assets.some(a=>/particle/.test(a.id)));
});
test('five minions have six frames and five bosses have eight; native ground points and the full source canvas agree',()=>{
 const {ENEMIES}=require(path.join(process.env.DAIDAI_TEST_BUILD,'config/EnemyConfig'));
 assert.equal(Object.keys(defs).length,10);for(const [kind,d]of Object.entries(defs)){assert.equal(recipe.animations.enemyNativeFacing[kind],'DOWN');assert.equal(d.frames.length,ENEMIES[kind].boss?8:6);assert.equal(d.frames.length/d.fps,2/3);assert(d.stride>0);
 const images=d.frames.map(f=>recipe.assets.find(a=>a.id===f.body));assert(images.every(Boolean));assert.equal(new Set(images.map(a=>a.provenance.sourceHash)).size,1);assert.equal(new Set(images.map(a=>a.provenance.outputHash)).size,images.length);for(const a of images){assert(a.provenance.fullCanvas);assert.equal(a.pivot.x/a.width,.5);assert(Math.abs(a.pivot.y/a.height-d.foot.y/d.canvas)<1e-12);}}
});
test('four packages have no duplicate frames and runtime bundle files match the published whitelist',()=>{
 const manifest=require('../../../res/manifest.json'),ids=new Set();assert.deepEqual(Object.keys(manifest.bundles),['base','buildings','characters','battle']);
 for(const [bundle,files]of Object.entries(manifest.bundles)){assert(!files.some(f=>/particle/.test(f)));const table=require(path.join(source,'bundles',bundle,'frames.json'));for(const id of Object.keys(table.frames)){assert(!ids.has(id));ids.add(id);}assert(files.every(f=>fs.existsSync(path.join(source,f))));}
 assert.equal(ids.size,recipe.assets.length);
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
  const role=a.id.split('_')[1],profile=JSON.parse(fs.readFileSync(path.join(source,`source/rendered2d/characters/${role}/rig-profile.json`)));
  assert(Math.abs(clip.stridePixels/clip.canvas.w-profile.walkCycle.strideCanvasPixels/256)<1e-12);
 }
 const portraits=recipe.assets.filter(a=>a.id.startsWith('portrait_'));assert.equal(portraits.length,5);
 for(const a of portraits){assert.equal(a.width,a.id.includes('baby')?192:256);assert(!a.provenance.runtimeScale);assert(byId.has(a.id.slice('portrait_'.length)));}
});
test('enlarged enemies and every attachment retain two physical pixels per logical pixel plus five percent sampling margin',()=>{
 const {ENEMY_LOOKS,ENEMY_SCALES}=require(path.join(process.env.DAIDAI_TEST_BUILD,'view/config/EnemyVisualConfig'));
 const assets=new Map(recipe.assets.map(a=>[a.id,a])),sampling=2*1.05*Math.max(...ENEMY_SCALES);
 for(const [kind,look]of Object.entries(ENEMY_LOOKS))for(const frame of defs[kind].frames){
  assert(assets.get(frame.body).width>=look.size*sampling,frame.body);
  for(const [id,part]of Object.entries(frame.parts))assert(assets.get(id).width>=part.width/96*look.size*sampling,kind+'/'+id);
 }
});
