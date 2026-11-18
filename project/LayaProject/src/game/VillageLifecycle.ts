import { ADULT_APPEARANCE, ELITE, POLICIES, RULE, SKILLS, Skill, TRAITS, Trait, VILLAGER_NAMES } from "./GameConfig";
import { GameState, Person } from "./GameState";
import { SeededRandom } from "./SeededRandom";
import { nextSex, travelerDue } from "./Population";
import { person, capacity } from "./VillageQueries";
import { autoAssignJobs, autoAssignOperators } from "./VillageJobs";
import { requireRule, newId, pruneHistory } from "./VillageStateOps";
export function finishNight(s: GameState, gate: number, operators: (string | null)[]) {
    requireRule(s.phase === "NIGHT" && s.night, "守夜已经结算");
    s.gate = gate;
    s.towers.forEach((t, i) => t.operator = operators[i]);
    if (gate <= 0) {
        s.phase = "GAME_OVER";
        s.wave = null;
        s.night = null;
        s.summary = `守住 ${s.completed} 夜，传承至第 ${s.stats.generation} 代，迎来 ${s.stats.births} 个孩子，${s.stats.retirees} 位村民荣休。`;
        return;
    }
    const rng = new SeededRandom(s.rng.family), world = new SeededRandom(s.rng.world);
    // 只递减入夜时已经在养老的人，新荣休者从下一夜开始计时，失败夜已在上方返回。
    for (const id of s.night.elders)
        person(s, id).elderNights--;
    const departed = s.night.elders.map(id => person(s, id)).filter(p => p.elderNights === 0), departedIds = departed.map(p => p.id);
    for (const id of s.night.adults)
        person(s, id).nights--;
    const grown: Person[] = [];
    for (const id of s.night.cared) {
        const p = person(s, id);
        if (!p.adult && ++p.growth >= RULE.growNights) {
            p.adult = true;
            p.nights = p.elite ? ELITE.adultNights : RULE.adultNights;
            p.job = "WAITING";
            grown.push(p);
        }
    }
    for (const p of s.people)
        if (grown.some(c => c.id === p.careChild)) {
            p.job = "WAITING";
            p.careChild = null;
        }
    const retired = s.night.adults.map(id => person(s, id)).filter(p => p.nights === 0), retiredIds = retired.map(p => p.id);
    const uncared = retired.filter(p => p.careChild && !person(s, p.careChild).adult).length;
    for (const p of retired) {
        p.elderNights = p.elite ? ELITE.elderNights : RULE.elderNights;
        p.job = "WAITING";
        p.careChild = null;
    }
    s.towers.forEach(t => {
        if (t.operator && retiredIds.includes(t.operator))
            t.operator = null;
    });
    // 老人在村时保留婚姻和亲缘；寿终才腾出人口、解除婚姻并进入有界家谱。
    for (const p of departed) {
        p.ancestors = [];
        s.history.push(p);
    }
    s.people = s.people.filter(p => !departedIds.includes(p.id));
    for (const p of s.people)
        p.ancestors = p.ancestors.filter(id => !departedIds.includes(id));
    s.families = s.families.filter(f => !f.partners.some(id => departedIds.includes(id)));
    autoAssignJobs(s);
    autoAssignOperators(s);
    s.stats.retirees += retired.length;
    s.legacy.retirees += retired.length;
    pruneHistory(s);
    s.completed++;
    s.day++;
    s.phase = "DAWN";
    s.wave = null;
    s.night = null;
    s.legacy.bestNight = Math.max(s.legacy.bestNight, s.completed);
    s.choices = grown.sort((a, b) => Number(a.id.split(":")[1]) - Number(b.id.split(":")[1])).map(p => ({ kind: "SKILL" as const, person: p.id, options: rng.choices(Object.keys(SKILLS) as Skill[], 3) }));
    if (travelerDue(s, capacity(s))) {
        s.lastTraveler = s.completed;
        const sex = nextSex(s.people, world, true);
        // 与出生一致，保留世界随机流的原消费顺序，命名分支不改变精英、天赋和专长结果。
        const nameState = world.state, nameIndex = world.range(VILLAGER_NAMES.traveler.length);
        const elite = world.range(ELITE.chanceScale) < ELITE.travelerChancePercent;
        const name = elite ? VILLAGER_NAMES.elite[new SeededRandom(nameState).range(VILLAGER_NAMES.elite.length)]
            : VILLAGER_NAMES.traveler[nameIndex];
        const traveler: Person = { id: newId(s), name, sex, origin: "TRAVELER", elite, appearance: ADULT_APPEARANCE[sex], trait: (Object.keys(TRAITS) as Trait[])[world.range(8)], skill: (Object.keys(SKILLS) as Skill[])[world.range(6)], generation: 1, parents: [], ancestors: [], adult: true, nights: elite ? ELITE.adultNights : RULE.adultNights, elderNights: 0, growth: 0, job: "WAITING", careChild: null };
        s.choices.push({ kind: "TRAVELER", person: traveler });
    }
    s.rng.family = rng.state;
    if ((s.day - 1) % RULE.seasonDays === 0) {
        s.policy = null;
        s.choices.push({ kind: "POLICY", options: world.choices(Object.keys(POLICIES), 3) });
    }
    s.rng.world = world.state;
    s.summary = `守夜成功！${grown.length ? `${grown.length} 个孩子成年。` : ""}${retired.length ? `${retired.length} 位村民荣休，留村养老。` : ""}${departed.length ? `${departed.length} 位长辈安然辞世，已记入家谱。` : ""}${uncared ? `${uncared} 个孩子的照料者荣休，请重新安排。` : ""}`;
}
