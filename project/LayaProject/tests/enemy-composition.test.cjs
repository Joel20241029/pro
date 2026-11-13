const {test}=require('node:test'), assert=require('node:assert/strict'),path=require('node:path');
const build=process.env.DAIDAI_TEST_BUILD;
const {ENEMIES,BOSS_ROTATION}=require(path.join(build,'config/EnemyConfig'));
const {createGame,applyCommand}=require(path.join(build,'game/VillageRules'));
const {generateWave}=require(path.join(build,'game/WaveGenerator'));
const {BattleSimulation}=require(path.join(build,'game/BattleSimulation'));
const {SaveStore}=require(path.join(build,'storage/SaveStore'));
const {ResourcePreparation}=require(path.join(build,'platform/ResourcePreparation'));
test('five ordinary silhouettes and five bosses; first five boss nights show every boss in order',()=>{
 assert.equal(Object.values(ENEMIES).filter(e=>!e.boss).length,5);assert.equal(Object.values(ENEMIES).filter(e=>e.boss).length,5);
 const s=createGame(12),seen=[];
 for(let day=1;day<=120;day++) {s.day=day;const family=s.rng.family,w=generateWave(s);assert.equal(s.rng.family,family);
  assert(w.entries.every(e=>Number.isInteger(e.appearanceSeed)&&e.appearanceSeed>=0&&e.appearanceSeed<=0xffffffff));
  const bosses=w.entries.filter(e=>ENEMIES[e.kind].boss);assert.equal(bosses.length,day%12===0?1:0);
  if(bosses.length)seen.push(bosses[0].kind);assert.equal(w.entries.reduce((n,e)=>n+ENEMIES[e.kind].cost,0),w.budget);
 }
 assert.deepEqual(seen,[...BOSS_ROTATION,...BOSS_ROTATION]);
});
test('changing every appearance seed cannot change combat or consume family/world RNG',()=>{
 const a=createGame(84);a.day=12;a.completed=11;a.wave=generateWave(a);applyCommand(a,{type:'NIGHT'});
 const b=JSON.parse(JSON.stringify(a));b.wave.entries.forEach((e,i)=>e.appearanceSeed=i);const x=new BattleSimulation(a),y=new BattleSimulation(b);
 const outcome=z=>({tick:z.tick,gate:z.gate,outcome:z.outcome,shots:z.shots,enemies:z.enemies.map(({appearanceSeed,...e})=>e)});
 for(let i=0;i<10000&&!x.outcome;i++){x.step();y.step();assert.deepEqual(outcome(x),outcome(y));}
 assert(x.outcome);assert.deepEqual(x.base.rng,y.base.rng);
});
test('saved night and chief summons replay identical appearances, bounded enemy pool',()=>{
 const s=createGame(15);s.day=12;s.completed=11;s.legacy.bestNight=11;s.wave=generateWave(s);s.gate=200;applyCommand(s,{type:'NIGHT'});
 const values=new Map(),port={read:k=>values.get(k)||null,write:(k,v)=>values.set(k,v)};const store=new SaveStore(port);store.inspect();store.prepare(s);store.commit();
 const loaded=new SaveStore(port).inspect();assert.equal(loaded.kind,'ready');assert.deepEqual(loaded.state.wave,s.wave);
 const a=new BattleSimulation(s),b=new BattleSimulation(loaded.state);let sawSummon=false;
 for(let i=0;i<10000&&!a.outcome;i++){a.step();b.step();assert.deepEqual(a.enemies,b.enemies);assert(a.enemies.length<=40);if(a.enemies.some(e=>e.summoned))sawSummon=true;}
 // A no-tower wave may breach before the chief's first summon; independently isolate the same saved chief for its full quota.
 for(const battle of [a,b]){battle.outcome=null;battle.gate=100000;battle.enemies=[];battle.cursor=battle.base.wave.entries.length;battle.queued=[];battle.base.towers.forEach(t=>{t.kind=null;t.operator=null;});battle.spawn('enemy_chief',0,123);}
 for(let i=0;i<260;i++){a.step();b.step();assert.deepEqual(a.enemies,b.enemies);if(a.enemies.some(e=>e.summoned))sawSummon=true;}
 assert(sawSummon);assert.equal(a.enemies.filter(e=>e.kind==='enemy_raider').length,4);
});
test('presentation programming error remains the original error, never a retryable download failure',async()=>{
 const r=new ResourcePreparation({download:async()=>true,decode:async()=>{}}),error=new Error('broken UI');r.changed=()=>{throw error;};
 await assert.rejects(r.ensure('characters'),e=>e===error);assert.notEqual(r.states.characters.phase,'FAILED');r.destroy();
});
