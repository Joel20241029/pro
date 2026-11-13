const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const recipe=require('../../../res/source/asset_recipe.json'),defs=require('../../../res/native/enemies.json').definitions;
const source=path.resolve(__dirname,'../../../res');
test('HD replacement contains only selected source images; pixels and native prefab sources are traceable',()=>{
 const ids=new Set();for(const a of recipe.assets){assert(!ids.has(a.id));ids.add(a.id);assert(a.runtime);assert(a.sourceSheet.startsWith('source/rendered2d/production/'));assert(fs.existsSync(path.join(source,a.sourceSheet)));assert.equal(a.sampling,'Lanczos');assert(a.provenance.sourceHash);assert(a.provenance.outputHash);if(a.category==='building-parts')assert.equal(a.bundle,'buildings');}
 assert.equal(recipe.assets.length,333);assert(recipe.assets.filter(a=>a.nineSlice).every(a=>a.height>=128 && a.nineSlice.scale>0));
 assert(!recipe.assets.some(a=>a.tintLayer));assert(!recipe.assets.some(a=>/particle/.test(a.id)));
});
test('ten front-facing enemies preserve a common group crop and fixed feet across two to four distinct frames',()=>{
 assert.equal(Object.keys(defs).length,10);for(const [kind,d]of Object.entries(defs)){assert.equal(recipe.animations.enemyNativeFacing[kind],'DOWN');assert(d.frames.length>=2&&d.frames.length<=4);assert.equal(d.frames.length/d.fps,2/3);
 const images=d.frames.map(f=>recipe.assets.find(a=>a.id===f.body));assert(images.every(Boolean));assert.equal(new Set(images.map(a=>JSON.stringify(a.provenance.groupCrop))).size,1);assert.equal(new Set(images.map(a=>a.provenance.outputHash)).size,images.length);for(const a of images)assert.deepEqual(a.pivot,{x:128,y:256*92/96});}
});
test('four packages have no duplicate frames and runtime bundle files match the published whitelist',()=>{
 const manifest=require('../../../res/manifest.json'),ids=new Set();assert.deepEqual(Object.keys(manifest.bundles),['base','buildings','characters','battle']);
 for(const [bundle,files]of Object.entries(manifest.bundles)){assert(!files.some(f=>/particle/.test(f)));const table=require(path.join(source,'bundles',bundle,'frames.json'));for(const id of Object.keys(table.frames)){assert(!ids.has(id));ids.add(id);}assert(files.every(f=>fs.existsSync(path.join(source,f))));}
 assert.equal(ids.size,recipe.assets.length);
});
