const { test } = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const compiled = process.env.DAIDAI_TEST_BUILD;
if (!compiled) throw new Error('Set DAIDAI_TEST_BUILD to the compiled project under Downloads');
const { actionHints, actionHintsBlocked, constructionHints, towerActionHints, towerAmmoActionHints } = require(path.join(compiled, 'view/ActionHints.js'));
const { createGame, applyCommand, capacity } = require(path.join(compiled, 'game/VillageRules.js'));
const { RULE } = require(path.join(compiled, 'game/GameConfig.js'));
const { TOWER_BUILD_COINS } = require(path.join(compiled, 'config/DefenseConfig.js'));
const { ICE_AMMO_OFFER } = require(path.join(compiled, 'config/ShopConfig.js'));
const { FEATURE_WINS } = require(path.join(compiled, 'config/DailyTaskConfig.js'));
const { gateCapacity, upgradeCost, residentialCost } = require(path.join(compiled, 'game/Growth.js'));
const { GameSession } = require(path.join(compiled, 'game/GameSession.js'));
const { SaveStore } = require(path.join(compiled, 'storage/SaveStore.js'));
const hint = s => actionHints(s, false);
function marriedOnly() { const s = createGame(1); s.people = s.people.filter(p => s.families[0].partners.includes(p.id)); s.families = [s.families[0]]; return s; }
function noFunds() { const s = createGame(2); s.coins = 0; return s; }
test('queries preserve every state field and RNG, with no archive red dot', () => {
    const s = createGame(1), before = JSON.stringify(s);
    for (let i = 0; i < 20; i++) { assert(hint(s).families); assert(hint(s).build); assert.equal(hint(s).history, false); }
    assert.equal(JSON.stringify(s), before);
});
test('family hint represents a legal marriage even without birth funds, not a same-sex or related pairing', () => {
    const s = noFunds(); s.families = []; s.people = s.people.slice(0, 2); s.people[0].sex = 'MALE'; s.people[1].sex = 'FEMALE';
    assert(hint(s).families); assert.doesNotThrow(() => applyCommand(s, {type:'FAMILY', a:s.people[0].id, b:s.people[1].id}));
    assert.equal(hint(s).families, false);
    s.families = []; s.people[1].sex = 'MALE'; assert.equal(hint(s).families, false);
    s.people[1].sex = 'FEMALE'; s.people[1].parents = [s.people[0].id]; s.people[1].ancestors = [s.people[0].id]; assert.equal(hint(s).families, false);
    s.people[1].parents = []; s.people[1].ancestors = []; s.nextFamily = Number.MAX_SAFE_INTEGER; assert.equal(hint(s).families, false);
});
test('birth hint shares cooldown, parent, coins, space and safe ID restrictions', () => {
    for (const block of [
        s => s.coins = RULE.birthCost - 1,
        s => s.families[0].lastBirth = s.completed,
        s => s.people[0].nights = 0,
        s => s.nextPerson = Number.MAX_SAFE_INTEGER,
        s => { while (s.people.length < capacity(s)) s.people.push({...s.people[0], id:`elder:${s.people.length}`, nights:0}); }
    ]) { const s = marriedOnly(); assert(hint(s).families); block(s); assert.equal(hint(s).families, false); }
    const s = marriedOnly(); applyCommand(s, {type:'BIRTH', family:s.families[0].id, carer:s.people[0].id}); assert.equal(hint(s).families, false);
});
test('construction alerts for every affordable improvement and only marks damage that can be repaired', () => {
    const s = createGame(2);
    s.coins = 100;
    const repairs = () => constructionHints(s, false).REPAIR;
    assert.deepEqual(constructionHints(s, false), {
        REPAIR: false, HOUSE: true, PATROL: true, FACTORY: true, GATE: true
    });
    s.gate = gateCapacity(s) - 1;
    s.coins = RULE.repairCost - 1; assert(!repairs());
    s.coins++; assert(repairs()); assert(hint(s).build);
    applyCommand(s, { type: 'REPAIR' }); assert(!repairs());
    const cost = residentialCost(s.houses);
    s.coins = cost.coins - 1;
    assert(!constructionHints(s, false).HOUSE);
    s.coins++; assert(constructionHints(s, false).HOUSE);
    applyCommand(s, { type: 'BUILD', kind: 'HOUSE' });
    assert(!constructionHints(s, false).HOUSE);
    s.houses = 100;
    Object.assign(s, residentialCost(s.houses));
    assert(!constructionHints(s, false).HOUSE, 'housing stops once every bed is added');
    assert(!Object.values(constructionHints(s, true)).some(Boolean));
});
test('towers alert only for build, upgrade, genuine vacancy filling, and actionable ammo', () => {
    const s = createGame(1);
    const empty = s.towers.findIndex(t => !t.kind), tower = s.towers.findIndex(t => t.kind);
    const towerHints = index => towerActionHints(s, index, false);
    assert.equal(hint(s).history, false);
    s.coins = TOWER_BUILD_COINS - 1;
    assert(!towerHints(empty).build);
    s.coins++; assert(towerHints(empty).build);
    s.coins = 0;
    assert(!towerHints(tower).ammo, 'ordinary swapping does not generate a reminder');
    Object.assign(s, upgradeCost('TOWER', s.towers[tower].level));
    assert(towerHints(tower).upgrade);
    s.coins = upgradeCost('AMMO', s.ammoLevels.ARROW).coins;
    assert(towerHints(tower).ammo);
    s.coins = 0;
    s.towers[tower].operator = null;
    assert(towerHints(tower).staff);
    s.people = s.people.filter(q => s.towers.some(t => t.operator === q.id) || q.id === s.patrol.captain);
    assert(!towerHints(tower).staff, 'swaps alone only relocate an empty position');
    s.legacy.bestNight = FEATURE_WINS.shop;
    s.coins = ICE_AMMO_OFFER.coins;
    s.ammoLevels.ARROW = s.ammoLevels.STONE = 10;
    assert(!Object.values(towerAmmoActionHints(s, 'SLOW', false)).some(Boolean));
    assert(!towerHints(tower).ammo, 'locked ammo is only promoted in the shop');
    s.iceAmmoUnlocked = true;
    assert(towerAmmoActionHints(s, 'SLOW', false).equip);
    assert(towerHints(tower).ammo);
    s.towers[tower].kind = 'SLOW';
    assert(!towerAmmoActionHints(s, 'SLOW', false).equip);
    assert(!Object.values(towerActionHints(s, tower, true)).some(Boolean));
});
test('a daytime vacancy points to an idle adult and child growth has no assignment hint', () => {
    const s=createGame(1);assert.equal(hint(s).people,false);
    s.people.find(p=>p.job==='SEWING').job='WAITING';assert.equal(hint(s).people,true);
    applyCommand(s,{type:'JOB',id:s.people.find(p=>p.job==='WAITING').id,job:'SEWING'});assert.equal(hint(s).people,false);
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
