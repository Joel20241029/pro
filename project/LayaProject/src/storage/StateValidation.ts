import { ADULT_APPEARANCE, ELITE, ENEMIES, PADS, POLICIES, RULE, SKILLS, TOWERS, TRAITS } from "../game/GameConfig";
import { GameState, isElder, isWorkingAdult, Person } from "../game/GameState";
import { gateCapacity, laborSlots, levelPower, storageCapacity } from "../game/Growth";
import { validRationDate } from "../game/DailyRation";
import { capacity } from "../game/VillageQueries";
import { WAVE } from "../config/DefenseConfig";
import { DEFAULT_TACTIC, TACTICS } from "../config/TacticConfig";
/** 与生成器共用预算配置；覆盖一年末、累计跨年加成及最高挑战档，调难度后不会误拒合法存档。 */
const MAX_WAVE_BUDGET = RULE.planCap * Math.max(...Object.values(ENEMIES).map(e => e.cost));
function check(v: unknown, message = "存档数据不完整"): asserts v { if (!v) throw new Error(message); }
const int = (v: unknown, low = 0, high = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= low && (v as number) <= high;
const text = (v: unknown) => typeof v === "string" && v.length > 0 && v.length <= 80;
const ids = (v: unknown, max: number) => Array.isArray(v) && v.length <= max && v.every(text) && new Set(v).size === v.length;
const own = (v: unknown, table: object) => typeof v === "string" && Object.prototype.hasOwnProperty.call(table, v);
function validatePerson(p: Person) {
    check(p && text(p.id) && text(p.name) && ["MALE", "FEMALE"].includes(p.sex) && ["FOUNDER", "TRAVELER", "BORN"].includes(p.origin));
    check(typeof p.elite === "boolean", "村民精英标记缺失");
    check(p.origin !== "FOUNDER" || !p.elite, "开村村民不参与精英抽取");
    check(p.appearance === ADULT_APPEARANCE[p.sex], "人物外观与当前资源版本不匹配");
    check(own(p.trait, TRAITS) && (p.skill === null || own(p.skill, SKILLS)) && int(p.generation, 1));
    check(ids(p.parents, 2) && p.parents.length === (p.origin === "BORN" ? 2 : 0) && ids(p.ancestors, RULE.populationCap));
    check(!p.parents.includes(p.id) && !p.ancestors.includes(p.id) && typeof p.adult === "boolean" && int(p.nights, 0, p.elite ? ELITE.adultNights : RULE.adultNights) && int(p.growth, 0, RULE.growNights));
    check(int(p.elderNights, 0, p.elite ? ELITE.elderNights : RULE.elderNights));
    check(["WAITING", "FARM", "LOGGING", "CARE"].includes(p.job) && (p.job === "CARE" ? text(p.careChild) : p.careChild === null));
    if (!p.adult) check(p.nights === 0 && p.elderNights === 0 && p.skill === null && p.job === "WAITING" && p.growth < RULE.growNights);
    else if (isWorkingAdult(p)) check(p.elderNights === 0);
    else check(p.skill !== null && p.job === "WAITING" && p.careChild === null);
}
/** 载入即验证业务引用；损坏内容不自动补值、不自动清档。 */
export function validateState(s: GameState) {
    check(s && int(s.run, 1) && int(s.nextPerson, 1) && int(s.nextFamily, 1) && int(s.day, 1) && int(s.completed) && s.day === s.completed + 1);
    check(["DAY", "NIGHT", "DAWN", "GAME_OVER"].includes(s.phase));
    check(s.tactics && ids(s.tactics.learned, TACTICS.length) && s.tactics.learned.includes(DEFAULT_TACTIC) &&
        s.tactics.learned.every(id => TACTICS.some(t => t.id === id)) && s.tactics.learned.includes(s.tactics.equipped), "战技存档无效");
    check(int(s.housing, 1) && int(s.gateLevel, 1) && int(storageCapacity(s), RULE.storageCap) && int(gateCapacity(s), RULE.gateMax));
    check(int(s.food, 0, storageCapacity(s)) && int(s.wood, 0, storageCapacity(s)) && int(s.gate, 0, gateCapacity(s)) && (s.phase === "GAME_OVER" ? s.gate === 0 : s.gate > 0));
    check(int(s.houses, 1, RULE.houseMax) && int(s.farm, 1) && int(s.logging, 1) && s.tier === RULE.maxTier && (s.policy === null || own(s.policy, POLICIES)));
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
    const cares = workers.filter(p => p.job === "CARE").map(p => p.careChild);
    check(new Set(cares).size === cares.length && cares.every(id => children.some(p => p.id === id)));
    check(workers.filter(p => p.job === "FARM").length <= laborSlots("FARM", s.farm) && workers.filter(p => p.job === "LOGGING").length <= laborSlots("LOGGING", s.logging));
    check(Array.isArray(s.families) && s.families.length <= Math.floor(s.people.length / 2));
    const partners: string[] = [];
    for (const f of s.families) {
        check(text(f.id) && ids(f.partners, 2) && f.partners.length === 2 && f.partners.every(id => adults.some(p => p.id === id)) && (f.lastBirth === null || int(f.lastBirth, 0, s.completed)));
        const a = adults.find(p => p.id === f.partners[0])!, b = adults.find(p => p.id === f.partners[1])!;
        check(a.sex !== b.sex && !a.ancestors.includes(b.id) && !b.ancestors.includes(a.id) && !a.parents.some(id => b.parents.includes(id))); partners.push(...f.partners);
    }
    check(new Set(partners).size === partners.length && new Set(s.families.map(f => f.id)).size === s.families.length);
    check(Array.isArray(s.towers) && s.towers.length === PADS.length);
    const operators: string[] = [];
    for (const t of s.towers) {
        check(t.kind === null ? t.level === 0 && t.operator === null : own(t.kind, TOWERS) && int(t.level, 1) && Number.isSafeInteger(Math.ceil(levelPower(t.level) * TOWERS[t.kind].damage)));
        if (t.operator !== null) { check(workers.some(p => p.id === t.operator)); operators.push(t.operator); }
    }
    check(new Set(operators).size === operators.length && ids(s.favorites, RULE.favoriteCap) && s.favorites.every(id => s.history.some(p => p.id === id)));
    check(Array.isArray(s.choices) && s.choices.length <= RULE.populationCap + 3);
    for (const q of s.choices) {
        check(q && ["SKILL", "TRAVELER", "POLICY"].includes(q.kind));
        if (q.kind === "SKILL") check(workers.some(p => p.id === q.person && p.skill === null) && ids(q.options, 3) && q.options.length === 3 && q.options.every(k => own(k, SKILLS)));
        if (q.kind === "TRAVELER") { validatePerson(q.person); check(q.person.origin === "TRAVELER" && isWorkingAdult(q.person) && !all.some(p => p.id === q.person.id)); }
        if (q.kind === "POLICY") check(ids(q.options, 3) && q.options.length === 3 && q.options.every(k => own(k, POLICIES)));
    }
    if (s.phase !== "DAWN") check(!s.choices.length);
    for (const p of workers) if (p.skill === null) check(s.phase === "DAWN" && s.choices.some(q => q.kind === "SKILL" && q.person === p.id));
    if (s.phase === "DAY" || s.phase === "NIGHT") {
        const w = s.wave; check(w && int(w.budget, 1, MAX_WAVE_BUDGET) && w.tier === s.tier && ["NONE", "FAST", "STURDY", "GROUP"].includes(w.affix) && Array.isArray(w.entries) && w.entries.length > 0 && w.entries.length <= RULE.planCap);
        let last = 0, budget = 0;
        for (const e of w.entries) { check(own(e.kind, ENEMIES) && int(e.tick, last, WAVE.maxSpawnTicks) && int(e.appearanceSeed, 0, 0xffffffff) && ENEMIES[e.kind].unlock <= s.day); last = e.tick; budget += ENEMIES[e.kind].cost; }
        check(budget === w.budget);
    } else check(s.wave === null);
    if (s.phase === "NIGHT") {
        check(s.night && s.night.tactic === s.tactics.equipped, "本夜战技快照不一致");
        check(s.night && ids(s.night.adults, RULE.populationCap) && ids(s.night.elders, RULE.populationCap) && ids(s.night.cared, RULE.populationCap) && typeof s.night.hungry === "boolean");
        check(s.night.adults.length === workers.length && s.night.adults.every(id => workers.some(p => p.id === id)));
        check(s.night.elders.length === elders.length && s.night.elders.every(id => elders.some(p => p.id === id)));
        check(s.night.cared.length === cares.length && s.night.cared.every(id => cares.includes(id)));
    } else check(s.night === null);
    check(s.rng && [s.rng.family, s.rng.world].every(n => int(n, 0, 0xffffffff)));
    check(s.stats && int(s.stats.births) && int(s.stats.retirees) && int(s.stats.generation, 1));
    check(s.legacy && int(s.legacy.births, s.stats.births) && int(s.legacy.retirees, s.stats.retirees) && int(s.legacy.bestNight, s.completed) && int(s.legacy.nextRun, s.run + 1));
    check(s.legacy.lastRationDate === null || validRationDate(s.legacy.lastRationDate));
    check(ids(s.legacy.traits, Object.keys(TRAITS).length) && s.legacy.traits.every(k => own(k, TRAITS)) && s.people.every(p => s.legacy.traits.includes(p.trait)));
    check(s.settings && (s.settings.speed === RULE.minSpeed || s.settings.speed === RULE.maxSpeed) && typeof s.settings.music === "boolean" && typeof s.summary === "string" && s.summary.length < 300);
}
