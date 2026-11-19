// Reproducible population/five-tower economy/lifecycle/combat strategy; no resource or lifespan injection.
const root = process.env.DAIDAI_TEST_BUILD;
if (!root) throw new Error('Set DAIDAI_TEST_BUILD to the CommonJS project build under Downloads');
const {createGame,applyCommand,economy,finishNight,canMarry,birthUnavailableReason,capacity}=require(root+'/game/VillageRules');
const {isWorkingAdult}=require(root+'/game/GameState');
const {BattleSimulation}=require(root+'/game/BattleSimulation');
const {gateCapacity,storageCapacity,laborSlots,upgradeCost,residentialCost,enemyPower,levelPower}=require(root+'/game/Growth');
const {validateState}=require(root+'/storage/StateValidation');
const {RULE,PADS,TOWERS}=require(root+'/game/GameConfig');
const {TACTICS}=require(root+'/config/TacticConfig');
const {VILLAGER_QUALITY}=require(root+'/config/VillagerQuality');
const {tacticUnavailableReason}=require(root+'/game/Tactics');

function play(seed, nights=300, verbose=false, options={}) {
 const s=createGame(seed), log=[],learnedAt={},firstQuality={}; let maxPeople=0,maxEnemies=0,births=0,upgrades=0,leakNights=0,hungryNights=0,totalBattleSeconds=0;
 const affordable=c=>s.food>=c.food&&s.wood>=c.wood;
 const upgrade=(kind)=>{const level=kind==='FARM'?s.farm:kind==='LOGGING'?s.logging:kind==='HOUSING'?s.housing:s.gateLevel;
  if(affordable(upgradeCost(kind,level))){applyCommand(s,{type:'BUILD',kind});upgrades++;return true;}return false;};
 for(let d=0;d<nights;d++) {
  for(const p of [...s.people,...s.choices.filter(q=>q.kind==='TRAVELER').map(q=>q.person)])
   if(p.quality!=='COMMON') firstQuality[p.quality] ??= s.day;
  while(s.choices.length){const q=s.choices[0];let value;
   if(q.kind==='SKILL') value=q.options.includes('skill_logging')?'skill_logging':q.options.includes('skill_farming')?'skill_farming':q.options[0];
   else if(q.kind==='POLICY')value=['policy_logging','policy_harvest','policy_tillage','policy_watch','policy_arrows','policy_stones','policy_nurture','policy_patrol'].find(k=>q.options.includes(k))||q.options[0];
   else value=s.people.length<Math.min(options.populationLimit||RULE.populationCap,capacity(s))?'accept':'decline';
   applyCommand(s,{type:'CHOOSE',value});
  }
  if(s.phase==='DAWN')applyCommand(s,{type:'FINALIZE'});
  if(s.farm===1) upgrade('FARM');
  const workers=s.people.filter(isWorkingAdult);
  // Form only eligible families, favour similar remaining lifetimes to avoid an early-retired partner.
  for(const a of workers.filter(p=>p.sex==='MALE')) {
   const candidates=workers.filter(b=>canMarry(s,a,b)).sort((a1,b1)=>Math.abs(a1.nights-a.nights)-Math.abs(b1.nights-a.nights));
   if(candidates.length)applyCommand(s,{type:'FAMILY',a:a.id,b:candidates[0].id});
  }
  if(s.people.length>=capacity(s)-1 && s.houses<RULE.houseMax && affordable(residentialCost(s.houses)) && Math.max(residentialCost(s.houses).wood,residentialCost(s.houses).food)<=storageCapacity(s))applyCommand(s,{type:'BUILD',kind:'HOUSE'});
  for(const f of s.families) {
   if(s.people.length>=Math.min(options.populationLimit||RULE.populationCap,capacity(s))||s.people.filter(p=>!p.adult).length>=Math.max(4,Math.floor(workers.length*.3))||s.food<35)break;
   if(birthUnavailableReason(s,f.id))continue;
   const carers=workers.filter(p=>p.job!=='CARE').sort((a,b)=>Number(b.skill==='skill_nurturing')-Number(a.skill==='skill_nurturing')||Number(a.job==='LOGGING')-Number(b.job==='LOGGING')||b.nights-a.nights);
   if(carers.length){applyCommand(s,{type:'BIRTH',family:f.id,carer:carers[0].id});births++;}
  }
  // Reassign orphaned children; never inject growth or workers.
  for(const child of s.people.filter(p=>!p.adult&&!s.people.some(a=>a.careChild===p.id))){
   const carer=workers.filter(p=>p.job!=='CARE').sort((a,b)=>b.nights-a.nights)[0];
   if(carer)applyCommand(s,{type:'JOB',id:carer.id,job:'CARE',child:child.id});
  }
  if(s.logging<3)upgrade('LOGGING');
  // Share production between wood and food as vacancies grow; all actual adults participate.
  const available=workers.filter(p=>p.job!=='CARE');
  const logTarget=Math.min(laborSlots('LOGGING',s.logging),Math.max(1,Math.floor(available.length*.45)));
  for(const p of available.filter(p=>p.job!=='LOGGING').sort((a,b)=>Number(b.skill==='skill_logging')-Number(a.skill==='skill_logging'))) {
   if(s.people.filter(q=>q.job==='LOGGING').length>=logTarget)break;
   applyCommand(s,{type:'JOB',id:p.id,job:'LOGGING'});
  }
  while(s.people.filter(q=>q.job==='LOGGING').length>logTarget){const p=s.people.find(q=>q.job==='LOGGING'&&q.skill!=='skill_logging')||s.people.find(q=>q.job==='LOGGING');
   if(s.people.filter(q=>q.job==='FARM').length>=laborSlots('FARM',s.farm))break;
   applyCommand(s,{type:'JOB',id:p.id,job:'FARM'});
  }
  // Keep economic growth ahead of defence, and expand storage before any upgrade can exceed it.
  const target=Math.max(2,Math.ceil(Math.sqrt(s.day)*.9)+1);
  if(Math.max(...['FARM','LOGGING','GATE'].map(k=>upgradeCost(k,k==='FARM'?s.farm:k==='LOGGING'?s.logging:s.gateLevel).wood))>storageCapacity(s)*.8)upgrade('HOUSING');
  if(s.logging<target+2)upgrade('LOGGING');
  if(economy(s).food-economy(s).rations<Math.max(12,s.logging*5)||s.farm<target)upgrade('FARM');
  if(s.people.filter(isWorkingAdult).length>=4)for(let i=0;i<PADS.length;i++){
   const kind=options.towerKind || (i===2?'SLOW':'ARROW');
   if(!s.towers[i].kind&&s.wood>=TOWERS[kind].cost)applyCommand(s,{type:'TOWER',index:i,kind});
  }
  const operators=workers.slice();
  for(let i=0;i<s.towers.length;i++){const t=s.towers[i];if(!t.kind)continue;
   operators.sort((a,b)=>Number(b.skill===(t.kind==='STONE'?'skill_throwing':t.kind==='SLOW'?'skill_warding':'skill_archery'))-Number(a.skill===(t.kind==='STONE'?'skill_throwing':t.kind==='SLOW'?'skill_warding':'skill_archery'))||VILLAGER_QUALITY[b.quality].damage-VILLAGER_QUALITY[a.quality].damage||b.nights-a.nights);
   if(operators.length)applyCommand(s,{type:'OPERATOR',index:i,id:operators.shift().id});
  }
  for(const i of [1,0,3,4,2]){const t=s.towers[i]; if(t.kind&&t.level<target&&affordable(upgradeCost('TOWER',t.level))){applyCommand(s,{type:'UPGRADE',index:i});upgrades++;}}
  // Fortify before a sparse generation meets the annual chief; waiting for damage can be too late.
  const gateTarget=workers.length<4?target:Math.ceil(target/2);
  if(s.gateLevel<gateTarget||s.gateLevel<target&&s.gate<gateCapacity(s)*.8)upgrade('GATE');
  while(s.gate<gateCapacity(s)*.95&&s.wood>=10+5*(s.gateLevel-1))applyCommand(s,{type:'REPAIR'});
  if(options.learnSkills)for(const tactic of TACTICS)if(!tacticUnavailableReason(s,tactic.id,'LEARN')){applyCommand(s,{type:'TACTIC_LEARN',id:tactic.id});learnedAt[tactic.id]=s.completed;}
  if(options.tactic&&s.tactics.learned.includes(options.tactic)&&s.tactics.equipped!==options.tactic)applyCommand(s,{type:'TACTIC_EQUIP',id:options.tactic});
  if(economy(s).hungry)hungryNights++;
  const gateBefore=s.gate;
  validateState(s);applyCommand(s,{type:'NIGHT'});const b=new BattleSimulation(s);
  while(!b.outcome&&b.tick<12000){if(options.useSkill!==false&&(b.enemies.some(e=>require(root+'/game/GameConfig').ENEMIES[e.kind].boss)||b.enemies.length>=10))b.bell(); b.step();maxEnemies=Math.max(maxEnemies,b.enemies.length);}
  if(!b.outcome)throw new Error('battle did not finish');
  if(b.gate<gateBefore)leakNights++;totalBattleSeconds+=b.tick*RULE.step;
  maxPeople=Math.max(maxPeople,s.people.length);
  const row={day:s.day,food:s.food,wood:s.wood,pop:s.people.length,adults:workers.length,children:s.people.filter(p=>!p.adult).length,farm:s.farm,logging:s.logging,housing:s.housing,houses:s.houses,capacity:capacity(s),gateLevel:s.gateLevel,towers:s.towers.map(t=>t.level),gate:b.gate,outcome:b.outcome};
  if(verbose||s.day%50===0||b.outcome==='LOSE')log.push(row);
  finishNight(s,b.gate,b.operators);validateState(s); if(b.outcome==='LOSE')break;
 }
 return {seed,completed:s.completed,births,retired:s.stats.retirees,upgrades,maxPeople,maxEnemies,leakNights,hungryNights,averageBattleSeconds:totalBattleSeconds/(s.completed+(s.phase==='GAME_OVER'?1:0)),learned:s.tactics.learned,learnedAt,firstQuality,log};
}
if(require.main===module){for(const seed of [1,2,3,11,123])console.log(JSON.stringify(play(seed,Number(process.argv[2]||300),!!process.env.VERBOSE)));}
module.exports={play};
