const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const root=process.env.DAIDAI_TEST_BUILD;
const {orderPanelRows}=require(path.join(root,'view/panels/PanelListOrder'));
const {actionHints}=require(path.join(root,'view/ActionHints'));
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
test('children growing naturally cause no staffing alert in either phase',()=>{
 const s=createGame(9);
 s.people.unshift({...s.people[0],id:'test-child',adult:false,job:'WAITING',nights:0});
 assert.equal(actionHints(s,false).people,false);
 s.phase='NIGHT';assert.equal(actionHints(s,false).people,false);
});
