const { test } = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const build = process.env.DAIDAI_TEST_BUILD;
const read = file => require(path.join(build, file));
const { createGame, applyCommand } = read('game/VillageRules');
const { clone } = read('game/GameState');
const { BattleSimulation } = read('game/BattleSimulation');
const { RAGE_TACTIC, SHIELD_TACTIC, DEFAULT_TACTIC, tacticDefinition } = read('config/TacticConfig');
const { tacticUnavailableReason, canLearnTactic } = read('game/Tactics');
const { ProjectileMotion } = read('view/ProjectileMotion');
const { CombatPresentation } = read('view/CombatPresentation');
const { RULE } = read('game/GameConfig');

function learned() {
    const s = createGame(7); const t = tacticDefinition(RAGE_TACTIC);
    s.completed = t.unlockWaves; s.day = s.completed + 1; s.wood = t.wood; s.food = t.food;
    applyCommand(s, { type: 'TACTIC_LEARN', id: RAGE_TACTIC }); return s;
}
function enemy(seq, kind = 'enemy_raider') {
    // 这段路上的近邻都在首塔位寒塔的射程内。
    return { seq, kind, appearanceSeed: 87, progress: 256 + seq, hp: 100000, speed: 0, slow: 0, slowTicks: 0, walkDistance: 0, born: 0, summoned: 0 };
}
function battle(kind = 'ARROW', tactic = RAGE_TACTIC) {
    const s = learned(); s.food = 100; s.policy = null; s.tactics.equipped = tactic;
    applyCommand(s, { type: 'NIGHT' }); const b = new BattleSimulation(s);
    b.base.towers.forEach((t, i) => { t.kind = i === 0 ? kind : null; t.level = 1; t.operator = i === 0 ? s.people[0].id : null; });
    const operator = b.base.people[0]; operator.traits = ['trait_frugal']; operator.quality = "COMMON";
    b.cursor = b.base.wave.entries.length; b.enemies = [enemy(0)]; return b;
}
test('rage learns at ten current-village wins with one exact 45 wood + 20 food debit', () => {
    const t = tacticDefinition(RAGE_TACTIC);
    assert.deepEqual([t.name, t.unlockWaves, t.wood, t.food, t.effect, t.multiplier, t.ticks * RULE.step], ['百毅靓之怒', 10, 45, 20, 'ATTACK_DAMAGE', 1.5, 15]);
    const s = createGame(7); s.completed = 9; s.day = 10; s.legacy.bestNight = 100; s.tactics.learned.push(SHIELD_TACTIC);
    assert.equal(tacticUnavailableReason(s, RAGE_TACTIC, 'LEARN'), '还需守住 1 波'); assert(!canLearnTactic(s));
    const old = clone(s); assert.throws(() => applyCommand(s, { type: 'TACTIC_LEARN', id: RAGE_TACTIC })); assert.deepEqual(s, old);
    s.completed = 10; s.day = 11; s.wood = 45; s.food = 19;
    assert.equal(tacticUnavailableReason(s, RAGE_TACTIC, 'LEARN'), '还缺 1 粮');
    s.food = 20; assert(canLearnTactic(s)); applyCommand(s, { type: 'TACTIC_LEARN', id: RAGE_TACTIC });
    assert.deepEqual([s.wood, s.food, s.tactics.equipped], [0, 0, RAGE_TACTIC]); assert(!canLearnTactic(s));
    assert.throws(() => applyCommand(s, { type: 'TACTIC_LEARN', id: RAGE_TACTIC }));
    applyCommand(s, { type: 'TACTIC_EQUIP', id: DEFAULT_TACTIC }); applyCommand(s, { type: 'TACTIC_EQUIP', id: RAGE_TACTIC });
    assert.deepEqual([s.wood, s.food], [0, 0]);
});
test('three tower damage paths use rage before final rounding across enemy kinds, with no extra frost splash damage', () => {
    for (const [kind, normal, boosted] of [['ARROW',12,18], ['STONE',22,33], ['SLOW',4,6]]) {
        for (const targetKind of ['enemy_raider','enemy_armored','enemy_commander']) {
            for (const active of [false,true]) {
                // 两个靶子放在同一条路带，保持这个用例专门覆盖近邻溅射。
                const b = battle(kind); b.enemies = [enemy(0, targetKind), enemy(3, targetKind)];
                if (active) b.bell(); b.step();
                const event = b.feedback.find(e => e.type === 'shot'); assert(event);
                assert.equal(event.shot.empowered, active); assert.equal(event.hurt.length, kind === 'STONE' ? 2 : 1);
                for (const victim of event.hurt) assert.equal(100000 - victim.hp, active ? boosted : normal, kind);
                if (kind === 'SLOW') {
                    const neighbor = b.enemies.find(e => e.seq !== event.target);
                    assert.equal(neighbor.hp, 100000); assert.equal(neighbor.slow, .3); assert.equal(neighbor.slowTicks, RULE.slowTicks);
                }
            }
        }
    }
});
test('rage preserves firing schedule; heart still speeds attacks without increasing individual damage', () => {
    for (const kind of ['ARROW','STONE','SLOW']) {
        const plain = battle(kind), rage = battle(kind), heart = battle(kind, DEFAULT_TACTIC);
        rage.bell(); heart.bell(); const traces = [[],[],[]];
        for (let i = 0; i < RULE.bellTicks; i++) [plain,rage,heart].forEach((b,index) => {
            b.step(); for (const event of b.feedback) if (event.type === 'shot') traces[index].push(event.shot.tick);
        });
        assert.deepEqual(traces[0], traces[1]); assert(traces[2].length > traces[0].length);
        assert.equal(rage.bellTicks, 0); const tick = rage.tick; rage.bell(); assert.equal(rage.bellTicks, 0); assert.equal(rage.tick, tick);
    }
    const plain = battle(), heart = battle('ARROW', DEFAULT_TACTIC); heart.bell(); plain.step(); heart.step();
    assert.equal(plain.enemies[0].hp, heart.enemies[0].hp); assert.equal(heart.shots[0].empowered, false);
});
test('rage multiplies accumulated bonuses and keeps the last active attack snapshot after expiry', () => {
    const b = battle('STONE'); b.base.people[0].quality = "ELITE"; b.base.people[0].traits = ['trait_strong'];
    b.base.policy = 'policy_prepare';
    b.bell(); b.bellTicks = 1; b.step();
    // 22 × (1 + .45 strong + .10 prepare) × 1.25 elite × 1.5 rage is floored to 63.
    assert.equal(100000 - b.enemies[0].hp, 63); assert.equal(b.bellTicks, 0); assert(b.shots[0].empowered);
    const boosted = b.shots[0]; b.charge[0] = 1; b.step(); assert.equal(b.shots.at(-1).empowered, false); assert(boosted.empowered);
});
test('boosted impact remains visible across a full 3x catch-up, freezes on pause and is removed once', () => {
    const b = battle(), feedback = new CombatPresentation(), motion = new ProjectileMotion(); b.bell(); b.step();
    feedback.sync(b, b.feedback); motion.update(b, undefined, undefined, undefined, feedback); const pose = motion.poses[0]; assert(pose.shot.empowered);
    b.bellTicks = 0; b.tick += 15; motion.update(b, undefined, undefined, undefined, feedback);
    assert.equal(motion.arrivals.length, 1); assert.equal(pose.frame, 'fx_arrow'); assert(pose.contact); assert.equal(pose.alpha, 1);
    motion.update(b, undefined, undefined, undefined, feedback); assert.equal(motion.arrivals.length, 0); assert.equal(pose.alpha, 1);
    b.tick++; feedback.advance(.05); motion.update(b, undefined, undefined, undefined, feedback); assert.equal(pose.frame, 'fx_rage_hit'); assert(pose.alpha > 0 && pose.alpha < 1);
    b.tick += 3; feedback.advance(.15); motion.update(b, undefined, undefined, undefined, feedback); assert.equal(pose.impactFrame, 'fx_impact_arrow_5');
    feedback.advance(.02); motion.update(b, undefined, undefined, undefined, feedback);
    assert.equal(motion.poses.length, 0); assert.equal(feedback.shots.size, 0);
    motion.update(null); assert.equal(motion.poses.length, 0);
});
test('ordinary shot in flight does not acquire rage after casting', () => {
    const b = battle(), motion = new ProjectileMotion(); b.step(); const shot = b.shots[0]; motion.update(b); b.bell();
    b.tick += 6; motion.update(b); assert.equal(shot.empowered, false); assert.equal(motion.poses[0].frame, 'fx_arrow');
    b.tick++; motion.update(b); assert.equal(motion.poses[0].frame, 'fx_hit');
});
