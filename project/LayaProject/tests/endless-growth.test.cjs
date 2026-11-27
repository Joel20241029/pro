const {test}=require('node:test'), assert=require('node:assert/strict'), path=require('node:path');
const read=file=>require(path.join(process.env.DAIDAI_TEST_BUILD,file));
const {createGame,applyCommand,capacity,economy,finishNight}=read('game/VillageRules');
const {RULE,PADS,ENEMIES}=read('game/GameConfig');
const {residentialCost,sewingSlots}=read('game/Growth');
const {validateState}=read('storage/StateValidation');
const {SaveStore}=read('storage/SaveStore');
const {VisibleResidents}=read('view/VisibleResidents');
const {VillagerMotion}=read('view/VillagerMotion');
const {generateWave}=read('game/WaveGenerator');
const {waveDifficulty}=read('game/WaveDifficulty');
const {BattleSimulation}=read('game/BattleSimulation');
const {tacticRevealed}=read('game/Tactics');
const {TACTICS}=read('config/TacticConfig');

test('grouped waves stagger their three arrivals within the existing wave window',()=>{
 const {WAVE}=read('config/DefenseConfig');
 const candidates=Array.from({length:40},(_,i)=>{
  const s=createGame(i+1);s.day=12;s.completed=11;s.tier=3;return generateWave(s);
 });
 const wave=candidates.find(w=>w.affix==='GROUP');
 assert(wave);
 const ticks=wave.entries.map(entry=>entry.tick);
 const expected=waveDifficulty(12).spawnTicks;
 assert.equal(ticks[0],0);assert.equal(ticks.at(-1),expected);
 assert(ticks.every((t,i)=>!i||t>ticks[i-1]));
 assert(ticks[WAVE.groupSize]-ticks[WAVE.groupSize-1]>ticks[1]-ticks[0]);
 assert.equal(wave.entries.filter(e=>ENEMIES[e.kind].boss).length,1);
});

function population(count=107) {
 const s=createGame(7), templates=s.people;
 s.houses=100;s.factory.level=52;s.families=[];
 s.people=Array.from({length:count},(_,i)=>({...structuredClone(templates[i%templates.length]),id:`${s.run}:${i+1}`,job:'SEWING'}));
 s.nextPerson=count+1;s.coins=500;return s;
}
test('residential expansion ends at capacity 107 with one exact coin payment each',()=>{
 const s=createGame(7);assert.equal(s.houses,1);assert.equal(capacity(s),8);
 for(let level=1;level<100;level++){
  const cost=residentialCost(level);s.coins=cost.coins;
  applyCommand(s,{type:'BUILD',kind:'HOUSE'});assert.equal(s.houses,level+1);assert.equal(capacity(s),8+level);assert.equal(s.coins,0);
 }
 assert.equal(s.people.length,6);assert.equal(capacity(s),107);
 s.coins=1000000;const before=JSON.stringify(s);
 assert.throws(()=>applyCommand(s,{type:'BUILD',kind:'HOUSE'}));assert.equal(JSON.stringify(s),before);validateState(s);
});
test('full population saves, settles coins and ages all adults even if only a subset is displayed',()=>{
 const s=population(),selection=new VisibleResidents();validateState(s);
 const original=JSON.stringify(s),shown=selection.select(s,s.towers,[]);
 assert(shown.length<=20);assert.equal(JSON.stringify(s),original);assert.equal(sewingSlots(s.factory.level),107);
 const production=economy(s);
 assert.equal(production.sewing,15);
 const values=new Map(),port={read:k=>values.get(k)??null,write:(k,v)=>values.set(k,v)};
 const save=new SaveStore(port);save.inspect();save.prepare(s);save.commit();assert.equal(new SaveStore(port).inspect().state.people.length,107);
 const coins=s.coins,nights=new Map(s.people.map(p=>[p.id,p.nights]));
 applyCommand(s,{type:'NIGHT'});assert.equal(s.coins,coins);
 finishNight(s,s.gate,s.towers.map(t=>t.operator));assert.equal(s.coins,coins+production.total);
 assert.equal(s.people.length,107);for(const p of s.people)assert.equal(p.nights,nights.get(p.id)-1);validateState(s);
});
test('display selection remains bounded and stable through population and day/night changes',()=>{
 const s=population(),motion=new VillagerMotion();const before=JSON.stringify(s);
 motion.sync(s,s.towers);const ids=motion.visiblePeople.map(p=>p.id);motion.sync(s,s.towers);assert.deepEqual(motion.visiblePeople.map(p=>p.id),ids);
 for(let i=0;i<20;i++){s.phase=i%2?'DAY':'NIGHT';motion.sync(s,s.towers);motion.update(.1);assert(motion.count<=20);assert.equal(s.people.length,107);}
 s.phase='DAY';assert.equal(JSON.stringify(s),before);
 const worker=s.people[100];
 const selector=new VisibleResidents(),selected=selector.select(s,s.towers,[worker.id]);
 assert(selected.includes(worker));assert(selected.length<=20);
});
test('three consecutive weddings retain six appearances while workers return to their stations',()=>{
 const s=createGame(7);s.families=[];
 const motion=new VillagerMotion();motion.sync(s,s.towers);
 for(let i=0;i<3;i++)applyCommand(s,{type:'FAMILY',a:s.people[i*2].id,b:s.people[i*2+1].id});
 motion.sync(s,s.towers);
 const celebrated=new Set();
 for(let i=0;i<2400;i++){
  if(motion.update(.1))motion.sync(s,s.towers);
  assert(motion.visiblePeople.filter(p=>motion.get(p.id).clip==='sewing').length<=3);
  for(const p of motion.visiblePeople)if(motion.get(p.id).heartElapsed!==null)celebrated.add(p.id);
 }
 assert.equal(celebrated.size,6);assert.equal(s.families.length,3);
});
test('five pads start with two towers and validate all five occupants',()=>{
 const s=createGame(7);assert.equal(PADS.length,5);assert.equal(s.towers.length,5);assert.equal(s.towers.filter(t=>t.kind).length,2);
 s.houses=3;s.coins=500;for(let i=2;i<5;i++)applyCommand(s,{type:'TOWER',index:i,kind:'ARROW'});
 assert(s.towers.every(t=>t.kind&&t.operator));assert.equal(new Set(s.towers.map(t=>t.operator)).size,5);validateState(s);
 const b=structuredClone(s);b.towers.pop();assert.throws(()=>validateState(b));
});
test('extended batches keep growing and new waves do not wait at the legacy field limit',()=>{
 const {WAVE}=read('config/DefenseConfig');
 const counts=[];
 for(const day of [1,13,37,73,301,10001]){
  const s=createGame(7);s.day=day;s.completed=day-1;s.legacy.bestNight=s.completed;s.tier=3;s.wave=generateWave(s);
  const expected=waveDifficulty(day);
  assert.equal(s.wave.entries.length,expected.count);assert.equal(s.wave.entries.at(-1).tick,expected.spawnTicks);
  validateState(s);counts.push(s.wave.entries.length);
 }
 const historical=createGame(7);delete historical.wave.rhythm;historical.wave.entries.at(-1).tick=WAVE.spawnWindowTicks.maximum+1;
 assert.throws(()=>validateState(historical));
 assert.equal(counts[0],51);assert(counts[3]>counts[0]*2);assert(counts.at(-1)>5000);
 const s=createGame(7);applyCommand(s,{type:'NIGHT'});s.towers.forEach(t=>{t.kind=null;t.level=0;t.operator=null;});
 const allAtOnce=96;
 s.wave.entries=Array.from({length:allAtOnce},(_,i)=>({kind:'enemy_raider',tick:0,appearanceSeed:i}));
 s.wave.budget=allAtOnce*ENEMIES.enemy_raider.cost;
 const b=new BattleSimulation(s);b.step();
 assert.equal(b.enemies.length,allAtOnce);assert.equal(b.pendingCount,0);assert.equal(b.outcome,null);
 assert.deepEqual(b.enemies.map(enemy=>enemy.appearanceSeed),s.wave.entries.map(entry=>entry.appearanceSeed));
 delete s.wave.rhythm;
 s.wave.ordinaryHealthPercent=WAVE.legacyOrdinaryHealth[0];
 const old=new BattleSimulation(s);let emitted=0;
 while(old.pendingCount){old.step();assert(old.enemies.length<=RULE.legacyEnemyCap);emitted+=old.enemies.length;old.enemies=[];}
 assert.equal(emitted,allAtOnce);old.step();assert.equal(old.outcome,'WIN');
});
test('skills are revealed every five wins, while inherited skills stay visible',()=>{
 const s=createGame(7), ids=TACTICS.map(t=>t.id);
 for(const [wins,count]of [[0,1],[4,1],[5,2],[9,2],[10,3],[14,3],[15,4],[19,4],[20,5],[24,5],[25,6],[29,6],[30,7],[34,7],[35,8],[39,8],[40,9],[44,9],[45,10]]){s.completed=wins;assert.equal(ids.filter(id=>tacticRevealed(s,id)).length,count);}
 s.completed=0;s.tactics.learned.push(ids[3]);assert(tacticRevealed(s,ids[3]));assert(!tacticRevealed(s,ids[2]));
});
