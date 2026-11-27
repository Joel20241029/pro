const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const build = process.env.DAIDAI_TEST_BUILD;
const { VillagerMotion } = require(path.join(build, 'view/VillagerMotion.js'));
const { VillageNavigation, VILLAGE_STOPS } = require(path.join(build, 'view/VillageScene.js'));
const { createGame } = require(path.join(build, 'game/VillageRules.js'));
const { SewingVisual } = require(path.join(build, 'view/SewingVisual.js'));

function advance(motion, seconds) {
    for (let tick = 0; tick < Math.ceil(seconds / .05); tick++) motion.update(.05);
}
test('assigned workers walk to three distinct machines; overflow enters through the factory door', () => {
    const state=createGame(7), motion=new VillagerMotion(new VillageNavigation()), initial=JSON.stringify(state);
    motion.sync(state,state.towers);
    const assigned=state.people.filter(p=>p.job==='SEWING');
    assert(assigned.length > VILLAGE_STOPS.sewing.length);
    assert(assigned.every(p=>motion.get(p.id).walking && !motion.get(p.id).insideFactory));
    advance(motion,60);
    const poses=assigned.map(p=>motion.get(p.id));
    assert.deepEqual(poses.filter(p=>p.clip==='sewing').map(p=>[p.x,p.y]).sort(),
        VILLAGE_STOPS.sewing.map(p=>[p.x,p.y]).sort());
    assert(poses.filter(p=>p.insideFactory).every(p=>p.x===VILLAGE_STOPS.factoryDoor[0].x && p.y===VILLAGE_STOPS.factoryDoor[0].y));
    assert.equal(poses.filter(p=>p.insideFactory).length,assigned.length-VILLAGE_STOPS.sewing.length);
    assert.equal(JSON.stringify(state),initial);
});
test('overnight tower guards leave their machines, then walk back through the gate during DAWN', () => {
    const state=createGame(8),motion=new VillagerMotion();
    motion.sync(state,state.towers); advance(motion,50);
    const guard=state.people.at(-1);
    state.towers[0].operator=guard.id; state.phase='NIGHT'; motion.sync(state,state.towers);
    assert(!motion.get(guard.id).insideFactory); advance(motion,60);
    const night={...motion.get(guard.id)};assert(night.insideTower);
    state.phase='DAWN'; motion.sync(state,state.towers);
    const start=motion.get(guard.id);
    assert.deepEqual([start.x,start.y],[night.x,night.y]); assert(start.walking && !start.insideTower && !start.insideFactory);
    let opened=false;
    for(let i=0;i<1200;i++){
        if(i===12){state.phase='DAY';motion.sync(state,state.towers);}
        motion.update(.05);opened ||= motion.crossingGate(830);
    }
    assert(opened); assert(motion.get(guard.id).insideFactory);
});
test('sewing rig reuses layers, preserves seated appearance and drives the wheel at each quality rate', () => {
    class Sprite {
        children=[];
        addChild(n){this.children.push(n);return n;}
        size(w,h){this.width=w;this.height=h;return this;}
        pivot(x,y){this.pivotX=x;this.pivotY=y;return this;}
        pos(x,y){this.x=x;this.y=y;return this;}
        scale(x,y){this.scaleX=x;this.scaleY=y;return this;}
    }
    global.Laya={Sprite};
    for(const [quality,rate] of Object.entries({COMMON:1,ELITE:1.2,HERO:1.45,LEGENDARY:1.7})){
        const visual=new SewingVisual(new Sprite(),{get:id=>id});
        const [motion,head,plane]=visual.parts.children;
        for(const model of ['blue','straw','red','jade','elite_male','elite_female']){
            const seen=new Set();
            for(let tick=0;tick<90;tick++){
                const seconds=tick*.05,phase=seconds*.95*rate*2*Math.PI;
                visual.draw(model,quality,seconds,0,56);
                seen.add(head.texture);
                assert.equal(motion.texture,'sew_motion_'+(Math.floor(seconds*.95*rate*8)%8));
                assert(Math.abs(plane.children[0].rotation-(phase*.72+.14*Math.sin(phase))*180/Math.PI%360)<1e-6);
            }
            assert.deepEqual([...seen].sort(),['sew_'+model,'sew_'+model+'_smile']);
        }
        assert.equal(visual.parts.children.length,3);assert.equal(plane.children.length,1);
    }
});
