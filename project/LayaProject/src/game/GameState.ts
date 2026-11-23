import { EnemyKind, Skill, TowerKind, Trait } from "./GameConfig";
import type { WaveRhythm } from "../config/DefenseConfig";
import type { VillagerQuality } from "../config/VillagerQuality";
import type { DailyTaskDay } from "./DailyTaskState";
export type Job = "WAITING" | "FARM" | "LOGGING" | "CARE";
export interface Person {
    id: string; name: string; sex: "MALE" | "FEMALE"; origin: "FOUNDER" | "TRAVELER" | "BORN";
    appearance: string; trait: Trait; skill: Skill | null; generation: number;
    /** 出生或来访时抽定，成年、荣休和家谱沿用同一品质。 */
    quality: VillagerQuality;
    parents: string[]; ancestors: string[]; adult: boolean; nights: number; growth: number;
    /** 荣休后剩余成功守夜夜数；儿童、劳动成人及已入家谱者为 0，不使用现实时间。 */
    elderNights: number;
    /** 曾为该村民使用的续寿道具数，随本人和家谱保存。旧档缺席表示从未使用。 */
    retirementDelayUses?: number;
    job: Job; careChild: string | null;
}
export interface Family { id: string; partners: string[]; lastBirth: number | null; }
export interface Tower { kind: TowerKind | null; level: number; operator: string | null; }
export interface Wave {
    budget: number; tier: number; affix: "NONE" | "FAST" | "STURDY" | "GROUP";
    entries: { kind: EnemyKind; tick: number; appearanceSeed: number }[];
    /** 固化普通怪生命倍率，守夜和任务预演使用同一份波次数据。 */
    ordinaryHealthPercent: number;
    /** 可选规则标记。已经保存的旧波次继续使用原规则。 */
    rhythm?: WaveRhythm;
}
export type Choice = { kind: "SKILL"; person: string; options: Skill[] } | { kind: "TRAVELER"; person: Person } | { kind: "POLICY"; options: string[] };
export interface Legacy {
    births: number; retirees: number; bestNight: number; traits: Trait[]; nextRun: number;
    /** 每日口粮最后成功入档的本地日历日期 YYYY-MM-DD；null 表示未领过，每次新开村清空。 */
    lastRationDate: string | null;
}
export interface GameState {
    run: number; nextPerson: number; nextFamily: number; day: number; completed: number;
    phase: "DAY" | "NIGHT" | "DAWN" | "GAME_OVER"; food: number; wood: number; gate: number;
    /** 住宅扩建等级1–100，影响人口；housing是独立修缮等级，影响仓储与住宅主体外观。 */
    houses: number; housing: number; gateLevel: number; farm: number; logging: number; tier: number; policy: string | null;
    /** 上次提供旅人时的成功守夜数；谢绝也记时，新村null，不迁移旧配置。 */
    lastTraveler: number | null;
    people: Person[]; families: Family[]; towers: Tower[];
    /** 开局即有此建筑，夜战只读战前快照。 */
    patrol: { level: number; captain: string | null };
    /** 战技学习结果与当前携带；资格由本村成功波数推导，查看提醒使用独立的界面记录。 */
    // 旧档携带项仍是第一槽。额外数组的长度记录已购槽数，null 表示空槽。
    tactics: {
        learned: string[]; equipped: string; extraSlots?: (string | null)[];
        /** 怜悯首次施放前无记录。累计次数和剩余波数随已学战技保存，与当前装配无关。 */
        mercyCooldown?: { casts: number; wavesLeft: number };
    };
    history: Person[]; favorites: string[]; choices: Choice[];
    wave: Wave | null; night: {
        adults: string[]; elders: string[]; cared: string[]; hungry: boolean; tactic: string; extraSlots?: (string | null)[];
        /** 与献纳和门血同笔保存，夜间冷启动恢复已用次数并排除施放当夜。 */
        mercySpent?: true;
        /** 历史字段名。标记现代交会判定与出征间隔；无标记的旧夜战沿用原接触规则。 */
        patrolSquad?: true;
        patrolSpin?: true;
    } | null;
    rng: { family: number; world: number };
    stats: { births: number; retirees: number; generation: number }; legacy: Legacy;
    /** Optional in existing saves. Stored with inventory so claiming is a single save transaction. */
    dailyTasks?: DailyTaskDay;
    settings: { speed: 2 | 3; music: boolean }; summary: string;
}
export function clone<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }
/** 工作、驻塔、照料与成家共用资格；已成年并不代表仍在劳作期。 */
export function isWorkingAdult(p: Person): boolean { return p.adult && p.nights > 0; }
/** 在村老人的阶段判断；家谱成员的晚年计时归零，显示由家谱上下文决定。 */
export function isElder(p: Person): boolean { return p.adult && p.nights === 0 && p.elderNights > 0; }
