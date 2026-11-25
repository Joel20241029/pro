const { test } = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const compiled = process.env.DAIDAI_TEST_BUILD;
if (!compiled) throw new Error('Set DAIDAI_TEST_BUILD to the compiled project under Downloads');
const { actionHints, actionHintsBlocked } = require(path.join(compiled, 'view/ActionHints.js'));
const { createGame, applyCommand, capacity } = require(path.join(compiled, 'game/VillageRules.js'));
const { RULE, TOWERS } = require(path.join(compiled, 'game/GameConfig.js'));
const { gateCapacity, upgradeCost, residentialCost } = require(path.join(compiled, 'game/Growth.js'));
const { GameSession } = require(path.join(compiled, 'game/GameSession.js'));
const { SaveStore } = require(path.join(compiled, 'storage/SaveStore.js'));
const hint = s => actionHints(s, false);
function marriedOnly() { const s = createGame(1); s.people = s.people.filter(p => s.families[0].partners.includes(p.id)); s.families = [s.families[0]]; return s; }
function noFunds() { const s = createGame(2); s.food = 0; s.wood = 0; return s; }
test('queries preserve every state field and RNG, with no archive red dot', () => {
    const s = createGame(1), before = JSON.stringify(s);
    for (let i = 0; i < 20; i++) { assert(hint(s).families); assert(hint(s).build); assert.equal(hint(s).history, false); }
    assert.equal(JSON.stringify(s), before);
});
test('family hint represents a legal marriage even without birth food, not a same-sex or related pairing', () => {
    const s = noFunds(); s.families = []; s.people = s.people.slice(0, 2); s.people[0].sex = 'MALE'; s.people[1].sex = 'FEMALE';
    assert(hint(s).families); assert.doesNotThrow(() => applyCommand(s, {type:'FAMILY', a:s.people[0].id, b:s.people[1].id}));
    assert.equal(hint(s).families, false);
    s.families = []; s.people[1].sex = 'MALE'; assert.equal(hint(s).families, false);
    s.people[1].sex = 'FEMALE'; s.people[1].parents = [s.people[0].id]; s.people[1].ancestors = [s.people[0].id]; assert.equal(hint(s).families, false);
    s.people[1].parents = []; s.people[1].ancestors = []; s.nextFamily = Number.MAX_SAFE_INTEGER; assert.equal(hint(s).families, false);
});
test('birth hint shares cooldown, parent, food, space and safe ID restrictions', () => {
    for (const block of [
        s => s.food = RULE.birthCost - 1,
        s => s.families[0].lastBirth = s.completed,
        s => s.people[0].nights = 0,
        s => s.nextPerson = Number.MAX_SAFE_INTEGER,
        s => { while (s.people.length < capacity(s)) s.people.push({...s.people[0], id:`elder:${s.people.length}`, nights:0}); }
    ]) { const s = marriedOnly(); assert(hint(s).families); block(s); assert.equal(hint(s).families, false); }
    const s = marriedOnly(); applyCommand(s, {type:'BIRTH', family:s.families[0].id, carer:s.people[0].id}); assert.equal(hint(s).families, false);
});
test('build hints switch at exact costs, full houses/gate do not keep them lit', () => {
    const s = noFunds(); applyCommand(s, {type:'PATROL_CAPTAIN', id:s.people[4].id}); s.houses = 100; s.gate = gateCapacity(s); assert.equal(hint(s).build, false);
    s.houses--; const expansion = residentialCost(s.houses); s.wood = expansion.wood; s.food = expansion.food - 1;
    // Other cheap upgrades can also light the shared dot; expansion's own boundary is tested through its command.
    assert.throws(() => applyCommand(s, {type:'BUILD',kind:'HOUSE'}));
    s.food++; assert(hint(s).build); applyCommand(s, {type:'BUILD',kind:'HOUSE'}); assert.equal(hint(s).build, false);
    s.gate--; s.wood = RULE.repairCost; assert(hint(s).build); applyCommand(s,{type:'REPAIR'}); assert.equal(hint(s).build, false);
    const cost = upgradeCost('FARM', s.farm); s.wood = cost.wood; s.food = cost.food; assert(hint(s).build);
    assert.doesNotThrow(() => applyCommand(s,{type:'BUILD',kind:'FARM'}));
});
test('tower state never creates a map hint or adds work to the archive button', () => {
    const s = createGame(1); assert.equal('towers' in hint(s), false);
    s.towers.forEach(t => { t.kind = null; t.level = 0; t.operator = null; });
    assert.equal('towers' in hint(s), false); assert.equal(hint(s).history, false);
});
test('children grow without alerting the player to assign a carer', () => {
    const s=createGame(1);assert.equal(hint(s).people,false);
    s.people.find(p=>p.job==='FARM').job='WAITING';assert.equal(hint(s).people,false);
    applyCommand(s,{type:'JOB',id:s.people.find(p=>p.job==='WAITING').id,job:'FARM'});assert.equal(hint(s).people,false);
    const child={...s.people[0],id:'child',adult:false,nights:0,job:'WAITING'};s.people.push(child);assert.equal(hint(s).people,false);
});
test('loading, foreground confirmation, rewards and save-pending suppress hints; normal panels do not', () => {
    const values=new Map(),store=new SaveStore({read:k=>values.get(k)??null,write:(k,v)=>values.set(k,v)}),game=new GameSession(store);game.state=createGame(3);
    for(const pause of ['BACKGROUND','WAIT_RESUME','DAILY_RATION','SAVE_PENDING','ASSETS','DISABLED']) {
        game.pause(pause);assert(actionHintsBlocked(game));assert.equal(actionHints(game.state,actionHintsBlocked(game)).families,false);game.resume(pause);
    }
    game.pause('CHOICE');assert.equal(actionHintsBlocked(game),false);assert(hint(game.state).families);
    game.dailyRationDate='2026-11-13';assert(actionHintsBlocked(game));game.dailyRationDate=null;
    store.inspect();store.prepare(game.state);assert(actionHintsBlocked(game));store.commit();assert.equal(actionHintsBlocked(game),false);
    for(const phase of ['NIGHT','DAWN','GAME_OVER']) {game.state.phase=phase;assert.deepEqual(Object.values(hint(game.state)),[false,false,false,false]);}
});
