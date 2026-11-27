const { test } = require('node:test');
const assert = require('node:assert/strict');
const read = name => require(`${process.env.DAIDAI_TEST_BUILD}/${name}.js`);
const { HERO, SONGLEI, SLOWER_HERO_SORTIE } = read('config/HeroConfig');
const { RULE } = read('config/RuleConfig');
const { RESOURCE_CONTRACT } = read('config/ResourceManifest');
const { BattleSimulation, PATH_LENGTH, pointAt } = read('game/BattleSimulation');
const { HeroSortie, paralyzed } = read('game/HeroSortie');
const { generateWave } = read('game/WaveGenerator');
const { createGame, applyCommand } = read('game/VillageRules');
const { validateState } = read('storage/StateValidation');
const { appearanceSeed } = read('game/EnemySeed');

const recruit = { type: 'RECRUIT_SONGLEI' };
const select = { type: 'SELECT_HERO', id: SONGLEI.actorId };
const hitTick = Math.ceil(Math.round(SONGLEI.interval / RULE.step) / HERO.attackFrames);

function eligible() {
    const state = createGame(31);
    state.completed = state.legacy.bestNight = SONGLEI.recruitment.waves;
    state.day = state.completed + 1;
    state.wave = generateWave(state);
    state.coins = SONGLEI.recruitment.coins;
    return state;
}

function monster(seq, progress, seed, kind = 'enemy_raider') {
    return { seq, kind, appearanceSeed: seed, progress, hp: 160, maxHp: 160, speed: 0,
        walkDistance: 0, slow: 0, slowTicks: 0, born: 0, summoned: 0 };
}

test('Song Lei unlocks once, validates with old villages, and is the only hero in his night replay', () => {
    const old = createGame(12);
    validateState(old);
    assert.throws(() => applyCommand(old, recruit), /守住/);
    assert.throws(() => applyCommand(old, select), /尚未加入/);
    const s = eligible();
    s.coins--;
    assert.throws(() => applyCommand(s, recruit), /尔币不足/);
    assert.equal(s.coins, SONGLEI.recruitment.coins - 1);
    s.coins++;
    applyCommand(s, recruit);
    assert.deepEqual([s.coins, s.songLeiUnlocked, s.selectedHero], [0, true, undefined]);
    assert.throws(() => applyCommand(s, recruit), /已加入/);
    applyCommand(s, select);
    applyCommand(s, { type: 'NIGHT' });
    const restored = JSON.parse(JSON.stringify(s));
    validateState(restored);
    const battle = new BattleSimulation(restored);
    assert.equal(battle.hero.actorId, SONGLEI.actorId);
    assert.equal(battle.delivery, null);
    assert.throws(() => applyCommand(restored, { type: 'SELECT_HERO', id: HERO.actorId }), /白天/);
    delete restored.songLeiUnlocked;
    assert.throws(() => validateState(restored), /出战英雄/);
});

test('electrical hit tries the furthest-progress living target and switches on proc', () => {
    let ordinaryProcs = 0;
    for (let seed = 1; seed <= 400; seed++) {
        const sortie = new HeroSortie(9, true, SLOWER_HERO_SORTIE, true, SONGLEI.actorId);
        const progress = PATH_LENGTH - 80;
        const at = pointAt(progress);
        Object.assign(sortie.position, at);
        const early = monster(1, progress, seed + 600);
        const nearGate = monster(2, progress + 30, seed);
        const candidates = [{ enemy: early, at }, { enemy: nearGate, at: pointAt(nearGate.progress) }];
        const strikes = [];
        for (let tick = 0; tick <= hitTick; tick++) {
            const hit = sortie.advance(tick, candidates);
            if (hit) strikes.push(hit);
        }
        assert.equal(strikes.length, 1);
        assert.deepEqual(strikes[0].hurt.map(e => e.seq), [nearGate.seq]);
        assert.equal(strikes[0].electric, true);
        assert.equal(early.hp, early.maxHp);
        if (!paralyzed(nearGate, hitTick)) continue;
        ordinaryProcs++;
        assert.equal(nearGate.paralyzedUntil, hitTick + Math.round(SONGLEI.paralysis.seconds / RULE.step));
        const after = [];
        for (let tick = hitTick + 1; tick <= hitTick * 5; tick++) {
            const hit = sortie.advance(tick, candidates);
            if (hit?.hurt.length) after.push(hit.hurt[0].seq);
        }
        assert.equal(after[0], early.seq);
    }
    assert(ordinaryProcs > 90 && ordinaryProcs < 150, `Unexpected proc rate: ${ordinaryProcs}/400`);
});

test('an enemy paralyzed on the crossing step waits at the gate while its neighbor moves', () => {
    // Find a published deterministic roll that triggers on the first contact.
    let seed = 1;
    while (appearanceSeed(0x50415241, seed, 8, hitTick, 0) % 100 >= SONGLEI.paralysis.chancePercent) seed++;
    const s = eligible();
    applyCommand(s, recruit); applyCommand(s, select); applyCommand(s, { type: 'NIGHT' });
    s.wave.entries = [];
    s.patrol.captain = null;
    s.towers.forEach(tower => tower.operator = null);
    const battle = new BattleSimulation(s);
    Object.assign(battle.hero.position, pointAt(PATH_LENGTH - 20));
    const speed = 20;
    const atGate = { ...monster(8, PATH_LENGTH - (hitTick + 1) * speed * RULE.step + .01, seed), speed };
    const second = { ...monster(9, PATH_LENGTH - 180, 89), speed: 13 };
    battle.enemies = [atGate, second];
    const before = battle.gate;
    while (battle.tick <= hitTick) battle.step();
    assert(paralyzed(atGate, battle.tick));
    assert.equal(battle.gate, before);
    const progress = atGate.progress, neighbor = second.progress, until = atGate.paralyzedUntil;
    while (battle.tick < until) battle.step();
    assert.equal(atGate.progress, progress);
    assert(second.progress > neighbor);
    battle.step();
    assert(battle.gate < before);
    assert(!battle.enemies.includes(atGate));

    const boss = monster(8, PATH_LENGTH - 40, seed, 'enemy_chief');
    const hero = new HeroSortie(9, true, SLOWER_HERO_SORTIE, true, SONGLEI.actorId);
    const point = pointAt(boss.progress);
    Object.assign(hero.position, point);
    for (let tick = 0; tick <= hitTick; tick++) hero.advance(tick, [{ enemy: boss, at: point }]);
    assert.equal(boss.paralyzedUntil, hitTick + Math.round(SONGLEI.paralysis.bossSeconds / RULE.step));
});

test('all twenty Song Lei poses, eight clips and the prep portrait are in the native village contract', () => {
    const { village } = RESOURCE_CONTRACT;
    for (const direction of ['down', 'up', 'left', 'right']) {
        const root = `hero_songlei_${direction}`;
        for (const suffix of ['idle', 'walk_0', 'walk_1', 'attack_0', 'attack_1']) assert(village.frames.includes(`${root}_${suffix}`));
        for (const action of ['walk', 'attack']) assert(village.clips.includes(`${root}_${action}`));
    }
    assert(village.frames.includes(SONGLEI.portrait));
});
