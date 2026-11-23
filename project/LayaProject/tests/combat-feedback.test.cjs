const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const build=process.env.DAIDAI_TEST_BUILD;
const {createGame,applyCommand}=require(path.join(build,'game/VillageRules'));
const {BattleSimulation,PATH_LENGTH}=require(path.join(build,'game/BattleSimulation'));
const {enemyPoint}=require(path.join(build,'game/BattleRoad'));
const {GameSession}=require(path.join(build,'game/GameSession'));
const {SaveStore}=require(path.join(build,'storage/SaveStore'));
const {CombatPresentation}=require(path.join(build,'view/CombatPresentation'));
const {ProjectileMotion,PROJECTILE_STYLE}=require(path.join(build,'view/ProjectileMotion'));
const {LoggingFeedback}=require(path.join(build,'view/LoggingFeedback'));
const {FEEDBACK}=require(path.join(build,'view/config/FeedbackConfig'));
const {RULE,PADS,TOWERS}=require(path.join(build,'game/GameConfig'));
function battle(kind='ARROW') {const s=createGame(7);applyCommand(s,{type:'NIGHT'});const b=new BattleSimulation(s);b.patrol=null; b.base.towers.forEach((t,i)=>{t.kind=i===0?kind:null;t.operator=i===0?s.people[1].id:null;});b.cursor=b.base.wave.entries.length;return b;}
function enemy(seq,hp=1000,progress=200){return {seq,kind:'enemy_raider',appearanceSeed:87,progress,hp,speed:0,slow:0,slowTicks:0, walkDistance: 0,born:0,summoned:0};}
// Pick an actual close pair so damage and frost tests do not depend on how a particular sequence is distributed.
function nearbyEnemy(target,kind) {
 const at=enemyPoint(target), tower=PADS[0], {range,splash}=TOWERS[kind];
 const match=Array.from({length:32},(_,i)=>enemy(20+i,1000,target.progress+5)).find(candidate=>{
  const p=enemyPoint(candidate);
  return Math.hypot(p.x-at.x,p.y-at.y)<splash&&Math.hypot(p.x-tower.x,p.y-tower.y)<range;
 });
 assert(match,'expected a real splash neighbor');return match;
}
function shot(tick,kind='ARROW'){return {tower:0,x:300,y:400,kind,tick};}
test('patrol hit clock belongs to the target through movement, a finishing blow and battle replacement',()=>{
 const b=battle(),f=new CombatPresentation(),a=enemy(1),c=enemy(2);
 const hit=(enemy,tick)=>({type:'patrol',tick,enemy:{...enemy},index:tick,at:enemyPoint(enemy),dx:0,dy:-1});
 b.enemies=[a,c];f.sync(b,[hit(a,0)]);assert(f.hasPatrolImpact);assert.equal(f.patrolImpactAge(a.seq),0);assert.equal(f.hitShake(a.seq),FEEDBACK.patrolHit.pixels);assert(f.flashing(a.seq));
 a.progress+=20;f.advance(.11);assert.equal(f.patrolImpactAge(a.seq),.11);assert.equal(f.patrolImpactAge(c.seq),undefined);
 b.enemies=[];a.hp=c.hp=0;b.outcome='WIN';f.sync(b,[hit(a,1),hit(c,1)]);
 assert(f.deathPose(a.seq)&&f.deathPose(c.seq));assert.equal(f.patrolImpactAge(a.seq),0);
 f.advance(FEEDBACK.patrolHit.seconds-.01);assert(f.hasPatrolImpact);
 f.advance(.02);assert(!f.hasPatrolImpact);assert(f.deathPose(a.seq));
 f.sync(b,[hit(a,2)]);f.sync(battle(),[]);assert(!f.hasPatrolImpact);
});
test('spin impact pushes each rendered target radially and leaves its combat position intact',()=>{
 const f=new CombatPresentation(),b=battle(),left=enemy(1),right=enemy(2),boss={...enemy(3),kind:'enemy_chief'},legacy=enemy(4);
 b.patrol={spin:{}};
 const hit=(enemy,dx,dy)=>({type:'patrol',tick:0,enemy:{...enemy},index:0,at:enemyPoint(enemy),dx,dy});
 const originals=[left,right,boss].map(enemyPoint);
 f.sync(b,[hit(left,-12,0),hit(right,12,10),hit(boss,0,0)]);
 assert(f.patrolRecoil(left.seq,1).x===0);
 f.advance(FEEDBACK.patrolHit.recoilPeak);
 const lp=f.patrolRecoil(left.seq,1),rp=f.patrolRecoil(right.seq,2),bp=f.patrolRecoil(boss.seq,1);
 assert.equal(lp.x,-FEEDBACK.patrolHit.commonRecoil);
 assert(rp.x>0&&rp.y>rp.x);
 assert(Math.abs(Math.hypot(bp.x,bp.y)-FEEDBACK.patrolHit.bossRecoil)<1e-9);
 assert.deepEqual([left,right,boss].map(enemyPoint),originals);
 f.advance(FEEDBACK.patrolHit.recoilSeconds);
 assert.equal(f.patrolRecoil(left.seq,1),undefined);
 const old=battle();f.sync(old,[hit(legacy,1,1)]);assert.equal(f.patrolRecoil(legacy.seq,1),undefined);
});
test('spin kills somersault to a displaced landing, with one defeat cue and no simulation movement',()=>{
 const f=new CombatPresentation(), b=battle(), victim=enemy(8,0);
 b.patrol={spin:{}};
 const at=enemyPoint(victim),spinDeath=FEEDBACK.patrolDeath;
 f.sync(b,[{type:'patrol',tick:0,enemy:victim,index:0,at,dx:-12,dy:0}]);
 assert.equal(f.deathPose(8),undefined);assert.equal(f.takeDefeatCue(),false);
 f.advance(spinDeath.airSeconds/2);
 assert.equal(f.patrolAir(8).degrees,-180);
 assert.equal(f.patrolAir(8).lift,spinDeath.lift);
 assert.equal(f.patrolRecoil(8,1).x,-spinDeath.distance/2);
 f.advance(spinDeath.airSeconds/2+.03);
 assert.equal(f.patrolAir(8),undefined);assert(f.deathPose(8).scaleY<1);
 assert.equal(f.patrolRecoil(8,1).x,-spinDeath.distance);
 assert.equal(f.takeDefeatCue(),true);assert.equal(f.takeDefeatCue(),false);
 assert.deepEqual(enemyPoint(victim),at);
 f.advance(spinDeath.squashSeconds+spinDeath.holdSeconds+spinDeath.fadeSeconds);
 assert(!f.hasPatrolImpact);assert(!f.deaths.has(8));assert.equal(f.patrolRecoil(8,1),undefined);
});
test('real stone hurt set contains splash victims; slow-only neighbors have no damage event',()=>{
 for(const kind of ['STONE','SLOW']){const b=battle(kind);const target=enemy(10);b.enemies=[target,nearbyEnemy(target,kind)];b.step();const e=b.feedback.find(e=>e.type==='shot');assert(e);assert.equal(e.hurt.length,kind==='STONE'?2:1);if(kind==='SLOW')assert.equal(b.enemies[0].slowTicks,RULE.slowTicks);}
});
test('frost reaches living splash targets at visual impact and clears with the underlying slow',()=>{
 const b=battle('SLOW'),f=new CombatPresentation(),p=new ProjectileMotion(),a=enemy(10),neighbor=nearbyEnemy(a,'SLOW'),far=enemy(12,1000,PATH_LENGTH-1);
 b.enemies=[a,neighbor,far];b.step();
 const e=b.feedback.find(e=>e.type==='shot');
 assert.deepEqual(e.slowed,[a.seq,neighbor.seq]);assert.equal(e.hurt.length,1);
 f.sync(b,b.feedback);p.update(b,undefined,undefined,undefined,f);
 assert(!f.frosted(a.seq)&&!f.frosted(neighbor.seq));
 b.tick+=Math.ceil(PROJECTILE_STYLE.SLOW.flight/RULE.step);
 p.update(b,undefined,undefined,undefined,f);
 assert(f.frosted(a.seq)&&f.frosted(neighbor.seq)&&!f.frosted(far.seq));
 assert(!f.flashing(e.slowed.find(seq=>seq!==e.target)));
 a.slowTicks=0;neighbor.hp=0;f.sync(b,[]);
 assert(!f.frosted(a.seq)&&!f.frosted(neighbor.seq));
 const dropped={...e.shot};a.slowTicks=RULE.slowTicks;f.sync(b,[{...e,shot:dropped}]);f.discard(dropped);
 assert(f.frosted(a.seq)&&!f.frosted(neighbor.seq));
 f.sync(battle('SLOW'),[]);assert(!f.frosted(a.seq));
});
test('multi-step session inbox captures every shot once and no event changes family RNG',()=>{
 const store=new SaveStore({read:()=>null,write(){}}),g=new GameSession(store);g.state=createGame(7);applyCommand(g.state,{type:'NIGHT'});g.battle=new BattleSimulation(g.state);g.state.settings.speed=3;
 // 本用例验证事件收件箱，不依赖首波敌人是否已走进调整后的塔位；将静止靶放到各已建塔最近的道路点。
 g.battle.cursor=g.battle.base.wave.entries.length;
 g.battle.enemies=g.battle.base.towers.flatMap((tower,i)=>{
  if(!tower.kind||!tower.operator)return[];
  let progress=0,nearest=Infinity;for(let at=0;at<PATH_LENGTH;at++){const p=enemyPoint(enemy(100+i,1000,at)),d=Math.hypot(p.x-PADS[i].x,p.y-PADS[i].y);if(d<nearest){nearest=d;progress=at;}}
  return[enemy(100+i,1000,progress)];
 });
 const rng=JSON.stringify(g.state.rng);g.update(.25);const events=g.takeCombatFeedback();assert(events.some(e=>e.type==='shot'));assert.equal(new Set(events.filter(e=>e.type==='shot').map(e=>e.shot)).size,events.filter(e=>e.type==='shot').length);assert.deepEqual(g.takeCombatFeedback(),[]);assert.equal(JSON.stringify(g.state.rng),rng);
});
test('living target is followed, every pending shot shares death point, flash begins only at visual arrival',()=>{
 const b=battle(),f=new CombatPresentation(),a=shot(0),fatal=shot(1,'STONE');b.enemies=[enemy(1)];f.sync(b,[{type:'shot',shot:a,target:1,hurt:[enemy(1)]}]);assert(!f.flashing(1));b.enemies[0].progress=260;assert.deepEqual(f.target(a),enemyPoint(b.enemies[0]));
 b.enemies=[];f.sync(b,[{type:'shot',shot:fatal,target:1,hurt:[enemy(1,0,280)]}]);assert.deepEqual(f.target(a),f.target(fatal));assert.equal(f.deaths.size,1);f.impact(fatal);assert(f.flashing(1));f.advance(.15);assert.equal(f.deaths.size,1);assert(!f.flashing(1));const started=f.deaths.get(1).started;f.impact(a);assert.equal(f.deaths.get(1).started,started);assert(!f.flashing(1));f.advance(.72);assert.equal(f.deaths.size,0);
});
test('arrival still fires once if a triple-speed frame jumps beyond the entire impact interval',()=>{
 const b=battle(),f=new CombatPresentation(),p=new ProjectileMotion(),s=shot(0);b.enemies=[enemy(1)];b.tick=1;f.sync(b,[{type:'shot',shot:s,target:1,hurt:[enemy(1)]}]);p.update(b,undefined,undefined,undefined,f);assert.equal(p.arrivals.length,0);
 b.tick=16;p.update(b,undefined,undefined,undefined,f);assert.equal(p.arrivals.length,1);assert(f.flashing(1));p.update(b,undefined,undefined,undefined,f);assert.equal(p.arrivals.length,0);
});
test('gate collision and battle replacement retire visual state; no old event replay',()=>{
 const b=battle(),f=new CombatPresentation(),s=shot(0);f.sync(b,[{type:'shot',shot:s,target:1,hurt:[enemy(1,0)]}]);f.sync(b,[{type:'gate',enemy:enemy(1,0,PATH_LENGTH)}]);assert.equal(f.deaths.size,1);assert.equal(f.deaths.get(1).fatal,null);assert(f.deathPose(1));f.sync(null,[]);assert.equal(f.deaths.size,0);assert.equal(f.shots.size,0);
});
test('fatal snapshot outlives short 3x projectile impact interval through the full death animation',()=>{
 const b=battle(),f=new CombatPresentation(),p=new ProjectileMotion(),s=shot(0);f.sync(b,[{type:'shot',shot:s,target:1,hurt:[enemy(1,0)]}]);b.tick=7;p.update(b,undefined,undefined,undefined,f);assert(f.flashing(1));b.tick=14;p.update(b,undefined,undefined,undefined,f);assert(f.deaths.has(1));f.advance(.15);assert(f.deaths.has(1));assert(!f.flashing(1));f.advance(.72);assert(!f.deaths.has(1));
});
test('defeat cue is deferred to visual contact, coalesces combat deaths and excludes gate exits',()=>{
 const b=battle(),f=new CombatPresentation(),p=new ProjectileMotion(),fatal=shot(0,'STONE');
 b.tick=1;b.outcome='WIN';
 f.sync(b,[{type:'shot',shot:fatal,target:1,hurt:[enemy(1,0),enemy(2,0)]}]);
 p.update(b,undefined,undefined,undefined,f);assert.equal(f.takeDefeatCue(),false);
 f.advance(PROJECTILE_STYLE.STONE.flight+.01);p.update(b,undefined,undefined,undefined,f);
 assert.equal(f.takeDefeatCue(),true);assert(f.deathPose(1));assert(f.deathPose(2));
 f.impact(fatal);f.discard(fatal);assert.equal(f.takeDefeatCue(),false);
 const hidden=shot(2);f.sync(b,[{type:'shot',shot:hidden,target:3,hurt:[enemy(3,0)]}]);
 f.discard(hidden);assert(f.deathPose(3));assert.equal(f.takeDefeatCue(),true);f.discard(hidden);
 f.sync(b,[{type:'gate',enemy:enemy(4,0,PATH_LENGTH)}]);assert.equal(f.takeDefeatCue(),false);
});
const chop = id => ({ id, fps: 8, frameIds: ['one', 'two', 'contact', 'release', 'recover'], contactFrame: 2 });
test('actual chop clips follow their contact metadata, pause and resting do not repeat',()=>{
 for(const clip of [chop('villager_blue_chop_left'),chop('villager_red_chop_right')]){const f=new LoggingFeedback();f.sample('a',clip,0,'tree:a');f.sample('a',clip,.5,'tree:a');f.advance(.04);assert.notEqual(f.rotation('tree:a'),0);f.advance(1);f.sample('a',clip,.5,'tree:a');f.advance(0);assert.equal(f.rotation('tree:a'),0);f.sample('a',null,1.2,'tree:a');f.advance(.1);assert.equal(f.rotation('tree:a'),0);}
});
test('only the struck tree sways and a new target cannot inherit the previous strike phase',()=>{
 const f=new LoggingFeedback(),clip=chop('villager_blue_chop_left');f.sample('a',clip,0,'oak');f.sample('a',clip,.5,'oak');f.advance(.04);
 const old=f.rotation('oak');assert.notEqual(old,0);assert.equal(f.rotation('pine'),0);f.advance(0);assert.equal(f.rotation('oak'),old);
 f.sample('a',clip,5,'pine');assert.equal(f.rotation('pine'),0);f.sample('a',clip,5.8,'pine');f.advance(.04);assert.notEqual(f.rotation('pine'),0);
 f.advance(1);assert.equal(f.rotation('oak'),0);assert.equal(f.rotation('pine'),0);
});
test('bell availability shares pause, saved commit and battle outcome conditions',()=>{
 const g=new GameSession(new SaveStore({read:()=>null,write(){}}));g.state=createGame(7);applyCommand(g.state,{type:'NIGHT'});g.battle=new BattleSimulation(g.state);assert(g.canRingBell);for(const reason of ['ASSETS','CHOICE','BACKGROUND','SAVE_PENDING','USER']){g.pause(reason);assert(!g.canRingBell);g.resume(reason);}g.bell();assert(!g.canRingBell);
});
