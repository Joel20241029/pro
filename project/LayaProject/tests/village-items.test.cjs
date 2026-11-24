const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const read = name => require(path.join(process.env.DAIDAI_TEST_BUILD, name));
const { SaveStore } = read('storage/SaveStore');
const { VILLAGE_ITEM_KEYS: keys } = read('storage/VillageItemStorage');
const { GUIDE_SAVE_KEY } = read('storage/VillageGuides');
const { GameSession } = read('game/GameSession');
const { createGame } = read('game/VillageRules');
const { featureUnlocked } = read('config/DailyTaskConfig');
const { SHOP_PRODUCTS, ITEMS, LIANG_ESSENCE, PATROL_RATION, LIANG_INDULGENCE } = read('config/ShopConfig');

const mainA = 'daidai_village.save.a', mainB = 'daidai_village.save.b';
const unrelated = 'daidai_village.device_settings';
function fixture() {
    const values = new Map([[unrelated, 'preserve']]);
    const fault = {};
    const port = {
        read: key => values.get(key) ?? null,
        write(key, value) {
            if (fault.beforeWrite === key) throw Error('failed main write');
            values.set(key, value);
            if (fault.afterWrite === key) throw Error('uncertain main write');
        },
        remove(key) {
            if (fault.remove === key) throw Error('failed item deletion');
            values.delete(key);
        }
    };
    const reopen = () => { const game = new GameSession(new SaveStore(port)); game.load(); return game; };
    return { values, fault, port, reopen };
}
function populate(game) {
    game.villageItems.saveItems({ gate_kit: 2, food_bag: 3 });
    game.saves.port.write(keys.shop, JSON.stringify({ version:1, villageId:game.saves.villageId, guideSeen:true }));
}
function assertReset(f, game) {
    assert.equal(game.state.completed, 0);
    assert.equal(game.saves.pending, null);
    assert.equal(f.values.has(keys.backpack), false);
    assert.equal(f.values.has(keys.shop), false);
    assert.deepEqual(game.villageItems.backpack().items, {});
    assert.equal(game.villageItems.shop().guideSeen, false);
    assert.equal(f.values.get(unrelated), 'preserve');
}

test('an older envelope loads with empty independent feature data and stays byte-for-byte unchanged', () => {
    const f = fixture(), legacy = new SaveStore(f.port);
    legacy.inspect(); legacy.prepare(createGame(19)); legacy.commit();
    const before = [...f.values], game = f.reopen();
    assert.deepEqual(game.villageItems.backpack().items, {});
    assert.equal(game.villageItems.shop().guideSeen, false);
    assert.deepEqual([...f.values], before);
});

test('inventory and separate tutorial records survive the same village and never rewrite the main envelope', () => {
    const f = fixture(), game = f.reopen();
    game.newVillage();
    const original = f.values.get(mainA);
    populate(game);
    const shopRaw = f.values.get(keys.shop);
    game.guides.mark('backpack');
    assert.equal(f.values.get(keys.shop), shopRaw);
    assert.equal(f.values.get(mainA), original);
    assert(!Object.keys(JSON.parse(original).payload).includes('backpack'));
    game.command({ type: 'NIGHT' });
    const reopened = f.reopen();
    assert.equal(reopened.saves.villageId, game.saves.villageId);
    assert.deepEqual(reopened.villageItems.backpack().items, { gate_kit: 2, food_bag: 3 });
    for (const name of ['backpack', 'shop']) assert.equal(reopened.guides.get(name), 1);
});

test('guide migration preserves old confirmations, writes independently and clears on a retried restart', () => {
    const f = fixture(), game = f.reopen(); game.newVillage(); populate(game);
    const starter = 'daidai_village.starter_guide', slot = 'daidai_village.tactic_slot_guide_dismissed';
    f.values.set(starter, '2'); f.values.set(slot, '1');
    const rawBag = f.values.get(keys.backpack), main = f.values.get(mainA);
    assert.equal(game.guides.get('starter'), 2);
    assert.equal(game.guides.get('slot'), 1);
    assert.equal(game.guides.get('shop'), 1);
    game.guides.mark('tacticAction');
    assert.equal(f.values.get(mainA), main); assert.equal(f.values.get(keys.backpack), rawBag);
    assert.equal(f.reopen().guides.get('tacticAction'), 1);
    f.fault.remove = GUIDE_SAVE_KEY;
    game.newVillage(); assert(game.saves.pending);
    delete f.fault.remove;
    const reopened = f.reopen();
    assert.equal(reopened.guides.get('starter'), 0);
    assert.equal(reopened.guides.get('tacticAction'), 0);
    for (const key of [GUIDE_SAVE_KEY, starter, slot]) assert(!f.values.has(key));
});

test('settings and game-over restart both delete just the two feature keys for the old village', () => {
    for (const phase of ['DAY', 'GAME_OVER']) {
        const f = fixture(), game = f.reopen(); game.newVillage(); populate(game);
        game.state.phase = phase;
        const id = game.saves.villageId;
        game.newVillage();
        assertReset(f, game);
        assert.notEqual(game.saves.villageId, id);
        assert.equal(f.values.get(mainA), f.values.get(mainB));
    }
});

test('new-village failure before the first write preserves feature data, and retry deletes it', () => {
    const f = fixture(), game = f.reopen(); game.newVillage(); populate(game);
    const old = f.values.get(keys.backpack);
    f.fault.beforeWrite = mainB;
    game.newVillage();
    assert(game.saves.pending);
    assert.equal(f.values.get(keys.backpack), old);
    delete f.fault.beforeWrite;
    game.retry();
    assertReset(f, game);
});

test('interrupted deletion resumes from the durable clean-start candidate on a cold start', () => {
    const f = fixture(), game = f.reopen(); game.newVillage(); populate(game);
    f.fault.remove = keys.shop;
    game.newVillage();
    assert(game.saves.pending);
    assert.equal(f.values.has(keys.shop), true);
    assert.notEqual(f.values.get(mainA), f.values.get(mainB));
    delete f.fault.remove;
    const reopened = f.reopen();
    assertReset(f, reopened);
    assert.equal(f.values.get(mainA), f.values.get(mainB));
});

test('resetting two corrupt slots resumes cleaning even if the first write result was uncertain', () => {
    const f = fixture();
    f.values.set(mainA, 'corrupt-a');
    f.values.set(mainB, 'corrupt-b');
    f.values.set(keys.shop, 'old-shop');
    f.values.set(keys.backpack, 'old-backpack');
    const game = f.reopen();
    f.fault.afterWrite = mainA;
    game.newVillage(true);
    assert(game.saves.pending);
    assert.equal(f.values.get(keys.shop), 'old-shop');
    delete f.fault.afterWrite;
    assertReset(f, f.reopen());
});

test('unknown versions and foreign-village inventories remain preserved', () => {
    const f = fixture(), game = f.reopen(); game.newVillage(); populate(game);
    const raw = f.values.get(keys.backpack);
    for (const patch of [{ version: 99 }, { villageId: 'other' }]) {
        const unrecognized = JSON.stringify({ ...JSON.parse(raw), ...patch });
        f.values.set(keys.backpack, unrecognized);
        assert.throws(() => game.villageItems.backpack(), /原数据已保留/);
        assert.throws(() => game.villageItems.saveItems({ gate_kit: 1 }));
        assert.equal(f.values.get(keys.backpack), unrecognized);
        assert.equal(game.villageItems.shop().guideSeen, true);
    }
});

test('backpack and shop gates are distinct, and only confirmed offers are purchasable', () => {
    assert.equal(featureUnlocked(7, 'backpack'), false);
    assert.equal(featureUnlocked(8, 'backpack'), true);
    assert.equal(featureUnlocked(12, 'shop'), false);
    assert.equal(featureUnlocked(13, 'shop'), true);
    assert.deepEqual(SHOP_PRODUCTS, [LIANG_ESSENCE, PATROL_RATION, LIANG_INDULGENCE]);
    assert.equal(ITEMS.patrol_ration.name, '靓哥的底线');
    assert.equal(ITEMS.patrol_ration.icon, 'icon_liang_briefs');
    assert.match(PATROL_RATION.lore, /靓哥的红底裤/);
    assert.deepEqual(ITEMS.gate_kit, { name: '修门工具', description: '用于修补城门', icon: 'icon_build' });
});

test('patrol ration atomically consumes one bag and boosts only the next night, including reload', () => {
    const f = fixture(), game = f.reopen(), id = PATROL_RATION.id;
    game.newVillage();
    game.state.legacy.bestNight = 13;
    const { food, wood } = game.state;
    game.buyItem(id);
    assert.equal(game.state.food, food - 40);
    assert.equal(game.state.wood, wood - 20);
    assert.equal(game.villageItems.backpack().items[id], 1);
    const captain = game.state.patrol.captain;
    game.state.patrol.captain = null;
    game.usePatrolItem(PATROL_RATION.id);
    assert.match(game.error, /先任命/);
    assert.equal(game.villageItems.backpack().items[id], 1);
    game.state.patrol.captain = captain;
    game.villageItems.saveItems({ [id]: 2 });
    f.fault.beforeWrite = keys.backpack;
    game.usePatrolItem(PATROL_RATION.id);
    assert(game.saves.pending);
    delete f.fault.beforeWrite;
    const resumed = f.reopen();
    assert.equal(resumed.state.patrol.rationReady, true);
    assert.equal(resumed.villageItems.backpack().items[id], 1);
    resumed.usePatrolItem(PATROL_RATION.id);
    assert.match(resumed.error, /已获鼓舞/);
    assert.equal(resumed.villageItems.backpack().items[id], 1);
    resumed.command({ type: 'NIGHT' });
    const combat = f.reopen(), { patrolSpinStats, patrolCaptain } = read('game/PatrolRules');
    assert.equal(combat.state.patrol.rationReady, undefined);
    assert.equal(combat.state.night.patrolRation, true);
    const normal = patrolSpinStats(combat.state.patrol.level, patrolCaptain(combat.state));
    assert.equal(combat.battle.patrol.stats.damage, Math.round(normal.damage * 1.5));
    assert.equal(combat.battle.patrol.stats.ticks, normal.ticks);
});

test('wide impact and damage supplies persist independently through purchase, retry and night replay', () => {
    const f = fixture(), game = f.reopen(), id = LIANG_INDULGENCE.id;
    game.newVillage();
    game.state.legacy.bestNight = 13;
    game.state.food = 160; game.state.wood = 80;
    game.buyItem(id);
    assert.deepEqual([game.state.food, game.state.wood, game.villageItems.backpack().items[id]], [120, 60, 1]);
    game.buyItem(id); game.buyItem(PATROL_RATION.id);
    f.fault.beforeWrite = keys.backpack;
    game.usePatrolItem(id);
    assert(game.saves.pending);
    delete f.fault.beforeWrite;
    const day = f.reopen();
    assert.equal(day.state.patrol.radiusReady, true);
    assert.equal(day.state.patrol.rationReady, undefined);
    day.usePatrolItem(id);
    assert.match(day.error, /已扩大/);
    assert.equal(day.villageItems.backpack().items[id], 1);
    day.usePatrolItem(PATROL_RATION.id);
    day.command({ type: 'NIGHT' });
    const night = f.reopen();
    assert.equal(night.state.patrol.radiusReady, undefined);
    assert.equal(night.state.night.patrolWideImpact, true);
    assert.equal(night.state.night.patrolRation, true);
    assert.equal(night.battle.patrol.spin.radius, 112.5);
    night.usePatrolItem(id);
    assert.match(night.error, /白天/);
    assert.equal(night.villageItems.backpack().items[id], 1);
    const { applyCommand, finishNight } = read('game/VillageRules');
    const s = night.state;
    finishNight(s, s.gate, s.towers.map(t => t.operator));
    while (s.choices.length) applyCommand(s, {type: 'CHOOSE', value: s.choices[0].options[0]});
    applyCommand(s, {type: 'FINALIZE'}); applyCommand(s, {type: 'NIGHT'});
    assert.equal(s.night.patrolRation, undefined);
    assert.equal(s.night.patrolWideImpact, undefined);
    const { Patrol } = read('game/Patrol');
    assert.equal(new Patrol(s).spin.radius, 90);
});

test('house selection survives reopening and both prepared supplies wait through rapid nights for a spin night', () => {
    const f = fixture(), game = f.reopen();
    const { applyCommand, finishNight } = read('game/VillageRules');
    const { validateState } = read('storage/StateValidation');
    game.newVillage(); game.state.legacy.bestNight = 13;
    game.villageItems.saveItems({ [PATROL_RATION.id]: 2, [LIANG_INDULGENCE.id]: 1 });
    game.usePatrolItem(PATROL_RATION.id);
    game.command({ type: 'PATROL_MODE', mode: 'rapid' });
    game.usePatrolItem(LIANG_INDULGENCE.id);
    const ready = f.reopen();
    assert.equal(ready.state.patrol.mode, 'rapid');
    assert.equal(ready.state.patrol.radiusReady, true);
    assert.equal(ready.state.patrol.rationReady, true);
    ready.command({ type: 'NIGHT' });
    const night = f.reopen();
    const s = night.state;
    assert.equal(s.night.patrolMode, 'rapid');
    assert.equal(s.night.patrolSpin, undefined);
    assert.equal(s.night.patrolRation, undefined);
    assert.equal(s.night.patrolWideImpact, undefined);
    assert.throws(() => applyCommand(s, {type: 'PATROL_MODE', mode: 'spin'}), /白天/);
    const corrupted = JSON.parse(JSON.stringify(s));
    corrupted.night.patrolMode = 'spin';
    assert.throws(() => validateState(corrupted), /打法/);

    for (let i = 0; i < 2; i++) {
        assert.equal(s.patrol.radiusReady, true); assert.equal(s.patrol.rationReady, true);
        finishNight(s, s.gate, s.towers.map(t => t.operator));
        validateState(s);
        while (s.choices.length) applyCommand(s, {type: 'CHOOSE', value: s.choices[0].options[0]});
        applyCommand(s, {type: 'FINALIZE'});
        assert.equal(s.patrol.mode, 'rapid');
        if (i === 1) applyCommand(s, {type:'PATROL_MODE', mode:'spin'});
        applyCommand(s, {type: 'NIGHT'}); validateState(s);
    }
    assert.equal(s.night.patrolMode, 'spin');
    assert.equal(s.night.patrolRation, true); assert.equal(s.night.patrolWideImpact, true);
    assert.equal(s.patrol.rationReady, undefined); assert.equal(s.patrol.radiusReady, undefined);
    assert.equal(night.villageItems.backpack().items[PATROL_RATION.id], 1);
});

function unlocked(f) {
    const game = f.reopen(); game.newVillage();
    const state = { ...game.state, food: 200, wood: 37, legacy: { ...game.state.legacy, bestNight: 13 } };
    game.saves.prepare(state); game.saves.commit();
    return f.reopen();
}

test('shop charges materials once and adds one bottle, then refuses insufficient funds', () => {
    const f = fixture(), game = unlocked(f), { id } = LIANG_ESSENCE;
    game.buyItem(id);
    assert.equal(game.state.food, 80); assert.equal(game.state.wood, 22);
    assert.equal(game.takePurchaseFeedback(), true);
    assert.equal(game.takePurchaseFeedback(), false);
    assert.equal(game.villageItems.backpack().items[id], 1);
    game.buyItem(id);
    assert.match(game.error, /不足/);
    assert.equal(game.takePurchaseFeedback(), false);
    assert.equal(game.villageItems.backpack().items[id], 1);
    assert.equal(game.state.food, 80);
});

test('essence stacks three times for one adult, persists the result and rejects a fourth bottle', () => {
    const f = fixture(), game = unlocked(f), { id } = LIANG_ESSENCE;
    game.villageItems.saveItems({ [id]: 4 });
    const target = game.state.people[0], world = game.state.rng.world;
    let expected = target.nights;
    for (let i = 0; i < 3; i++) {
        game.useEssence(target.id);
        const feedback = game.takeEssenceFeedback();
        assert.equal(feedback.person, target.id);
        assert(feedback.nights >= 5 && feedback.nights <= 20);
        expected += feedback.nights;
    }
    const reopened = f.reopen();
    assert.equal(reopened.takeEssenceFeedback(), undefined);
    reopened.useEssence(target.id);
    assert.match(reopened.error, /无法使用/);
    assert.equal(reopened.state.people[0].nights, expected);
    assert.equal(reopened.state.people[0].retirementDelayUses, 3);
    assert.equal(reopened.state.rng.world, world);
    assert.equal(reopened.villageItems.backpack().items[id], 1);
    reopened.newVillage();
    assert.equal(reopened.state.people[0].retirementDelayUses, undefined);
    assert.deepEqual(reopened.villageItems.backpack().items, {});
});

test('children, retirees and nonexistent residents cannot use the item', () => {
    const f = fixture(), game = unlocked(f), { id } = LIANG_ESSENCE;
    game.villageItems.saveItems({ [id]: 1 });
    const [child, elder] = game.state.people;
    child.adult = false; child.nights = 0;
    elder.nights = 0; elder.elderNights = 2;
    for (const person of [child.id, elder.id, 'unknown']) {
        game.useEssence(person);
        assert.match(game.error, /无法使用/);
        assert.equal(game.villageItems.backpack().items[id], 1);
    }
});

test('interrupted item operations converge after retry, cold start and an uncertain write', () => {
    const { id } = LIANG_ESSENCE;
    for (const failure of ['mirror', 'inventory', 'uncertain']) {
        const f = fixture(), game = unlocked(f), target = game.state.people[0];
        game.villageItems.saveItems({ [id]: 2 });
        const active = [mainA, mainB].sort((a,b) => JSON.parse(f.values.get(b)).revision - JSON.parse(f.values.get(a)).revision)[0];
        const fault = failure === 'mirror' ? { beforeWrite: active } :
            failure === 'inventory' ? { beforeWrite: keys.backpack } : { afterWrite: keys.backpack };
        Object.assign(f.fault, fault);
        game.useEssence(target.id);
        assert(game.saves.pending);
        assert.equal(game.takeEssenceFeedback(), undefined);
        assert.equal(game.state.people[0].nights, target.nights);
        for (const key of Object.keys(fault)) delete f.fault[key];
        const reopened = f.reopen();
        assert.equal(reopened.state.people[0].retirementDelayUses, 1);
        assert.equal(reopened.villageItems.backpack().items[id], 1);
        assert.equal(f.values.get(mainA), f.values.get(mainB));
        f.values.set(mainA, 'corrupt-a');
        const recovered = f.reopen(); recovered.recover();
        assert.equal(recovered.state.people[0].retirementDelayUses, 1);
        assert.equal(recovered.villageItems.backpack().items[id], 1);
    }
    const f = fixture(), game = unlocked(f);
    f.fault.afterWrite = keys.backpack;
    game.buyItem(id);
    assert(game.saves.pending);
    assert.equal(game.takePurchaseFeedback(), false);
    delete f.fault.afterWrite;
    game.retry();
    assert.equal(game.takePurchaseFeedback(), true);
    assert.equal(game.state.food, 80);
    assert.equal(game.villageItems.backpack().items[id], 1);
});
