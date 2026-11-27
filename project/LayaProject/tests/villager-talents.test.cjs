const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const load = file => require(path.join(process.env.DAIDAI_TEST_BUILD, file));
const { createGame, applyCommand } = load('game/VillageRules');
const { VILLAGER_QUALITY } = load('config/VillagerQuality');
const { validateState } = load('storage/StateValidation');
const { towerStats } = load('game/TowerStats');
const { Patrol } = load('game/Patrol');
const { patrolSpinStats } = load('game/PatrolRules');
const { PATROL } = load('config/PatrolConfig');

test('all four qualities inherit distinct parental talents before drawing outside their family', () => {
    const seen = new Set();
    for (let seed = 0; seed < 3000 && seen.size < 4; seed++) {
        const s = createGame(seed);
        s.completed = s.legacy.bestNight = 36; s.day = 37;
        s.people[0].traits = s.people[1].traits.slice();
        applyCommand(s, { type: 'BIRTH', family: s.families[0].id });
        const child = s.people.at(-1);
        assert(child.traits.includes('trait_crafty'));
        assert.equal(new Set(child.traits).size, VILLAGER_QUALITY[child.quality].traitCount);
        assert.equal(child.traits.length, new Set(child.traits).size);
        assert(child.traits.every(t => s.legacy.traits.includes(t)));
        seen.add(child.quality);
    }
    assert.equal(seen.size, 4);
});

test('multi-talent data rejects missing, extra, repeated or unknown traits', () => {
    for (const traits of [[], ['trait_crafty'], ['trait_strong', 'trait_strong'], ['trait_strong', 'unknown'], ['trait_strong', 'trait_nimble', 'trait_crafty']]) {
        const s = createGame(1);
        Object.assign(s.people[0], { origin: 'TRAVELER', quality: 'HERO', traits });
        assert.throws(() => validateState(s));
    }
    const s = createGame(1);
    Object.assign(s.people[0], { origin: 'TRAVELER', quality: 'HERO', traits: ['trait_strong','trait_nimble'] });
    validateState(s);
});

test('strong and nimble stack on every ammo without altering range or ice slow', () => {
    const s = createGame(1), person = s.people[0];
    for (const kind of ['ARROW','STONE','SLOW']) {
        person.traits = ['trait_crafty'];
        const normal = towerStats(s, kind, 1, person);
        person.traits = ['trait_strong','trait_nimble'];
        const both = towerStats(s, kind, 1, person);
        assert.equal(both.damage, normal.damage * 1.45);
        assert.equal(both.speed, 1.35);
        assert.deepEqual([both.range,both.slow], [normal.range,normal.slow]);
    }
});

test('nimble rapid captain empties the actual magazine at normal cadence and reloads in three seconds', () => {
    const s = createGame(1), captain = s.people.find(p => p.id === s.patrol.captain);
    applyCommand(s, {type:'PATROL_MODE', mode:'rapid'});
    applyCommand(s, {type:'NIGHT'});
    const base = patrolSpinStats(1,captain), plain = new Patrol(s).rapid;
    captain.traits = ['trait_strong','trait_nimble'];
    const spin = patrolSpinStats(1,captain), rapid = new Patrol(s).rapid;
    assert(spin.damage > base.damage && spin.ticks < base.ticks);
    assert(rapid.damage > plain.damage);
    const spec = PATROL.rapid;
    for (const gun of [plain,rapid]) {
        assert(gun.aim({x:0,y:-1}, spec.origin, spec.muzzleDistance));
        const tick = 1 / 60;
        for (let i = 0; i <= (gun.capacity - 1) * 60 / spec.shotsPerSecond; i++) gun.advance(tick, []);
        assert.equal(gun.ammo, 0);
    }
    assert.equal(plain.reloadRemaining,4);
    assert.equal(rapid.reloadRemaining,3);
    rapid.advance(2.9,[]); assert.equal(rapid.ammo,0);
    rapid.advance(.1,[]); assert.equal(rapid.ammo,rapid.capacity);
    plain.advance(3,[]); assert.equal(plain.ammo,0);
});
