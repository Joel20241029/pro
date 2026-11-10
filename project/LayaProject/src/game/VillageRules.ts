import { ADULT_APPEARANCE, ELITE, FOUNDERS, POLICIES, Policy, RULE, SKILLS, Skill, TOWERS, TowerKind, TRAITS, Trait, VILLAGER_NAMES } from "./GameConfig";
import { clone, GameState, isElder, isWorkingAdult, Job, Legacy, Person } from "./GameState";
import { SeededRandom } from "./SeededRandom";
import { generateWave, season } from "./WaveGenerator";
export const JOB_NAMES: Record<Job, string> = { WAITING: "待安排", FARM: "耕作", LOGGING: "伐木", CARE: "照料" };
/** 用户确认的自动分配顺序：先农艺/伐木专长对应空岗，再先农田后伐木；各轮按在村顺序。
 * 只处理待安排成年人，不换走在岗者、不自动照料、不使用随机数；没有空岗仍为待安排。
 */
export function autoAssignJobs(s: GameState) {
    const free = {
        FARM: RULE.farmSlots[s.farm - 1] - s.people.filter(p => p.job === "FARM").length,
        LOGGING: RULE.logSlots[s.logging - 1] - s.people.filter(p => p.job === "LOGGING").length
    };
    for (const p of s.people) if (isWorkingAdult(p) && p.skill !== null && p.job === "WAITING") {
        const job = p.skill === "skill_farming" ? "FARM" : p.skill === "skill_logging" ? "LOGGING" : null;
        if (job && free[job] > 0) { p.job = job; free[job]--; }
    }
    for (const p of s.people) if (isWorkingAdult(p) && p.skill !== null && p.job === "WAITING") {
        if (free.FARM > 0) { p.job = "FARM"; free.FARM--; }
        else if (free.LOGGING > 0) { p.job = "LOGGING"; free.LOGGING--; }
    }
}
export function person(s: GameState, id: string): Person { const p = s.people.find(p => p.id === id); if (!p) throw new Error("村民已不在村中"); return p; }
function requireRule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
export function policy(s: GameState): Partial<Policy> { return s.policy === null ? {} : POLICIES[s.policy]; }
export function capacity(s: GameState) { return Math.min(RULE.populationCap, s.houses * RULE.houseCapacity); }
function spend(s: GameState, resource: "food" | "wood", amount: number) { requireRule(s[resource] >= amount, resource === "food" ? "粮食不足" : "木材不足"); s[resource] -= amount; }
function newId(s: GameState): string { requireRule(Number.isSafeInteger(s.nextPerson + 1), "人口编号已达安全范围"); return `${s.run}:${s.nextPerson++}`; }
function remember(s: GameState, trait: Trait) { if (!s.legacy.traits.includes(trait)) s.legacy.traits.push(trait); }
export function createGame(seed: number, old?: Legacy, inherited?: Trait, history: Person[] = [], favorites: string[] = []): GameState {
    const legacy: Legacy = old ? clone(old) : { births: 0, retirees: 0, bestNight: 0, bestTier: 0, traits: [], nextRun: 1 };
    requireRule(Number.isSafeInteger(legacy.nextRun + 1), "村落编号已达安全范围");
    if (inherited) requireRule(legacy.traits.includes(inherited), "尚未发现此天赋");
    const s: GameState = {
        run: legacy.nextRun++, nextPerson: 1, nextFamily: 2, day: 1, completed: 0, lastDawn: 0,
        phase: "DAY", food: RULE.initialResource, wood: RULE.initialResource, gate: RULE.gateMax,
        houses: 2, farm: 1, logging: 1, tier: 0, policy: null,
        people: [], families: [], towers: [], history: clone(history), favorites: favorites.slice(), choices: [], wave: null, night: null,
        // 三流通过不同固定掩码分离；仅新村生成种子，重进不重新取时间。
        rng: { family: (seed ^ 0xa341316c) >>> 0, world: (seed ^ 0xc8013ea4) >>> 0, battle: (seed ^ 0xad90777d) >>> 0 },
        stats: { births: 0, retirees: 0, generation: 1 }, legacy, settings: { speed: 1 }, summary: ""
    };
    s.people = FOUNDERS.map((f, i): Person => ({ id: newId(s), name: f.name, sex: f.sex, origin: "FOUNDER", elite: false, appearance: f.appearance, trait: i === 0 && inherited ? inherited : f.trait, skill: f.skill, generation: 1, parents: [], ancestors: [], adult: true, nights: f.nights, elderNights: 0, growth: 0, job: f.job, careChild: null }));
    s.families.push({ id: `${s.run}:f1`, partners: [s.people[0].id, s.people[1].id], lastBirth: null });
    s.towers = [{ kind: "ARROW", level: 1, operator: s.people[3].id }, { kind: "STONE", level: 1, operator: s.people[2].id }, { kind: null, level: 0, operator: null }, { kind: null, level: 0, operator: null }];
    s.people.forEach(p => remember(s, p.trait)); autoAssignJobs(s); s.wave = generateWave(s); return s;
}
export function canMarry(s: GameState, a: Person, b: Person): boolean {
    return a.id !== b.id && isWorkingAdult(a) && isWorkingAdult(b) && a.sex !== b.sex &&
        !s.families.some(f => f.partners.includes(a.id) || f.partners.includes(b.id)) &&
        !a.ancestors.includes(b.id) && !b.ancestors.includes(a.id) && !a.parents.some(id => b.parents.includes(id));
}
/** 迎接孩子的预检与命令共用原生育条件，按原校验顺序返回首个阻塞原因。
 * 不传照料者时只检查是否存在合格人选；传入 ID 时校验该人。纯查询，不扣粮、不改岗位或随机数。
 */
export function birthUnavailableReason(s: GameState, familyId: string, carerId?: string): string | null {
    if (s.phase !== "DAY") return "请在白天安排村务";
    const family = s.families.find(f => f.id === familyId);
    if (!family) return "家庭不存在";
    const parents = family.partners.map(id => person(s, id));
    if (parents.some(p => !isWorkingAdult(p))) return "双亲需仍在劳作期";
    if (s.people.length >= capacity(s)) return `民居已满 · ${s.people.length}/${capacity(s)} 人`;
    if (parents.some(p => p.nights < RULE.parentMinNights)) return `双亲需至少余 ${RULE.parentMinNights} 夜`;
    if (s.people.some(p => !p.adult && p.parents.some(id => family.partners.includes(id)))) return "已有孩子未成年";
    if (family.lastBirth !== null && s.completed - family.lastBirth < RULE.birthCooldown) return `再守住 ${RULE.birthCooldown - (s.completed - family.lastBirth)} 夜可迎接`;
    const carer = carerId === undefined ? s.people.find(p => isWorkingAdult(p) && p.job !== "CARE") : s.people.find(p => p.id === carerId);
    if (!carer) return carerId === undefined ? "暂无可用照料者" : "照料者已不在村中";
    if (!isWorkingAdult(carer)) return "照料者需在劳作期";
    if (carer.job === "CARE") return "照料者正照顾其他孩子";
    if (s.food < RULE.birthCost) return `粮食不足 · ${s.food}/${RULE.birthCost}`;
    return null;
}
export function economy(s: GameState) {
    const po = policy(s); let food = 0, wood = 0, rations = 0, elderRations = 0;
    for (const p of s.people) {
        const ration = p.adult ? (p.trait === "trait_frugal" ? 1 : RULE.adultRation) : RULE.childRation;
        rations += ration;
        if (isElder(p)) elderRations += ration;
        if (!isWorkingAdult(p)) continue;
        const production = p.elite ? ELITE.productionMultiplier : 1;
        if (p.job === "FARM") food += Math.floor(production * RULE.farmBase * (1 + (p.trait === "trait_diligent" ? .2 : 0) + (p.skill === "skill_farming" ? .2 : 0) + (season(s.day) === 0 ? .1 : 0) + (po.food || 0)));
        if (p.job === "LOGGING") wood += Math.floor(production * RULE.logBase * (1 + (p.trait === "trait_woodwise" ? .2 : 0) + (p.skill === "skill_logging" ? .2 : 0) + (season(s.day) === 2 ? .15 : 0) + (po.wood || 0)));
        if (p.job === "CARE" && s.people.some(c => c.id === p.careChild && !c.adult)) food += (p.skill === "skill_nurturing" ? 2 : 0) + (po.care || 0) + (p.elite ? ELITE.careFoodBonus : 0);
    }
    rations = Math.ceil(rations * (1 + (season(s.day) === 3 ? .2 : 0) + (po.ration || 0)));
    // elderRations 是已包含在总口粮中的基础值，仅供 UI 解释；不可再次扣除或单独向上取整。
    return { food, wood, rations, elderRations, hungry: s.food + food < rations, endFood: Math.min(RULE.storageCap, Math.max(0, s.food + food - rations)), endWood: Math.min(RULE.storageCap, s.wood + wood) };
}
export type Command =
    { type: "JOB"; id: string; job: Job; child?: string; replace?: string } |
    { type: "FAMILY"; a: string; b: string } | { type: "BIRTH"; family: string; carer: string } |
    { type: "BUILD"; kind: "HOUSE" | "FARM" | "LOGGING" } | { type: "REPAIR" } |
    { type: "TOWER"; index: number; kind: TowerKind } | { type: "UPGRADE"; index: number } |
    { type: "OPERATOR"; index: number; id: string | null } | { type: "NIGHT" } |
    { type: "CHOOSE"; value: string } | { type: "FINALIZE" } | { type: "FAVORITE"; id: string } | { type: "SPEED"; value: 1 | 2 };
export function assignOperator(s: GameState, index: number, id: string | null) {
    const t = s.towers[index]; requireRule(t && t.kind !== null, "此处尚未建塔");
    if (id) requireRule(isWorkingAdult(person(s, id)), "只有仍在劳作期的成年人可以驻塔");
    for (const tower of s.towers) if (id && tower.operator === id) tower.operator = null;
    t.operator = id;
}
export function applyCommand(s: GameState, c: Command) {
    if (c.type === "SPEED") { requireRule(c.value === 1 || c.value === 2, "无效倍速"); s.settings.speed = c.value; return; }
    if (c.type === "FAVORITE") {
        requireRule(s.history.some(p => p.id === c.id), "此人不在家谱中");
        const i = s.favorites.indexOf(c.id);
        if (i >= 0) s.favorites.splice(i, 1); else { requireRule(s.favorites.length < RULE.favoriteCap, "最多珍藏 20 位先辈"); s.favorites.push(c.id); }
        pruneHistory(s); return;
    }
    if (c.type === "CHOOSE") { requireRule(s.phase === "DAWN" && s.choices.length > 0, "当前没有待办事项"); choose(s, c.value); autoAssignJobs(s); return; }
    if (c.type === "FINALIZE") { requireRule(s.phase === "DAWN" && !s.choices.length, "请先完成清晨事项"); s.wave = generateWave(s); s.phase = "DAY"; return; }
    requireRule(s.phase === "DAY", "请在白天安排村务");
    switch (c.type) {
        case "JOB": {
            const p = person(s, c.id); requireRule(isWorkingAdult(p), "孩子和荣休老人不能安排工作");
            let replaced: Person | null = null;
            if (c.job === "FARM" || c.job === "LOGGING") {
                const max = c.job === "FARM" ? RULE.farmSlots[s.farm - 1] : RULE.logSlots[s.logging - 1];
                const full = s.people.filter(q => q.id !== p.id && q.job === c.job).length >= max;
                if (c.replace) {
                    replaced = person(s, c.replace);
                    requireRule(full && p.job !== c.job && replaced.id !== p.id && isWorkingAdult(replaced) && replaced.job === c.job, "请选择该岗位当前的另一位村民");
                } else requireRule(!full, "岗位已满，请选择替换对象或升级建筑");
            } else {
                requireRule(!c.replace, "此岗位不支持替换工人");
            }
            if (c.job === "CARE") {
                requireRule(c.child && !person(s, c.child).adult, "请选择孩子");
                requireRule(!s.people.some(q => q.id !== p.id && q.careChild === c.child), "这个孩子已有照料人");
            }
            if (replaced) { replaced.job = "WAITING"; replaced.careChild = null; }
            p.job = c.job; p.careChild = c.job === "CARE" ? c.child! : null; break;
        }
        case "FAMILY": {
            requireRule(canMarry(s, person(s, c.a), person(s, c.b)), "双方须在劳作期、单身，且非直系亲属或同胞");
            requireRule(Number.isSafeInteger(s.nextFamily + 1), "家庭编号已达安全范围");
            s.families.push({ id: `${s.run}:f${s.nextFamily++}`, partners: [c.a, c.b], lastBirth: null }); break;
        }
        case "BIRTH": {
            const reason = birthUnavailableReason(s, c.family, c.carer); requireRule(reason === null, reason!);
            const f = s.families.find(f => f.id === c.family)!;
            const parents = f.partners.map(id => person(s, id)), carer = person(s, c.carer);
            spend(s, "food", RULE.birthCost);
            const rng = new SeededRandom(s.rng.family), sex = rng.range(2) === 0 ? "MALE" : "FEMALE";
            const trait = parents[0].trait === parents[1].trait ? parents[0].trait : parents[rng.range(2)].trait;
            const id = newId(s);
            const nameIndex = rng.range(VILLAGER_NAMES.child.length + 1);
            const name = nameIndex === VILLAGER_NAMES.child.length ? VILLAGER_NAMES.personal[sex] : `小${VILLAGER_NAMES.child[nameIndex]}${s.nextPerson - 1}`;
            const child: Person = { id, name, sex, origin: "BORN", elite: rng.range(ELITE.chanceScale) < ELITE.chancePercent, appearance: ADULT_APPEARANCE[sex], trait, skill: null, generation: Math.max(...parents.map(p => p.generation)) + 1, parents: f.partners.slice(), ancestors: Array.from(new Set([...f.partners, ...parents[0].ancestors, ...parents[1].ancestors])), adult: false, nights: 0, elderNights: 0, growth: 0, job: "WAITING", careChild: null };
            s.people.push(child); carer.job = "CARE"; carer.careChild = id; f.lastBirth = s.completed;
            s.stats.births++; s.legacy.births++; s.stats.generation = Math.max(s.stats.generation, child.generation); remember(s, trait); s.rng.family = rng.state; break;
        }
        case "BUILD":
            if (c.kind === "HOUSE") { requireRule(s.houses < RULE.houseMax, "民居已达上限"); spend(s, "wood", RULE.houseCost); s.houses++; }
            else { const field = c.kind === "FARM" ? "farm" : "logging"; requireRule(s[field] < 3, "建筑已满级"); spend(s, "wood", (field === "farm" ? RULE.farmUpgrade : RULE.logUpgrade)[s[field] - 1]); s[field]++; } break;
        case "REPAIR": requireRule(s.gate < RULE.gateMax, "城门完好"); spend(s, "wood", RULE.repairCost); s.gate = Math.min(RULE.gateMax, s.gate + RULE.repairAmount * (1 + (policy(s).repair || 0))); break;
        case "TOWER": { const t = s.towers[c.index]; requireRule(t && c.kind in TOWERS, "塔位无效"); requireRule(t.kind !== c.kind, "已是此类防塔"); spend(s, "wood", t.kind ? RULE.towerConvert : TOWERS[c.kind].cost); t.kind = c.kind; if (!t.level) t.level = 1; break; }
        case "UPGRADE": { const t = s.towers[c.index]; requireRule(t && t.kind && t.level < 3, "无法升级此塔"); spend(s, "wood", RULE.towerUpgrade[t.level - 1]); t.level++; break; }
        case "OPERATOR": assignOperator(s, c.index, c.id); break;
        case "NIGHT": {
            requireRule(s.wave !== null, "波次未准备好"); const e = economy(s);
            s.night = { adults: s.people.filter(isWorkingAdult).map(p => p.id), elders: s.people.filter(isElder).map(p => p.id), cared: s.people.filter(p => isWorkingAdult(p) && p.job === "CARE").map(p => p.careChild!), hungry: e.hungry };
            s.food = e.endFood; s.wood = e.endWood; s.phase = "NIGHT"; break;
        }
    }
    if (c.type === "JOB" || c.type === "BIRTH" || c.type === "BUILD") autoAssignJobs(s);
}
function pruneHistory(s: GameState) {
    const normal = s.history.filter(p => !s.favorites.includes(p.id)).slice(-RULE.historyCap);
    s.history = s.history.filter(p => s.favorites.includes(p.id) || normal.includes(p));
}
export function finishNight(s: GameState, gate: number, operators: (string | null)[]) {
    requireRule(s.phase === "NIGHT" && s.night, "守夜已经结算");
    s.gate = gate; s.towers.forEach((t, i) => t.operator = operators[i]);
    if (gate <= 0) {
        s.phase = "GAME_OVER"; s.wave = null; s.night = null;
        s.summary = `守住 ${s.completed} 夜，传承至第 ${s.stats.generation} 代，迎来 ${s.stats.births} 个孩子，${s.stats.retirees} 位村民荣休。`; return;
    }
    const rng = new SeededRandom(s.rng.family), world = new SeededRandom(s.rng.world), completedDay = s.day;
    // 只递减入夜时已经在养老的人，新荣休者从下一夜开始计时，失败夜已在上方返回。
    for (const id of s.night.elders) person(s, id).elderNights--;
    const departed = s.night.elders.map(id => person(s, id)).filter(p => p.elderNights === 0), departedIds = departed.map(p => p.id);
    for (const id of s.night.adults) person(s, id).nights--;
    const grown: Person[] = [];
    for (const id of s.night.cared) { const p = person(s, id); if (!p.adult && ++p.growth >= RULE.growNights) { p.adult = true; p.nights = p.elite ? ELITE.adultNights : RULE.adultNights; p.job = "WAITING"; grown.push(p); } }
    for (const p of s.people) if (grown.some(c => c.id === p.careChild)) { p.job = "WAITING"; p.careChild = null; }
    const retired = s.night.adults.map(id => person(s, id)).filter(p => p.nights === 0), retiredIds = retired.map(p => p.id);
    const uncared = retired.filter(p => p.careChild && !person(s, p.careChild).adult).length;
    for (const p of retired) { p.elderNights = p.elite ? ELITE.elderNights : RULE.elderNights; p.job = "WAITING"; p.careChild = null; }
    s.towers.forEach(t => { if (t.operator && retiredIds.includes(t.operator)) t.operator = null; });
    // 老人在村时保留婚姻和亲缘；寿终才腾出人口、解除婚姻并进入有界家谱。
    for (const p of departed) { p.ancestors = []; s.history.push(p); }
    s.people = s.people.filter(p => !departedIds.includes(p.id));
    for (const p of s.people) p.ancestors = p.ancestors.filter(id => !departedIds.includes(id));
    s.families = s.families.filter(f => !f.partners.some(id => departedIds.includes(id)));
    autoAssignJobs(s);
    s.stats.retirees += retired.length; s.legacy.retirees += retired.length; pruneHistory(s);
    s.completed++; s.day++; s.lastDawn = completedDay; s.phase = "DAWN"; s.wave = null; s.night = null;
    s.legacy.bestNight = Math.max(s.legacy.bestNight, s.completed); s.legacy.bestTier = Math.max(s.legacy.bestTier, s.tier);
    s.choices = grown.sort((a, b) => Number(a.id.split(":")[1]) - Number(b.id.split(":")[1])).map(p => ({ kind: "SKILL" as const, person: p.id, options: rng.choices(Object.keys(SKILLS) as Skill[], 3) }));
    if (s.day >= 5 && (s.day - 5) % 4 === 0) {
        const sex = world.range(2) === 0 ? "MALE" : "FEMALE";
        const name = [...VILLAGER_NAMES.traveler, VILLAGER_NAMES.personal[sex]][world.range(VILLAGER_NAMES.traveler.length + 1)];
        const elite = world.range(ELITE.chanceScale) < ELITE.chancePercent;
        const traveler: Person = { id: newId(s), name, sex, origin: "TRAVELER", elite, appearance: ADULT_APPEARANCE[sex], trait: (Object.keys(TRAITS) as Trait[])[world.range(8)], skill: (Object.keys(SKILLS) as Skill[])[world.range(6)], generation: 1, parents: [], ancestors: [], adult: true, nights: elite ? ELITE.adultNights : RULE.adultNights, elderNights: 0, growth: 0, job: "WAITING", careChild: null };
        s.choices.push({ kind: "TRAVELER", person: traveler });
    }
    s.rng.family = rng.state;
    if ((s.day - 1) % RULE.seasonDays === 0) { s.policy = null; s.choices.push({ kind: "POLICY", options: world.choices(Object.keys(POLICIES), 3) }); }
    s.rng.world = world.state;
    if ((s.day - 1) % RULE.yearDays === 0) s.choices.push({ kind: "TIER" });
    s.summary = `守夜成功！${grown.length ? `${grown.length} 个孩子成年。` : ""}${retired.length ? `${retired.length} 位村民荣休，留村养老。` : ""}${departed.length ? `${departed.length} 位长辈安然辞世，已记入家谱。` : ""}${uncared ? `${uncared} 个孩子的照料者荣休，请重新安排。` : ""}`;
}
function choose(s: GameState, value: string) {
    const q = s.choices[0];
    switch (q.kind) {
        case "SKILL": requireRule(q.options.includes(value as Skill), "请选择列出的专长"); person(s, q.person).skill = value as Skill; break;
        case "TRAVELER": requireRule(value === "accept" || value === "decline", "旅人选项无效"); if (value === "accept") { requireRule(s.people.length < capacity(s), "民居已满，可以谢绝旅人"); s.people.push(q.person); remember(s, q.person.trait); } break;
        case "POLICY": requireRule(q.options.includes(value), "村规选项无效"); s.policy = value; break;
        case "TIER": requireRule(["0", "1", "2", "3"].includes(value), "挑战档无效"); s.tier = Number(value); break;
    }
    s.choices.shift();
}
