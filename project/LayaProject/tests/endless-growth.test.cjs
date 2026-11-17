const {test}=require('node:test'), assert=require('node:assert/strict'), path=require('node:path');
const read=file=>require(path.join(process.env.DAIDAI_TEST_BUILD,file));
const {createGame,applyCommand,capacity,economy,finishNight}=read('game/VillageRules');
const {RULE,PADS,ENEMIES}=read('game/GameConfig');
const {residentialCost,storageCapacity,upgradeCost}=read('game/Growth');
const {validateState}=read('storage/StateValidation');
const {SaveStore}=read('storage/SaveStore');
const {VisibleResidents}=read('view/VisibleResidents');
const {VillagerMotion}=read('view/VillagerMotion');
const {generateWave}=read('game/WaveGenerator');
const {BattleSimulation}=read('game/BattleSimulation');
const {tacticRevealed}=read('game/Tactics');
const {TACTICS}=read('config/TacticConfig');

function population(count=107) {
 const s=createGame(7), templates=s.people;
 s.houses=100;s.housing=25;s.farm=110;s.logging=110;s.families=[];
 s.people=Array.from({length:count},(_,i)=>({...structuredClone(templates[i%templates.length]),id:`${s.run}:${i+1}`,job:i%2?'LOGGING':'FARM',careChild:null}));
 s.nextPerson=count+1;s.food=s.wood=storageCapacity(s);return s;
}
test('residential expansion reaches exactly 100 with capacity 107 and one atomic dual-resource payment',()=>{
 const s=createGame(7);assert.equal(s.houses,1);assert.equal(capacity(s),8);s.housing=25;
 for(let level=1;level<100;level++){
  const cost=residentialCost(level);s.food=cost.food;s.wood=cost.wood;
  applyCommand(s,{type:'BUILD',kind:'HOUSE'});assert.equal(s.houses,level+1);assert.equal(capacity(s),8+level);assert.equal(s.food+s.wood,0);
 }
 assert.equal(s.people.length,6);assert.equal(capacity(s),107);
 const before=JSON.stringify(s);assert.throws(()=>applyCommand(s,{type:'BUILD',kind:'HOUSE'}));assert.equal(JSON.stringify(s),before);
 for(const level of [1,5,50,100,10000]){s.housing=level;const c=upgradeCost('HOUSING',level);assert(Math.max(c.food,c.wood)<=storageCapacity(s));}
});
test('full population saves and settles food, work and ageing even when only twenty residents are displayed',()=>{
 const s=population(),selection=new VisibleResidents();validateState(s);
 const original=JSON.stringify(s),shown=selection.select(s,s.towers,[]);
 assert(shown.length<=20);assert.equal(JSON.stringify(s),original);
 const production=economy(s),small=economy({...s,people:shown});
 assert(production.food>small.food*3);assert(production.wood>small.wood*3);assert(production.rations>small.rations*3);
 const values=new Map(),port={read:k=>values.get(k)??null,write:(k,v)=>values.set(k,v)};
 const save=new SaveStore(port);save.inspect();save.prepare(s);save.commit();assert.equal(new SaveStore(port).inspect().state.people.length,107);
 const food=s.food,wood=s.wood,nights=new Map(s.people.map(p=>[p.id,p.nights]));
 applyCommand(s,{type:'NIGHT'});assert.equal(s.food,Math.min(storageCapacity(s),food+production.food-production.rations));assert.equal(s.wood,Math.min(storageCapacity(s),wood+production.wood));
 finishNight(s,s.gate,s.towers.map(t=>t.operator));
 assert.equal(s.people.length,107);for(const p of s.people)assert.equal(p.nights,nights.get(p.id)-1);validateState(s);
});
test('display selection stays bounded and stable through population, care and day/night changes',()=>{
 const s=population(),motion=new VillagerMotion();const before=JSON.stringify(s);
 motion.sync(s,s.towers);const ids=motion.visiblePeople.map(p=>p.id);motion.sync(s,s.towers);assert.deepEqual(motion.visiblePeople.map(p=>p.id),ids);
 for(let i=0;i<20;i++){s.phase=i%2?'DAY':'NIGHT';motion.sync(s,s.towers);motion.update(.1);assert(motion.count<=20);assert.equal(s.people.length,107);}
 s.phase='DAY';assert.equal(JSON.stringify(s),before);
 const carer=s.people[100],child=s.people[101];carer.job='CARE';carer.careChild=child.id;child.adult=false;child.growth=0;child.job='WAITING';child.nights=0;child.skill=null;
 const selector=new VisibleResidents(),selected=selector.select(s,s.towers,[carer.id]);
 assert(selected.includes(carer)&&selected.includes(child));assert(selected.length<=20);
});
test('three consecutive logging couples all celebrate without exceeding four displayed logging workers',()=>{
 const s=createGame(7);s.families=[];s.logging=7;s.people.forEach(p=>p.job='LOGGING');
 const motion=new VillagerMotion();motion.sync(s,s.towers);
 for(let i=0;i<3;i++)applyCommand(s,{type:'FAMILY',a:s.people[i*2].id,b:s.people[i*2+1].id});
 motion.sync(s,s.towers);
 const celebrated=new Set();
 for(let i=0;i<2400;i++){
  // 模拟真实世界推进：没有面板刷新，只在婚礼完成发出重选信号时同步。
  if(motion.update(.1))motion.sync(s,s.towers);
  assert(motion.visiblePeople.filter(p=>p.job==='LOGGING').length<=4);
  for(const p of motion.visiblePeople)if(motion.get(p.id).heartElapsed!==null)celebrated.add(p.id);
 }
 assert.equal(celebrated.size,6);assert.equal(s.families.length,3);
});
test('five pads start with two towers and validate all five occupants',()=>{
 const s=createGame(7);assert.equal(PADS.length,5);assert.equal(s.towers.length,5);assert.equal(s.towers.filter(t=>t.kind).length,2);
 s.housing=3;s.wood=500;s.food=300;for(let i=2;i<5;i++)applyCommand(s,{type:'TOWER',index:i,kind:'ARROW'});
 assert(s.towers.every(t=>t.kind&&t.operator));assert.equal(new Set(s.towers.map(t=>t.operator)).size,5);validateState(s);
 const b=structuredClone(s);b.towers.pop();assert.throws(()=>validateState(b));
});
test('quantity curve grows within fixed budgets and a full on-screen queue never drops pending enemies',()=>{
 const {WAVE}=read('config/DefenseConfig');
 const counts=[];
 for(const day of [1,13,37,73,301,1000001]){
  const s=createGame(7);s.day=day;s.completed=day-1;s.legacy.bestNight=s.completed;s.tier=3;s.wave=generateWave(s);
  const expected=Math.min(WAVE.spawnWindowTicks.maximum,Math.max(WAVE.spawnWindowTicks.minimum,
   RULE.spawnTicks+Math.max(0,s.wave.entries.length-WAVE.spawnCountThreshold)*WAVE.extraSpawnTicks));
  assert(s.wave.entries.length<=RULE.planCap);assert.equal(s.wave.entries.at(-1).tick,expected);
  validateState(s);counts.push(s.wave.entries.length);
 }
 const historical=createGame(7);historical.wave.entries.at(-1).tick=WAVE.maxSpawnTicks;
 validateState(historical);applyCommand(historical,{type:'NIGHT'});
 assert.equal(new BattleSimulation(historical).base.wave.entries.at(-1).tick,960);
 assert(counts[3]>counts[0]*2);assert(counts.at(-1)<=85);
 const s=createGame(7);applyCommand(s,{type:'NIGHT'});s.towers.forEach(t=>{t.kind=null;t.level=0;t.operator=null;});
 s.wave={budget:100*ENEMIES.enemy_raider.cost,tier:s.tier,affix:'NONE',entries:Array.from({length:100},(_,i)=>({kind:'enemy_raider',tick:0,appearanceSeed:i}))};
 const b=new BattleSimulation(s);let emitted=0;
 for(let i=0;i<3;i++){b.step();assert(b.enemies.length<=40);emitted+=b.enemies.length;b.enemies=[];}
 assert.equal(emitted,100);assert.equal(b.cursor,100);b.step();assert.equal(b.outcome,'WIN');
});
test('skills are revealed at twelve, thirty-six and seventy-two wins, while inherited skills stay visible',()=>{
 const s=createGame(7), ids=TACTICS.map(t=>t.id);
 for(const [wins,count]of [[0,1],[11,1],[12,2],[35,2],[36,3],[71,3],[72,4]]){s.completed=wins;assert.equal(ids.filter(id=>tacticRevealed(s,id)).length,count);}
 s.completed=0;s.tactics.learned.push(ids[3]);assert(tacticRevealed(s,ids[3]));assert(!tacticRevealed(s,ids[2]));
});
