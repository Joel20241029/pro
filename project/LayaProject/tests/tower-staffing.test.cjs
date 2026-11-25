const { test } = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const compiled = process.env.DAIDAI_TEST_BUILD;
if (!compiled) throw new Error('Set DAIDAI_TEST_BUILD to the compiled project under Downloads');
const { createGame, applyCommand, finishNight, autoAssignOperators, assignOperator } = require(path.join(compiled, 'game/VillageRules.js'));
const { autoAssignNightDuties } = require(path.join(compiled, 'game/VillageJobs.js'));
const { isWorkingAdult, clone } = require(path.join(compiled, 'game/GameState.js'));
const { GameSession } = require(path.join(compiled, 'game/GameSession.js'));
const { BattleSimulation } = require(path.join(compiled, 'game/BattleSimulation.js'));
const { SaveStore, canonical } = require(path.join(compiled, 'storage/SaveStore.js'));
const { validateState } = require(path.join(compiled, 'storage/StateValidation.js'));
const { RULE, TOWERS } = require(path.join(compiled, 'game/GameConfig.js'));
class Sprite { pos() {return this;} size() {return this;} addChild(n) {return n;} }
global.Laya = { Sprite, OpenDataContextView: class {}, Texture2D: class {} };
const { drawBuildingPanel } = require(path.join(compiled, 'view/panels/BuildingPanels.js'));

function operators(s) { return s.towers.map(t => t.operator); }
function retainWorkers(s, ids) {
    for (const p of s.people) if (p.adult && !ids.includes(p.id)) { p.nights = 0; p.elderNights = RULE.elderNights; p.job = 'WAITING'; p.careChild = null; }
    for (const tower of s.towers) if (tower.operator && !ids.includes(tower.operator)) tower.operator = null;
    if (!ids.includes(s.patrol.captain)) s.patrol.captain = null;
    autoAssignNightDuties(s);
}
function assertCoverage(s) {
    const assigned = operators(s).filter(Boolean), built = s.towers.filter(t => t.kind).length;
    assert.equal(assigned.length, Math.min(built, s.people.filter(p => isWorkingAdult(p) && p.id !== s.patrol.captain).length));
    assert.equal(new Set(assigned).size, assigned.length); validateState(s);
}

test('automatic staffing preserves founders, existing choices, daytime jobs and random state', () => {
    const s = createGame(7), original = canonical(s);
    assert.equal(s.towers[0].operator, s.people[3].id); assert.equal(s.towers[1].operator, s.people[2].id);
    autoAssignOperators(s); assert.equal(canonical(s), original);
    s.towers[0].operator = null; const jobs = s.people.map(p => [p.job, p.careChild]), rng = canonical(s.rng);
    autoAssignOperators(s); assert.equal(s.towers[0].operator, s.people[1].id);
    assert.deepEqual(s.people.map(p => [p.job, p.careChild]), jobs); assert.equal(canonical(s.rng), rng);
    const filled = canonical(s); autoAssignOperators(s); assert.equal(canonical(s), filled); assertCoverage(s);
});

test('new towers fill immediately and changing tower type keeps its chosen operator', () => {
    const s = createGame(7), original = operators(s); s.wood = TOWERS.ARROW.cost * 2;
    applyCommand(s, { type: 'TOWER', index: 2, kind: 'ARROW' });
    assert.equal(s.towers[2].operator, s.people[1].id); assert.deepEqual(operators(s).slice(0, 2), original.slice(0, 2));
    applyCommand(s, { type: 'TOWER', index: 3, kind: 'ARROW' }); assertCoverage(s);
    const crew = operators(s); s.wood = RULE.towerConvert;
    applyCommand(s, { type: 'TOWER', index: 2, kind: 'STONE' }); assert.deepEqual(operators(s), crew); assertCoverage(s);
});

test('daytime occupations after a birth do not exclude eligible tower operators', () => {
    const s = createGame(7); applyCommand(s, { type: 'BIRTH', family: s.families[0].id, carer: s.people[1].id });
    s.towers[0].operator = null; autoAssignOperators(s);
    assert.equal(s.towers[0].operator, s.people[1].id); assert.equal(s.people[1].job, 'FARM'); assertCoverage(s);
});

test('only an adult shortage leaves built towers unstaffed and empty building pads stay empty', () => {
    const s = createGame(7); retainWorkers(s, [s.people[0].id, s.people[1].id]); assertCoverage(s);
    assert.equal(s.towers[1].operator, null); assert.equal(s.towers[2].kind, null); assert.equal(s.towers[2].operator, null);
    retainWorkers(s, []); assertCoverage(s); assert(operators(s).every(id => id === null));
});

test('manual cross-tower choice swaps operators and selecting the current villager is a no-op', () => {
    const s = createGame(7), before = operators(s);
    assignOperator(s, 0, before[1]); assert.deepEqual(operators(s), [before[1], before[0], null, null, null]);
    const same = canonical(s); assignOperator(s, 0, before[1]); assert.equal(canonical(s), same); assertCoverage(s);
});

test('during a shortage the player can move the only operator to a chosen later tower', () => {
    const s = createGame(7), id = s.people[1].id; retainWorkers(s, [s.patrol.captain, id]);
    assignOperator(s, 1, id); assert.deepEqual(operators(s), [null, id, null, null, null]);
    autoAssignOperators(s); assert.deepEqual(operators(s), [null, id, null, null, null]); assertCoverage(s);
});

test('null, empty, missing, child and retired selections are rejected without modifying assignments', () => {
    const s = createGame(7); applyCommand(s, { type: 'BIRTH', family: s.families[0].id, carer: s.people[0].id });
    retainWorkers(s, [s.people[0].id, s.people[1].id]); const before = canonical(s), child = s.people.find(p => !p.adult);
    for (const id of [null, '', 'missing', child.id, s.people[2].id]) assert.throws(() => assignOperator(s, 0, id));
    assert.throws(() => assignOperator(s, 2, s.people[0].id)); assert.equal(canonical(s), before);
});

test('a retiring operator is replaced at the successful dawn without waiting for another command', () => {
    const s = createGame(7), retired = s.towers[0].operator, retained = s.towers[1].operator;
    s.people.find(p => p.id === retired).nights = 1;
    applyCommand(s, { type: 'NIGHT' }); finishNight(s, s.gate, operators(s));
    assert(!operators(s).includes(retired)); assert.equal(s.towers[1].operator, retained); assertCoverage(s);
});

test('a child becoming an adult fills a vacancy immediately without a dawn skill choice', () => {
    const s = createGame(7), carer = s.people[1];
    applyCommand(s, { type: 'BIRTH', family: s.families[0].id, carer: carer.id });
    const child = s.people.find(p => !p.adult); child.growth = RULE.growNights - 1;
    retainWorkers(s, [carer.id]); assertCoverage(s);
    applyCommand(s, { type: 'NIGHT' }); finishNight(s, s.gate, operators(s));
    assert.equal(child.adult, true); assert(child.traits.length > 0); assert(operators(s).includes(child.id)); assertCoverage(s);
    assert(!s.choices.some(q => q.kind === 'SKILL')); assertCoverage(s);
});

test('accepting a traveler immediately fills a vacancy; declining does not add an operator', () => {
    for (const accept of [false, true]) {
        const s = createGame(7); retainWorkers(s, [s.people[0].id]);
        const traveler = clone(s.people[0]); traveler.id = `${s.run}:${s.nextPerson++}`; traveler.origin = 'TRAVELER'; traveler.job = 'WAITING';
        s.phase = 'DAWN'; s.wave = null; s.choices = [{ kind: 'TRAVELER', person: traveler }]; validateState(s);
        applyCommand(s, { type: 'CHOOSE', value: accept ? 'accept' : 'decline' });
        assert.equal(operators(s).includes(traveler.id), accept); assertCoverage(s);
    }
});

test('entering night fills remaining vacancies before the saved battle baseline is created', () => {
    const s = createGame(7); s.towers[0].operator = null;
    applyCommand(s, { type: 'NIGHT' }); assertCoverage(s);
    assert.deepEqual(new BattleSimulation(s).operators, operators(s));
});

test('when all working adults are stationed the last staffed tower makes room for a captain', () => {
    const s = createGame(7);
    retainWorkers(s, [s.people[2].id, s.people[3].id]);
    s.patrol.captain = null;
    s.towers[1].operator = s.people[2].id;
    const towerZero = s.towers[0].operator, towerOne = s.towers[1].operator;
    autoAssignNightDuties(s);
    assert.equal(s.patrol.captain, towerOne);
    assert.equal(s.towers[0].operator, towerZero);
    assert.equal(s.towers[1].operator, null);
    assertCoverage(s);
    const snapshot = canonical(s);
    autoAssignNightDuties(s);
    assert.equal(canonical(s), snapshot);
});

test('night swaps preserve battle progress and saved assignments, then resume without restarting the battle', () => {
    const values = new Map(), storage = { read: key => values.get(key) ?? null, write: (key, raw) => values.set(key, raw) };
    const game = new GameSession(new SaveStore(storage)); game.load(); game.newVillage(); game.command({ type: 'NIGHT' }); game.update(.15);
    const battle = game.battle, tick = battle.tick, baseline = canonical(game.state), original = battle.operators;
    game.pause('CHOICE'); assert.equal(game.reassign(0, original[1]), true);
    assert.deepEqual(battle.operators.slice(0, 2), [original[1], original[0]]); assert.equal(battle.tick, tick);
    assert.equal(canonical(game.state), baseline); game.resume('CHOICE'); game.update(.05);
    assert.equal(game.battle, battle); assert.equal(battle.tick, tick + game.state.settings.speed);
    const reopened = new GameSession(new SaveStore(storage)); reopened.load(); assert.deepEqual(reopened.battle.operators, original);
});

test('tower panel offers replacement but no release action, and explains auto staffing', () => {
    const s = createGame(7), buttons = [], view = {}; let help;
    Object.assign(view, { art: {panel(){}, portraitId(p){return p.id;}}, game: { state: s, battle: null, pauses: new Set() },
        modal(title, overview, close, size, text) { help = text; return new Sprite(); },
        ui: { image() {}, buildRow() {}, iconValue() {}, label() { return {}; }, centerButton(parent, text) { buttons.push(text); },
            button(parent, text) { buttons.push(text); return { getChildByName: () => ({ getChildByName: () => new Sprite() }) }; } } });
    drawBuildingPanel(view, s, { type: 'tower', index: 0 });
    assert(buttons.includes('换人')); assert(!buttons.some(text => text.includes('释放'))); assert(help.includes('自动补上可用成年人'));
});
