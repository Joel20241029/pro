const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const build=process.env.DAIDAI_TEST_BUILD;
const {enemyPoint,pointAt,PATH_LENGTH,roadFootprintBounds}=require(path.join(build,'game/BattleRoad'));
const {BattleSimulation}=require(path.join(build,'game/BattleSimulation'));
const {createGame,applyCommand}=require(path.join(build,'game/VillageRules'));
const {ENEMIES,PATH,PADS,TOWERS,RULE}=require(path.join(build,'game/GameConfig'));
const {WAVE}=require(path.join(build,'config/DefenseConfig'));
const {ROAD_MOVEMENT}=require(path.join(build,'config/RoadMovementConfig'));
const enemy=(kind,seq,progress)=>({kind,seq,progress,appearanceSeed:91,hp:1e6,speed:0,slow:0,slowTicks:0, walkDistance: 0,born:0,summoned:RULE.summonTicks.length});
function battle(tower,index=0){
 const state=createGame(41);applyCommand(state,{type:'NIGHT'});const b=new BattleSimulation(state);
 b.cursor=b.base.wave.entries.length;b.base.towers.forEach((t,i)=>{t.kind=i===index?tower:null;t.operator=i===index?state.people[0].id:null;});
 b.gate=1e9;return b;
}
test('all ten kinds stay within the allowed road shoulder and preserve the original progress axis',()=>{
 assert.equal(PATH_LENGTH,PATH.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-PATH[i].x,p.y-PATH[i].y),0));
 for(const kind of Object.keys(ENEMIES))for(let seq=0;seq<RULE.planCap;seq++)for(let progress=0;progress<=PATH_LENGTH;progress+=3){
  const p=enemyPoint(enemy(kind,seq,progress)),bounds=roadFootprintBounds(p.y,kind);
  assert(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.equal(p.y,pointAt(progress).y);
  assert(bounds.left-ROAD_MOVEMENT.shoulderAllowance<=p.x&&p.x<=bounds.right+ROAD_MOVEMENT.shoulderAllowance,`${kind}/${seq}/${progress}`);
 }
});
test('successive groups favour different lanes while outliers still use all three bands and the shoulder',()=>{
 const kind='enemy_raider', progress=0;
 const {size}=ROAD_MOVEMENT.formation;
 const positions=Array.from({length:size*6},(_,seq)=>enemyPoint(enemy(kind,seq,progress)));
 const {left,right}=roadFootprintBounds(positions[0].y,kind), middle=(left+right)/2, inner=(right-left)/4;
 const lanes=positions.map(({x})=>x<middle-inner?0:x>middle+inner?1:2);
 const leaders=[];
 let threeLaneGroups=0;
 for(let i=0;i<lanes.length;i+=size){
  const group=lanes.slice(i,i+size);
  const counts=[0,1,2].map(lane=>group.filter(value=>value===lane).length);
  const most=Math.max(...counts);
  if(counts.every(count=>count>0)) threeLaneGroups++;
  leaders.push(counts.indexOf(most));
 }
 assert.equal(new Set(lanes).size,3);
 assert.equal(new Set(leaders).size,3);
 assert(threeLaneGroups>=4);
 assert(lanes.some((lane,i)=>lane===lanes[i-1]&&positions[i].x!==positions[i-1].x));
 assert.deepEqual(positions,positions.map((_,seq)=>enemyPoint({...enemy(kind,seq,progress),appearanceSeed:5})));
 assert(positions.some(p=>p.x<left-6||p.x>right+6)); // 超过原路面剖面的 6px 内收量。
});
test('enemies spread across the road, remain continuous around bends and gather before the gate',()=>{
 for(const kind of Object.keys(ENEMIES)){
  const xs=Array.from({length:40},(_,seq)=>enemyPoint(enemy(kind,seq,0)).x);assert(Math.max(...xs)-Math.min(...xs)>10);
  for(let seq=0;seq<12;seq++)for(let progress=0;progress<PATH_LENGTH;progress+=.5){
   const a=enemyPoint(enemy(kind,seq,progress)),b=enemyPoint(enemy(kind,seq,progress+.1));
   assert(Math.hypot(b.x-a.x,b.y-a.y)<1,`${kind}/${seq}/${progress}`);
  }
  const end=enemyPoint(enemy(kind,0,PATH_LENGTH));assert.equal(end.y,760);
  for(let seq=1;seq<40;seq++)assert.deepEqual(enemyPoint(enemy(kind,seq,PATH_LENGTH+3)),end);
 }
});
test('all five pads and three tower types can attack every kind on multiple road positions',()=>{
 for(let index=0;index<PADS.length;index++)for(const tower of Object.keys(TOWERS))for(const kind of Object.keys(ENEMIES))for(const seq of [0,1,2,7]){
  let closest=Infinity,progress=0;
  for(let at=0;at<PATH_LENGTH;at+=2){const p=enemyPoint(enemy(kind,seq,at)),d=Math.hypot(p.x-PADS[index].x,p.y-PADS[index].y);if(d<closest){closest=d;progress=at;}}
  assert(closest<TOWERS[tower].range,`${index}/${tower}/${kind}/${seq}: ${closest}`);
  const b=battle(tower,index),e=enemy(kind,seq,progress);b.enemies=[e];b.step();
  assert(e.hp<1e6);const shot=b.feedback.find(e=>e.type==='shot');assert(shot);
  assert.deepEqual({x:shot.shot.x,y:shot.shot.y},enemyPoint(e));
 }
});
test('walking distance follows actual lateral motion, slows with frost and freezes when no simulation step runs',()=>{
 const b=battle(null),e=enemy('enemy_raider',3,220);e.speed=40;b.enemies=[e];
 const p=enemyPoint(e);b.step();const q=enemyPoint(e),normal=e.walkDistance;
 assert(Math.abs(normal-Math.hypot(q.x-p.x,q.y-p.y))<1e-12);assert(normal>0);
 const frozen=e.walkDistance;assert.equal(e.walkDistance,frozen);
 e.slow=.5;e.slowTicks=10;b.step();assert(e.walkDistance-frozen<normal*.7);
});
test('lateral placement does not change the arrival tick, gate damage or pending queue',()=>{
 for(const kind of Object.keys(ENEMIES)){
  const b=battle(null),e=enemy(kind,19,0);e.speed=ENEMIES[kind].speed;b.enemies=[e];
  let expectedProgress=0,steps=0;while(expectedProgress<PATH_LENGTH){expectedProgress+=e.speed*RULE.step;steps++;}
  for(let i=0;i<steps-1;i++){b.step();assert(!b.feedback.some(e=>e.type==='gate'));}
  b.step();assert(b.feedback.some(e=>e.type==='gate'));assert.equal(b.enemies.length,0);assert.equal(b.pendingCount,0);
  const {gate,boss}=ENEMIES[kind];
  assert.equal(b.gate,1e9-Math.ceil(gate*(boss?1:WAVE.ordinaryGateScale)));assert.equal(b.outcome,'WIN');
 }
});
test('splash uses actual lateral distance, not equal progress on the old single line',()=>{
 let pair;
 for(let progress=200;progress<500&&!pair;progress+=2){
  const values=Array.from({length:40},(_,seq)=>enemy('enemy_raider',seq,progress));
  for(const a of values)for(const b of values){
   const pa=enemyPoint(a),pb=enemyPoint(b);
   if(a.seq<b.seq&&Math.abs(pa.x-pb.x)>TOWERS.STONE.splash+2&&Math.hypot(pa.x-PADS[1].x,pa.y-PADS[1].y)<TOWERS.STONE.range){pair=[a,b];break;}
  }
 }
 assert(pair,'expected a wide road section');const b=battle('STONE',1);b.enemies=pair;b.step();
 assert(pair[0].hp<1e6);assert.equal(pair[1].hp,1e6);
 assert.deepEqual(b.feedback.find(e=>e.type==='shot').hurt.map(e=>e.seq),[pair[0].seq]);
});
