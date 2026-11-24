const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const root=process.env.DAIDAI_TEST_BUILD;
const {createGame,applyCommand}=require(path.join(root,'game/VillageRules'));
const {generateWave}=require(path.join(root,'game/WaveGenerator'));
const {BattleSimulation,PATH_LENGTH}=require(path.join(root,'game/BattleSimulation'));
const {validateState}=require(path.join(root,'storage/StateValidation'));
const {SaveStore}=require(path.join(root,'storage/SaveStore'));
const {ENEMIES,RULE}=require(path.join(root,'game/GameConfig'));
const {enemyPower}=require(path.join(root,'game/Growth'));
const {waveArrivalTick,waveDifficulty}=require(path.join(root,'game/WaveDifficulty'));
const {FIXED_NIGHT,WAVE,WAVE_PROGRESSION,WAVE_RHYTHM}=require(path.join(root,'config/DefenseConfig'));
test('fixed highest challenge at yearly boundaries can save, load, replay and end within enemy limits',()=>{
 for(const seed of [1,7,123])for(const day of [1,12,13,24,25,36,300,2999,3000]){
  const s=createGame(seed);Object.assign(s,{day,completed:day-1});s.legacy.bestNight=day-1;s.wave=generateWave(s);
  assert.equal(s.tier,RULE.maxTier);assert.equal(s.wave.tier,RULE.maxTier);
  validateState(s);assert.equal(s.wave.entries.length,waveDifficulty(day).count);applyCommand(s,{type:'NIGHT'});
  const values=new Map(),port={read:k=>values.get(k)||null,write:(k,v)=>values.set(k,v)};
  const store=new SaveStore(port);store.inspect();store.prepare(s);store.commit();const loaded=new SaveStore(port).inspect();
  assert.equal(loaded.kind,'ready');const a=new BattleSimulation(s),b=new BattleSimulation(loaded.state);
  let cursor=0;
  while(!a.outcome&&a.tick<12000){const tick=a.tick;a.step();b.step();
   while(cursor<a.base.wave.entries.length&&a.base.wave.entries[cursor].tick<=tick)cursor++;
   assert.equal(a.pendingCount,a.base.wave.entries.length-cursor);
  }
  assert(a.outcome);assert.deepEqual([a.outcome,a.gate,a.tick],[b.outcome,b.gate,b.tick]);
 }
});
test('first night uses highest-tier quantity and stays winnable across founding seeds',()=>{
 for(let seed=1;seed<=20;seed++){
  const s=createGame(seed);assert.equal(s.wave.entries.length,51);assert(s.wave.entries.every(e=>e.kind==='enemy_raider'));
  applyCommand(s,{type:'NIGHT'});const b=new BattleSimulation(s);
  b.step();assert.equal(b.enemies[0].maxHp,35);
  while(!b.outcome&&b.tick<12000)b.step();assert.equal(b.outcome,'WIN');assert.equal(b.gate,s.gate);
 }
});
test('only newly planned nights spread arrivals progressively during the first six nights',()=>{
 const newTicks=[1288,1428,1574,1726,1882,2044,2094],previousTicks=[1288,1322,1358,1392,1426,1460,1494];
 for(let day=1;day<=newTicks.length;day++){
  const s=createGame(7);s.day=day;const wave=generateWave(s);
  assert.equal(wave.rhythm,WAVE_RHYTHM.fixed);
  assert.equal(wave.entries.at(-1).tick,newTicks[day-1]);
  assert.equal(waveDifficulty(day,WAVE_RHYTHM.extended).spawnTicks,previousTicks[day-1]);
  assert.equal(wave.entries.length,waveDifficulty(day,WAVE_RHYTHM.extended).count);
 }
});
test('new and pre-marker historical rules replay with their original multipliers',()=>{
 function roundTrip(state){
  const entries=new Map(),port={read:k=>entries.get(k)||null,write:(k,v)=>entries.set(k,v)};
  const store=new SaveStore(port);store.inspect();store.prepare(state);store.commit();
  const loaded=new SaveStore(port).inspect();assert.equal(loaded.kind,'ready');
  assert.deepEqual(loaded.state.wave,state.wave);
  return loaded.state;
 }
 for(const [day,band] of [[1,0],[8,0],[9,1],[12,1]]){
  const fresh=createGame(15);fresh.day=day;fresh.completed=fresh.legacy.bestNight=day-1;fresh.wave=generateWave(fresh);
  fresh.wave.affix="NONE";
  const savedWave=rhythm=>{
   const historical=structuredClone(fresh), plan=waveDifficulty(day,rhythm);
   historical.wave.rhythm=rhythm;
   historical.wave.entries.forEach((e,i,all)=>{e.tick=Math.floor(waveArrivalTick(i,all.length,plan.baseSpawnTicks))*plan.arrivalScale;});
   return historical;
  };
  const lastNightly=savedWave(WAVE_RHYTHM.nightly), extended=savedWave(WAVE_RHYTHM.extended);
  const dense=structuredClone(lastNightly), previous=structuredClone(lastNightly);
  delete dense.wave.rhythm;delete previous.wave.rhythm;
  assert.equal(roundTrip(lastNightly).wave.entries.at(-1).tick,waveDifficulty(day,WAVE_RHYTHM.nightly).spawnTicks);
  dense.wave.ordinaryHealthPercent=WAVE.ordinaryHealth[band];
  previous.wave.ordinaryHealthPercent=WAVE.legacyOrdinaryHealth[band];
  assert.equal(fresh.wave.ordinaryHealthPercent,WAVE_PROGRESSION.ordinaryHealthPercent);
  for(const invalid of [undefined,62,100,106]){
   const malformed=structuredClone(fresh);malformed.wave.ordinaryHealthPercent=invalid;
   assert.throws(()=>validateState(malformed),/波次生命倍率不合法/);
  }
  const unknown=structuredClone(fresh);unknown.wave.rhythm='UNKNOWN';
  assert.throws(()=>validateState(unknown),/波次难度规则无效/);
  for(const state of [fresh,dense,previous,extended]){
   roundTrip(state);applyCommand(state,{type:'NIGHT'});
  }
  for(const kind of ['enemy_raider','enemy_chief']){
   const hp=[],damage=[],speeds=[], data=ENEMIES[kind], difficulty=waveDifficulty(day);
   for(const state of [fresh,dense,previous,extended]){
    const b=new BattleSimulation(roundTrip(state));b.cursor=state.wave.entries.length;
    b.spawn(kind,PATH_LENGTH-.1,1);hp.push(b.enemies[0].maxHp);speeds.push(b.enemies[0].speed);
    b.step();damage.push(state.gate-b.gate);
   }
   const scale = data.boss ? 1 : WAVE.ordinaryGateScale;
   assert.equal(hp[0],Math.ceil(data.hp*(data.boss?1:FIXED_NIGHT.raiderHealth)*(data.boss?difficulty.bossHealth:difficulty.health)*(data.boss?1:.7)));
   assert.equal(speeds[0],data.speed*FIXED_NIGHT.enemySpeed*difficulty.speed);
   assert.equal(damage[0],Math.ceil(data.gate*(data.boss?1:scale*FIXED_NIGHT.ordinaryGateDamage)*difficulty.gate));
   assert.equal(hp[3],Math.ceil(data.hp*(data.boss?difficulty.bossHealth:difficulty.health)*(data.boss?1:.7)));
   assert.equal(speeds[3],data.speed*difficulty.speed);
   assert.equal(damage[3],Math.ceil(data.gate*scale*difficulty.gate));
   assert.equal(hp[1],Math.ceil(data.hp*enemyPower(day)*(data.boss?1:WAVE.ordinaryHealth[band]/100)));
   assert.equal(hp[2],Math.ceil(data.hp*enemyPower(day)*(data.boss?1:WAVE.legacyOrdinaryHealth[band]/100)));
   assert.equal(damage[1],Math.ceil(data.gate*scale*enemyPower(day)));
   assert.equal(damage[2],Math.ceil(data.gate*enemyPower(day)));
  }
 }
});
test('every night increases the enemy budget without a fixed count cap or extra annual bosses',()=>{
 for (const [day,count] of [[1,51],[2,54],[3,57],[4,60],[5,63],[12,84],[60,190],[120,250],[300,430],[1000,1130],[3000,3130]]) {
  const s=createGame(7); s.day=day; s.completed=s.legacy.bestNight=day-1; s.wave=generateWave(s);
  assert.equal(s.wave.entries.length,count);
  assert.equal(s.wave.entries.filter(e=>ENEMIES[e.kind].boss).length,day%12===0?1:0);
  assert.equal(s.wave.entries.at(-1).tick,waveDifficulty(day).spawnTicks);
  validateState(s);
 }
});
test('current saves reject lower difficulty and removed annual choice instead of silently migrating them',()=>{
 for(let tier=0;tier<RULE.maxTier;tier++){
  const s=createGame(1);s.tier=tier;s.wave=generateWave(s);assert.throws(()=>validateState(s));
 }
 const s=createGame(1);s.phase='DAWN';s.wave=null;s.choices=[{kind:'TIER'}];assert.throws(()=>validateState(s));
});

test('a late night consumes the entire extended plan with no fixed arrival cutoff',()=>{
 const s=createGame(71);
 s.day=301;s.completed=s.legacy.bestNight=300;s.wave=generateWave(s);
 assert(s.wave.entries.length>RULE.planCap);
 assert(s.wave.entries.at(-1).tick>WAVE.spawnWindowTicks.maximum);
 s.gateLevel=80;
 s.gate=require(path.join(root,'game/Growth')).gateCapacity(s);
 s.towers.forEach(t=>{if(t.kind)t.level=100;});
 validateState(s);applyCommand(s,{type:'NIGHT'});
 const b=new BattleSimulation(s);
 while(!b.outcome&&b.tick<s.wave.entries.at(-1).tick+1500)b.step();
 assert.equal(b.outcome,'WIN');assert.equal(b.pendingCount,0);
 assert(b.tick>s.wave.entries.at(-1).tick);
});

test('an already planned paired wave retains its older headcount, deadline and stats',()=>{
 const s=createGame(71);s.day=60;s.completed=s.legacy.bestNight=59;
 const current=generateWave(s), old=waveDifficulty(s.day,WAVE_RHYTHM.paired);
 s.wave={...current,affix:'NONE',rhythm:WAVE_RHYTHM.paired,entries:current.entries.slice(0,old.count).map((entry,i)=>({...entry,tick:Math.floor(i*old.spawnTicks/(old.count-1))}))};
 s.wave.entries[0].kind='enemy_raider';
 s.wave.budget=s.wave.entries.reduce((sum,e)=>sum+ENEMIES[e.kind].cost,0);
 validateState(s);applyCommand(s,{type:'NIGHT'});
 // The old wave was already started before automatic appointment.
 s.patrol.captain=null;delete s.night.patrolSquad;delete s.night.patrolSpin;delete s.night.patrolMode;
 validateState(s);
 const b=new BattleSimulation(s);b.step();
 assert.equal(b.enemies[0].maxHp,Math.ceil(ENEMIES[s.wave.entries[0].kind].hp*(ENEMIES[s.wave.entries[0].kind].boss?old.bossHealth:old.health*.7)));
 assert.equal(s.wave.entries.length,189);assert.equal(s.wave.entries.at(-1).tick,966);
 assert.equal(current.entries.length,190);assert.equal(current.entries.at(-1).tick,waveDifficulty(s.day).spawnTicks);
 assert.equal(waveDifficulty(s.day,WAVE_RHYTHM.extended).spawnTicks,2416);
});
