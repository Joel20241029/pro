import { PATROL, PATROL_MODE } from "../config/PatrolConfig";
import { LIANG_ESSENCE, YUEXIU_DICE } from "../config/ShopConfig";
import { HERO, SLOWER_HERO_SORTIE, SONGLEI } from "../config/HeroConfig";
import { DELIVERY_HERO, DELIVERY_PATROL_HUNT } from "../config/DeliveryHeroConfig";
import { patrolSpinStats, patrolStats } from "../game/PatrolRules";
import { validDailyTaskDay } from "../game/DailyTaskState";
import { VILLAGER_QUALITY } from "../config/VillagerQuality";
import { SEWING } from "../config/RuleConfig";
import { ADULT_APPEARANCE, ENEMIES, PADS, RULE, TOWERS, TRAITS } from "../game/GameConfig";
import { GameState, isElder, isWorkingAdult, isAvailableAdult, Person } from "../game/GameState";
import { validExpedition } from "../game/Expedition";
import { gateCapacity, levelPower, sewingDayCap, sewingSlots, upgradeCost } from "../game/Growth";
import { validGiftDate } from "../game/DailyRation";
import { capacity } from "../game/VillageQueries";
import { TOWER_FLAGS, WAVE_PROGRESSION, WAVE, WAVE_RHYTHM } from "../config/DefenseConfig";
import { waveDifficulty } from "../game/WaveDifficulty";
import { DEFAULT_TACTIC, KING_MERCY, KING_MERCY_TACTIC, TACTICS, TACTIC_SLOTS } from "../config/TacticConfig";
/** 与生成器共用预算配置；覆盖一年末、累计跨年加成及最高挑战档，调难度后不会误拒合法存档。 */
const MAX_ENEMY_COST = Math.max(...Object.values(ENEMIES).map(e => e.cost));
function check(v: unknown, message = "存档数据不完整"): asserts v { if (!v) throw new Error(message); }
const int = (v: unknown, low = 0, high = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= low && (v as number) <= high;
const text = (v: unknown) => typeof v === "string" && v.length > 0 && v.length <= 80;
const ids = (v: unknown, max: number) => Array.isArray(v) && v.length <= max && v.every(text) && new Set(v).size === v.length;
const own = (v: unknown, table: object) => typeof v === "string" && Object.prototype.hasOwnProperty.call(table, v);
function validatePerson(p: Person) {
    check(p && text(p.id) && text(p.name) && ["MALE", "FEMALE"].includes(p.sex) && ["FOUNDER", "TRAVELER", "BORN"].includes(p.origin));
    check(own(p.quality, VILLAGER_QUALITY), "村民品质数据无效");
    check(p.origin !== "FOUNDER" || p.quality === "COMMON", "开村村民使用普通品质");
    const quality = VILLAGER_QUALITY[p.quality];
    check(p.appearance === ADULT_APPEARANCE[p.sex], "人物外观与当前资源版本不匹配");
    check(ids(p.traits, quality.traitCount) && p.traits.length === quality.traitCount && p.traits.every(t => own(t, TRAITS)) && int(p.generation, 1));
    check(ids(p.parents, 2) && p.parents.length === (p.origin === "BORN" ? 2 : 0) && ids(p.ancestors, RULE.populationCap));
    const uses = p.retirementDelayUses;
    if (uses !== undefined) check(p.adult && int(uses, 1, LIANG_ESSENCE.maxUses), "村民延寿次数无效");
    check(!p.parents.includes(p.id) && !p.ancestors.includes(p.id) && typeof p.adult === "boolean" &&
        int(p.nights, 0, quality.adultNights + (uses ?? 0) * LIANG_ESSENCE.maxNights) && int(p.growth, 0, RULE.growNights));
    check(int(p.elderNights, 0, quality.elderNights));
    check(p.job === "WAITING" || p.job === "SEWING");
    if (!p.adult) check(p.nights === 0 && p.elderNights === 0 && p.job === "WAITING" && p.growth < RULE.growNights);
    else if (isWorkingAdult(p)) check(p.elderNights === 0);
    else check(p.job === "WAITING");
}
/** 载入即验证业务引用；损坏内容不自动补值、不自动清档。 */
export function validateState(s: GameState, migratingLegacyNight = false) {
    check(s && int(s.run, 1) && int(s.nextPerson, 1) && int(s.nextFamily, 1) && int(s.day, 1) && int(s.completed) && s.day === s.completed + 1);
    check(s.rewardDie === undefined || s.phase === "DAY" && int(s.rewardDie, 1, YUEXIU_DICE.faces), "下场守夜骰子点数无效");
    check(s.deliveryUnlocked === undefined || (s.deliveryUnlocked === true && s.completed >= DELIVERY_HERO.recruitment.waves), "外卖大王招募状态无效");
    check(s.songLeiUnlocked === undefined || (s.songLeiUnlocked === true && s.completed >= SONGLEI.recruitment.waves), "宋磊招募状态无效");
    const heroAvailable = (id: unknown) => id === HERO.actorId || (id === DELIVERY_HERO.actorId && s.deliveryUnlocked === true) ||
        (id === SONGLEI.actorId && s.songLeiUnlocked === true);
    check(s.selectedHero === undefined || heroAvailable(s.selectedHero), "出战英雄无效");
    check(["DAY", "NIGHT", "DAWN", "GAME_OVER"].includes(s.phase));
    check(s.tactics && ids(s.tactics.learned, TACTICS.length) && s.tactics.learned.includes(DEFAULT_TACTIC) &&
        s.tactics.learned.every(id => TACTICS.some(t => t.id === id)) && s.tactics.learned.includes(s.tactics.equipped), "战技存档无效");
    const extra = s.tactics.extraSlots;
    const mercy = s.tactics.mercyCooldown;
    if (mercy !== undefined) {
        check(mercy && int(mercy.casts, 1, Number.MAX_SAFE_INTEGER - KING_MERCY.baseCooldownWaves) &&
            int(mercy.wavesLeft, 0, KING_MERCY.baseCooldownWaves + mercy.casts) && s.tactics.learned.includes(KING_MERCY_TACTIC), "怜悯冷却存档无效");
    }
    if (extra !== undefined) {
        check(Array.isArray(extra) && extra.length <= TACTIC_SLOTS.length && extra.every(id => id === null || s.tactics.learned.includes(id)), "战技槽存档无效");
        const carried = [s.tactics.equipped, ...extra.filter(id => id !== null)];
        check(new Set(carried).size === carried.length, "战技槽重复携带");
    }
    check(int(s.gateLevel, 1) && int(gateCapacity(s), RULE.gateMax));
    check(int(s.coins) && int(s.gate, 0, gateCapacity(s)) && (s.phase === "GAME_OVER" ? s.gate === 0 : s.gate > 0));
    check(int(s.houses, 1) && s.tier === RULE.maxTier);
    check(!("wood" in s || "food" in s || "farm" in s || "logging" in s), "存档仍包含已停用的粮木字段");
    const factory = s.factory;
    check(factory && int(factory.level, 1) && int(upgradeCost("FACTORY", factory.level).coins, 1) &&
        int(sewingSlots(factory.level), 1) && int(sewingDayCap(s), 1) &&
        int(factory.batches, 0, SEWING.maxBatches) && int(factory.earned, 0, sewingDayCap(s)) &&
        (factory.batches > 0 || factory.earned === 0) && int(factory.elapsedMs, 0, SEWING.batchMs - 1), "制衣厂产出存档无效");
    check(s.lastTraveler === null || int(s.lastTraveler, 1, s.completed));
    check(Array.isArray(s.people) && s.people.length <= capacity(s)); s.people.forEach(validatePerson);
    check(Array.isArray(s.history) && s.history.length <= RULE.historyCap + RULE.favoriteCap); s.history.forEach(validatePerson);
    const all = [...s.people, ...s.history]; check(new Set(all.map(p => p.id)).size === all.length);
    check(s.people.every(p => { const parts = p.id.split(":"); return parts.length === 2 && Number(parts[0]) === s.run && int(Number(parts[1]), 1, s.nextPerson - 1); }));
    check(s.history.every(p => { const parts = p.id.split(":"); return parts.length === 2 && int(Number(parts[0]), 1, s.run) && int(Number(parts[1]), 1, Number(parts[0]) === s.run ? s.nextPerson - 1 : Number.MAX_SAFE_INTEGER); }));
    const adults = s.people.filter(p => p.adult), workers = s.people.filter(isWorkingAdult), elders = s.people.filter(isElder), children = s.people.filter(p => !p.adult);
    check(adults.every(p => isWorkingAdult(p) || isElder(p)));
    check(s.history.every(p => p.adult && p.nights === 0 && p.elderNights === 0 && p.job === "WAITING"));
    check(s.people.every(p => p.ancestors.every(id => s.people.some(a => a.id === id))));
    const sewing = workers.filter(p => p.job === "SEWING");
    check(sewing.length <= sewingSlots(factory.level) && sewing.every(p => isAvailableAdult(s, p)), "制衣厂岗位存档无效");
    check(Array.isArray(s.families) && s.families.length <= Math.floor(s.people.length / 2));
    const partners: string[] = [];
    for (const f of s.families) {
        check(text(f.id) && ids(f.partners, 2) && f.partners.length === 2 && f.partners.every(id => adults.some(p => p.id === id)) && (f.lastBirth === null || int(f.lastBirth, 0, s.completed)));
        const a = adults.find(p => p.id === f.partners[0])!, b = adults.find(p => p.id === f.partners[1])!;
        check(a.sex !== b.sex && !a.ancestors.includes(b.id) && !b.ancestors.includes(a.id) && !a.parents.some(id => b.parents.includes(id))); partners.push(...f.partners);
    }
    check(new Set(partners).size === partners.length && new Set(s.families.map(f => f.id)).size === s.families.length);
    check(Array.isArray(s.towers) && s.towers.length === PADS.length);
    check(s.ammoLevels && Object.keys(TOWERS).every(k => int(s.ammoLevels[k as keyof typeof TOWERS], 1)), "弹药等级无效");
    check(s.iceAmmoUnlocked === undefined || s.iceAmmoUnlocked === true, "冰弹解锁数据无效");
    const operators: string[] = [];
    for (const t of s.towers) {
        check(t.kind === null ? t.level === 0 && t.operator === null : own(t.kind, TOWERS) && int(t.level, 1) && Number.isSafeInteger(Math.ceil(levelPower(t.level) * TOWERS[t.kind].damage)));
        check(t.flag === undefined || (t.kind !== null && TOWER_FLAGS.includes(t.flag)), "塔旗样式无效");
        if (t.kind === "SLOW") check(s.iceAmmoUnlocked === true, "未解锁冰弹");
        if (t.operator !== null) { check(workers.some(p => p.id === t.operator)); operators.push(t.operator); }
    }
    check(new Set(operators).size === operators.length && ids(s.favorites, RULE.favoriteCap) && s.favorites.every(id => s.history.some(p => p.id === id)));
    const { patrol } = s;
    const spin = s.phase !== "NIGHT" || s.night?.patrolSpin === true || s.night?.patrolMode === PATROL_MODE.rapid;
    const patrolNumbers = (captain?: Person) => spin ? patrolSpinStats(patrol.level, captain, patrol.rationReady || s.night?.patrolRation)
        : patrolStats(patrol.level, captain, captain ? s.night?.patrolSquad === true : undefined);
    check(patrol && int(patrol.level, PATROL.startLevel) && int(patrolNumbers().damage, 1), "淡紫儿建筑数据无效");
    check(patrol.mode === undefined || patrol.mode === PATROL_MODE.rapid || patrol.mode === PATROL_MODE.spin, "淡紫儿打法无效");
    // 跨过连发夜或队长荣休时，已备的商品仍属于村庄。旋甩实际出战时，两件商品原子转入当夜快照。
    if (patrol.rationReady !== undefined) check(patrol.rationReady === true && !s.night?.patrolSpin, "淡紫儿鼓舞数据无效");
    if (patrol.radiusReady !== undefined) check(patrol.radiusReady === true && !s.night?.patrolSpin, "淡紫儿砸地范围准备状态无效");
    check(patrol.captain === null || workers.some(p => p.id === patrol.captain &&
        !operators.includes(p.id) && int(patrolNumbers(p).damage, 1)), "淡紫队长数据无效");
    check(validExpedition(s), "勇闯521存档无效");
    check(Array.isArray(s.choices) && s.choices.length <= RULE.populationCap + 3);
    for (const q of s.choices) {
        check(q && q.kind === "TRAVELER");
        validatePerson(q.person);
        check(q.person.origin === "TRAVELER" && isWorkingAdult(q.person) && !all.some(p => p.id === q.person.id));
    }
    if (s.phase !== "DAWN") check(!s.choices.length);
    if (s.phase === "DAY" || s.phase === "NIGHT") {
        const w = s.wave;
        check(w && w.tier === s.tier && ["NONE", "FAST", "STURDY", "GROUP"].includes(w.affix) && Array.isArray(w.entries) && w.entries.length > 0);
        check(w.rhythm === undefined || Object.values(WAVE_RHYTHM).includes(w.rhythm), "波次难度规则无效");
        const plan = w.rhythm === undefined ? null : waveDifficulty(s.day, w.rhythm);
        const count = plan?.count ?? RULE.planCap;
        check(w.entries.length <= count && int(w.budget, 1, count * MAX_ENEMY_COST));
        const healthBand = s.day >= WAVE.ordinaryHealthStageDay ? 1 : 0;
        check(plan ? w.ordinaryHealthPercent === WAVE_PROGRESSION.ordinaryHealthPercent :
            w.ordinaryHealthPercent === WAVE.ordinaryHealth[healthBand] || w.ordinaryHealthPercent === WAVE.legacyOrdinaryHealth[healthBand], "波次生命倍率不合法");
        let last = 0, budget = 0;
        for (const e of w.entries) { check(own(e.kind, ENEMIES) && int(e.tick, last, plan?.spawnTicks ?? WAVE.spawnWindowTicks.maximum) && int(e.appearanceSeed, 0, 0xffffffff) && ENEMIES[e.kind].unlock <= s.day); last = e.tick; budget += ENEMIES[e.kind].cost; }
        check(budget === w.budget);
    } else check(s.wave === null);
    if (s.phase === "NIGHT") {
        check(s.night && s.night.tactic === s.tactics.equipped, "本夜战技快照不一致");
        if (s.night.activeHero !== undefined)
            check(heroAvailable(s.night.activeHero) && s.night.heroSortie === undefined && s.night.deliveryHero === undefined, "本夜出战英雄快照无效");
        if (s.night.deliveryPatrol !== undefined)
            check((s.night.deliveryPatrol === true || s.night.deliveryPatrol === DELIVERY_PATROL_HUNT) &&
                s.night.activeHero === DELIVERY_HERO.actorId, "本夜大王巡路快照无效");
        if (s.night.heroSortie !== undefined) check(s.night.heroSortie === true, "本夜英雄快照无效");
        if (s.night.deliveryHero !== undefined) check(s.night.deliveryHero === true && s.deliveryUnlocked === true, "本夜外卖大王快照无效");
        if (s.night.extendedHeroSortie !== undefined)
            check(s.night.extendedHeroSortie === true || s.night.extendedHeroSortie === SLOWER_HERO_SORTIE, "本夜英雄出战快照无效");
        if (s.night.reinforcedEnemies !== undefined) check(s.night.reinforcedEnemies === true, "本夜怪物强化快照无效");
        if (s.night.spreadEnemyFormation !== undefined) check(s.night.spreadEnemyFormation === true, "本夜怪物阵型快照无效");
        const back = s.night.returnPoint;
        if (back !== undefined) {
            check(back && int(back.coins) && int(back.gate, 1, gateCapacity(s)) && !("wood" in back || "food" in back), "战前进度无效");
            check(back.dailyTasks === undefined || validDailyTaskDay(back.dailyTasks), "战前任务进度无效");
            const cooldown = back.mercyCooldown;
            if (cooldown !== undefined) check(cooldown && mercy && int(cooldown.casts, 1, mercy.casts) &&
                int(cooldown.wavesLeft, 0, KING_MERCY.baseCooldownWaves + cooldown.casts), "战前怜悯冷却无效");
        }
        const reward = s.night.reward;
        if (reward !== undefined) {
            check(reward && back && s.night.hungry === undefined && int(reward.base) && int(reward.sewing) && int(reward.boss) &&
                int(reward.total) && reward.total === reward.base + reward.sewing + reward.boss, "本夜尔币奖励无效");
        } else {
            // 无精确回退点的旧夜已经入库，沿用旧战斗，不生成第二份胜利奖励。
            check(back === undefined || migratingLegacyNight, "缺少本夜尔币奖励快照");
        }
        if (s.night.patrolSquad !== undefined) check(s.night.patrolSquad === true && !!patrol.captain, "本夜淡紫儿出征规则无效");
        if (s.night.patrolSpin !== undefined) check(s.night.patrolSpin === true && s.night.patrolSquad === true, "本夜淡紫儿旋转规则无效");
        if (s.night.patrolMode !== undefined) {
            check(s.night.patrolSquad === true && s.night.patrolMode === (patrol.mode ?? PATROL_MODE.spin) &&
                (s.night.patrolMode === PATROL_MODE.spin) === (s.night.patrolSpin === true), "本夜淡紫儿打法不一致");
        } else {
            check(patrol.mode === undefined || !patrol.captain, "缺少本夜淡紫儿打法");
        }
        if (s.night.patrolRation !== undefined) check(s.night.patrolRation === true && s.night.patrolSpin === true, "本夜淡紫儿鼓舞无效");
        if (s.night.patrolWideImpact !== undefined) check(s.night.patrolWideImpact === true && s.night.patrolSpin === true, "本夜淡紫儿砸地范围无效");
        check(s.night.rewardDie === undefined || int(s.night.rewardDie, 1, YUEXIU_DICE.faces), "本夜骰子点数无效");
        const nightExtra = s.night.extraSlots;
        check(nightExtra === undefined ? extra === undefined : Array.isArray(nightExtra) && nightExtra.length === extra?.length &&
            nightExtra.every((id, i) => id === extra[i]), "本夜战技槽快照不一致");
        if (s.night.mercySpent !== undefined) {
            check(s.night.mercySpent === true && (s.night.tactic === KING_MERCY_TACTIC || nightExtra?.includes(KING_MERCY_TACTIC)) &&
                mercy && mercy.wavesLeft === KING_MERCY.baseCooldownWaves + mercy.casts, "本夜怜悯存档无效");
        }
        check(s.night && ids(s.night.adults, RULE.populationCap) && ids(s.night.elders, RULE.populationCap) &&
            (s.night.hungry === undefined || s.night.hungry === true));
        const onDuty = workers.filter(p => isAvailableAdult(s, p));
        check(s.night.adults.length === onDuty.length && s.night.adults.every(id => onDuty.some(p => p.id === id)));
        check(s.night.elders.length === elders.length && s.night.elders.every(id => elders.some(p => p.id === id)));
    } else check(s.night === null);
    check(s.rng && [s.rng.family, s.rng.world].every(n => int(n, 0, 0xffffffff)));
    check(s.stats && int(s.stats.births) && int(s.stats.retirees) && int(s.stats.generation, 1));
    check(s.legacy && int(s.legacy.births, s.stats.births) && int(s.legacy.retirees, s.stats.retirees) && int(s.legacy.bestNight, s.completed) && int(s.legacy.nextRun, s.run + 1));
    if (s.dailyTasks !== undefined) check(validDailyTaskDay(s.dailyTasks), "每日任务存档无效");
    check(s.legacy.lastRationDate === null || validGiftDate(s.legacy.lastRationDate));
    check(ids(s.legacy.traits, Object.keys(TRAITS).length) && s.legacy.traits.every(k => own(k, TRAITS)) && s.people.every(p => p.traits.every(t => s.legacy.traits.includes(t))));
    check(s.settings && (s.settings.speed === RULE.legacySlowSpeed || s.settings.speed === RULE.battleSpeed) && typeof s.settings.music === "boolean" && typeof s.summary === "string" && s.summary.length < 300);
}
