const { test } = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const compiled = process.env.DAIDAI_TEST_BUILD;
if (!compiled) throw new Error('Set DAIDAI_TEST_BUILD to the compiled project under Downloads');
const { ROAD_PROFILE } = require(path.join(compiled, 'config/RoadGeometry.js'));
const { GameLayout } = require(path.join(compiled, 'view/GameLayout.js'));
const { HUD } = require(path.join(compiled, 'view/config/HudConfig.js'));
const { layoutVillage, VillageNavigation, towerLaunch, TOWER_VIEW, distance } = require(path.join(compiled, 'view/VillageScene.js'));
const { VillagerMotion } = require(path.join(compiled, 'view/VillagerMotion.js'));
const { ProjectileMotion } = require(path.join(compiled, 'view/ProjectileMotion.js'));
const { createGame, applyCommand } = require(path.join(compiled, 'game/VillageRules.js'));
const { BattleSimulation } = require(path.join(compiled, 'game/BattleSimulation.js'));
const profiles = [
    ['small 16:9', 320, 568, 20, 568, 24, 56], ['plus 16:9', 414, 736, 20, 736, 24, 56],
    ['18:9', 360, 720, 24, 696, 28, 60], ['iPhone X', 375, 812, 44, 778, 40, 72],
    ['iPhone 13', 390, 844, 47, 810, 44, 76], ['iPhone Pro', 402, 874, 62, 840, 59, 91],
    ['iPhone Max', 430, 932, 59, 898, 56, 88], ['Android 20:9', 360, 800, 24, 776, 28, 60],
    ['Android large', 412, 915, 28, 891, 32, 64], ['long outer screen', 360, 880, 28, 856, 32, 64]
];
function layout([name,w,h,top,bottom,mt,mb]) {
    return new GameLayout({ windowWidth:w, windowHeight:h, screenTop:0, statusBarHeight:top, safeArea:{top,bottom,left:0,right:w} }, {width:88,height:32,top:mt,bottom:mb,left:w-98,right:w-10});
}
function sceneAt(l) { const scene=layoutVillage(l); return { scene, nav:new VillageNavigation(scene.props,scene.landscape,scene.bounds) }; }
function near(a,b) { assert(Math.abs(a-b)<1e-6,`${a} != ${b}`); }
for(const profile of profiles) test(`${profile[0]}: safe controls, expanded village, reachable stops and intact source proportions`, () => {
    const l=layout(profile), {scene,nav}=sceneAt(l), [name,w,h,top,bottom,mt,mb]=profile;
    near(l.height,h*720/w); near(l.safeTop,top*720/w); near(l.safeBottom,bottom*720/w);
    assert(l.dateY+HUD.title.top>=mb*720/w-1e-6); assert(l.footerTop+228<=l.safeBottom);
    assert(l.footerTop-l.gateY>=260);
    const adultCanvas = l.personScale * 56;
    assert(adultCanvas >= 90.3 - 1e-6 && adultCanvas <= 94.5 + 1e-6);
    assert(l.safeBottom-l.safeTop>=860, 'full panel must fit safe region');
    assert.deepEqual(scene.props.filter(p=>p.id.startsWith('building:house-')).map(p=>p.id), ['building:house-a']);
    const patrol=scene.props.find(p=>p.id==='building:patrol');
    near(patrol.size,148); near(patrol.x,226);
    const { PATROL } = require(path.join(compiled, 'config/PatrolConfig.js'));
    near(patrol.x, PATROL.spin.house.x); near(patrol.y, l.worldY(PATROL.spin.house.y));
    assert(scene.stops.nightRest.every(at => {
        const y = l.referenceY(at.y);
        return Math.abs(at.x - PATROL.spin.center.x) > PATROL.spin.shoulder + 34
            || y < PATROL.spin.center.y - 42 || y > PATROL.spin.center.y + 38;
    }), 'night residents stay clear of the pair and the pull area');
    const patrolBase={x:patrol.x,y:patrol.y};
    assert(!nav.walkable(patrolBase));
    for(const [key,stops] of Object.entries(scene.stops)) for(const p of stops) {
        assert(nav.walkable(p),`${name}:${key} ${JSON.stringify(p)}`);
        let at=scene.stops.homes[0];
        for(const end of nav.route(at,p)) { assert(nav.clear(at,end)); at=end; }
        near(distance(at,p),0);
    }
    const farm=scene.props.find(p=>p.id==='building:farm');
    for(const p of scene.stops.farm) assert([-75,-30].some(d=>Math.abs(p.y-farm.y-d)<1e-6),'farmer leaves crop rows');
    for(const p of scene.stops.logging) {
        const tree=scene.props.find(t=>t.id===p.treeId);
        assert(p.y>tree.y,'woodcutter must stand in front of the assigned tree after screen layout');
    }
    assert.deepEqual(TOWER_VIEW.facing, [1, -1, 1, -1, -1], `${name}: two towers west and three east`);
    assert(scene.pads[0].y < scene.pads[3].y && scene.pads[3].y < scene.pads[2].y && scene.pads[2].y < scene.pads[4].y);
    assert(scene.pads[1].y < scene.pads[3].y);
    for (const [i, pad] of scene.pads.entries()) {
        const { footprint } = scene.props.find(p => p.id === `tower:${i}`);
        const road = ROAD_PROFILE.filter(([y]) => y >= l.referenceY(footprint.top) - 4 && y <= l.referenceY(footprint.bottom) + 4);
        assert(road.length > 0);
        const clearance = Math.min(...road.map(([, left, right]) => TOWER_VIEW.facing[i] > 0 ? left - footprint.right : footprint.left - right));
        assert(clearance >= 10, `${name}: tower ${i + 1} leaves ${clearance} px of grass`);
        const tapY = pad.y - HUD.towerBuildHint.centerAbovePad;
        const hit = scene.pads.map((target, index) => ({ target, index })).filter(({ target }) =>
            Math.abs(pad.x - target.x) < HUD.tower.hitWidth / 2 &&
            tapY >= target.y + HUD.tower.hitY && tapY <= target.y + HUD.tower.hitY + HUD.towerBuildHint.hitHeight);
        assert.deepEqual(hit.map(({ index }) => index), [i], `${name}: tower ${i + 1} has an ambiguous center tap`);
    }
    for(let i=0;i<scene.pads.length;i++) for(const kind of ['ARROW','STONE','SLOW']) {
        const start=towerLaunch(i,kind,scene.pads), tower=scene.props.find(p=>p.id===`tower:${i}`);
        near(tower.y,scene.pads[i].y+(TOWER_VIEW.top+TOWER_VIEW.size*15/16)*scene.towerScale);
        near(start.y,scene.pads[i].y+TOWER_VIEW.top+TOWER_VIEW.muzzle[kind].y*TOWER_VIEW.size/128);
    }
    const state=createGame(7); state.people.forEach(p=>p.job='WAITING');
    while(state.people.length<20) state.people.push({...state.people[state.people.length%6],id:`1:${state.people.length+1}`});
    state.people.slice(0,6).forEach(p=>p.job='FARM'); state.people.slice(6,10).forEach(p=>p.job='LOGGING');
    const before=JSON.stringify(state), motion=new VillagerMotion(nav,scene.stops);
    motion.sync(state,state.towers);
    for(let i=0;i<2400;i++) { motion.update(.05); for(const p of state.people) assert(nav.walkable(motion.get(p.id))); }
    assert.equal(JSON.stringify(state),before);
});
test('missing safeArea uses reported status bar; screenTop removes already excluded status pixels; empty menu adds no phantom inset', () => {
    const menu={top:0,bottom:0,left:0,right:0,width:0,height:0};
    let l=new GameLayout({windowWidth:360,windowHeight:800,screenTop:0,statusBarHeight:24},menu);
    near(l.safeTop,48); near(l.safeBottom,1600); near(l.dateY,112);
    l=new GameLayout({windowWidth:360,windowHeight:776,screenTop:24,statusBarHeight:24,safeArea:{top:24,bottom:776,left:0,right:360}}, {top:28,bottom:60,left:262,right:350,width:88,height:32});
    near(l.safeTop,0); near(l.safeBottom,1504); near(l.dateY,112);
});
test('iPhone 12 window without screenTop keeps layout, village stops and controls inside the visible window', () => {
    const menu={top:51,bottom:83,left:292,right:380,width:88,height:32};
    for(const safeArea of [{top:47,bottom:810,left:0,right:390},undefined]) {
        const metrics={windowWidth:390,windowHeight:844,statusBarHeight:47,safeArea};
        const l=new GameLayout(metrics,menu);
        for(const [key,value] of Object.entries(l)) assert(Number.isFinite(value),`invalid layout ${key}: ${value}`);
        assert.deepEqual(l,new GameLayout({...metrics,screenTop:0},menu));
        assert(l.dateY+HUD.title.top>=menu.bottom*720/390-1e-6); assert(l.footerTop+228<=l.safeBottom);
        const {scene,nav}=sceneAt(l);
        for(const [key,stops] of Object.entries(scene.stops)) for(const point of stops) {
            assert(Number.isFinite(point.x) && Number.isFinite(point.y),`invalid ${key} stop`);
            assert(nav.walkable(point),`${key} stop must remain walkable`);
            assert(point.y>=0 && point.y<=l.height,`${key} stop must remain visible`);
        }
    }
});
test('resizing during a ceremony preserves its timer, partner positions, live battle and save data', () => {
    let current=layout(profiles[4]), data=sceneAt(current);
    const s=createGame(17), m=new VillagerMotion(data.nav,data.scene.stops); m.sync(s,s.towers);
    applyCommand(s,{type:'FAMILY',a:s.people[4].id,b:s.people[5].id}); m.sync(s,s.towers);
    for(let i=0;i<3000 && m.get(s.people[4].id).heartElapsed===null;i++) m.update(.05);
    assert.notEqual(m.get(s.people[4].id).heartElapsed,null); m.update(.1);
    const heart=m.get(s.people[4].id).heartElapsed, state=JSON.stringify(s);
    for(const profile of [profiles[0],profiles[9],profiles[4]]) {
        const next=layout(profile), fresh=sceneAt(next);
        m.relayout(fresh.nav,fresh.scene.stops,p=>({x:p.x,y:next.worldY(current.referenceY(p.y))}));
        near(m.get(s.people[4].id).heartElapsed,heart);
        for(const p of s.people) assert(fresh.nav.walkable(m.get(p.id)));
        near(distance(m.get(s.people[4].id),fresh.scene.stops.wedding[0]),0);
        current=next; data=fresh;
    }
    assert.equal(JSON.stringify(s),state); for(let i=0;i<100;i++)m.update(.05);
    assert.equal(m.get(s.people[4].id).heartElapsed,null);
    applyCommand(s,{type:'NIGHT'}); const battle=new BattleSimulation(s); m.sync(s,battle.base.towers);
    for(let i=0;i<40;i++)m.update(.05);
    const live=JSON.stringify(battle), before=JSON.stringify(s), next=layout(profiles[0]), fresh=sceneAt(next);
    m.relayout(fresh.nav,fresh.scene.stops,p=>({x:p.x,y:next.worldY(current.referenceY(p.y))}));
    for(let i=0;i<2500;i++) {m.update(.05);for(const p of s.people)assert(fresh.nav.walkable(m.get(p.id)));}
    for(const t of battle.base.towers)if(t.operator)assert(m.get(t.operator).insideTower);
    assert.equal(JSON.stringify(battle),live);assert.equal(JSON.stringify(s),before);
});
test('projectiles use resized muzzle and enemy body, preserve age and leave exact battle results untouched', () => {
    const s=createGame(7);applyCommand(s,{type:'NIGHT'}); const b=new BattleSimulation(s), m=new ProjectileMotion();
    for(const profile of [profiles[0],profiles[4],profiles[9]]) for(let tower=0;tower<4;tower++)for(const kind of ['ARROW','STONE','SLOW']) {
        const l=layout(profile),{scene}=sceneAt(l),shot={tower,kind,x:360,y:500,tick:0};
        b.tick=1;b.shots=[shot];m.update(b,l,scene.pads);
        const p=m.poses.find(p=>p.shot===shot),from=towerLaunch(tower,kind,scene.pads);
        near(p.x,from.x);near(p.y,from.y);
        if(kind==='ARROW')near(p.rotation,Math.atan2(l.worldY(shot.y)-20-from.y,shot.x-from.x)*180/Math.PI);
        b.tick=9;m.update(b,l,scene.pads);
        if(kind==='STONE'){near(p.x,shot.x);near(p.y,l.worldY(shot.y)-20);}
    }
    const a=new BattleSimulation(s), c=new BattleSimulation(s), l=layout(profiles[9]), {scene}=sceneAt(l);
    while(!a.outcome && a.tick<6000){a.step();c.step();m.update(a,l,scene.pads);}
    assert.equal(JSON.stringify(a),JSON.stringify(c));
});
test('in-flight native muzzle offset survives recoil and paused screen resize', () => {
    const before=layout(profiles[0]),after=layout(profiles[4]),first=layoutVillage(before),next=layoutVillage(after);
    const s=createGame(7);applyCommand(s,{type:'NIGHT'});const b=new BattleSimulation(s),m=new ProjectileMotion();
    const shot={tower:0,kind:'STONE',x:360,y:500,tick:0};b.shots=[shot];b.tick=1;
    const offset={x:17,y:-53};let calls=0;
    m.update(b,before,first.pads,index=>{calls++;return{x:first.pads[index].x+offset.x,y:first.pads[index].y+offset.y};});
    b.tick=3;m.update(b,before,first.pads,()=>{throw new Error('must not re-read a moving weapon');});
    const p=m.poses[0],age=b.tick;
    m.update(b,after,next.pads,()=>{throw new Error('paused resize must not resample recoil');});
    assert.equal(calls,1);assert.equal(b.tick,age);near(p.from.x,next.pads[0].x+offset.x);near(p.from.y,next.pads[0].y+offset.y);
});
test('crowded childcare keeps babies stationary and carers beside them across layout changes', () => {
    const s=createGame(11);s.people.forEach((p,i)=>{p.job='CARE';p.careChild=`1:${7+i}`;});
    while(s.people.length<20){const i=s.people.length;s.people.push({...s.people[0],id:`1:${i+1}`,adult:false,growth:0,job:'WAITING',careChild:null});}
    let current=layout(profiles[0]),data=sceneAt(current),m=new VillagerMotion(data.nav,data.scene.stops);m.sync(s,s.towers);
    for(const profile of [profiles[9],profiles[4],profiles[0]]) {
        const next=layout(profile),fresh=sceneAt(next);
        m.relayout(fresh.nav,fresh.scene.stops,p=>({x:p.x,y:next.worldY(current.referenceY(p.y))}));
        const babies=s.people.filter(p=>!p.adult).map(p=>({...m.get(p.id)}));
        const caring=new Set();
        for(let i=0;i<1500;i++){m.update(.05);for(const p of s.people){const pose=m.get(p.id);assert(fresh.nav.walkable(pose));
            const carerStop=p.job==='CARE' ? m.careStops.get(p.id) ?? fresh.scene.stops.rest[m.campSlots.get(p.id)] : null;
            if(carerStop && distance(pose,carerStop)<1e-6 && !pose.walking){
                assert(!pose.animated && pose.clip.endsWith('_walk'));
                const child=m.get(p.careChild),dx=child.x-pose.x,dy=child.y-pose.y;
                const [x,y]={UP:[0,-1],DOWN:[0,1],LEFT:[-1,0],RIGHT:[1,0]}[pose.direction];
                // Cardinal poses can hold across the 45-degree boundary by up to 5 degrees.
                assert(x*dx+y*dy >= Math.hypot(dx,dy)*Math.cos(50*Math.PI/180));
                assert(Math.abs(dx)>=24);caring.add(p.id);
            }
        }}
        babies.forEach(p=>near(distance(p,m.get(p.id)),0));
        assert.equal(caring.size,6);
        current=next;
    }
});
test('layout resize without screenTop preserves the visible popup and updates the open-data touch viewport without authorization', () => {
    global.Laya={Sprite:class{},OpenDataContextView:class{},Texture2D:class{}};
    const {GameView}=require(path.join(compiled,'view/GameView.js'));
    const {GamePanels}=require(path.join(compiled,'view/GamePanels.js'));
    const {VillageWorld}=require(path.join(compiled,'view/VillageWorld.js'));
    const old=layout(profiles[4]),data=sceneAt(old),game=createGame(7),motion=new VillagerMotion(data.nav,data.scene.stops);motion.sync(game,game.towers);
    let viewportUpdates=0,refreshes=0,clears=0; const ranking={updateViewPort(){viewportUpdates++;}};
    const box={width:668,height:860,y:0,pos(x,y){this.x=x;this.y=y;},scale(){},getChildByName(name){assert.equal(name,'FriendRankingCanvas');return ranking;}};
    const overlay={numChildren:1,graphics:{clear(){clears++;},drawRect(){}},size(){},getChildAt(){return box;}};
    const view=Object.create(GameView.prototype), w={windowWidth:360,windowHeight:880,statusBarHeight:28,safeArea:{top:28,bottom:856,left:0,right:360}}, menu={width:88,height:32,top:32,bottom:64,left:262,right:350};
    const village=Object.create(VillageWorld.prototype); Object.assign(village,{layout:old,scene:data.scene,motion,props:data.scene.props.map(p=>({...p,node:{pos(){}}}))});
    const panels=new GamePanels(game,{}, {}, {},overlay,old,()=>{},{});
    Object.assign(view,{layout:old,village,panels,platform:{window:w,menu},root:{size(){}},overlay,tip:{pos(){}},refresh(preserve){assert.equal(preserve,true);refreshes++;}});
    const before=JSON.stringify(game);view.resize();assert.equal(view.overlay,overlay);assert.equal(view.overlay.getChildAt(0),box);assert.equal(viewportUpdates,1);
    assert(Number.isFinite(box.y));assert(box.y>=view.layout.safeTop);assert(box.y+box.height<=view.layout.safeBottom);
    near(box.y,view.layout.safeTop+(view.layout.safeBottom-view.layout.safeTop-box.height)/2);view.resize();assert.equal(refreshes,1);assert.equal(clears,1);assert.equal(JSON.stringify(game),before);
});
