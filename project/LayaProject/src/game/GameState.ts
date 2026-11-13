import { EnemyKind, Skill, TowerKind, Trait } from "./GameConfig";
export type Job = "WAITING" | "FARM" | "LOGGING" | "CARE";
export interface Person {
    id: string; name: string; sex: "MALE" | "FEMALE"; origin: "FOUNDER" | "TRAVELER" | "BORN";
    appearance: string; trait: Trait; skill: Skill | null; generation: number;
    /** 出生/旅人创建时确定的稀有身份；不随重进、成年或荣休重新抽取，家谱保留。 */
    elite: boolean;
    parents: string[]; ancestors: string[]; adult: boolean; nights: number; growth: number;
    /** 荣休后剩余成功守夜夜数；儿童、劳动成人及已入家谱者为 0，不使用现实时间。 */
    elderNights: number;
    job: Job; careChild: string | null;
}
export interface Family { id: string; partners: string[]; lastBirth: number | null; }
export interface Tower { kind: TowerKind | null; level: number; operator: string | null; }
export interface Wave { budget: number; tier: number; affix: "NONE" | "FAST" | "STURDY" | "GROUP"; entries: { kind: EnemyKind; tick: number; appearanceSeed: number }[]; }
export type Choice = { kind: "SKILL"; person: string; options: Skill[] } | { kind: "TRAVELER"; person: Person } | { kind: "POLICY"; options: string[] } | { kind: "TIER" };
export interface Legacy {
    births: number; retirees: number; bestNight: number; traits: Trait[]; nextRun: number;
    /** 每日口粮最后成功入档的本地日历日期 YYYY-MM-DD；null 表示未领过，每次新开村清空。 */
    lastRationDate: string | null;
}
export interface GameState {
    run: number; nextPerson: number; nextFamily: number; day: number; completed: number;
    phase: "DAY" | "NIGHT" | "DAWN" | "GAME_OVER"; food: number; wood: number; gate: number;
    houses: number; housing: number; gateLevel: number; farm: number; logging: number; tier: number; policy: string | null;
    /** 上次提供旅人时的成功守夜数；谢绝也记时，新村null，不迁移旧配置。 */
    lastTraveler: number | null;
    people: Person[]; families: Family[]; towers: Tower[];
    history: Person[]; favorites: string[]; choices: Choice[];
    wave: Wave | null; night: { adults: string[]; elders: string[]; cared: string[]; hungry: boolean } | null;
    rng: { family: number; world: number };
    stats: { births: number; retirees: number; generation: number }; legacy: Legacy;
    settings: { speed: 1 | 2 | 3; music: boolean }; summary: string;
}
export function clone<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }
/** 工作、驻塔、照料与成家共用资格；已成年并不代表仍在劳作期。 */
export function isWorkingAdult(p: Person): boolean { return p.adult && p.nights > 0; }
/** 在村老人的阶段判断；家谱成员的晚年计时归零，显示由家谱上下文决定。 */
export function isElder(p: Person): boolean { return p.adult && p.nights === 0 && p.elderNights > 0; }
