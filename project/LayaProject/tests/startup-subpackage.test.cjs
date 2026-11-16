const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), { createRequire } = require('node:module');
const compiled = process.env.DAIDAI_TEST_BUILD;
if (!compiled) throw new Error('Set DAIDAI_TEST_BUILD under Downloads');
const mainFile = path.join(compiled, 'Main.js'), actualRequire = createRequire(mainFile);
const project = path.resolve(__dirname, '..');
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };
const flush = () => new Promise(setImmediate);
function setup() {
    const requests=[], textures=[], cache=new Map(), gates=new Map(), native=new Map(), storage=new Map(); let views=0;
    class Sprite {
        constructor(){this.children=[];this.events=new Map();this.destroyed=false;}
        addChild(c){this.children.push(c);c.parent=this;return c;}
        on(event,caller,fn){this.events.set(event,()=>fn.call(caller));}
        off(event){this.events.delete(event);}
        destroy(){this.destroyed=true;if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);}
    }
    class StartupView extends Sprite { resize(){this.resizes=(this.resizes||0)+1;} showStatus(failed){assert(!this.destroyed);this.failed=failed;} decorate(){} showPreparation(title,state){assert(!this.destroyed);this.failed=state.phase==='FAILED';} }
    class GameView { constructor(){views++;this.root=new Sprite();} refresh(){} resize(){this.resizes=(this.resizes||0)+1;} update(){} destroy(){this.root.destroy();} }
    const stage=new Sprite();
    global.Laya={Script:class{},regClass:()=>t=>t,stage,Event:{CLICK:'click',RESIZE:'resize'},timer:{unscaledDelta:50},FilterMode:{Bilinear:1},Loader:{JSON:'json',IMAGE:'image'},
        loader:{loadPackage(root,progress){requests.push({native:root});const gate=deferred();native.set(root,{...gate,progress});return gate.promise;},
            async load(url,options){
                requests.push({url,options});
                if(cache.has(url)&&!options.ignoreCache)return cache.get(url);
                if(gates.has(url)){const value=await gates.get(url).promise;cache.set(url,value);return value;}
                const file=path.join(project,'assets',url);
                let value;
                if(url.endsWith('.json'))value={data:JSON.parse(fs.readFileSync(file,'utf8'))};
                else if(url.endsWith('.mc')){assert(fs.statSync(file).size>0);value={binary:file};}
                else {const bytes=fs.readFileSync(file);assert(url.endsWith('.png'),url);value={width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),bitmap:{}};}
                cache.set(url,value);return value;
            }},
        Texture:{create(){const t={destroyed:false,destroy(){this.destroyed=true;}};textures.push(t);return t;}}
    };
    global.wx={getWindowInfo:()=>({windowWidth:720,windowHeight:1280,safeArea:{top:0,bottom:1280}}),
        getStorageInfoSync:()=>({keys:[...storage.keys()]}),getStorageSync:key=>storage.get(key),setStorageSync:(key,value)=>storage.set(key,value),
        onHide(){},offHide(){},onShow(){},offShow(){},onAudioInterruptionBegin(){},offAudioInterruptionBegin(){},onAudioInterruptionEnd(){},offAudioInterruptionEnd(){}};
    const module={exports:{}};
    vm.runInNewContext(fs.readFileSync(mainFile,'utf8'),{module,exports:module.exports,Laya:global.Laya,console:{log(){},error(){}},require:name=>name==='./view/GameView'?{GameView}:name==='./view/StartupView'?{StartupView}:actualRequire(name)},{filename:mainFile});
    const main=new module.exports.Main();return {main,requests,textures,cache,gates,native,stage,get views(){return views;}};
}
async function boot(f) {const start=f.main.onStart();await flush();assert.equal(f.views,0);assert(f.native.has('resources/buildings'));f.native.get('resources/buildings').resolve(true);await start;await flush();}
test('complete map waits for buildings, then characters; battle is not requested at boot',async()=>{
    const f=setup();await boot(f);
    assert.equal(f.views,1);assert(f.main.frames.ready('base'));assert(!f.main.frames.ready('characters'));
    assert.deepEqual(f.requests.filter(r=>r.native).map(r=>r.native),['resources/buildings','resources/characters']);
    assert(f.main.session.pauses.has('ASSETS'));assert.equal(f.main.loading,null);
    f.native.get('resources/characters').resolve(true);await flush();
    assert(f.main.frames.ready('characters'));assert(!f.main.session.pauses.has('ASSETS'));
    assert.equal(f.views,1);f.main.onDestroy();assert(f.textures.every(t=>t.destroyed));
});
test('real native failure retries once; repeated taps share the same promise',async()=>{
    const f=setup();await boot(f);
    const r=f.main.resources, first=r.ensure('characters');assert.equal(first,r.ensure('characters'));
    f.native.get('resources/characters').resolve(false);assert.equal(await first,false);
    assert.equal(r.states.characters.phase,'FAILED');assert(f.main.session.pauses.has('ASSETS'));
    const retry=r.ensure('characters');assert.equal(retry,r.ensure('characters'));await flush();
    f.native.get('resources/characters').resolve(true);assert.equal(await retry,true);
    assert.equal(f.requests.filter(r=>r.native==='resources/characters').length,2);f.main.onDestroy();
});
test('failed Laya null cache is bypassed and retry waits for every sibling to finish',async()=>{
    const f=setup();await boot(f);
    const table=JSON.parse(fs.readFileSync(path.join(project,'assets/resources/characters/frames.json')));
    assert(table.pages.length>=2,'fixture must exercise concurrent pages');
    const a='resources/characters/'+table.pages[0].runtimeFile,b='resources/characters/'+table.pages[1].runtimeFile;
    f.gates.set(a,deferred());f.gates.set(b,deferred());
    f.native.get('resources/characters').resolve(true);await flush();
    const active=f.main.resources.ensure('characters');f.gates.get(a).resolve(null);await flush();
    assert.equal(f.main.resources.states.characters.phase,'DECODE');assert.equal(active,f.main.resources.ensure('characters'));
    const pageBytes=fs.readFileSync(path.join(project,'assets',b));f.gates.get(b).resolve({width:pageBytes.readUInt32BE(16),height:pageBytes.readUInt32BE(20),bitmap:{}});assert.equal(await active,false);assert(!f.main.frames.ready('characters'));
    f.gates.delete(a);f.gates.delete(b);assert.equal(await f.main.resources.ensure('characters'),true);
    assert(f.requests.filter(r=>r.url===a).at(-1).options.ignoreCache);
    assert.equal(f.requests.filter(r=>r.native==='resources/characters').length,1,'registered package reused');f.main.onDestroy();
});
test('slow foreground download gives a hint, never starts a second native task; background does not age it',async()=>{
    const f=setup();await boot(f);const r=f.main.resources;
    r.advance(60,false);assert(!r.states.characters.slow);r.advance(31,true);assert(r.states.characters.slow);
    const current=r.ensure('characters');assert.equal(current,r.ensure('characters'));assert.equal(f.requests.filter(r=>r.native==='resources/characters').length,1);
    f.native.get('resources/characters').progress(50);assert(!r.states.characters.slow);assert.equal(r.states.characters.progress,.5);
    f.native.get('resources/characters').resolve(true);await current;f.main.onDestroy();
});
test('restored night remains at tick zero until both bundles are ready, without an extra settlement',async()=>{
    const f=setup();await boot(f);
    const {createGame,applyCommand}=actualRequire('./game/VillageRules'),state=createGame(123);applyCommand(state,{type:'NIGHT'});
    const session=f.main.session;session.saves.prepare(state);session.saves.commit();session.load();const saved=JSON.stringify(session.state);
    f.main.onUpdate();await flush();assert(f.native.has('resources/battle'));assert.equal(session.battle.tick,0);
    f.native.get('resources/characters').resolve(true);await flush();f.main.onUpdate();assert.equal(session.battle.tick,0);
    f.native.get('resources/battle').resolve(true);await flush();assert.equal(JSON.stringify(session.state),saved);
    session.dailyRationDate=null;session.resume('DAILY_RATION');f.main.onUpdate();assert(session.battle.tick>0);f.main.onDestroy();
});
test('destroy during native download suppresses late view creation and decode',async()=>{
    const f=setup();await boot(f);const r=f.main.resources,task=r.ensure('characters');
    f.main.onDestroy();const requests=f.requests.length;f.native.get('resources/characters').resolve(true);assert.equal(await task,false);
    assert.equal(f.requests.length,requests);assert.equal(f.stage.children.length,0);assert(f.textures.every(t=>t.destroyed));
});
test('base resource failure leaves an operable retry without requesting a subpackage',async()=>{
    const f=setup(),url='resources/base/frames.json';f.gates.set(url,deferred());const start=f.main.onStart();f.gates.get(url).resolve(null);await start;
    assert.equal(f.views,0);assert(f.main.loading.failed);assert(!f.requests.some(r=>r.native));
    f.gates.delete(url);const retry=f.main.startVillage();await flush();f.native.get('resources/buildings').resolve(true);await retry;await flush();assert.equal(f.views,1);assert(f.requests.findLast(r=>r.url===url).options.ignoreCache);
    f.main.onDestroy();f.native.get('resources/characters').resolve(true);await flush();
});

test('missing frames, animation declarations or labor directions cannot publish half-ready characters and can retry',async()=>{
 for(const defect of ['frames','animations','labor']) {
  const f=setup();await boot(f);
  const name=defect==='frames'?'frames.json':'animations.json',url='resources/characters/'+name;
  const data=JSON.parse(fs.readFileSync(path.join(project,'assets',url)));
  if(defect==='frames')delete data.frames[Object.keys(data.frames)[0]];
  else if(defect==='animations')data.animations.pop();
  else data.laborDirections={};
  f.cache.set(url,{data});f.native.get('resources/characters').resolve(true);await flush();
  assert.equal(f.main.resources.states.characters.phase,'FAILED');assert(!f.main.frames.ready('characters'));
  assert(f.main.session.pauses.has('ASSETS'));assert.equal(await f.main.resources.ensure('characters'),true);
  assert(f.requests.findLast(r=>r.url===url).options.ignoreCache);f.main.onDestroy();
 }
});
test('missing Boss layout is rejected before a battle can start and can retry',async()=>{
 const f=setup();await boot(f);f.native.get('resources/characters').resolve(true);await flush();
 const r=f.main.resources,url='resources/battle/enemies.json',data=JSON.parse(fs.readFileSync(path.join(project,'assets',url)));
 delete data.definitions.enemy_shaman;f.cache.set(url,{data});const task=r.ensure('battle');await flush();f.native.get('resources/battle').resolve(true);
 assert.equal(await task,false);assert(!f.main.frames.ready('battle'));assert.equal(await r.ensure('battle'),true);f.main.onDestroy();
});
for(const defect of ['missing-accessory','invalid-position','invalid-layer','invalid-body-offset','missing-shadow','invalid-shadow-alpha','invalid-shadow-texture']) {
 test(`invalid enemy ${defect} rejects the entire battle bundle before publishing textures`,async()=>{
  const f=setup();await boot(f);f.native.get('resources/characters').resolve(true);await flush();
  const url='resources/battle/enemies.json',data=JSON.parse(fs.readFileSync(path.join(project,'assets',url)));
  const frame=data.definitions.enemy_raider.frames[0],part=frame.parts.enemy_acc_banner;
  if(defect==='missing-accessory')delete frame.parts.enemy_acc_banner;
  else if(defect==='invalid-position')part.x=NaN;
  else if(defect==='invalid-layer')part.behind='front';
  else if(defect==='missing-shadow')delete data.definitions.enemy_raider.shadow;
  else if(defect==='invalid-shadow-alpha')data.definitions.enemy_raider.shadow.alpha=NaN;
  else if(defect==='invalid-shadow-texture')data.definitions.enemy_raider.shadow.frame='enemy_raider_walk_00';
  else frame.x=Infinity;
  f.cache.set(url,{data});const task=f.main.resources.ensure('battle');await flush();f.native.get('resources/battle').resolve(true);
  assert.equal(await task,false);assert(!f.main.frames.ready('battle'));assert.deepEqual(f.main.frames.enemyLayouts,{});
  assert.equal(await f.main.resources.ensure('battle'),true);f.main.onDestroy();
 });
}
test('destroy while metadata is still loading prevents page decoding and texture publication',async()=>{
 const f=setup();await boot(f);const url='resources/characters/frames.json',gate=deferred();f.gates.set(url,gate);
 f.native.get('resources/characters').resolve(true);await flush();const task=f.main.resources.ensure('characters');f.main.onDestroy();const count=f.requests.length;
 gate.resolve({data:JSON.parse(fs.readFileSync(path.join(project,'assets',url)))});assert.equal(await task,false);
 assert.equal(f.requests.length,count);assert(!f.main.frames.ready('characters'));assert(f.textures.every(t=>t.destroyed));
});

// Mutations affect only decoded test-local metadata; the production loader validates
// actual atlas declarations and frame references before publishing the character bundle.
for(const defect of ['missing-direction','wrong-mirror','missing-action-frame','missing-rest-frame','invalid-fps']) {
 test(`invalid character ${defect} fails atomically and manual retry rereads animation metadata`,async()=>{
  const f=setup();await boot(f);const url='resources/characters/animations.json';
  const data=JSON.parse(fs.readFileSync(path.join(project,'assets',url)));
  if(defect==='missing-direction'||defect==='wrong-mirror') {
   const directions=data.walkDirections[Object.keys(data.walkDirections)[0]],key=Object.keys(directions)[0];
   if(defect==='missing-direction')delete directions[key];else directions[key].mirror=!directions[key].mirror;
  } else if(defect==='missing-action-frame')data.animations[0].frameIds.push('not_a_real_frame');
  else if(defect==='missing-rest-frame')data.animations[0].restFrame='not_a_real_rest_frame';
  else data.animations[0].fps=0;
  f.cache.set(url,{data});const task=f.main.resources.ensure('characters');f.native.get('resources/characters').resolve(true);
  assert.equal(await task,false);assert(!f.main.frames.ready('characters'));assert(f.main.session.pauses.has('ASSETS'));
  const first=JSON.parse(fs.readFileSync(path.join(project,'assets/resources/characters/frames.json')));assert.throws(()=>f.main.frames.get(Object.keys(first.frames)[0]));
  assert.equal(await f.main.resources.ensure('characters'),true);assert(f.requests.findLast(r=>r.url===url).options.ignoreCache);
  assert.equal(f.requests.filter(r=>r.native==='resources/characters').length,1);f.main.onDestroy();assert(f.textures.every(t=>t.destroyed));
 });
}
test('3D portrait-only frame table cannot satisfy restored 2D frame contract',async()=>{
 const f=setup();await boot(f);const url='resources/characters/frames.json';
 const data=JSON.parse(fs.readFileSync(path.join(project,'assets',url))),first=Object.keys(data.frames)[0];
 data.frames={portrait_male:data.frames[first]};f.cache.set(url,{data});
 const task=f.main.resources.ensure('characters');f.native.get('resources/characters').resolve(true);
 assert.equal(await task,false);assert(!f.main.frames.ready('characters'));
 assert.equal(await f.main.resources.ensure('characters'),true);assert(f.requests.findLast(r=>r.url===url).options.ignoreCache);f.main.onDestroy();
});
test('unified portraits select full-resolution copies of the original rest pose for every life stage and ancestors',async()=>{
 const f=setup();await boot(f);f.native.get('resources/characters').resolve(true);await flush();const art=f.main.frames;
 for(const sex of ['MALE','FEMALE']) {
  const p={sex,appearance:sex==='MALE'?'male_a':'female_a',adult:true,elderNights:0,nights:12,growth:0};
  assert.equal(art.portraitId(p),'portrait_'+art.frameId(`villager_${p.appearance}_walk`,0,false));
  assert.equal(art.portraitId(p,true),'portrait_'+art.frameId(`villager_elder_${sex==='MALE'?'male':'female'}_idle`,0,false));
  p.nights=0;p.elderNights=3;assert.equal(art.portraitId(p),art.portraitId(p,true));
  p.adult=false;p.elderNights=0;assert.equal(art.portraitId(p),'portrait_'+art.frameId('villager_baby_idle',0,false));
  p.growth=1;assert.equal(art.portraitId(p),'portrait_'+art.frameId(`villager_${sex==='MALE'?'boy':'girl'}_walk`,0,false));
  assert(art.get(art.portraitId(p)));
 }
 f.main.onDestroy();
});

test('building download failure keeps startup operable, one retry, and no game state is loaded',async()=>{
 const f=setup(),start=f.main.onStart();await flush();assert.equal(f.views,0);assert.equal(f.main.session.state,null);
 f.native.get('resources/buildings').resolve(false);await start;assert(f.main.loading.failed);assert.equal(f.views,0);assert(f.main.session.pauses.has('ASSETS'));
 const retry=f.main.startVillage();void f.main.startVillage();await flush();assert.equal(f.requests.filter(r=>r.native==='resources/buildings').length,2);
 f.native.get('resources/buildings').resolve(true);await retry;assert.equal(f.views,1);assert(f.main.frames.ready('buildings'));assert.equal(f.requests.filter(r=>r.url==='resources/base/frames.json').length,1);
 f.main.onDestroy();f.native.get('resources/characters').resolve(true);await flush();
});
test('invalid building layout fails before scene construction and retry reuses downloaded package',async()=>{
 const f=setup(),url='resources/buildings/buildings.json',data=JSON.parse(fs.readFileSync(path.join(project,'assets',url)));
 delete data.layouts.HOUSE_1_1;f.cache.set(url,{data});const start=f.main.onStart();await flush();f.native.get('resources/buildings').resolve(true);await start;
 assert.equal(f.views,0);assert(f.main.loading.failed);assert(!f.main.frames.ready('buildings'));
 await f.main.startVillage();assert.equal(f.views,1);assert.equal(f.requests.filter(r=>r.native==='resources/buildings').length,1);
 f.main.onDestroy();f.native.get('resources/characters').resolve(true);await flush();
});
test('destroy while building download is pending never creates the complete map',async()=>{
 const f=setup(),start=f.main.onStart();await flush();f.main.onDestroy();const requests=f.requests.length;
 f.native.get('resources/buildings').resolve(true);await start;assert.equal(f.views,0);assert.equal(f.requests.length,requests);assert.equal(f.stage.children.length,0);
});
test('labor chooses real left and right pictures, all life stages share unmirrored source lighting',async()=>{
 const f=setup();await boot(f);f.native.get('resources/characters').resolve(true);await flush();const art=f.main.frames;
 for(const identity of ['male_a','female_a','boy','girl','elder_male','elder_female'])for(const direction of ['DOWN','LEFT','UP','RIGHT'])assert.equal(art.walk(identity,direction).mirror,false);
 for(const identity of ['male_a','female_a'])for(const work of ['chop','care']){const clip=`villager_${identity}_${work}`,right=art.labor(clip,false),left=art.labor(clip,true);assert.notEqual(right.clip,left.clip);assert.equal(right.mirror,false);assert.equal(left.mirror,false);}
 assert.equal(art.frameId('villager_boy_walk',0),art.frameId('villager_girl_walk',0));assert.equal(art.frameId('villager_elder_male_walk',0),art.frameId('villager_elder_female_walk',0));f.main.onDestroy();
});
