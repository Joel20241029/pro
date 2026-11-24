import { FOUNDERS, PADS, RULE, Trait } from "./GameConfig";
import { clone, GameState, Legacy, Person, Tower } from "./GameState";
import { generateWave } from "./WaveGenerator";
import { autoAssignJobs, autoAssignNightDuties } from "./VillageJobs";
import { requireRule, newId, remember } from "./VillageStateOps";
import { PATROL } from "../config/PatrolConfig";
import { DEFAULT_TACTIC } from "../config/TacticConfig";
export function createGame(seed: number, old?: Legacy, inherited?: Trait, history: Person[] = [], favorites: string[] = []): GameState {
    // 口粮按当前村庄领取；即使传承其他记录，新村也从未领取开始。
    const legacy: Legacy = old ? { ...clone(old), lastRationDate: null } : { births: 0, retirees: 0, bestNight: 0, traits: [], nextRun: 1, lastRationDate: null };
    requireRule(Number.isSafeInteger(legacy.nextRun + 1), "村落编号已达安全范围");
    if (inherited)
        requireRule(legacy.traits.includes(inherited), "尚未发现此天赋");
    const s: GameState = {
        run: legacy.nextRun++, nextPerson: 1, nextFamily: 2, day: 1, completed: 0,
        phase: "DAY", food: RULE.initialResource, wood: RULE.initialResource, gate: RULE.gateMax,
        houses: 1, housing: 1, gateLevel: 1, farm: 1, logging: 1, tier: RULE.maxTier, policy: null, lastTraveler: null,
        people: [], families: [], towers: [], history: clone(history), favorites: favorites.slice(), choices: [], wave: null, night: null,
        patrol: { level: PATROL.startLevel, captain: null },
        tactics: { learned: [DEFAULT_TACTIC], equipped: DEFAULT_TACTIC },
        // 家庭与世界通过不同固定掩码分离；战斗不使用随机数，重进不重新取时间。
        rng: { family: (seed ^ 0xa341316c) >>> 0, world: (seed ^ 0xc8013ea4) >>> 0 },
        stats: { births: 0, retirees: 0, generation: 1 }, legacy, settings: { speed: RULE.battleSpeed, music: true }, summary: ""
    };
    s.people = FOUNDERS.map((f, i): Person => ({ id: newId(s), name: f.name, sex: f.sex, origin: "FOUNDER", quality: "COMMON", appearance: f.appearance, trait: i === 0 && inherited ? inherited : f.trait, skill: f.skill, generation: 1, parents: [], ancestors: [], adult: true, nights: f.nights, elderNights: 0, growth: 0, job: f.job, careChild: null }));
    s.families.push({ id: `${s.run}:f1`, partners: [s.people[0].id, s.people[1].id], lastBirth: null });
    s.towers = PADS.map((_, i): Tower => i === 0 ? { kind: "ARROW", level: 1, operator: s.people[3].id } : i === 1 ? { kind: "STONE", level: 1, operator: s.people[2].id } : { kind: null, level: 0, operator: null });
    s.people.forEach(p => remember(s, p.trait));
    autoAssignJobs(s);
    autoAssignNightDuties(s);
    s.wave = generateWave(s);
    return s;
}
