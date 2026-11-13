const { test } = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const build = process.env.DAIDAI_TEST_BUILD;
const { VillagerMotion } = require(path.join(build, 'view/VillagerMotion.js'));
const { VillageNavigation, VILLAGE_STOPS, layoutVillage } = require(path.join(build, 'view/VillageScene.js'));
const { GameLayout } = require(path.join(build, 'view/GameLayout.js'));
const { createGame } = require(path.join(build, 'game/VillageRules.js'));
function fixture() {
    const state = createGame(7); state.families = [];
    state.people.forEach((p,i) => { p.job=i<4?'LOGGING':'WAITING'; p.nights=8; p.elderNights=0; });
    let seed=17, calls=0;
    const random=()=>{calls++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/0x100000000;};
    const motion=new VillagerMotion(new VillageNavigation(),VILLAGE_STOPS,random); motion.sync(state,state.towers);
    return {state,motion,calls:()=>calls};
}
function reservations(state,motion){return state.people.map(p=>motion.get(p.id).loggingTree).filter(Boolean);}
test('four woodcutters reserve distinct trees before arriving and change trees between work rounds',()=>{
    const {state,motion}=fixture(),before=JSON.stringify(state),seen=new Map(),previous=new Map();
    for(let i=0;i<5200;i++){
        const taken=reservations(state,motion);assert.equal(taken.length,4);assert.equal(new Set(taken).size,4);
        for(const p of state.people.slice(0,4)){
            const pose=motion.get(p.id),last=previous.get(p.id);
            if(last&&last.tree!==pose.loggingTree)assert.equal(last.walking,false,'tree changes only after resting, never during travel');
            if(!seen.has(p.id))seen.set(p.id,new Set());seen.get(p.id).add(pose.loggingTree);
            if(!pose.walking&&pose.clip.endsWith('_chop')){
                const target=VILLAGE_STOPS.logging.find(t=>t.treeId===pose.loggingTree);
                assert.equal(pose.x,target.x);assert.equal(pose.y,target.y);assert.equal(pose.mirror,target.treeX<pose.x);
            }
            previous.set(p.id,{tree:pose.loggingTree,walking:pose.walking});
        }
        motion.update(.05);
    }
    for(const trees of seen.values())assert(trees.size>=3);assert.equal(JSON.stringify(state),before);
});
test('panel sync, pause, coworker departure and resize do not redraw an existing target',()=>{
    const {state,motion,calls}=fixture();motion.update(.1);
    const id=state.people[1].id,target=motion.get(id).loggingTree,called=calls();
    for(let i=0;i<40;i++){motion.sync(state,state.towers);motion.update(0);}assert.equal(calls(),called);
    state.people[0].job='WAITING';motion.sync(state,state.towers);assert.equal(motion.get(id).loggingTree,target);assert.equal(calls(),called);
    const layout=new GameLayout({windowWidth:390,windowHeight:844,screenTop:0,statusBarHeight:47},{width:88,height:32,bottom:76});
    const scene=layoutVillage(layout);motion.relayout(new VillageNavigation(scene.props,scene.landscape,scene.bounds),scene.stops,p=>({x:p.x,y:layout.worldY(p.y)}));
    assert.equal(motion.get(id).loggingTree,target);assert.equal(calls(),called);
});
test('wedding releases its two trees and reacquires valid separate targets before resuming work',()=>{
    const {state,motion}=fixture(),ids=state.people.slice(0,2).map(p=>p.id);
    state.families.push({id:'visual-wedding',partners:ids,lastBirth:null});motion.sync(state,state.towers);
    assert(ids.every(id=>motion.get(id).loggingTree===null));
    let heart=false,resumed=false;
    for(let i=0;i<1800;i++){
        motion.update(.05);motion.sync(state,state.towers);
        const taken=reservations(state,motion);assert.equal(new Set(taken).size,taken.length);
        heart ||= ids.every(id=>motion.get(id).heartElapsed!==null);
        if(heart&&ids.every(id=>motion.get(id).loggingTree!==null)){resumed=true;break;}
    }
    assert(heart&&resumed);
});
test('night interrupts weddings without reacquiring a tree; job changes and removal release reservations',()=>{
    const {state,motion}=fixture(),ids=state.people.slice(0,2).map(p=>p.id);
    state.families.push({id:'interrupted',partners:ids,lastBirth:null});motion.sync(state,state.towers);
    state.phase='NIGHT';motion.sync(state,state.towers);assert.deepEqual(reservations(state,motion),[]);
    for(let i=0;i<100;i++)motion.update(.05);assert.deepEqual(reservations(state,motion),[]);
    state.phase='DAY';motion.sync(state,state.towers);assert.equal(new Set(reservations(state,motion)).size,4);
    state.people.shift();state.people[0].job='WAITING';motion.sync(state,state.towers);assert.equal(reservations(state,motion).length,2);
});
