const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const root=process.env.DAIDAI_TEST_BUILD;
const {createGame,applyCommand}=require(path.join(root,'game/VillageRules'));
const {generateWave}=require(path.join(root,'game/WaveGenerator'));
const {BattleSimulation}=require(path.join(root,'game/BattleSimulation'));
const {validateState}=require(path.join(root,'storage/StateValidation'));
const {SaveStore}=require(path.join(root,'storage/SaveStore'));
const {RULE}=require(path.join(root,'game/GameConfig'));
const {WAVE}=require(path.join(root,'config/DefenseConfig'));
test('fixed highest challenge at yearly boundaries can save, load, replay and end within enemy limits',()=>{
 for(const seed of [1,7,123])for(const day of [1,12,13,24,25,36,300,2999,3000]){
  const s=createGame(seed);Object.assign(s,{day,completed:day-1});s.legacy.bestNight=day-1;s.wave=generateWave(s);
  assert.equal(s.tier,RULE.maxTier);assert.equal(s.wave.tier,RULE.maxTier);
  validateState(s);assert(s.wave.entries.length<=RULE.planCap);applyCommand(s,{type:'NIGHT'});
  const values=new Map(),port={read:k=>values.get(k)||null,write:(k,v)=>values.set(k,v)};
  const store=new SaveStore(port);store.inspect();store.prepare(s);store.commit();const loaded=new SaveStore(port).inspect();
  assert.equal(loaded.kind,'ready');const a=new BattleSimulation(s),b=new BattleSimulation(loaded.state);
  while(!a.outcome&&a.tick<12000){a.step();b.step();assert(a.enemies.length<=RULE.enemyCap);}
  assert(a.outcome);assert.deepEqual([a.outcome,a.gate,a.tick],[b.outcome,b.gate,b.tick]);
 }
});
test('first night uses highest-tier quantity and stays winnable across founding seeds',()=>{
 for(let seed=1;seed<=20;seed++){
  const s=createGame(seed);assert.equal(s.wave.entries.length,WAVE.initialCount+WAVE.tierCount*RULE.maxTier);assert(s.wave.entries.every(e=>e.kind==='enemy_raider'));
  applyCommand(s,{type:'NIGHT'});const b=new BattleSimulation(s);while(!b.outcome&&b.tick<12000)b.step();assert.equal(b.outcome,'WIN');
 }
});
test('ordinary health is mandatory in latest saved waves and does not boost boss health',()=>{
 const s=createGame(15);Object.assign(s,{day:12,completed:11});s.legacy.bestNight=11;s.wave=generateWave(s);
 assert.equal(s.wave.ordinaryHealthPercent,106);
 const old=JSON.parse(JSON.stringify(s));delete old.wave.ordinaryHealthPercent;
 function saveBattle(state){
  applyCommand(state,{type:'NIGHT'});
  const entries=new Map(),port={read:k=>entries.get(k)||null,write:(k,v)=>entries.set(k,v)};
  const store=new SaveStore(port);store.inspect();store.prepare(state);store.commit();
  const loaded=new SaveStore(port).inspect();assert.equal(loaded.kind,'ready');
  return new BattleSimulation(loaded.state);
 }
 assert.throws(()=>validateState(old));
 const after=saveBattle(s),before = new BattleSimulation(after.base);
 before.base.wave.ordinaryHealthPercent = WAVE.baseHealthPercent;
 assert.notEqual(before.base.wave.ordinaryHealthPercent,after.base.wave.ordinaryHealthPercent);
 for(const [kind,increased]of [['enemy_raider',true],['enemy_chief',false]]){
  before.spawn(kind,0,1); after.spawn(kind,0,1);
  assert.equal(after.enemies.at(-1).hp>before.enemies.at(-1).hp,increased);
 }
});
test('quality-era pressure adds zero to four mixed enemies on the planned curve',()=>{
 const {season}=require(path.join(root,'game/WaveGenerator'));
 for (const [day,extra] of [[24,0],[25,0],[35,0],[36,1],[48,2],[49,2],[60,3],[72,4],[1000004,4]]) {
  const s=createGame(7); s.day=day; s.completed=s.legacy.bestNight=day-1; s.wave=generateWave(s);
  const baseline=WAVE.initialCount+Math.floor(WAVE.additionalCount*(1-Math.exp(-(day-1)/WAVE.countGrowthNights)))+WAVE.seasonPulse[season(day)]+WAVE.tierCount*RULE.maxTier;
  const patrolSupport = day >= 25 ? 2 : day >= 13 ? 1 : 0;
  assert.equal(s.wave.entries.length,baseline+extra+patrolSupport);
  assert.equal(s.wave.entries.filter(e=>e.kind.startsWith('enemy_')&&['enemy_chief','enemy_commander','enemy_wolfking','enemy_tuskking','enemy_shaman'].includes(e.kind)).length,day%12===0?1:0);
  validateState(s);
 }
});
test('current saves reject lower difficulty and removed annual choice instead of silently migrating them',()=>{
 for(let tier=0;tier<RULE.maxTier;tier++){
  const s=createGame(1);s.tier=tier;s.wave=generateWave(s);assert.throws(()=>validateState(s));
 }
 const s=createGame(1);s.phase='DAWN';s.wave=null;s.choices=[{kind:'TIER'}];assert.throws(()=>validateState(s));
});
