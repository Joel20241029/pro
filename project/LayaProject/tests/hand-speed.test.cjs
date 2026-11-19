const { test } = require('node:test');
const assert = require('node:assert/strict');
const read = name => require(`${process.env.DAIDAI_TEST_BUILD}/${name}.js`);
const { HAND_SPEED, HAND_SPEED_TACTIC, DEFAULT_TACTIC, TACTICS, TACTIC_USE } = read('config/TacticConfig');
const { BattleSimulation, PATH_LENGTH } = read('game/BattleSimulation');
const { GameSession } = read('game/GameSession');
const { SaveStore } = read('storage/SaveStore');
const { createGame, applyCommand } = read('game/VillageRules');
const { generateWave } = read('game/WaveGenerator');
const { CombatPresentation } = read('view/CombatPresentation');
const { DailyTaskCombat } = read('game/DailyTaskCombat');

const enemy = (seq, kind, hp, maxHp = hp, progress = 140, speed = 0) => ({
    seq, kind, hp, maxHp, progress, speed, appearanceSeed: seq, walkDistance: 0, slow: 0, slowTicks: 0, born: 0, summoned: 0
});
function setup(speed) {
    const state = createGame(13);
    state.completed = 30; state.day = 31; state.legacy.bestNight = 30;
    state.wood = state.food = 200; state.settings.speed = speed;
    state.wave = generateWave(state);
    state.tactics.extraSlots = [null];
    applyCommand(state, { type: 'TACTIC_LEARN', id: HAND_SPEED_TACTIC, slot: 1 });
    applyCommand(state, { type: 'NIGHT' });
    const slots = new Map();
    const store = new SaveStore({ read: key => slots.get(key) ?? null, write: (key, value) => slots.set(key, value) });
    store.inspect(); store.prepare(state); store.commit();
    const game = new GameSession(store);
    game.state = state; game.battle = new BattleSimulation(state);
    const b = game.battle;
    b.base.towers.forEach(t => t.operator = null);
    b.base.wave.entries = [{ tick: 900, kind: 'enemy_raider', appearanceSeed: 3 }];
    b.enemies = [enemy(100, 'enemy_armored', 900, 1000), enemy(101, 'enemy_commander', 4000)];
    return { game, b };
}

test('skills are ordered in five-wave steps, with the hand speed lore and learning costs', () => {
    assert.deepEqual(TACTICS.map(t => [t.order, t.unlockWaves, t.wood, t.food]), [
        [0,0,0,0], [1,5,30,15], [2,10,45,20], [3,15,60,30], [4,20,80,40], [5,25,100,50], [6,30,130,65], [7,35,160,80], [8,40,180,90], [9,45,200,100], [10,50,200,120]
    ]);
    assert.match(TACTICS[6].lore, /讲义气.*手速也是全村第一/);
});

test('fourteen taps preserve the freeze until timeout and apply proportional damage once', () => {
    for (const speed of [2, 3, 'switch']) {
        const { game, b } = setup(speed === 'switch' ? 2 : speed);
        assert(!game.tapHandSpeed());
        b.enemies[0].speed = 25; b.enemies[0].slow = .5; b.enemies[0].slowTicks = 10;
        b.base.wave.entries[0].tick = b.tick;
        const frozen = b.enemies.map(e => ({ ...e })), queued = b.pendingCount;
        game.bell(HAND_SPEED_TACTIC);
        assert.equal(b.tacticUsesLeft, 1);
        assert(!b.canCast(DEFAULT_TACTIC));
        for (let i = 0; i < 14; i++) assert(game.tapHandSpeed());
        for (let i = 0; i < 30; i++) game.update(.031);
        if (speed === 'switch') game.state.settings.speed = 3;
        game.pause('BACKGROUND');
        const left = b.handSpeed.remaining;
        game.update(.2);
        assert.equal(b.handSpeed.remaining, left);
        assert(!game.tapHandSpeed());
        game.resume('BACKGROUND');
        for (let i = 0; i < 60; i++) game.update(.034);
        assert(b.handSpeed.remaining > 0);
        assert.deepEqual(b.enemies, frozen);
        assert.equal(b.pendingCount, queued);
        assert.equal(b.tick, 0);
        game.update(.03);
        assert(!game.tapHandSpeed());
        assert.equal(b.handSpeed, null);
        assert.deepEqual(b.enemies.map(e => e.hp), [480, 3664]);
        assert.equal(b.tick, 0);
        const hits = game.takeCombatFeedback().filter(e => e.type === 'handSpeed');
        assert.equal(hits.length, 1);
        assert.equal(hits[0].hurt.length, 2);
        assert.equal(b.cooldownFor(DEFAULT_TACTIC), TACTIC_USE.recoveryTicks);
        assert.equal(b.usesLeftFor(b.tactic), 0);
        game.update(.05);
        assert(b.tick > 0 && b.tick <= 3);
        assert(b.enemies[0].progress > frozen[0].progress);
        assert(b.pendingCount < queued);
        assert(!game.takeCombatFeedback().some(e => e.type === 'handSpeed'));
    }
});

test('the fifteenth tap ends the freeze immediately and caps each live enemy at ten percent HP', () => {
    const { game, b } = setup(3);
    b.base.wave.entries[0].tick = 0;
    b.enemies.push(enemy(102, 'enemy_raider', 31, 1000), enemy(103, 'enemy_raider', 3, 3));
    const queued = b.pendingCount;
    game.bell(HAND_SPEED_TACTIC);
    assert.equal(HAND_SPEED.burstTaps, 15);
    for (let i = 0; i < 14; i++) assert(game.tapHandSpeed());
    for (let i = 0; i < 11; i++) game.update(.25);
    assert.deepEqual(b.enemies.map(e => e.hp), [900, 4000, 31, 3]);
    assert.deepEqual(game.takeCombatFeedback(), []);
    let refreshed = 0;
    game.changed = () => refreshed++;
    assert(game.tapHandSpeed());
    assert.equal(refreshed, 1);
    assert.equal(b.handSpeed, null);
    assert.equal(b.tick, 0);
    assert.equal(b.pendingCount, queued);
    assert.equal(b.outcome, null);
    assert.deepEqual(b.enemies.map(e => e.hp), [100, 400, 31, 1]);
    assert(!game.tapHandSpeed());
    const hits = game.takeCombatFeedback();
    assert.equal(hits.length, 1);
    assert.equal(hits[0].type, 'handSpeed');
    assert.deepEqual(hits[0].hurt.map(e => e.seq), [100, 101, 102, 103]);
    game.update(.05);
    assert(b.tick > 0);
    assert(b.pendingCount < queued);
    assert(!game.takeCombatFeedback().some(e => e.type === 'handSpeed'));
});

test('zero taps deal nothing and enemies only touch the gate after the freeze expires', () => {
    const empty = setup(2).b;
    empty.bell(HAND_SPEED_TACTIC); empty.step(3);
    assert(!empty.feedback.some(e => e.type === 'handSpeed'));
    assert.equal(empty.tacticUsesLeft, 1);

    const last = setup(2).b;
    last.enemies = [enemy(103, 'enemy_raider', 3, 100, PATH_LENGTH - 1, 25)];
    last.bell(HAND_SPEED_TACTIC); assert(last.tapHandSpeed());
    last.step(3);
    assert(last.feedback.some(e => e.type === 'handSpeed' && e.hurt[0].hp === 0));
    assert(!last.feedback.some(e => e.type === 'gate'));

    const lose = setup(2).b;
    lose.gate = 1; lose.enemies = [enemy(104, 'enemy_raider', 50, 100, PATH_LENGTH - 1, 25)];
    lose.bell(HAND_SPEED_TACTIC); assert(lose.tapHandSpeed()); lose.step(2);
    assert.equal(lose.gate, 1);
    assert.equal(lose.outcome, null);
    assert.equal(lose.enemies[0].progress, PATH_LENGTH - 1);
    lose.step(1);
    assert.equal(lose.gate, 1);
    assert.equal(lose.outcome, null);
    lose.step();
    assert.equal(lose.outcome, 'LOSE');
    assert.equal(lose.handSpeed, null);
    assert(!lose.tapHandSpeed());
    assert(!lose.feedback.some(e => e.type === 'handSpeed'));
});

test('a final hand speed kill is saved and supplies a single daily kill and a visual at the frozen location', () => {
    const { game, b } = setup(2), taskCombat = new DailyTaskCombat();
    game.battle = new BattleSimulation(b.base, taskCombat);
    const battle = game.battle;
    battle.base.wave.entries = [];
    battle.enemies = [enemy(110, 'enemy_raider', 3, 100, PATH_LENGTH - 1, 25)];
    game.bell(HAND_SPEED_TACTIC);
    assert(game.tapHandSpeed());
    for (let i = 0; i < 12; i++) game.update(.25);
    assert.equal(battle.outcome, 'WIN');
    assert.equal(game.state.completed, 31);
    assert.equal(game.presentationBattle, battle);
    assert.equal(taskCombat.totalKills, 1);
    const events = game.takeCombatFeedback(), hits = events.filter(event => event.type === 'handSpeed');
    assert.equal(hits.length, 1);
    assert.deepEqual(hits[0].hurt.map(e => [e.hp, e.progress]), [[0, PATH_LENGTH - 1]]);
    const view = new CombatPresentation();
    view.sync(battle, events);
    assert.equal(view.burstAge(110), 0);
    assert(view.deathPose(110));
    view.advance(.25);
    assert.equal(view.burstAge(110), undefined);
});
