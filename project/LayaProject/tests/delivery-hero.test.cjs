const assert = require('node:assert/strict');
const { test } = require('node:test');
const read = name => require(`${process.env.DAIDAI_TEST_BUILD}/${name}.js`);
const { DELIVERY_HERO: C, DELIVERY_PATROL_HUNT } = read('config/DeliveryHeroConfig');
const { HERO } = read('config/HeroConfig');
const { RULE } = read('config/RuleConfig');
const { BattleSimulation, PATH_LENGTH } = read('game/BattleSimulation');
const { enemyPoint, onBattleRoad, pointAt, roadFootprintBounds } = read('game/BattleRoad');
const { DeliverySortie, deliveryEnemySlow } = read('game/DeliverySortie');
const { applyCommand, createGame } = read('game/VillageRules');
const { generateWave } = read('game/WaveGenerator');
const { validateState } = read('storage/StateValidation');
const { RESOURCE_CONTRACT } = read('config/ResourceManifest');

test('only the front and rear riding poses ship with night combat, with one parked side view shared from village', () => {
    const village = RESOURCE_CONTRACT.village.frames, night = RESOURCE_CONTRACT.night.frames;
    assert(village.includes('delivery_bike'));
    assert(!night.includes('delivery_bike'));
    assert.deepEqual([...village, ...night].filter(id => /^hero_delivery_.*_(ride|stepoff)$/.test(id)),
        ['hero_delivery_down_ride', 'hero_delivery_up_ride']);
});

test('recruitment is once per village and only equips the new night snapshot', () => {
    const state = createGame(31);
    const recruit = { type: 'RECRUIT_DELIVERY' };
    const select = { type: 'SELECT_HERO', id: C.actorId };
    assert.throws(() => applyCommand(state, recruit), /守住/);
    assert.throws(() => applyCommand(state, select), /尚未加入/);
    assert.equal(state.deliveryUnlocked, undefined);
    state.day = C.recruitment.waves + 1;
    state.completed = state.legacy.bestNight = state.day - 1;
    state.wave = generateWave(state);
    state.coins = C.recruitment.coins - 1;
    assert.throws(() => applyCommand(state, recruit), /尔币不足/);
    assert.equal(state.coins, C.recruitment.coins - 1);
    state.coins++;
    applyCommand(state, recruit);
    assert.deepEqual([state.coins, state.deliveryUnlocked], [0, true]);
    assert.throws(() => applyCommand(state, recruit), /已加入/);
    validateState(state);
    const withChief = structuredClone(state);
    applyCommand(withChief, { type: 'NIGHT' });
    const chief = new BattleSimulation(withChief);
    assert(chief.hero && !chief.delivery);
    applyCommand(state, select);
    assert.equal(state.selectedHero, C.actorId);
    applyCommand(state, { type: 'NIGHT' });
    validateState(state);
    assert.throws(() => applyCommand(state, { type: 'SELECT_HERO', id: HERO.actorId }), /白天/);
    const nextNight = new BattleSimulation(state);
    assert(nextNight.delivery && !nextNight.hero);
    assert.equal(nextNight.delivery.roaming, true);
    assert.equal(nextNight.delivery.hunting, true);
    const roadsideNight = structuredClone(state);
    roadsideNight.night.deliveryPatrol = true;
    validateState(roadsideNight);
    const roadsideBattle = new BattleSimulation(roadsideNight);
    assert(roadsideBattle.delivery.roaming && !roadsideBattle.delivery.hunting);
    const previous = structuredClone(state);
    delete previous.night.deliveryPatrol;
    validateState(previous);
    assert.equal(new BattleSimulation(previous).delivery.roaming, false);
    assert.equal(state.night.activeHero, C.actorId);
    for (const battle of [chief, nextNight]) battle.spawn('enemy_raider', 0, 1);
    assert.equal(chief.enemies[0].maxHp, nextNight.enemies[0].maxHp);
    state.night.heroSortie = true;
    assert.throws(() => validateState(state), /本夜出战英雄快照/);
    delete state.night.activeHero;
    delete state.night.deliveryPatrol;
    state.night.deliveryHero = true;
    validateState(state);
    const oldNight = new BattleSimulation(state);
    assert(oldNight.hero && !oldNight.delivery);
    delete state.selectedHero;
    delete state.deliveryUnlocked;
    assert.throws(() => validateState(state), /外卖大王快照/);
});

test('roaming delivery parks at different shoulders, steps out at chill speed and walks back to the same bike', () => {
    const delivery = new DeliverySortie(20, true, true);
    const start = { ...delivery.position }, parked = [];
    const ordinary = { seq: 1, kind: 'enemy_raider', progress: PATH_LENGTH - 130, speed: 0, hp: 700, slowTicks: 0 };
    let stepped = false, cameBack = false, mounted = false;
    delivery.advance(0, []);
    assert(Math.abs(start.x - delivery.position.x - 42 * RULE.step) < 1e-9);
    for (let tick = 1; tick < 1600; tick++) {
        const at = { ...enemyPoint(ordinary), y: delivery.phase === 'fighting' ? delivery.parked.y - 48 : 695 };
        const prev = delivery.phase;
        delivery.advance(tick, parked.length < 2 ? [{ enemy: ordinary, at }] : []);
        if (prev === 'ridingOut' && delivery.phase === 'dismount') parked.push({ ...delivery.parked });
        if (delivery.walking && delivery.phase === 'fighting') {
            stepped = true;
            const edge = roadFootprintBounds(delivery.position.y, { halfWidth: 0, back: 0, front: 0 });
            assert(delivery.position.x < edge.left || delivery.position.x > edge.right);
            assert.deepEqual(delivery.parked, parked[0]);
        }
        if (prev === 'walkingBack' && delivery.phase === 'mounting') {
            cameBack = true;
            assert.deepEqual(delivery.position, delivery.parked);
        }
        if (delivery.phase === 'resting') { mounted = true; assert.deepEqual(delivery.position, start); }
        if (parked.length === 2) break;
    }
    assert(stepped && cameBack && mounted);
    assert.equal(parked.length, 2);
    assert.notDeepEqual(parked[0], parked[1]);
});

test('only survivors in a roaming delivery splash are slowed, for the next 48 ticks', () => {
    const { slow, slowSeconds } = C.patrol;
    const delivery = new DeliverySortie(30, true, true);
    const progress = PATH_LENGTH - 130;
    const common = { kind: 'enemy_raider', progress, speed: 0, slowTicks: 6, slow: .38, roadLane: 0 };
    const enemies = [{ ...common, seq: 1, hp: 10 }, { ...common, seq: 2, hp: 70, roadLane: .15 }];
    let impact, tick = 0;
    for (; tick < 600; tick++) {
        const event = delivery.advance(tick, enemies.map(enemy => ({ enemy, at: enemyPoint(enemy) })));
        if (event?.type === 'deliveryHit') { impact = event; break; }
    }
    assert.equal(impact.hurt.length, 2);
    assert.equal(enemies[0].deliverySlowUntil, undefined);
    assert.equal(enemies[1].slowTicks, common.slowTicks);
    assert.equal(deliveryEnemySlow(enemies[1], tick + Math.ceil(slowSeconds / RULE.step)), slow);
    assert.equal(deliveryEnemySlow(enemies[1], enemies[1].deliverySlowUntil), 0);
});

test('route hunter rides empty road, stops at first reachable enemy, walks between throws and rides back on the other lane', () => {
    const courier = new DeliverySortie(30, true, DELIVERY_PATROL_HUNT);
    const mouth = pointAt(PATH_LENGTH);
    const makeTarget = (seq, dx, dy) => ({
        enemy: { seq, kind: 'enemy_raider', progress: PATH_LENGTH - 350, speed: 0, hp: 500, slowTicks: 0 },
        at: { x: courier.position.x + dx, y: courier.position.y + dy }
    });
    const throws = [];
    let parked, walkBack = false, mounted = false, returningOnRight = false, farthestEmptyY = mouth.y, rest = false;
    for (let tick = 1; tick < 2400; tick++) {
        const before = courier.phase;
        const targets = before === 'ridingOut' && courier.position.y <= 615 ? [makeTarget(19, 0, -80)]
            : before === 'fighting' && throws.length === 0 ? [makeTarget(1, 0, -14), makeTarget(2, 90, 64)]
            : before === 'fighting' ? [makeTarget(3, -60, -12), makeTarget(4, 60, -12), makeTarget(5, 0, -60)] : [];
        const event = courier.advance(tick, targets);
        if (courier.phase === 'ridingOut') {
            farthestEmptyY = Math.min(farthestEmptyY, courier.position.y);
            if (courier.position.y <= mouth.y) assert(onBattleRoad(courier.position));
        }
        if (courier.phase === 'dismount' && !parked) {
            assert(targets.length);
            parked = { ...courier.parked };
            assert.deepEqual(courier.position, parked);
            assert(farthestEmptyY < 620);
            assert(parked.x < (roadFootprintBounds(parked.y, { halfWidth: 0, back: 0, front: 0 }).left +
                roadFootprintBounds(parked.y, { halfWidth: 0, back: 0, front: 0 }).right) / 2);
        }
        if (event?.type === 'deliveryThrow') throws.push(event.flight);
        if (courier.phase === 'walkingBack') walkBack = true;
        if (courier.phase === 'mounting' && !mounted) {
            assert.deepEqual(courier.position, parked);
            mounted = true;
        }
        if (courier.phase === 'ridingBack' && courier.position.y > parked.y + 8 && courier.position.y < 710) {
            assert(onBattleRoad(courier.position));
            const { left, right } = roadFootprintBounds(courier.position.y, { halfWidth: 0, back: 0, front: 0 });
            returningOnRight ||= courier.position.x > (left + right) / 2;
        }
        if (courier.phase === 'resting') { rest = true; break; }
    }
    assert(rest && walkBack && mounted && returningOnRight);
    assert(throws.length >= 3);
    assert.equal(throws[0].seq, 2);
    assert.notEqual(throws[0].direction, throws[1].direction);
    assert.notEqual(throws[1].direction, throws[2].direction);
    assert(throws[1].from.y <= throws[0].from.y - C.hunt.stepAfterThrow);
});

test('the courier waits for dismount, hits one direct and four splash targets, and cycles back through the gate', () => {
    const delivery = new DeliverySortie(20);
    const home = { ...delivery.position };
    const { x, y } = delivery.parked;
    const targets = [12, 18, 22, 30, 38, 48, C.solo.radius * 2].map((offset, seq) => ({
        at: { x: x + offset, y },
        enemy: { seq: seq + 1, progress: PATH_LENGTH - C.parkingLead, hp: 90, speed: 0, slowTicks: 0 }
    }));
    const transitions = new Map();
    const throws = [], hits = [];
    for (let tick = 0; tick < 50 / RULE.step; tick++) {
        const event = delivery.advance(tick, throws.length > 1 ? [] : targets);
        if (delivery.phase === 'ridingOut' && transitions.has('resting')) {
            assert.equal(tick - transitions.get('resting'), Math.ceil(C.solo.restSeconds / RULE.step));
            assert.deepEqual(delivery.position, home);
            break;
        }
        if (!transitions.has(delivery.phase)) transitions.set(delivery.phase, tick);
        if (event?.type === 'deliveryThrow') throws.push({ tick, ...event.flight });
        if (event?.type === 'deliveryHit') hits.push({ tick, ...event });
    }
    assert.deepEqual([...transitions.keys()], ['ridingOut', 'dismount', 'fighting', 'mounting', 'ridingBack', 'resting']);
    assert(throws[0].tick >= transitions.get('fighting'));
    assert.equal((throws[1].tick - throws[0].tick) * RULE.step, C.solo.intervalSeconds);
    assert.equal(hits[0].tick, throws[0].landing);
    assert.equal(hits[0].direction, 'RIGHT');
    assert.equal(hits[0].radius, C.solo.radius);
    assert.deepEqual(hits[0].hurt.map(e => e.seq), [1, 2, 3, 4, 5]);
    assert.deepEqual(targets.map(t => t.enemy.hp), [70, 78, 78, 78, 78, 90, 90]);
});
