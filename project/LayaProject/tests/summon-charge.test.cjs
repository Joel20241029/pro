const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const read = name => require(path.join(process.env.DAIDAI_TEST_BUILD, name));
const { createGame, applyCommand } = read('game/VillageRules');
const { BattleSimulation } = read('game/BattleSimulation');
const { enemyPoint, roadFootprintBounds, PATH_LENGTH } = read('game/BattleRoad');
const { generateWave } = read('game/WaveGenerator');
const { GameSession } = read('game/GameSession');
const { SaveStore } = read('storage/SaveStore');
const { CombatPresentation } = read('view/CombatPresentation');
const { SUMMON_TACTIC, SUMMON_CHARGE, tacticDefinition } = read('config/TacticConfig');
const { RULE } = read('config/RuleConfig');

function state() {
    const s = createGame(52);
    s.legacy.bestNight = s.completed = 40;
    s.day = 41;
    s.wave = generateWave(s);
    s.wood = 150; s.food = 110;
    applyCommand(s, { type: 'TACTIC_LEARN', id: SUMMON_TACTIC });
    return s;
}

function enemy(seq, progress, speed = 0, kind = 'enemy_raider') {
    return { seq, kind, appearanceSeed: seq, progress, hp: 100000, maxHp: 100000, speed, slow: 0, slowTicks: 0, walkDistance: 0, born: 0, summoned: 0 };
}

function setup(b) {
    b.cursor = b.base.wave.entries.length;
    b.base.towers.forEach(t => { t.kind = t.operator = null; });
    b.enemies = [enemy(99, 30)];
    return b;
}

function battle() {
    const s = state();
    applyCommand(s, { type: 'NIGHT' });
    return setup(new BattleSimulation(s));
}

function gathered(b) {
    b.bell();
    for (let i = 0; i < SUMMON_CHARGE.gatherTicks; i++) b.step();
}

test('summon reveals at 40 current wins and costs 120 wood and 60 food once', () => {
    const s = createGame(2);
    s.completed = 39; s.legacy.bestNight = 62; s.wood = 120; s.food = 60;
    assert.throws(() => applyCommand(s, { type: 'TACTIC_LEARN', id: SUMMON_TACTIC }), /还需守住 1 波/);
    s.completed = 40; s.wood = 119;
    assert.throws(() => applyCommand(s, { type: 'TACTIC_LEARN', id: SUMMON_TACTIC }), /还缺/);
    assert.deepEqual([s.wood, s.food], [119, 60]);
    s.wood = 120; applyCommand(s, { type: 'TACTIC_LEARN', id: SUMMON_TACTIC });
    assert.deepEqual([s.wood, s.food, s.tactics.equipped], [0, 0, SUMMON_TACTIC]);
    assert.throws(() => applyCommand(s, { type: 'TACTIC_LEARN', id: SUMMON_TACTIC }));
    assert.equal(tacticDefinition(SUMMON_TACTIC).usesPerNight, 1);
});

test('20 units gather without stepping and follow the curved road to its end; a second cast is unavailable', () => {
    const b = battle();
    b.enemies = [enemy(99, 0)]; b.enemies[0].hp = 0;
    // Keep a future entry so the battle remains open while all 20 run off the road.
    b.base.wave.entries.push({ tick: 5000, kind: 'enemy_raider', appearanceSeed: 1 });
    gathered(b);
    const rush = b.summonCharge;
    assert.equal(rush.villagers.length, 20);
    assert(rush.villagers.every(v => v.distance === 0 && !v.retired));
    for (let i = SUMMON_CHARGE.gatherTicks; i < SUMMON_CHARGE.maxTicks; i++) {
        b.step();
        for (const unit of rush.villagers) {
            const { left, right } = roadFootprintBounds(unit.at.y, SUMMON_CHARGE.footprint);
            assert(unit.at.x >= left && unit.at.x <= right);
        }
    }
    assert(rush.villagers.every(v => v.progress === 0 && v.retired));
    assert.equal(b.bellTicks, 0);
    while (b.tacticCooldownTicks > 0) b.step();
    b.bell();
    assert.equal(b.summonCharge, rush);
    assert.equal(b.usesLeftFor(b.tactic), 0);
    assert.equal(new BattleSimulation(b.base).usesLeftFor(b.tactic), 1);
});

test('swept collisions consume exactly one summon per living enemy, with a cap of twenty', () => {
    const b = battle();
    b.enemies = Array.from({ length: 21 }, (_, i) => enemy(i, 90));
    gathered(b);
    const hits = [];
    for (let i = 0; i < SUMMON_CHARGE.maxTicks && !b.outcome; i++) {
        b.step();
        hits.push(...b.feedback.filter(e => e.type === 'summon'));
    }
    assert.equal(hits.length, 20);
    assert.equal(new Set(hits.map(h => h.index)).size, 20);
    assert.equal(new Set(hits.map(h => h.enemy.seq)).size, 20);
    assert.equal(b.enemies.length, 1);
    assert.equal(b.bellTicks, 0);
});

test('scattered summons can make contact on either edge in straight and curved sections', () => {
    for (const progress of [70, 290, 450, 555]) {
        const edges = Array.from({length: 40}, (_, index) => enemy(index, progress))
            .sort((left, right) => enemyPoint(left).x - enemyPoint(right).x);
        for (const target of [edges[0], edges.at(-1)]) {
            const b = battle(); b.enemies = [target];
            gathered(b);
            for (let tick = 0; tick < SUMMON_CHARGE.maxTicks && !b.outcome; tick++) b.step();
            assert.equal(b.outcome, 'WIN', `missed edge enemy ${target.seq} at ${progress}`);
        }
    }
});

test('summon caps boss damage at 45% per cast and surviving bosses flash without defeat cues', () => {
    const b = battle();
    const boss = enemy(8, 410, 0, 'enemy_commander');
    const small = enemy(9, 140);
    b.enemies = [boss, small];
    gathered(b);
    const bossHits = [], view = new CombatPresentation();
    while (b.summonCharge.active) {
        b.step();
        for (const hit of b.feedback.filter(e => e.type === 'summon' && e.enemy.seq === boss.seq)) {
            bossHits.push(hit.enemy.hp);
            view.sync(b, [hit]);
            assert(view.flashing(boss.seq));
            assert(!view.deaths.has(boss.seq));
            assert(!view.takeDefeatCue());
        }
    }
    assert.deepEqual(bossHits, [85_000, 70_000, 55_000]);
    assert.equal(small.hp, 0, 'remaining summons run past the capped boss');
});

test('scattered summons start in stages, move at different speeds and can overtake', () => {
    const b = battle(); b.enemies[0].hp = 0;
    b.base.wave.entries.push({ tick: 5000, kind: 'enemy_raider', appearanceSeed: 1 });
    gathered(b);
    const units = b.summonCharge.villagers;
    assert.equal(new Set(units.map(unit => unit.lane)).size, units.length);
    const positions = units.map(unit => unit.progress);
    const started = [];
    let overtook = false;
    for (let tick = 0; tick < 40; tick++) {
        b.step();
        units.forEach((unit, index) => {
            if (unit.distance > 0 && started[index] === undefined) started[index] = tick;
            if (index > 0 && unit.progress > units[index - 1].progress) overtook = true;
            if (tick >= SUMMON_CHARGE.startDelayTicks)
                assert(Math.abs(positions[index] - unit.progress - unit.speed * RULE.step) < 1e-8);
            positions[index] = unit.progress;
        });
    }
    assert.equal(started.filter(tick => tick === 0).length, 3);
    assert.equal(Math.max(...started), SUMMON_CHARGE.startDelayTicks);
    assert.equal(Math.min(...units.map(unit => unit.speed)), SUMMON_CHARGE.minSpeed);
    assert.equal(Math.max(...units.map(unit => unit.speed)), SUMMON_CHARGE.maxSpeed);
    assert(overtook);
});

test('boss contact before the gate applies percentage damage and a surviving boss can still reach the gate', () => {
    const b = battle(); gathered(b);
    b.enemies.push(enemy(0, PATH_LENGTH - 9, 400, 'enemy_commander'));
    b.enemies.push(enemy(1, PATH_LENGTH, 40));
    b.step();
    const hit = b.feedback.find(e => e.type === 'summon');
    assert.equal(hit.enemy.kind, 'enemy_commander');
    assert.equal(hit.enemy.hp, 85000);
    assert(hit.enemy.progress < PATH_LENGTH);
    const { x, y } = enemyPoint(hit.enemy);
    assert(Math.hypot(x - hit.at.x, y - hit.at.y) <= SUMMON_CHARGE.contact.boss.x);
    assert(b.feedback.some(e => e.type === 'gate' && e.enemy.seq === 1 && !e.blocked));
    assert(b.gate < b.base.gate);
});

test('a new charge respects saved speed and pauses, and the last hit settles immediately with its own death cue', () => {
    const data = new Map(), port = { read: k => data.get(k) ?? null, write: (k,v) => data.set(k,v) };
    const save = new SaveStore(port); save.inspect(); save.prepare(state()); save.commit();
    const g = new GameSession(new SaveStore(port)); g.load();
    g.command({ type: 'NIGHT' });
    const b = setup(g.battle);
    g.bell(); g.pause('CHOICE'); g.update(.25);
    assert.equal(b.summonCharge.gathered, 0);
    g.command({ type: 'SPEED', value: 3 }); g.resume('CHOICE');
    g.update(.2);
    assert.equal(b.tick, SUMMON_CHARGE.gatherTicks);
    assert(b.summonCharge.villagers.every(v => v.distance === 0));
    const start = b.summonCharge.villagers[0].progress;
    b.enemies = [enemy(0, start - 18, 70), enemy(1, start - 10)];
    b.enemies[1].hp = 0; // A lethal tower hit from an earlier combat step cannot consume another unit.
    g.update(RULE.step);
    assert.equal(g.battle, null);
    assert.equal(g.state.completed, 41);
    assert.equal(g.presentationBattle, b);
    assert.equal(b.summonCharge.villagers.filter(v => v.retired).length, 1);
    const view = new CombatPresentation(), events = g.takeCombatFeedback();
    assert.equal(events.filter(e => e.type === 'summon').length, 1);
    view.sync(b, events);
    assert(view.deathPose(0)); assert(!view.deathPose(1)); assert(view.takeDefeatCue()); assert(!view.takeDefeatCue());
    assert.deepEqual(g.state.tactics, b.base.tactics);
    const reopened = new GameSession(new SaveStore(port)); reopened.load();
    assert.equal(reopened.state.completed, 41);
    assert.equal(reopened.state.tactics.equipped, SUMMON_TACTIC);
});
