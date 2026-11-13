const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const build=process.env.DAIDAI_TEST_BUILD;
const {createGame,applyCommand}=require(path.join(build,'game/VillageRules'));
const {BattleSimulation,pointAt,PATH_LENGTH}=require(path.join(build,'game/BattleSimulation'));
const {GameSession}=require(path.join(build,'game/GameSession'));
const {SaveStore}=require(path.join(build,'storage/SaveStore'));
const {CombatPresentation}=require(path.join(build,'view/CombatPresentation'));
const {ProjectileMotion,PROJECTILE_STYLE}=require(path.join(build,'view/ProjectileMotion'));
const {LoggingFeedback}=require(path.join(build,'view/LoggingFeedback'));
const {buttonEdge}=require(path.join(build,'view/ButtonParticles'));
const {RULE}=require(path.join(build,'game/GameConfig'));
function battle(kind='ARROW') {const s=createGame(7);applyCommand(s,{type:'NIGHT'});const b=new BattleSimulation(s);b.base.towers.forEach((t,i)=>{t.kind=i===0?kind:null;t.operator=i===0?s.people[0].id:null;});b.cursor=b.base.wave.entries.length;return b;}
function enemy(seq,hp=1000,progress=200){return {seq,kind:'enemy_raider',appearanceSeed:87,progress,hp,speed:0,slow:0,slowTicks:0,born:0,summoned:0};}
function shot(tick,kind='ARROW'){return {tower:0,x:300,y:400,kind,tick};}
test('real stone hurt set contains splash victims; slow-only neighbors have no damage event',()=>{
 for(const kind of ['STONE','SLOW']){const b=battle(kind);b.enemies=[enemy(10),enemy(11,1000,205)];b.step();const e=b.feedback.find(e=>e.type==='shot');assert(e);assert.equal(e.hurt.length,kind==='STONE'?2:1);if(kind==='SLOW')assert.equal(b.enemies[0].slowTicks,RULE.slowTicks);}
});
test('multi-step session inbox captures every shot once and no event changes family RNG',()=>{
 const store=new SaveStore({read:()=>null,write(){}}),g=new GameSession(store);g.state=createGame(7);applyCommand(g.state,{type:'NIGHT'});g.battle=new BattleSimulation(g.state);g.state.settings.speed=3;
 const rng=JSON.stringify(g.state.rng);g.update(.25);const events=g.takeCombatFeedback();assert(events.some(e=>e.type==='shot'));assert.equal(new Set(events.filter(e=>e.type==='shot').map(e=>e.shot)).size,events.filter(e=>e.type==='shot').length);assert.deepEqual(g.takeCombatFeedback(),[]);assert.equal(JSON.stringify(g.state.rng),rng);
});
test('living target is followed, every pending shot shares death point, flash begins only at visual arrival',()=>{
 const b=battle(),f=new CombatPresentation(),a=shot(0),fatal=shot(1,'STONE');b.enemies=[enemy(1)];f.sync(b,[{type:'shot',shot:a,target:1,hurt:[enemy(1)]}]);assert(!f.flashing(1));b.enemies[0].progress=260;assert.deepEqual(f.target(a),pointAt(260));
 b.enemies=[];f.sync(b,[{type:'shot',shot:fatal,target:1,hurt:[enemy(1,0,280)]}]);assert.deepEqual(f.target(a),f.target(fatal));assert.equal(f.deaths.size,1);f.impact(fatal);assert(f.flashing(1));f.advance(.15);assert.equal(f.deaths.size,0);assert(!f.flashing(1));f.impact(a);assert.equal(f.deaths.size,0);assert(!f.flashing(1));
});
test('arrival still fires once if a triple-speed frame jumps beyond the entire impact interval',()=>{
 const b=battle(),f=new CombatPresentation(),p=new ProjectileMotion(),s=shot(0);b.enemies=[enemy(1)];b.tick=1;f.sync(b,[{type:'shot',shot:s,target:1,hurt:[enemy(1)]}]);p.update(b,undefined,undefined,undefined,f);assert.equal(p.arrivals.length,0);
 b.tick=16;p.update(b,undefined,undefined,undefined,f);assert.equal(p.arrivals.length,1);assert(f.flashing(1));p.update(b,undefined,undefined,undefined,f);assert.equal(p.arrivals.length,0);
});
test('gate collision and battle replacement retire visual state; no old event replay',()=>{
 const b=battle(),f=new CombatPresentation(),s=shot(0);f.sync(b,[{type:'shot',shot:s,target:1,hurt:[enemy(1,0)]}]);f.sync(b,[{type:'gate',enemy:enemy(1,0,PATH_LENGTH)}]);assert.equal(f.deaths.size,0);assert.equal(f.gateHits.length,1);f.sync(null,[]);assert.equal(f.shots.size,0);assert.equal(f.gateHits.length,0);
});
test('fatal snapshot outlives short 3x projectile impact interval until readable wall-clock flash ends',()=>{
 const b=battle(),f=new CombatPresentation(),p=new ProjectileMotion(),s=shot(0);f.sync(b,[{type:'shot',shot:s,target:1,hurt:[enemy(1,0)]}]);b.tick=7;p.update(b,undefined,undefined,undefined,f);assert(f.flashing(1));b.tick=14;p.update(b,undefined,undefined,undefined,f);assert(f.deaths.has(1));f.advance(.15);assert(!f.deaths.has(1));
});
test('both actual chop clips trigger only when crossing frame 3, pause and resting do not repeat',()=>{
 for(const clip of ['villager_male_a_chop','villager_female_a_chop']){const f=new LoggingFeedback();f.sample('a',clip,0,true);f.sample('a',clip,.5,true);assert.notEqual(f.advance(.04),0);f.advance(1);f.sample('a',clip,.5,true);assert.equal(f.advance(0),0);f.sample('a',clip,1.2,false);assert.equal(f.advance(.1),0);}
});
test('button particles stay inside border and complete a continuous rounded loop',()=>{
 let prev=buttonEdge(0,252,68);for(let i=1;i<=1000;i++){const p=buttonEdge(i/1000,252,68);assert(p.x>=6-1e-6&&p.x<=246+1e-6&&p.y>=6-1e-6&&p.y<=62+1e-6);assert(Math.hypot(p.x-prev.x,p.y-prev.y)<1);prev=p;}assert.deepEqual(buttonEdge(0,252,68),buttonEdge(1,252,68));
});
test('bell availability shares pause, saved commit and battle outcome conditions',()=>{
 const g=new GameSession(new SaveStore({read:()=>null,write(){}}));g.state=createGame(7);applyCommand(g.state,{type:'NIGHT'});g.battle=new BattleSimulation(g.state);assert(g.canRingBell);for(const reason of ['ASSETS','CHOICE','BACKGROUND','SAVE_PENDING','USER']){g.pause(reason);assert(!g.canRingBell);g.resume(reason);}g.bell();assert(!g.canRingBell);
});
