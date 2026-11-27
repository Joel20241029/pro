import { QUALITY_CHANCE_SCALE, rollVillagerQuality, VILLAGER_QUALITY } from "../config/VillagerQuality";
import { ADULT_APPEARANCE, RULE, TRAIT_POOL, VILLAGER_NAMES } from "./GameConfig";
import { GameState, Person } from "./GameState";
import { SeededRandom } from "./SeededRandom";
import { nextSex, travelerDue } from "./Population";
import { person, capacity } from "./VillageQueries";
import { autoAssignJobs, autoAssignNightDuties } from "./VillageJobs";
import { requireRule, newId, pruneHistory } from "./VillageStateOps";
import { advanceExpedition } from "./Expedition";
/** 客满的定期来访已按原规则抽人并记入间隔，只把无法接纳的待办换成清晨消息。 */
export function summarizeFullHouseVisit(s: GameState) {
    if (s.choices[0]?.kind !== "TRAVELER" || s.people.length < capacity(s)) return;
    s.choices = s.choices.slice(1);
    s.summary += "有旅人经过，村中客满。";
}

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
    const mercy = s.tactics.mercyCooldown;
    if (mercy && mercy.wavesLeft > 0 && !s.night.mercySpent) mercy.wavesLeft--;
    const world = new SeededRandom(s.rng.world);
    // 只递减入夜时已经在养老的人，新荣休者从下一夜开始计时，失败夜已在上方返回。
    for (const id of s.night.elders)
        person(s, id).elderNights--;
    const departed = s.night.elders.map(id => person(s, id)).filter(p => p.elderNights === 0), departedIds = departed.map(p => p.id);
    for (const id of s.night.adults)
        person(s, id).nights--;
    const grown: Person[] = [];
    for (const p of s.people) {
        if (!p.adult && ++p.growth >= RULE.growNights) {
            p.adult = true;
            p.nights = VILLAGER_QUALITY[p.quality].adultNights;
            p.job = "WAITING";
            grown.push(p);
        }
    }
    const retired = s.night.adults.map(id => person(s, id)).filter(p => p.nights === 0), retiredIds = retired.map(p => p.id);
    for (const p of retired) {
        p.elderNights = VILLAGER_QUALITY[p.quality].elderNights;
        p.job = "WAITING";
    }
    s.towers.forEach(t => {
        if (t.operator && retiredIds.includes(t.operator))
            t.operator = null;
    });
    if (s.patrol.captain && retiredIds.includes(s.patrol.captain)) s.patrol.captain = null;
    // 老人在村时保留婚姻和亲缘；寿终才腾出人口、解除婚姻并进入有界家谱。
    for (const p of departed) {
        p.ancestors = [];
        s.history.push(p);
    }
    s.people = s.people.filter(p => !departedIds.includes(p.id));
    for (const p of s.people)
        p.ancestors = p.ancestors.filter(id => !departedIds.includes(id));
    s.families = s.families.filter(f => !f.partners.some(id => departedIds.includes(id)));
    // 回村发生在本夜年龄结算之后、自动补位之前，返村这一夜仍不扣探索者寿命。
    advanceExpedition(s);
    autoAssignJobs(s);
    autoAssignNightDuties(s);
    s.stats.retirees += retired.length;
    s.legacy.retirees += retired.length;
    pruneHistory(s);
    s.completed++;
    s.day++;
    s.phase = "DAWN";
    s.wave = null;
    s.night = null;
    s.legacy.bestNight = Math.max(s.legacy.bestNight, s.completed);
    s.choices = [];
    if (travelerDue(s, capacity(s))) {
        s.lastTraveler = s.completed;
        const sex = nextSex(s.people, world, true);
        // 与出生共用品质抽取和姓名池，姓名分支不推进世界随机流。
        const nameState = world.state, nameIndex = world.range(VILLAGER_NAMES.traveler.length);
        const quality = rollVillagerQuality(world.range(QUALITY_CHANCE_SCALE), s.completed, "traveler");
        const name = quality !== "COMMON" ? VILLAGER_NAMES.special[new SeededRandom(nameState).range(VILLAGER_NAMES.special.length)]
            : VILLAGER_NAMES.traveler[nameIndex];
        const traveler: Person = { id: newId(s), name, sex, origin: "TRAVELER", quality, appearance: ADULT_APPEARANCE[sex], traits: world.choices(TRAIT_POOL, VILLAGER_QUALITY[quality].traitCount), generation: 1, parents: [], ancestors: [], adult: true, nights: VILLAGER_QUALITY[quality].adultNights, elderNights: 0, growth: 0, job: "WAITING" };
        s.choices.push({ kind: "TRAVELER", person: traveler });
    }
    s.rng.world = world.state;
    s.summary = `守夜成功！${grown.length ? `${grown.length} 个孩子成年。` : ""}${retired.length ? `${retired.length} 位村民荣休，留村养老。` : ""}${departed.length ? `${departed.length} 位长辈安然辞世，已记入家谱。` : ""}`;
    summarizeFullHouseVisit(s);
}
