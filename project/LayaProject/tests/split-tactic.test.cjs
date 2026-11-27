const { test } = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const read = file => require(path.join(process.env.DAIDAI_TEST_BUILD, file));
const { createGame, applyCommand } = read('game/VillageRules');
const { generateWave } = read('game/WaveGenerator');
const { clone } = read('game/GameState');
const { BattleSimulation, PATH_LENGTH } = read('game/BattleSimulation');
const { enemyPoint } = read('game/BattleRoad');
const { RULE, PADS, TOWERS } = read('game/GameConfig');
const { FIXED_NIGHT } = read('config/DefenseConfig');
const { SPLIT_TACTIC, DEFAULT_TACTIC, TACTICS, tacticDefinition, validateTactics } = read('config/TacticConfig');
const { tacticUnavailableReason } = read('game/Tactics');
const { CombatPresentation } = read('view/CombatPresentation');
const { ProjectileMotion } = read('view/ProjectileMotion');
const { GameSession } = read('game/GameSession');
const { SaveStore } = read('storage/SaveStore');

function learned() {
    const s = createGame(7); s.completed = 30; s.day = 31; s.legacy.bestNight = 30; s.wood = 80; s.food = 40;
    s.wave = generateWave(s);
    applyCommand(s, { type: 'TACTIC_LEARN', id: SPLIT_TACTIC }); return s;
}
function enemy(seq, progress = 260 - seq, hp = 100000, kind = 'enemy_raider') {
    return { seq, kind, appearanceSeed: 87, progress, hp, speed: 0, slow: 0, slowTicks: 0, walkDistance: 0, born: 0, summoned: 0 };
}
function battle(kind = 'ARROW', active = true) {
    const s = learned(); s.food = 100; applyCommand(s, { type: 'NIGHT' });
    const b = new BattleSimulation(s);
    b.base.towers.forEach((t, i) => { t.kind = i === 0 ? kind : null; t.level = 1; t.operator = i === 0 ? s.people[0].id : null; });
    for (const p of b.base.people) { p.traits = ['trait_frugal']; p.quality = "COMMON"; }
    b.cursor = b.base.wave.entries.length; b.enemies = [enemy(0), enemy(1), enemy(2)];
    if (active) b.bell(); return b;
}
const shots = b => b.feedback.filter(e => e.type === 'shot');

test('split uses the approved name, cost, fifteen current-village wins and fifteen combat seconds', () => {
    const t = tacticDefinition(SPLIT_TACTIC);
    assert.deepEqual([t.name, t.effect, t.targets, t.ticks * RULE.step, t.unlockWaves, t.wood, t.food],
        ['分裂术·超', 'MULTI_TARGET', 3, 15, 15, 60, 30]);
    const s = createGame(7); s.completed = 14; s.day = 15; s.legacy.bestNight = 100;
    assert.equal(tacticUnavailableReason(s, SPLIT_TACTIC, 'LEARN'), '还需守住 1 波');
    const before = clone(s); assert.throws(() => applyCommand(s, { type: 'TACTIC_LEARN', id: SPLIT_TACTIC })); assert.deepEqual(s, before);
    s.completed = 15; s.day = 16; s.wood = 59; s.food = 29;
    assert.equal(tacticUnavailableReason(s, SPLIT_TACTIC, 'LEARN'), '还缺 1 木、1 粮');
    s.wood = 60; s.food = 30; applyCommand(s, { type: 'TACTIC_LEARN', id: SPLIT_TACTIC });
    assert.deepEqual([s.wood, s.food, s.tactics.equipped], [0, 0, SPLIT_TACTIC]);
    assert.throws(() => applyCommand(s, { type: 'TACTIC_LEARN', id: SPLIT_TACTIC }));
    applyCommand(s, { type: 'TACTIC_EQUIP', id: DEFAULT_TACTIC }); applyCommand(s, { type: 'TACTIC_EQUIP', id: SPLIT_TACTIC });
    assert.deepEqual([s.wood, s.food], [0, 0]);
    for (const patch of [{ targets: 0 }, { targets: 1 }, { targets: 2.5 }, { targets: NaN }, { targets: RULE.effectCap + 1 }, { multiplier: 1.5 }])
        assert.throws(() => validateTactics(TACTICS.map(value => value.id === SPLIT_TACTIC ? { ...value, ...patch } : value)));
});

for (const kind of ['ARROW', 'STONE', 'SLOW']) test(`${kind}: zero to five candidates select at most three distinct valid targets and spend one charge`, () => {
    for (let count = 0; count <= 5; count++) {
        const b = battle(kind); b.enemies = Array.from({ length: count }, (_, i) => enemy(i));
        b.enemies.push(enemy(98, 0), enemy(99, 205, 0));
        b.step(); const events = shots(b);
        assert.equal(events.length, Math.min(count, 3));
        assert.deepEqual(events.map(e => e.target), Array.from({ length: Math.min(count, 3) }, (_, i) => i));
        assert(events.every(e => !e.shot.empowered && e.shot.tick === 0));
        assert(Math.abs(b.charge[0] - (count ? RULE.step * FIXED_NIGHT.towerFireRate / TOWERS[kind].interval : 1)) < 1e-12);
    }
    const b = battle(kind); b.enemies = [8, 5, 6, 4].map(i => enemy(i, 260)); b.step();
    assert.deepEqual(shots(b).map(e => e.target), [4, 5, 6]);
});

test('split leaves single-shot damage and elite bonuses unchanged for all three towers', () => {
    for (const [kind, normal, elite] of [['ARROW', 12, 15], ['STONE', 22, 27], ['SLOW', 4, 5]]) {
        for (const [enemyKind, isElite, damage] of [['enemy_raider', false, normal], ['enemy_armored', false, normal], ['enemy_raider', true, elite]]) {
            const b = battle(kind); b.base.people[0].quality = isElite ? "ELITE" : "COMMON";
            b.enemies = [0, 1, 2].map(i => enemy(i, 260 - i, 100000, enemyKind)); b.step();
            assert.equal(shots(b).length, 3);
            for (const e of b.enemies) assert.equal(100000 - e.hp, damage, `${kind} ${enemyKind}`);
        }
    }
});

test('three lethal overlapping stone centers each own their fatal shot; shared splash belongs to the first', () => {
    const b = battle('STONE'); b.enemies = [0, 1, 2, 3].map(i => enemy(i, 260 - i, 1)); b.enemies.push(enemy(99, 0));
    b.step(); const events = shots(b), f = new CombatPresentation(), motion = new ProjectileMotion(); f.sync(b, b.feedback);
    assert.equal(events.length, 3); assert.equal(f.deaths.size, 4);
    assert.deepEqual(events.map(e => e.hurt.map(v => v.seq)), [[0, 3], [1], [2]]);
    assert.equal(new Set(events.flatMap(e => e.hurt.map(v => v.seq))).size, 4);
    for (const event of events) {
        assert.equal(f.deaths.get(event.target).fatal, event.shot);
        assert.deepEqual(f.target(event.shot), enemyPoint(enemy(event.target)));
    }
    assert.equal(f.deaths.get(3).fatal, events[0].shot);
    motion.update(b, undefined, undefined, undefined, f); assert.equal(motion.poses.length, 3);
    b.tick += 9; motion.update(b, undefined, undefined, undefined, f);
    assert.equal(motion.arrivals.length, 3);
    for (let i = 0; i < 4; i++) assert(f.flashing(i));
    f.advance(.2); assert.equal(f.deaths.size, 4); f.advance(.67); assert.equal(f.deaths.size, 0);
    b.tick += 5; motion.update(b, undefined, undefined, undefined, f); assert.equal(f.shots.size, 0);
});

test('stone splash reaches other clusters, including victims just outside targeting range', () => {
    const b = battle('STONE'), pad = PADS[0], range = TOWERS.STONE.range;
    const distance = p => Math.hypot(p.x - pad.x, p.y - pad.y);
    let center, neighbor;
    for (let progress = 0; progress < PATH_LENGTH && !center; progress++) {
        const a = enemy(0, progress), at = enemyPoint(a);
        if (distance(at) > range) continue;
        for (let seq = 1; seq <= 21; seq++) {
            const v = enemy(seq, progress + 16), next = enemyPoint(v);
            if (distance(next) > range && Math.hypot(at.x - next.x, at.y - next.y) < TOWERS.STONE.splash) {
                center = a; neighbor = v; break;
            }
        }
    }
    assert(center && neighbor, 'a real road boundary pair exists'); b.enemies = [center, neighbor]; b.step();
    assert.equal(shots(b).length, 1); assert.equal(shots(b)[0].target, center.seq);
    assert.equal(neighbor.hp, 100000 - 22);
});

test('stone deduplication does not cross towers or persist into the next volley', () => {
    const b = battle('STONE'); b.base.towers[2] = { ...b.base.towers[0], operator: b.base.people[2].id };
    b.enemies = [1, 14, 17, 22].map(i => enemy(i, 314)); // 中段西侧两塔的共用射界。
    for (const i of [0, 2]) for (const e of b.enemies) {
        const p = enemyPoint(e); assert(Math.hypot(p.x - PADS[i].x, p.y - PADS[i].y) <= TOWERS.STONE.range);
    }
    b.step(); assert.equal(shots(b).length, 6); for (const e of b.enemies) assert.equal(e.hp, 100000 - 44);
    b.charge[0] = b.charge[2] = 1; b.step(); for (const e of b.enemies) assert.equal(e.hp, 100000 - 88);
});

test('slow keeps direct damage separate from overlapping area control and preserves stronger effects', () => {
    const b = battle('SLOW'); b.enemies.push(enemy(3));
    b.enemies[1].slow = .6; b.enemies[1].slowTicks = 20;
    b.enemies[3].slow = .1; b.enemies[3].slowTicks = 20;
    b.step(); assert.equal(shots(b).length, 3);
    assert(shots(b).every(e => e.hurt.length === 1 && e.hurt[0].seq === e.target));
    assert.deepEqual(b.enemies.map(e => e.hp), [99996, 99996, 99996, 100000]);
    assert.deepEqual(b.enemies.map(e => [e.slow, e.slowTicks]), [[.3, RULE.slowTicks], [.6, 19], [.3, RULE.slowTicks], [.3, RULE.slowTicks]]);
    b.step(); assert.equal(b.enemies[3].slowTicks, RULE.slowTicks - 1);
});

test('cadence is identical to uncast attacks; final active step fires three then expiry fires one', () => {
    for (const kind of ['ARROW', 'STONE', 'SLOW']) {
        const active = battle(kind), normal = battle(kind, false), traces = [[], []];
        for (let tick = 0; tick < RULE.bellTicks; tick++) [active, normal].forEach((b, i) => {
            b.step(); if (shots(b).length) traces[i].push([b.tick, b.charge[0]]);
        });
        assert.deepEqual(traces[0], traces[1]); assert.equal(active.bellTicks, 0); active.bell(); assert.equal(active.bellTicks, 0);
        const b = battle(kind), f = new CombatPresentation(), p = new ProjectileMotion();
        b.bellTicks = 1; b.step(); const last = shots(b); assert.equal(last.length, 3); assert.equal(b.bellTicks, 0);
        f.sync(b, b.feedback); p.update(b, undefined, undefined, undefined, f);
        b.charge[0] = 1; b.step(); assert.equal(shots(b).length, 1);
        f.sync(b, b.feedback); p.update(b, undefined, undefined, undefined, f); assert.equal(p.poses.length, 4);
        const poses = p.poses.map(v => [v.x, v.y]); p.update(b, undefined, undefined, undefined, f);
        assert.deepEqual(p.poses.map(v => [v.x, v.y]), poses); // no combat tick means no visual advance
        f.sync(null, []); p.update(null); assert.equal(p.poses.length, 0); assert.equal(f.shots.size, 0);
    }
});

test('max catch-up preserves all volley events and normal four-tower load fits the existing visual pool', () => {
    for (const kind of ['ARROW', 'STONE', 'SLOW']) {
        const b = battle(kind), f = new CombatPresentation(), p = new ProjectileMotion();
        b.base.towers.forEach((t, i) => { t.kind = kind; t.operator = b.base.people[i].id; });
        b.base.people.forEach(v => v.traits = ['trait_nimble']);
        b.enemies = Array.from({ length: 36 }, (_, i) => enemy(i, 140 + i * 14, 10000000));
        let maxPoses = 0, launched = 0, arrived = 0, forcedDiscard = 0;
        const discard = f.discard.bind(f); f.discard = shot => { if (!p.poses.find(v => v.shot === shot).impacted) forcedDiscard++; discard(shot); };
        for (let tick = 0; tick < RULE.bellTicks; tick += 15) {
            const events = []; for (let j = 0; j < 15; j++) { b.step(); events.push(...b.feedback); }
            launched += events.filter(e => e.type === 'shot').length;
            f.advance(.25); f.sync(b, events); p.update(b, undefined, undefined, undefined, f); arrived += p.arrivals.length; maxPoses = Math.max(maxPoses, p.poses.length);
        }
        assert(launched > 50 && arrived > 40); assert(maxPoses <= RULE.effectCap); assert.equal(forcedDiscard, 0, kind);
    }
});

test('forced visual overflow begins orphan death animations without a false flash or gameplay change', () => {
    const b = battle(), f = new CombatPresentation(), p = new ProjectileMotion(); b.tick = 1;
    const events = Array.from({ length: RULE.effectCap + 4 }, (_, i) => ({ type: 'shot', target: i + 100,
        shot: { tower: 0, x: 300 + i, y: 400, kind: 'ARROW', tick: 0, empowered: false }, hurt: [enemy(i + 100, 200, 0)] }));
    f.sync(b, events); p.update(b, undefined, undefined, undefined, f);
    assert.equal(p.poses.length, RULE.effectCap); assert.equal(f.deaths.size, RULE.effectCap + 4); assert.equal(f.shots.size, RULE.effectCap);
    for (let i = 100; i < 104; i++) { assert(f.deathPose(i)); assert(!f.flashing(i)); }
    f.advance(.87); for (let i = 100; i < 104; i++) assert(!f.deaths.has(i));
    assert.deepEqual(b.enemies.map(e => e.hp), [100000, 100000, 100000]);
});

test('purchase persists once; pause, reassign, triple speed and cold reload keep existing skill lifecycle', () => {
    const values = new Map(), port = { read: k => values.get(k) || null, write: (k, v) => values.set(k, v) };
    const saves = new SaveStore(port); saves.inspect(); saves.prepare(learned()); saves.commit();
    const g = new GameSession(saves); g.load(); g.state.food = 100; g.command({ type: 'NIGHT' });
    const b = g.battle; assert.equal(b.tactic.id, SPLIT_TACTIC); assert.equal(g.state.night.tactic, SPLIT_TACTIC);
    const duration = tacticDefinition(SPLIT_TACTIC).ticks;
    g.bell(); assert.equal(b.bellTicks, duration); g.pause('CHOICE'); g.update(.25); assert.equal(b.bellTicks, duration);
    assert(g.reassign(0, g.state.people[2].id)); assert.equal(g.battle, b); assert.equal(b.bellTicks, duration);
    g.resume('CHOICE'); g.update(.1); assert.equal(b.bellTicks, duration - 6);
    g.bell(); assert.equal(b.bellTicks, duration - 6);
    const reopened = new GameSession(new SaveStore(port)); reopened.load();
    assert.equal(reopened.battle.tactic.id, SPLIT_TACTIC); assert.equal(reopened.battle.usesLeftFor(reopened.battle.tactic), null);
    assert(reopened.state.tactics.learned.includes(SPLIT_TACTIC));
});
