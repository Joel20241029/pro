const assert = require('node:assert/strict');
const { test } = require('node:test');
const read = name => require(`${process.env.DAIDAI_TEST_BUILD}/${name}.js`);
const { HERO, SLOWER_HERO_SORTIE } = read('config/HeroConfig');
const { RULE } = read('config/RuleConfig');
const { BattleSimulation, PATH_LENGTH, pointAt } = read('game/BattleSimulation');
const { HeroSortie } = read('game/HeroSortie');
const { clone } = read('game/GameState');
const { GameSession } = read('game/GameSession');
const { applyCommand, createGame } = read('game/VillageRules');
const { SaveStore } = read('storage/SaveStore');
const { validateState } = read('storage/StateValidation');
const { heroStrikeDamage } = read('game/HeroSortie');
const { generateWave } = read('game/WaveGenerator');
const { TOWER_FLAGS } = read('config/DefenseConfig');

test('a newly built tower saves its flag without consuming gameplay randomness', () => {
    const flags = new Set();
    for (let seed = 1; seed <= 32; seed++) {
        const state = createGame(seed), before = state.rng.world;
        applyCommand(state, { type: 'TOWER', index: 2, kind: 'ARROW' });
        const flag = state.towers[2].flag;
        assert(TOWER_FLAGS.includes(flag));
        flags.add(flag);
        assert.equal(state.rng.world, before);
        const restored = JSON.parse(JSON.stringify(state));
        validateState(restored);
        applyCommand(restored, { type: 'TOWER', index: 2, kind: 'STONE' });
        assert.equal(restored.towers[2].flag, flag);
        assert.equal(restored.towers[3].flag, undefined);
    }
    assert.deepEqual(flags, new Set(TOWER_FLAGS));
});

test('a new night has the free hero while old active nights keep their own rules', () => {
    const state = createGame(12);
    const balances = [state.wood, state.food];
    applyCommand(state, { type: 'NIGHT' });
    validateState(state);
    assert.equal(state.night.activeHero, HERO.actorId);
    assert.equal(state.night.extendedHeroSortie, SLOWER_HERO_SORTIE);
    assert.equal(state.night.reinforcedEnemies, true);
    assert.deepEqual([state.night.returnPoint.wood, state.night.returnPoint.food], balances);
    const current = new BattleSimulation(state);
    const oldNight = clone(state);
    delete oldNight.night.activeHero;
    oldNight.night.heroSortie = true;
    oldNight.night.extendedHeroSortie = true;
    validateState(oldNight);
    const halfSpeed = new BattleSimulation(oldNight);
    delete oldNight.night.extendedHeroSortie;
    validateState(oldNight);
    const previous = new BattleSimulation(oldNight);
    delete oldNight.night.reinforcedEnemies;
    validateState(oldNight);
    const original = new BattleSimulation(oldNight);
    current.step(); halfSpeed.step(); previous.step(); original.step();
    const firstStep = battle => HERO.restPoint.y - battle.hero.position.y;
    assert(firstStep(current) > 0);
    assert(Math.abs(firstStep(current) / firstStep(halfSpeed) - .7) < 1e-10);
    assert(Math.abs(firstStep(halfSpeed) / firstStep(previous) - .5) < 1e-10);
    assert(Math.abs(firstStep(previous) / firstStep(original) - HERO.movementScale) < 1e-10);
    assert.equal(current.hero.secondsRemaining(0), 24);
    assert.equal(halfSpeed.hero.secondsRemaining(0), 24);
    assert.equal(previous.hero.secondsRemaining(0), 12);
    assert.equal(original.hero.secondsRemaining(0), 12);
    delete oldNight.night.heroSortie;
    validateState(oldNight);
    assert.equal(new BattleSimulation(oldNight).hero, null);
    oldNight.night.heroSortie = false;
    assert.throws(() => validateState(oldNight), /英雄快照/);
    state.night.reinforcedEnemies = false;
    assert.throws(() => validateState(state), /怪物强化快照/);
    state.night.reinforcedEnemies = true;
    state.night.extendedHeroSortie = false;
    assert.throws(() => validateState(state), /英雄出战快照/);
});

test('double-bottle contact follows both attack frames, including a visible miss', () => {
    const hero = new HeroSortie(HERO.bottleDamage, true, SLOWER_HERO_SORTIE);
    const mouth = pointAt(PATH_LENGTH);
    const at = { x: mouth.x, y: mouth.y - HERO.windupRange / 2 };
    const enemy = { seq: 1, hp: 3 * HERO.bottleDamage };
    const swing = [];
    for (let tick = 0; tick < HERO.sortieSeconds / RULE.step && swing.length < 2; tick++) {
        const hit = hero.advance(tick, swing.length ? [] : [{ enemy, at }]);
        if (hit) swing.push({ seconds: hero.motionSeconds, ...hit });
    }
    assert.deepEqual(swing.map(({ seconds, strike, direction }) => [seconds, strike, direction]), [
        [.25, 0, 'UP'],
        [.5, 1, 'UP']
    ]);
    assert.equal(swing[0].hurt.length, 1);
    assert.deepEqual(swing[0].at, swing[1].at);
    assert.deepEqual(swing[1].hurt, []);
    assert.equal(enemy.hp, 2 * HERO.bottleDamage);
});

test('new double-bottle rounds lock one enemy, prefer a nearby boss, and never spill after a kill', () => {
    const hero = new HeroSortie(13, true, SLOWER_HERO_SORTIE, true);
    const mouth = pointAt(PATH_LENGTH);
    const minion = { seq: 1, hp: 90, kind: 'enemy_raider' };
    const boss = { seq: 2, hp: 15, kind: 'enemy_chief' };
    const targets = [{ enemy: minion, at: { x: mouth.x, y: mouth.y - 20 } },
        { enemy: boss, at: { x: mouth.x, y: mouth.y - 30 } }];
    const strikes = [];
    for (let tick = 0; tick < 150 && strikes.length < 3; tick++) {
        const hit = hero.advance(tick, targets);
        if (hit) strikes.push({ tick, motion: hero.motionSeconds, ...hit });
    }
    assert.deepEqual(strikes.map(h => h.hurt.map(e => e.seq)), [[2], [], [1]]);
    assert.equal(boss.hp, 15 - Math.floor(13 * HERO.duel.bossMultiplier));
    assert.equal(minion.hp, 77);
    assert.equal((strikes[2].tick - strikes[0].tick) * RULE.step, HERO.duel.interval);
    assert.equal(Math.floor(strikes[0].motion * HERO.attackFrames), HERO.strikeFrames[0]);
    assert.equal(Math.floor(strikes[1].motion * HERO.attackFrames), HERO.strikeFrames[1]);
});

test('the first night uses real road positions and cycles returning, resting and deploying', () => {
    const state = createGame(1);
    applyCommand(state, { type: 'NIGHT' });
    const battle = new BattleSimulation(state), hero = battle.hero;
    assert.deepEqual(hero.position, HERO.restPoint);
    let firstHit = false, returnAt, restedAt, redeployedAt;
    for (; !battle.outcome && battle.tick < 2000;) {
        battle.step();
        if (battle.feedback.some(event => event.type === 'heroHit' && event.hurt.length > 0)) firstHit = true;
        if (hero.phase === 'returning') {
            returnAt ??= battle.tick - 1;
            assert(!battle.feedback.some(event => event.type === 'heroHit'));
        }
        if (restedAt === undefined && hero.phase === 'resting') {
            assert(returnAt !== undefined);
            assert.deepEqual(hero.position, HERO.restPoint);
            restedAt = battle.tick;
        }
        if (restedAt !== undefined && hero.phase === 'sortie') {
            redeployedAt = battle.tick;
            break;
        }
    }
    assert(firstHit);
    assert.equal(returnAt * RULE.step, 24);
    assert.equal(redeployedAt - restedAt, Math.round(HERO.restSeconds / RULE.step));
});

test('pausing freezes the sortie and abandoning retires the current actor', () => {
    const values = new Map();
    const session = new GameSession(new SaveStore({
        read: key => values.get(key) ?? null,
        write: (key, value) => values.set(key, value)
    }));
    session.load();
    session.newVillage();
    session.command({ type: 'NIGHT' });
    const hero = session.battle.hero;
    const rest = { ...hero.position };
    session.update(.25);
    assert.notDeepEqual(hero.position, rest);
    const before = { ...hero.position }, tick = session.battle.tick;
    session.pause('USER');
    session.update(.25);
    assert.equal(session.battle.tick, tick);
    assert.deepEqual(hero.position, before);
    session.pause('CHOICE');
    session.abandonNight();
    assert.equal(session.state.phase, 'DAY');
    assert.equal(session.battle, null);
    session.command({ type: 'NIGHT' });
    assert.notEqual(session.battle.hero, hero);
    assert.deepEqual(session.battle.hero.position, rest);
});

test('committee damage agrees with the actual battle and shared hero sound only emits on contact', () => {
    const state = createGame(47);
    state.day = 35; state.completed = state.legacy.bestNight = 34;
    state.wave = generateWave(state);
    const damage = heroStrikeDamage(state.day, state.wave.rhythm);
    applyCommand(state, { type: 'NIGHT' });
    const battle = new BattleSimulation(state);
    assert.equal(battle.hero.damage, damage);
    assert(damage > HERO.bottleDamage);
    const session = new GameSession(new SaveStore({ read: () => null, write() {} }));
    let cues = 0;
    session.onHeroHit = () => cues++;
    const hit = { type: 'heroHit', tick: 0, at: HERO.restPoint, direction: 'UP', strike: 0, hurt: [] };
    session.collectBattleStep({ feedback: [hit], outcome: null }, state);
    assert.equal(cues, 0);
    const landed = { ...hit, hurt: [{ seq: 1 }, { seq: 2 }] };
    session.collectBattleStep({ feedback: [landed], outcome: null }, state);
    assert.equal(cues, 1);
    assert.deepEqual(session.takeCombatFeedback(), [hit, landed]);
});
