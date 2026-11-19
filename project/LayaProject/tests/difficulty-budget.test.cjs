const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const root=process.env.DAIDAI_TEST_BUILD;
const {createGame,applyCommand}=require(path.join(root,'game/VillageRules'));
const {generateWave}=require(path.join(root,'game/WaveGenerator'));
const {BattleSimulation,PATH_LENGTH}=require(path.join(root,'game/BattleSimulation'));
const {validateState}=require(path.join(root,'storage/StateValidation'));
const {SaveStore}=require(path.join(root,'storage/SaveStore'));
const {ENEMIES,RULE}=require(path.join(root,'game/GameConfig'));
const {enemyPower}=require(path.join(root,'game/Growth'));
const {WAVE}=require(path.join(root,'config/DefenseConfig'));
test('fixed highest challenge at yearly boundaries can save, load, replay and end within enemy limits',()=>{
 for(const seed of [1,7,123])for(const day of [1,12,13,24,25,36,300,2999,3000]){
  const s=createGame(seed);Object.assign(s,{day,completed:day-1});s.legacy.bestNight=day-1;s.wave=generateWave(s);
  assert.equal(s.tier,RULE.maxTier);assert.equal(s.wave.tier,RULE.maxTier);
  validateState(s);assert(s.wave.entries.length<=RULE.planCap);applyCommand(s,{type:'NIGHT'});
  const values=new Map(),port={read:k=>values.get(k)||null,write:(k,v)=>values.set(k,v)};
  const store=new SaveStore(port);store.inspect();store.prepare(s);store.commit();const loaded=new SaveStore(port).inspect();
  assert.equal(loaded.kind,'ready');const a=new BattleSimulation(s),b=new BattleSimulation(loaded.state);
  while(!a.outcome&&a.tick<12000){const tick=a.tick;a.step();b.step();assert.equal(a.pendingCount,a.base.wave.entries.filter(e=>e.tick>tick).length);}
  assert(a.outcome);assert.deepEqual([a.outcome,a.gate,a.tick],[b.outcome,b.gate,b.tick]);
 }
});
test('first night uses highest-tier quantity and stays winnable across founding seeds',()=>{
 for(let seed=1;seed<=20;seed++){
  const s=createGame(seed);assert.equal(s.wave.entries.length,51);assert(s.wave.entries.every(e=>e.kind==='enemy_raider'));
  applyCommand(s,{type:'NIGHT'});const b=new BattleSimulation(s);while(!b.outcome&&b.tick<12000)b.step();assert.equal(b.outcome,'WIN');
 }
});
test('only the current and historical band can be saved and replayed; boss health and gate impact stay intact',()=>{
 function roundTrip(state){
  const entries=new Map(),port={read:k=>entries.get(k)||null,write:(k,v)=>entries.set(k,v)};
  const store=new SaveStore(port);store.inspect();store.prepare(state);store.commit();
  const loaded=new SaveStore(port).inspect();assert.equal(loaded.kind,'ready');
  assert.deepEqual(loaded.state.wave,state.wave);
  return loaded.state;
 }
 for(const [day,band] of [[1,0],[8,0],[9,1],[12,1]]){
  const fresh=createGame(15);fresh.day=day;fresh.completed=fresh.legacy.bestNight=day-1;fresh.wave=generateWave(fresh);
  const previous=structuredClone(fresh);
  previous.wave.ordinaryHealthPercent=WAVE.legacyOrdinaryHealth[band];
  assert.equal(fresh.wave.ordinaryHealthPercent,WAVE.ordinaryHealth[band]);
  for(const invalid of [undefined,WAVE.ordinaryHealth[1-band],WAVE.legacyOrdinaryHealth[1-band]]){
   const malformed=structuredClone(fresh);malformed.wave.ordinaryHealthPercent=invalid;
   assert.throws(()=>validateState(malformed),/波次生命倍率不合法/);
  }
  for(const state of [fresh,previous]){
   roundTrip(state);applyCommand(state,{type:'NIGHT'});
  }
  for(const kind of ['enemy_raider','enemy_chief']){
   const hp=[],damage=[];
   for(const state of [fresh,previous]){
    const b=new BattleSimulation(roundTrip(state));b.cursor=state.wave.entries.length;
    b.spawn(kind,PATH_LENGTH-.1,1);hp.push(b.enemies[0].maxHp);
    b.step();damage.push(state.gate-b.gate);
   }
   if(ENEMIES[kind].boss){
    assert.equal(hp[0],hp[1]);assert.equal(damage[0],damage[1]);
   }else{
    assert(hp[0]<hp[1]);assert.equal(damage[0],Math.ceil(ENEMIES[kind].gate*WAVE.ordinaryGateScale*enemyPower(day)));
    assert.equal(damage[1],Math.ceil(ENEMIES[kind].gate*enemyPower(day)));
   }
  }
 }
});
test('total wave budget triples seasonal, quality and patrol additions, with one annual boss',()=>{
 const {season}=require(path.join(root,'game/WaveGenerator'));
 for (const [day,extra] of [[24,0],[25,0],[35,0],[36,1],[48,2],[49,2],[60,3],[72,4],[1000004,4]]) {
  const s=createGame(7); s.day=day; s.completed=s.legacy.bestNight=day-1; s.wave=generateWave(s);
  const baseline=WAVE.initialCount+Math.floor(WAVE.additionalCount*(1-Math.exp(-(day-1)/WAVE.countGrowthNights)))+WAVE.seasonPulse[season(day)]+WAVE.tierCount*RULE.maxTier;
  const patrolSupport = day >= 25 ? 2 : day >= 13 ? 1 : 0;
  assert.equal(s.wave.entries.length,WAVE.density*(baseline+extra+patrolSupport));
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
