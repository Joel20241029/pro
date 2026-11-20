const { test } = require('node:test');
const assert = require('node:assert/strict');
const read = name => require(`${process.env.DAIDAI_TEST_BUILD}/${name}.js`);
const { BLAST_TACTIC, DEFAULT_TACTIC, SUMMON_TACTIC, TACTIC_USE, TIMED_BLAST, tacticDefinition } = read('config/TacticConfig');
const { BattleSimulation } = read('game/BattleSimulation');
const { enemyPoint, onBattleRoad, PATH_LENGTH } = read('game/BattleRoad');
const { createGame, applyCommand } = read('game/VillageRules');
const { isWorkingAdult } = read('game/GameState');
const { tacticRevealed } = read('game/Tactics');
const { GameSession } = read('game/GameSession');
const { SaveStore } = read('storage/SaveStore');
const { CombatPresentation } = read('view/CombatPresentation');

function state(waves = 50) {
    const s = createGame(52);
    s.completed = s.legacy.bestNight = waves;
    s.day = waves + 1;
    s.wood = s.food = 200;
    return s;
}

function fight() {
    const s = state();
    s.tactics.extraSlots = [null, null];
    applyCommand(s, { type: 'TACTIC_LEARN', id: BLAST_TACTIC, slot: 1 });
    applyCommand(s, { type: 'NIGHT' });
    const b = new BattleSimulation(s);
    b.base.wave.entries = [{ tick: 900, kind: 'enemy_raider', appearanceSeed: 3 }];
    b.base.towers.forEach(t => t.operator = null);
    return b;
}

const enemy = (seq, kind, progress, hp, speed = 0) => ({ seq, kind, progress, hp, maxHp: hp, speed,
    appearanceSeed: 42, born: 0, summoned: 0, slow: 0, slowTicks: 0, walkDistance: 0 });
const castPoint = enemyPoint(enemy(0, 'enemy_raider', 120, 1));

test('blast purchase uses twenty current wins and reordered learned skills remain visible on old saves', () => {
    const s = state(19), t = tacticDefinition(BLAST_TACTIC);
    assert.deepEqual([t.name, t.buttonName, t.unlockWaves, t.wood, t.food, t.usesPerNight, t.ticks], ['孟昭易·泻火', '泻火', 20, 80, 40, 1, 60]);
    assert.throws(() => applyCommand(s, { type: 'TACTIC_LEARN', id: BLAST_TACTIC }), /还需守住 1 波/);
    s.completed = 20; s.day = 21;
    applyCommand(s, { type: 'TACTIC_LEARN', id: BLAST_TACTIC });
    assert.deepEqual([s.wood, s.food], [120, 160]);
    s.tactics.learned.push(SUMMON_TACTIC);
    assert(tacticRevealed(s, SUMMON_TACTIC));
    applyCommand(s, { type: 'TACTIC_EQUIP', id: SUMMON_TACTIC });
    assert.equal(s.tactics.equipped, SUMMON_TACTIC);
    assert(!tacticRevealed(state(20), SUMMON_TACTIC));
});

test('targeting can be cancelled and only a valid road click spends the shared cast', () => {
    const s = state();
    s.tactics.learned.push(BLAST_TACTIC);
    s.tactics.equipped = BLAST_TACTIC;
    const g = new GameSession(new SaveStore({ read: () => null, write() {} }));
    g.state = s;
    assert(s.people.some(isWorkingAdult));
    applyCommand(s, { type: 'NIGHT' });
    g.battle = new BattleSimulation(s);
    assert(!g.placeBlast(castPoint));
    g.bell(BLAST_TACTIC); assert(g.blastAiming);
    assert(!g.placeBlast({ x: 25, y: castPoint.y })); assert(g.blastAiming);
    assert(!g.placeBlast({ x: 360, y: Infinity }));
    g.bell(BLAST_TACTIC); assert(!g.blastAiming);
    g.bell(BLAST_TACTIC); g.pause('USER'); g.resume('USER'); assert(!g.blastAiming);
    g.bell(BLAST_TACTIC); assert(g.placeBlast(castPoint));
    assert.equal(g.battle.tacticUsesLeft, 1); assert(!g.blastAiming);
    g.pause('CHOICE'); g.update(.25); assert.equal(g.battle.bellTicks, 60);
    assert.deepEqual(g.battle.blastAt, castPoint);
});

test('on step sixty blast kills the entire circle, including armored enemies and bosses, then starts shared cooldown', () => {
    const b = fight();
    assert(onBattleRoad(castPoint));
    assert(!b.bell(BLAST_TACTIC));
    const center = enemy(0, 'enemy_raider', 120, 900);
    const edge = enemy(1, 'enemy_raider', 38, 900);
    const expandedEdge = Array.from({ length: 35 }, (_, i) => enemy(i + 6, 'enemy_raider', 0, 900)).find(target => {
        const at = enemyPoint(target), distance = Math.hypot(at.x - castPoint.x, at.y - castPoint.y);
        return distance > 115 && distance <= TIMED_BLAST.radius;
    });
    assert(expandedEdge, 'an enemy stands inside the expanded radius only');
    const armored = enemy(3, 'enemy_armored', 120, 900);
    const boss = enemy(4, 'enemy_commander', 120, 1000);
    const outside = enemy(5, 'enemy_raider', 330, 900);
    const expandedFoot = enemyPoint(expandedEdge);
    const expandedDistance = Math.hypot(expandedFoot.x - castPoint.x, expandedFoot.y - castPoint.y);
    assert(expandedDistance > 115 && expandedDistance <= TIMED_BLAST.radius);
    const outsideFoot = enemyPoint(outside);
    assert(Math.hypot(outsideFoot.x - castPoint.x, outsideFoot.y - castPoint.y) > TIMED_BLAST.radius);
    b.enemies = [center, edge, expandedEdge, armored, boss, outside];
    const point = { ...castPoint };
    assert(b.bell(BLAST_TACTIC, point)); point.x = 0;
    assert(!b.canCast(DEFAULT_TACTIC));
    for (let i = 0; i < 59; i++) b.step();
    assert.equal(center.hp, 900);
    b.step();
    assert.deepEqual(b.enemies.map(e => [e.seq, e.hp]), [[outside.seq, outside.maxHp]]);
    const blast = b.feedback.find(e => e.type === 'blast');
    assert.deepEqual(blast.at, castPoint);
    assert.deepEqual(blast.hurt.map(e => [e.seq, e.hp]), [[0, 0], [1, 0], [expandedEdge.seq, 0], [3, 0], [4, 0]]);
    assert.equal(b.cooldownFor(DEFAULT_TACTIC), TACTIC_USE.recoveryTicks);
    for (let i = 0; i < TACTIC_USE.recoveryTicks; i++) b.step();
    assert(b.canCast(DEFAULT_TACTIC));
    assert(!b.bell(BLAST_TACTIC, castPoint));
});

test('blast includes the exact boundary and excludes the same enemy just outside', () => {
    for (const [extra, killed] of [[0, true], [.01, false]]) {
        const b = fight(), target = enemy(7, 'enemy_wolfking', 120, 10000);
        const foot = enemyPoint(target), spot = { x: foot.x, y: foot.y + TIMED_BLAST.radius + extra };
        // Inject the completed planting state to isolate the radius rule from road placement.
        assert(b.bell(BLAST_TACTIC, castPoint));
        b.blastAt = spot; b.bellTicks = 1;
        b.enemies = [target];
        b.step();
        assert.equal(b.enemies.length, killed ? 0 : 1);
        assert.equal(b.feedback.find(event => event.type === 'blast').hurt.length, killed ? 1 : 0);
    }
});

test('the last-step blast hits a moving enemy before gate damage and survives as final visual feedback', () => {
    const b = fight();
    b.base.wave.entries = [];
    b.enemies = [enemy(0, 'enemy_raider', PATH_LENGTH - 60, 50, 20)];
    const at = enemyPoint(enemy(0, 'enemy_raider', PATH_LENGTH, 1));
    assert(b.bell(BLAST_TACTIC, at));
    const gate = b.gate;
    for (let i = 0; i < 60; i++) b.step();
    assert.equal(b.outcome, 'WIN');
    assert.equal(b.gate, gate);
    assert.deepEqual(b.feedback.map(e => e.type), ['blast']);
    const visuals = new CombatPresentation();
    visuals.sync(b, b.feedback);
    assert(visuals.deathPose(0)); assert(visuals.takeDefeatCue()); assert.equal(visuals.shots.size, 0);
});
