const { test } = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const read = file => require(path.join(process.env.DAIDAI_TEST_BUILD, file));
const { createGame, applyCommand } = read('game/VillageRules');
const { generateWave } = read('game/WaveGenerator');
const { clone } = read('game/GameState');
const { BattleSimulation, PATH_LENGTH } = read('game/BattleSimulation');
const { enemyPoint } = read('game/BattleRoad');
const { GameSession } = read('game/GameSession');
const { SaveStore } = read('storage/SaveStore');
const { SHIELD_TACTIC, DEFAULT_TACTIC, TACTICS, tacticDefinition, validateTactics } = read('config/TacticConfig');
const { tacticUnavailableReason } = read('game/Tactics');
const { RULE, ENEMIES } = read('game/GameConfig');
const { FIXED_NIGHT, WAVE } = read('config/DefenseConfig');
const { waveDifficulty } = read('game/WaveDifficulty');
const { CombatPresentation } = read('view/CombatPresentation');
function learned() {
    const s = createGame(7); s.completed = 20; s.day = 21; s.legacy.bestNight = 20; s.wood = 60; s.food = 30;
    s.wave = generateWave(s);
    applyCommand(s, { type: 'TACTIC_LEARN', id: SHIELD_TACTIC }); return s;
}
function enemy(seq, kind = 'enemy_raider', progress = PATH_LENGTH - 1, speed = 40) {
    return { seq, kind, appearanceSeed: 87, progress, hp: 100000, speed, slow: 0, slowTicks: 0, walkDistance: 0, born: 0, summoned: 0 };
}
function battle(tactic = SHIELD_TACTIC) {
    const s = learned(); s.food = 100; s.policy = null; s.tactics.equipped = tactic;
    applyCommand(s, { type: 'NIGHT' }); const b = new BattleSimulation(s);
    b.base.towers.forEach(t => { t.kind = null; t.operator = null; });
    b.cursor = b.base.wave.entries.length; b.seq = 100;
    b.enemies = [enemy(99, 'enemy_raider', 100, 0)]; return b;
}
function fixture() {
    const data = new Map(), port = { read: k => data.get(k) ?? null, write: (k,v) => data.set(k,v) };
    const saves = new SaveStore(port); saves.inspect(); saves.prepare(learned()); saves.commit();
    const reopen = () => { const g = new GameSession(new SaveStore(port)); g.load(); return g; };
    return { game: reopen(), reopen };
}
test('shield requires five current wins and one atomic 30 wood / 15 food purchase', () => {
    const t = tacticDefinition(SHIELD_TACTIC);
    assert.deepEqual([t.name,t.unlockWaves,t.wood,t.food,t.ticks * RULE.step,t.effect], ['二楠之盾',5,30,15,7,'GATE_INVULNERABLE']);
    assert(!('multiplier' in t));
    assert.throws(() => validateTactics(TACTICS.map(x => x.id === SHIELD_TACTIC ? {...x,multiplier:1} : x)));
    const s = createGame(7); s.day = 5; s.completed = 4; s.legacy.bestNight = 99;
    assert.equal(tacticUnavailableReason(s, SHIELD_TACTIC, 'LEARN'),'还需守住 1 波');
    const old = clone(s); assert.throws(() => applyCommand(s,{type:'TACTIC_LEARN',id:SHIELD_TACTIC})); assert.deepEqual(s,old);
    s.day = 6; s.completed = 5; s.wood = 29; s.food = 14;
    assert.equal(tacticUnavailableReason(s,SHIELD_TACTIC,'LEARN'),'还缺 1 木、1 粮');
    s.wood = 30; s.food = 15; applyCommand(s,{type:'TACTIC_LEARN',id:SHIELD_TACTIC});
    assert.deepEqual([s.wood,s.food,s.tactics.equipped],[0,0,SHIELD_TACTIC]);
    assert.throws(() => applyCommand(s,{type:'TACTIC_LEARN',id:SHIELD_TACTIC}));
    applyCommand(s,{type:'TACTIC_EQUIP',id:DEFAULT_TACTIC}); applyCommand(s,{type:'TACTIC_EQUIP',id:SHIELD_TACTIC});
    assert.deepEqual([s.wood,s.food],[0,0]);
});
test('all five ordinary enemies and five bosses can be blocked at one HP without healing', () => {
    for (const kind of Object.keys(ENEMIES)) {
        const b = battle(); b.gate = 1; b.enemies.push(enemy(0,kind)); b.bell(); b.step();
        assert.equal(b.gate,1,kind); assert.equal(b.outcome,null); assert.equal(b.enemies.length,1);
        const e = b.feedback.find(e=>e.type==='gate'); assert(e.blocked); assert.equal(e.enemy.hp,0);
        assert.deepEqual([e.x,e.y],Object.values(enemyPoint(e.enemy))); assert.equal(e.tick,0);
    }
});
test('last protected tick blocks all simultaneous arrivals, next tick resumes exact damage', () => {
    const b = battle(); b.gate = 1000; b.bell(); b.bellTicks = 1;
    b.enemies.push(enemy(0),enemy(1,'enemy_commander')); b.step();
    assert.equal(b.gate,1000); assert.equal(b.bellTicks,0); assert(!b.gateProtected);
    const blocked = b.feedback.slice(); assert.equal(blocked.length,2); assert(blocked.every(e=>e.blocked));
    b.enemies.push(enemy(2)); b.step();
    assert.equal(b.gate,1000 - Math.ceil(ENEMIES.enemy_raider.gate * (WAVE.ordinaryGateScale * FIXED_NIGHT.ordinaryGateDamage) * waveDifficulty(b.base.day).gate));
    assert.equal(b.feedback[0].blocked,false); assert(blocked.every(e=>e.blocked));
});
test('unactivated shield and expired shield preserve lethal arrival and failure', () => {
    for (const mode of ['uncast','expired','heart']) {
        const b = battle(mode==='heart'?DEFAULT_TACTIC:SHIELD_TACTIC); b.gate=1; b.enemies.push(enemy(0));
        if(mode!=='uncast')b.bell(); if(mode==='expired')b.bellTicks=0;
        b.step(); assert.equal(b.gate,0); assert.equal(b.outcome,'LOSE'); assert.equal(b.feedback[0].blocked,false);
    }
});
test('shield lasts exactly 140 combat steps and cannot be refreshed', () => {
    const b = battle(); b.bell();
    for(let i=0;i<139;i++){assert(b.gateProtected);b.step();}
    assert.equal(b.bellTicks,1); b.step(); assert.equal(b.bellTicks,0); assert(!b.gateProtected);
    b.bell(); assert.equal(b.bellTicks,0); assert.equal(b.tick,140);
});
test('blocking a summoning chief preserves already spawned children, then stops future summons', () => {
    const b = battle(); b.tick=RULE.summonTicks[0]; b.enemies.push(enemy(0,'enemy_chief',PATH_LENGTH-3.5,100));
    b.bell(); b.step(); assert.equal(b.enemies.length,3); assert(!b.enemies.some(e=>e.kind==='enemy_chief'));
    const children=b.enemies.filter(e=>e.seq!==99); assert.equal(children.length,2); assert(children.every(e=>e.kind==='enemy_raider'));
    b.step(); assert.equal(b.enemies.length,1); assert.equal(b.feedback.filter(e=>e.type==='gate'&&e.blocked).length,2);
    while(b.tick<RULE.summonTicks.at(-1)+2)b.step(); assert.equal(b.pendingCount,0); assert.equal(b.enemies.length,1);
});
test('last blocked enemy wins immediately while its non-flashing death finishes visually', () => {
    const b = battle(); b.enemies=[enemy(0)]; b.gate=1; b.bell(); b.step();
    assert.equal(b.outcome,'WIN'); assert.equal(b.gate,1); assert(b.feedback[0].blocked);
    const presentation=new CombatPresentation(); presentation.sync(b,b.feedback);
    assert.equal(presentation.shots.size,0); assert.equal(presentation.deaths.size,1); assert(!presentation.flashing(0));
    presentation.advance(.87); assert.equal(presentation.deaths.size,0);
    const active=battle(); const e=enemy(0); active.enemies.push(e); active.bell(); active.step();
    presentation.sync(active,active.feedback); assert(presentation.deathPose(0)); assert(!presentation.flashes.has(0));
});
test('shield does not change tower damage, cadence or crowd-control', () => {
    for(const kind of ['ARROW','STONE','SLOW']) {
        const a=battle(),b=battle();
        for(const v of [a,b]){v.base.towers[0]={...v.base.towers[0],kind,level:1,operator:v.base.people[0].id};v.enemies=[enemy(0,'enemy_armored',200,0)];}
        b.bell();
        for(let i=0;i<160;i++){a.step();b.step();assert.deepEqual(a.shots,b.shots);assert.deepEqual(a.enemies,b.enemies);}
    }
});
test('pause, reassignment and 3x keep the same shield; reopen restarts saved pre-night state', () => {
    const f=fixture(),g=f.game; g.state.food=100; g.command({type:'NIGHT'}); const b=g.battle; g.bell();
    g.pause('CHOICE');g.update(.1);assert.equal(b.bellTicks,140);assert(g.reassign(0,g.state.people[2].id));
    g.resume('CHOICE');g.command({type:'SPEED',value:3});g.update(.1);assert.equal(g.battle,b);assert.equal(b.bellTicks,134);
    g.bell();assert.equal(b.bellTicks,134); const reopened=f.reopen();
    assert.equal(reopened.battle.tactic.id,SHIELD_TACTIC);assert.equal(reopened.battle.bellTicks,0);assert.equal(reopened.battle.tick,0);
});
test('session settles final block without holding the night open for visual feedback', () => {
    const f=fixture(),g=f.game;g.state.food=100;g.command({type:'NIGHT'});const b=g.battle;
    b.base.towers.forEach(t=>{t.kind=null;t.operator=null;});b.cursor=b.base.wave.entries.length;b.enemies=[enemy(0)];b.gate=1;g.bell();g.update(.05);
    assert.equal(g.battle,null);assert.equal(g.state.completed,21);assert.equal(g.state.gate,1);assert.equal(g.presentationBattle,b);
    const events=g.takeCombatFeedback();assert.equal(events.length,1);assert(events[0].blocked);assert.deepEqual(g.takeCombatFeedback(),[]);
});

class Sprite {
    constructor(){Object.assign(this,{children:[],x:0,y:0,width:0,height:0,alpha:1,visible:true,scaleX:1,scaleY:1});this.graphics={calls:[],clear(){this.calls=[];},drawImage(...args){this.calls.push(args);}};}
    addChild(n){this.children.push(n);n.parent=this;return n;} pos(x,y){this.x=x;this.y=y;return this;}
    size(width,height){Object.assign(this,{width,height});return this;} pivot(x,y){this.pivotX=x;this.pivotY=y;return this;}
    scale(x,y){this.scaleX=x;this.scaleY=y;return this;}
}
global.Laya={Sprite,Point:class{constructor(x,y){this.x=x;this.y=y;}}};
const { GateShieldEffects }=read('view/GateShieldEffects');
test('shield visuals use fixed noninteractive world nodes, freeze with battle clock and clean on expiry/outcome/reset',()=>{
    const world=new Sprite(), art={ready:()=>true,get:id=>id}, v=new GateShieldEffects(world,art), b=battle();
    let offset=0;const gate={node:{y:500},visual:{bodyRegion:()=>({node:{localToGlobal:p=>({x:p.x+300,y:p.y+400+offset})},bounds:{x:0,y:0,width:100,height:90}})}};
    const layout={worldY:y=>y+offset};b.bell();let depth=v.update(b,gate,layout,[]);
    assert.equal(depth.length,2);assert.equal(world.children.length,2);assert(world.children.every(n=>!n.mouseEnabled));
    assert(depth[0].y<gate.node.y&&depth[1].y>gate.node.y);const nodes=v.front.children.slice();
    b.tick=7;v.update(b,gate,layout,[]);assert.equal(v.dome.scaleY,1);const alpha=v.dome.alpha;
    assert.equal(v.dome.graphics.calls[0][3],v.dome.width);assert.equal(v.dome.graphics.calls[0][4],v.dome.height);
    v.update(b,gate,layout,[]);assert.equal(v.dome.alpha,alpha);
    const events=Array.from({length:20},(_,i)=>({type:'gate',blocked:true,tick:6,x:350,y:450,enemy:enemy(i)}));
    v.update(b,gate,layout,events);assert.equal(v.hits.filter(h=>h.node.visible).length,3);assert.deepEqual(v.front.children,nodes);
    const oldY=v.front.y;offset=80;v.update(b,gate,layout,[]);assert.equal(v.front.y,oldY+80);
    b.bellTicks=0;v.update(b,gate,layout,[]);b.tick+=6;assert.equal(v.update(b,gate,layout,[]).length,0);
    assert(!v.front.visible&&!v.back.visible);assert(v.hits.every(h=>!h.node.visible));
    const next=battle();next.bell();v.update(next,gate,layout,[]);next.outcome='WIN';assert.equal(v.update(next,gate,layout,[]).length,0);
    assert(!v.front.visible);v.update(battle(),gate,layout,[]);assert(!v.front.visible);v.reset();assert.equal(v.battle,null);
});
