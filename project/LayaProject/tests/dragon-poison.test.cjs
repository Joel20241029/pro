const { test } = require('node:test');
const assert = require('node:assert/strict');
const read = name => require(`${process.env.DAIDAI_TEST_BUILD}/${name}.js`);
const { DEFAULT_TACTIC, DRAGON_POISON, DRAGON_POISON_TACTIC, tacticDefinition } = read('config/TacticConfig');
const { PADS, RULE, TOWERS } = read('game/GameConfig');
const { createGame, applyCommand } = read('game/VillageRules');
const { generateWave } = read('game/WaveGenerator');
const { BattleSimulation, PATH_LENGTH } = read('game/BattleSimulation');
const { enemyPoint } = read('game/BattleRoad');
const { GameSession } = read('game/GameSession');
const { SaveStore } = read('storage/SaveStore');

function village() {
    const s = createGame(43);
    s.completed = s.legacy.bestNight = 45; s.day = 46;
    s.coins = 250; s.wave = generateWave(s);
    s.tactics.extraSlots = [null];
    applyCommand(s, { type: 'TACTIC_LEARN', id: DRAGON_POISON_TACTIC, slot: 1 });
    return s;
}

function battle() {
    const s = village();
    applyCommand(s, { type: 'NIGHT' });
    // This isolated poison fixture uses a night without committee support.
    delete s.night.activeHero;
    const b = new BattleSimulation(s);
    b.base.towers.forEach(t => t.operator = null);
    b.base.wave.entries = [{ tick: 5, kind: 'enemy_raider', appearanceSeed: 7 }];
    return b;
}

function enemy(seq, kind, hp, progress = 150) {
    return { seq, kind, hp, maxHp: 1000, progress, speed: 0, appearanceSeed: seq,
        walkDistance: 0, slow: 0, slowTicks: 0, born: 0, summoned: 0 };
}

function stepUntil(b, tick) {
    while (b.tick < tick) {
        assert.equal(b.outcome, null, 'fixture must stay in combat until the requested tick');
        b.step();
    }
}

test('dragon poison learns at wave 45 with one fee and survives a saved loadout round-trip', () => {
    const s = village(), t = tacticDefinition(DRAGON_POISON_TACTIC);
    assert.deepEqual([t.name, t.buttonName, t.unlockWaves, t.usesPerNight, t.coins], ['龙龙主母', '主母', 45, 1, 230]);
    assert.equal(s.coins, 20);
    const old = createGame(43); old.completed = 44; old.day = 45; old.coins = 250;
    assert.throws(() => applyCommand(old, { type: 'TACTIC_LEARN', id: DRAGON_POISON_TACTIC }), /还需守住 1 波/);
    applyCommand(s, { type: 'NIGHT' });
    const values = new Map(), port = { read: k => values.get(k) ?? null, write: (k,v) => values.set(k,v) };
    const store = new SaveStore(port); store.inspect(); store.prepare(s); store.commit();
    const game = new GameSession(new SaveStore(port)); game.load();
    assert.equal(game.state.coins, 20);
    assert.deepEqual(game.battle.tactics.map(t => t.id), [DEFAULT_TACTIC, DRAGON_POISON_TACTIC]);
    game.bell(DRAGON_POISON_TACTIC);
    game.pause('USER'); game.update(RULE.step);
    assert.equal(game.battle.bellTicks, 120);
    assert.equal(game.battle.usesLeftFor(tacticDefinition(DRAGON_POISON_TACTIC)), 0);
});

test('all enemies infect on cast or spawn and take six one-second poison ticks from their own infection', () => {
    const b = battle(), small = enemy(10, 'enemy_armored', 1000), boss = enemy(11, 'enemy_commander', 1000);
    b.enemies = [small, boss, enemy(12, 'enemy_raider', 0)];
    assert(b.bell(DRAGON_POISON_TACTIC));
    assert(b.isPoisoned(small.seq) && b.isPoisoned(boss.seq) && !b.isPoisoned(12));
    stepUntil(b, 19);
    const newEnemy = b.enemies.find(e => e.seq === 0), initialHp = newEnemy.hp;
    const newEnemyDamage = Math.floor(newEnemy.maxHp * DRAGON_POISON.smallPermille / 1000);
    assert(b.isPoisoned(newEnemy.seq));
    assert.deepEqual([small.hp, boss.hp], [1000, 1000]);
    b.step();
    assert.deepEqual([small.hp, boss.hp], [960, 985]);
    assert.deepEqual(b.feedback.find(e => e.type === 'poison').hurt.map(e => e.seq), [10, 11]);
    stepUntil(b, 24);
    assert.equal(newEnemy.hp, initialHp);
    b.step();
    assert.equal(newEnemy.hp, initialHp - newEnemyDamage);
    stepUntil(b, 120);
    assert.deepEqual([small.hp, boss.hp, newEnemy.hp], [760, 910, initialHp - newEnemyDamage * 5]);
    assert(!b.isPoisoned(small.seq));
    assert(b.isPoisoned(newEnemy.seq));
    assert.equal(b.cooldownFor(DEFAULT_TACTIC), 0);
    stepUntil(b, 125);
    assert.equal(newEnemy.hp, initialHp - newEnemyDamage * 6);
    assert(!b.isPoisoned(newEnemy.seq));
    assert(!b.bell(DRAGON_POISON_TACTIC));
});

test('late spawns and summoned children are poisoned after all early poison expires and during another tactic', () => {
    const b = battle(), opening = enemy(10, 'enemy_raider', 1000);
    const ready = tacticDefinition(DRAGON_POISON_TACTIC).ticks;
    b.base.wave.entries = [{ tick: ready + 10, kind: 'enemy_chief', appearanceSeed: 7 }];
    b.enemies = [opening];
    assert(b.bell(DRAGON_POISON_TACTIC));
    stepUntil(b, ready);
    assert(!b.isPoisoned(opening.seq));
    assert(b.bell(DEFAULT_TACTIC));
    b.base.towers.forEach(tower => tower.operator = null);
    stepUntil(b, ready + 11);
    const boss = b.enemies.find(e => e.kind === 'enemy_chief');
    assert(b.isPoisoned(boss.seq));
    assert.equal(boss.hp, boss.maxHp);
    boss.speed = 0;
    stepUntil(b, boss.born + RULE.summonTicks[0] + 1);
    assert(!b.isPoisoned(boss.seq));
    const children = b.enemies.filter(e => e.born === boss.born + RULE.summonTicks[0]);
    assert.equal(children.length, 2);
    assert(children.every(e => b.isPoisoned(e.seq) && e.hp === e.maxHp));
    stepUntil(b, children[0].born + DRAGON_POISON.intervalTicks);
    assert(children.every(e => e.hp === e.maxHp - Math.floor(e.maxHp * DRAGON_POISON.smallPermille / 1000)));
    assert.equal(b.bellTicks, tacticDefinition(DEFAULT_TACTIC).ticks - (b.tick - ready));
});

test('a tower kill of a poisoned enemy extends other poisoned targets and total time caps at nine seconds', () => {
    const b = battle(), boss = enemy(11, 'enemy_commander', 1000, 30), towerTarget = enemy(12, 'enemy_raider', 1);
    for (let progress = 50; progress < PATH_LENGTH; progress += 5) {
        const at = enemyPoint({ ...towerTarget, progress });
        if (Math.hypot(at.x - PADS[0].x, at.y - PADS[0].y) < TOWERS.ARROW.range - 10) {
            towerTarget.progress = progress;
            break;
        }
    }
    assert.notEqual(towerTarget.progress, 150);
    b.enemies = [boss, towerTarget, ...[20, 21, 22, 23].map(seq => enemy(seq, 'enemy_raider', 37, 30))];
    b.base.towers[0].operator = b.base.people[0].id;
    assert(b.bell(DRAGON_POISON_TACTIC));
    b.step();
    assert(b.feedback.some(e => e.type === 'shot' && e.hurt.some(victim => victim.seq === towerTarget.seq && victim.hp <= 0)));
    assert.equal(b.bellTicks, 139);
    b.base.towers[0].operator = null;
    stepUntil(b, 20);
    assert.equal(b.bellTicks, 160);
    stepUntil(b, 179);
    assert(b.isPoisoned(boss.seq));
    b.step();
    assert.equal(boss.hp, 865);
    assert.equal(b.bellTicks, 0);
});

test('kill on the last poison tick can extend the effect; gate exit removes a target without adding time', () => {
    const b = battle(), survivor = enemy(11, 'enemy_commander', 1000), last = enemy(12, 'enemy_raider', 240);
    const escape = enemy(13, 'enemy_raider', 1000, PATH_LENGTH);
    b.enemies = [survivor, last, escape];
    const gate = b.gate;
    assert(b.bell(DRAGON_POISON_TACTIC));
    b.step();
    assert(b.gate < gate);
    assert(!b.isPoisoned(escape.seq));
    assert.equal(b.bellTicks, 119);
    stepUntil(b, 119);
    last.progress = PATH_LENGTH;
    const gateBeforeTick = b.gate; b.step();
    assert.equal(b.gate, gateBeforeTick);
    assert(!b.isPoisoned(last.seq));
    assert.equal(b.bellTicks, 20);
    stepUntil(b, 140);
    assert.equal(survivor.hp, 895);
    assert.equal(b.bellTicks, 0);
});
