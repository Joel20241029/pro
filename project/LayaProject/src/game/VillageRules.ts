import { QUALITY_CHANCE_SCALE, rollVillagerQuality } from "../config/VillagerQuality";
import { ADULT_APPEARANCE, GROWTH, RULE, Skill, TOWERS, TowerKind, VILLAGER_NAMES } from "./GameConfig";
import { PATROL_MODE, PatrolMode } from "../config/PatrolConfig";
import { GameState, isElder, isWorkingAdult, Job, Person } from "./GameState";
import { SeededRandom } from "./SeededRandom";
import { generateWave } from "./WaveGenerator";
import { gateCapacity, laborSlots, repairCost, residentialCost, upgradeCost, upgradeUnavailableReason } from "./Growth";
import { nextSex } from "./Population";
import { dailyRationAmount } from "./DailyRation";
import { person, capacity, canMarry, birthUnavailableReason, economy, policy } from "./VillageQueries";
import { autoAssignJobs, autoAssignNightDuties, autoAssignOperators, assignOperator } from "./VillageJobs";
import { requireRule, spend, newId, remember, pruneHistory } from "./VillageStateOps";
import { patrolUpgradeReason, patrolCost } from "./PatrolRules";
import { applyTactic, unlockTacticSlot } from "./Tactics";
/** 原村务 API 保持不变；内部模块只依赖具体实现，禁止反向引用此入口。 */
export { createGame } from "./VillageCreation";
export { finishNight } from "./VillageLifecycle";
export { person, policy, capacity, canMarry, birthUnavailableReason, economy } from "./VillageQueries";
export { JOB_NAMES, autoAssignJobs, autoAssignOperators, assignOperator } from "./VillageJobs";
export type Command = {
    type: "TACTIC_LEARN" | "TACTIC_EQUIP";
    id: string;
    slot?: number;
} | {
    type: "TACTIC_UNLOCK_SLOT" | "TACTIC_CLEAR_SLOT";
    slot: number;
} | {
    type: "DAILY_RATION";
    date: string;
} | {
    type: "JOB";
    id: string;
    job: Job;
    child?: string;
    replace?: string;
} | {
    type: "FAMILY";
    a: string;
    b: string;
} | {
    type: "BIRTH";
    family: string;
    carer: string;
} | {
    type: "BUILD";
    kind: "HOUSE" | "FARM" | "LOGGING" | "HOUSING" | "GATE";
} | {
    type: "PATROL_MODE";
    mode: PatrolMode;
} | {
    type: "PATROL_UPGRADE";
} | {
    type: "PATROL_CAPTAIN";
    id: string;
} | {
    type: "REPAIR";
} | {
    type: "TOWER";
    index: number;
    kind: TowerKind;
} | {
    type: "UPGRADE";
    index: number;
} | {
    type: "OPERATOR";
    index: number;
    id: string;
} | {
    type: "NIGHT";
} | {
    type: "CHOOSE";
    value: string;
} | {
    type: "FINALIZE";
} | {
    type: "FAVORITE";
    id: string;
} | {
    type: "MUSIC";
    enabled: boolean;
};
export function applyCommand(s: GameState, c: Command) {
    if (c.type === "DAILY_RATION") {
        const amount = dailyRationAmount(s, c.date);
        requireRule(amount !== null, "今天的口粮已领取，或当前需先完成村务");
        s.food += amount;
        s.legacy.lastRationDate = c.date;
        return;
    }
    if (c.type === "MUSIC") {
        requireRule(typeof c.enabled === "boolean", "无效音乐设置");
        s.settings.music = c.enabled;
        return;
    }
    if (c.type === "FAVORITE") {
        requireRule(s.history.some(p => p.id === c.id), "此人不在家谱中");
        const i = s.favorites.indexOf(c.id);
        if (i >= 0)
            s.favorites.splice(i, 1);
        else {
            requireRule(s.favorites.length < RULE.favoriteCap, "最多珍藏 20 位先辈");
            s.favorites.push(c.id);
        }
        pruneHistory(s);
        return;
    }
    if (c.type === "CHOOSE") {
        requireRule(s.phase === "DAWN" && s.choices.length > 0, "当前没有待办事项");
        choose(s, c.value);
        autoAssignJobs(s);
        autoAssignNightDuties(s);
        return;
    }
    if (c.type === "FINALIZE") {
        requireRule(s.phase === "DAWN" && !s.choices.length, "请先完成清晨事项");
        if (s.patrol.captain === null) autoAssignNightDuties(s);
        s.wave = generateWave(s);
        s.phase = "DAY";
        return;
    }
    requireRule(s.phase === "DAY", "请在白天安排村务");
    switch (c.type) {
        case "TACTIC_LEARN":
        case "TACTIC_EQUIP":
            applyTactic(s, c.id, c.type === "TACTIC_LEARN" ? "LEARN" : "EQUIP", c.slot);
            break;
        case "TACTIC_UNLOCK_SLOT":
            unlockTacticSlot(s, c.slot);
            break;
        case "TACTIC_CLEAR_SLOT":
            requireRule(Number.isInteger(c.slot) && c.slot > 0 && !!s.tactics.extraSlots?.[c.slot - 1], "该槽位没有战技");
            s.tactics.extraSlots![c.slot - 1] = null;
            break;
        case "JOB": {
            const p = person(s, c.id);
            requireRule(isWorkingAdult(p), "孩子和荣休老人不能安排工作");
            let replaced: Person | null = null;
            if (c.job === "FARM" || c.job === "LOGGING") {
                const max = laborSlots(c.job, c.job === "FARM" ? s.farm : s.logging);
                const full = s.people.filter(q => q.id !== p.id && q.job === c.job).length >= max;
                if (c.replace) {
                    replaced = person(s, c.replace);
                    requireRule(full && p.job !== c.job && replaced.id !== p.id && isWorkingAdult(replaced) && replaced.job === c.job, "请选择该岗位当前的另一位村民");
                }
                else
                    requireRule(!full, "岗位已满，请选择替换对象或升级建筑");
            }
            else {
                requireRule(!c.replace, "此岗位不支持替换工人");
            }
            if (c.job === "CARE") {
                requireRule(c.child && !person(s, c.child).adult, "请选择孩子");
                requireRule(!s.people.some(q => q.id !== p.id && q.careChild === c.child), "这个孩子已有照料人");
            }
            if (replaced) {
                replaced.job = "WAITING";
                replaced.careChild = null;
            }
            p.job = c.job;
            p.careChild = c.job === "CARE" ? c.child! : null;
            break;
        }
        case "FAMILY": {
            requireRule(canMarry(s, person(s, c.a), person(s, c.b)), "成家需成年未退休、单身的男女，且非直系亲属或兄弟姐妹");
            requireRule(Number.isSafeInteger(s.nextFamily + 1), "家庭编号已达安全范围");
            s.families.push({ id: `${s.run}:f${s.nextFamily++}`, partners: [c.a, c.b], lastBirth: null });
            break;
        }
        case "BIRTH": {
            const reason = birthUnavailableReason(s, c.family, c.carer);
            requireRule(reason === null, reason!);
            const f = s.families.find(f => f.id === c.family)!;
            const parents = f.partners.map(id => person(s, id)), carer = person(s, c.carer);
            spend(s, "food", RULE.birthCost);
            const rng = new SeededRandom(s.rng.family), sex = nextSex(s.people, rng);
            const trait = parents[0].trait === parents[1].trait ? parents[0].trait : parents[rng.range(2)].trait;
            const id = newId(s);
            // 姓名分支使用原快照，主随机流仍按原顺序消费姓名和品质。
            const nameState = rng.state, nameIndex = rng.range(VILLAGER_NAMES.child.length);
            const quality = rollVillagerQuality(rng.range(QUALITY_CHANCE_SCALE), s.completed, "birth");
            const name = quality !== "COMMON" ? VILLAGER_NAMES.special[new SeededRandom(nameState).range(VILLAGER_NAMES.special.length)]
                : `小${VILLAGER_NAMES.child[nameIndex]}${s.nextPerson - 1}`;
            const child: Person = { id, name, sex, origin: "BORN", quality, appearance: ADULT_APPEARANCE[sex], trait, skill: null, generation: Math.max(...parents.map(p => p.generation)) + 1, parents: f.partners.slice(), ancestors: Array.from(new Set([...f.partners, ...parents[0].ancestors, ...parents[1].ancestors])), adult: false, nights: 0, elderNights: 0, growth: 0, job: "WAITING", careChild: null };
            s.people.push(child);
            carer.job = "CARE";
            carer.careChild = id;
            f.lastBirth = s.completed;
            s.stats.births++;
            s.legacy.births++;
            s.stats.generation = Math.max(s.stats.generation, child.generation);
            remember(s, trait);
            s.rng.family = rng.state;
            break;
        }
        case "BUILD": {
            if (c.kind === "HOUSE") {
                requireRule(s.houses < RULE.houseMax, "民居已达上限");
                const cost = residentialCost(s.houses), reason = upgradeUnavailableReason(s, cost);
                requireRule(!reason, reason!);
                spend(s, "wood", cost.wood);
                spend(s, "food", cost.food);
                s.houses++;
            }
            else {
                const field = c.kind === "FARM" ? "farm" : c.kind === "LOGGING" ? "logging" : c.kind === "HOUSING" ? "housing" : "gateLevel";
                const cost = upgradeCost(c.kind, s[field]), reason = upgradeUnavailableReason(s, cost);
                requireRule(!reason, reason!);
                const oldMax = gateCapacity(s);
                spend(s, "wood", cost.wood);
                spend(s, "food", cost.food);
                s[field]++;
                if (c.kind === "GATE")
                    s.gate += gateCapacity(s) - oldMax;
            }
            break;
        }
        case "PATROL_MODE":
            requireRule(c.mode === PATROL_MODE.spin || c.mode === PATROL_MODE.rapid, "未知的淡紫儿打法");
            s.patrol.mode = c.mode;
            break;
        case "PATROL_UPGRADE": {
            const reason = patrolUpgradeReason(s);
            requireRule(reason === null, reason!);
            const { wood, food } = patrolCost(s);
            spend(s, "wood", wood);
            spend(s, "food", food);
            s.patrol.level++;
            break;
        }
        case "PATROL_CAPTAIN": {
            requireRule(isWorkingAdult(person(s, c.id)), "请选择成年且未荣休的村民");
            const tower = s.towers.find(t => t.operator === c.id);
            if (tower) tower.operator = null;
            s.patrol.captain = c.id;
            autoAssignOperators(s);
            break;
        }
        case "REPAIR":
            requireRule(s.gate < gateCapacity(s), "城门完好");
            spend(s, "wood", repairCost(s));
            s.gate = Math.min(gateCapacity(s), s.gate + Math.ceil(gateCapacity(s) * GROWTH.repairFraction * (1 + (policy(s).repair || 0))));
            break;
        case "TOWER": {
            const t = s.towers[c.index];
            requireRule(t && c.kind in TOWERS, "塔位无效");
            requireRule(t.kind !== c.kind, "已是此类防塔");
            spend(s, "wood", t.kind ? RULE.towerConvert : TOWERS[c.kind].cost);
            t.kind = c.kind;
            if (!t.level)
                t.level = 1;
            break;
        }
        case "UPGRADE": {
            const t = s.towers[c.index];
            requireRule(t && t.kind, "此处尚未建塔");
            const cost = upgradeCost("TOWER", t.level), reason = upgradeUnavailableReason(s, cost);
            requireRule(!reason, reason!);
            spend(s, "wood", cost.wood);
            spend(s, "food", cost.food);
            t.level++;
            break;
        }
        case "OPERATOR":
            assignOperator(s, c.index, c.id);
            break;
        case "NIGHT": {
            requireRule(s.wave !== null, "波次未准备好");
            autoAssignNightDuties(s);
            const e = economy(s);
            s.night = { adults: s.people.filter(isWorkingAdult).map(p => p.id), elders: s.people.filter(isElder).map(p => p.id), cared: s.people.filter(p => isWorkingAdult(p) && p.job === "CARE").map(p => p.careChild!), hungry: e.hungry, tactic: s.tactics.equipped };
            if (s.tactics.extraSlots) s.night.extraSlots = s.tactics.extraSlots.slice();
            if (s.patrol.captain) {
                s.night.patrolSquad = true;
                s.night.patrolMode = s.patrol.mode ?? PATROL_MODE.spin;
                if (s.night.patrolMode === PATROL_MODE.spin) s.night.patrolSpin = true;
            }
            if (s.night.patrolSpin && s.patrol.rationReady) {
                s.night.patrolRation = true;
                delete s.patrol.rationReady;
            }
            if (s.night.patrolSpin && s.patrol.radiusReady) {
                s.night.patrolWideImpact = true;
                delete s.patrol.radiusReady;
            }
            s.food = e.endFood;
            s.wood = e.endWood;
            s.phase = "NIGHT";
            break;
        }
    }
    if (c.type === "JOB" || c.type === "BIRTH" || c.type === "BUILD")
        autoAssignJobs(s);
    if (c.type === "TOWER")
        autoAssignOperators(s);
}
function choose(s: GameState, value: string) {
    const q = s.choices[0];
    switch (q.kind) {
        case "SKILL":
            requireRule(q.options.includes(value as Skill), "请选择列出的专长");
            person(s, q.person).skill = value as Skill;
            break;
        case "TRAVELER":
            requireRule(value === "accept" || value === "decline", "旅人选项无效");
            if (value === "accept") {
                requireRule(s.people.length < capacity(s), "民居已满，可以谢绝旅人");
                s.people.push(q.person);
                remember(s, q.person.trait);
            }
            break;
        case "POLICY":
            requireRule(q.options.includes(value), "村规选项无效");
            s.policy = value;
            break;
    }
    s.choices.shift();
}
