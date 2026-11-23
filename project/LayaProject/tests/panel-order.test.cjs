const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const root=process.env.DAIDAI_TEST_BUILD;
const {orderPanelRows}=require(path.join(root,'view/panels/PanelListOrder'));
const {personNeedsAttention,actionHints}=require(path.join(root,'view/ActionHints'));
const {createGame}=require(path.join(root,'game/VillageRules'));
test('entry sorting is stable, refresh uses fresh rows without moving them, reopening recomputes',()=>{
 const p={type:'build',scroll:80},rows=[{id:'farm',ready:false,value:1},{id:'house',ready:true,value:1},{id:'gate',ready:true,value:1}];
 const before=JSON.stringify(rows),sort=a=>orderPanelRows(p,a,r=>r.id,r=>r.ready);
 assert.deepEqual(sort(rows).map(r=>r.id),['house','gate','farm']);assert.equal(JSON.stringify(rows),before);
 const changed=rows.map(r=>({...r,ready:r.id==='farm',value:2}));
 assert.deepEqual(sort(changed).map(r=>r.id),['house','gate','farm']);assert(sort(changed).every(r=>r.value===2));assert.equal(p.scroll,80);
 p.rowOrder=undefined;assert.deepEqual(sort(changed).map(r=>r.id),['farm','house','gate']);
});
test('added and removed IDs do not move surviving rows or select stale objects',()=>{
 const p={type:'families'},sort=a=>orderPanelRows(p,a,r=>r.id,r=>r.ready);
 sort([{id:'a',ready:false},{id:'b',ready:true}]);
 const live={id:'a',ready:true};assert.deepEqual(sort([live,{id:'c',ready:true}]).map(r=>r.id),['a','c']);assert.equal(sort([live])[0],live);
});
test('people priorities lead to adults who can act, not an uncared child with no action button',()=>{
 const s=createGame(9),child={...s.people[0],id:'test-child',adult:false,job:'WAITING',nights:0,careChild:null};
 s.people[0].job='WAITING';assert(!s.people.some(p=>personNeedsAttention(s,p)));
 s.people.unshift(child);
 const eligible=s.people.filter(p=>personNeedsAttention(s,p));assert(eligible.length);assert(!eligible.includes(child));assert(eligible.every(p=>p.adult&&p.nights>0&&p.job!=='CARE'));assert(actionHints(s,false).people);
 s.phase='NIGHT';assert(!s.people.some(p=>personNeedsAttention(s,p)));
});
