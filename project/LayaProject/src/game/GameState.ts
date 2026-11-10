import { EnemyKind, Skill, TowerKind, Trait } from "./GameConfig";
export type Job = "WAITING" | "FARM" | "LOGGING" | "CARE";
export interface Person {
    id: string; name: string; sex: "MALE" | "FEMALE"; origin: "FOUNDER" | "TRAVELER" | "BORN";
    appearance: string; trait: Trait; skill: Skill | null; generation: number;
    parents: string[]; ancestors: string[]; adult: boolean; nights: number; growth: number;
    job: Job; careChild: string | null;
}
export interface Family { id: string; partners: string[]; lastBirth: number | null; }
export interface Tower { kind: TowerKind | null; level: number; operator: string | null; }
export interface Wave { budget: number; tier: number; affix: "NONE" | "FAST" | "STURDY" | "GROUP"; entries: { kind: EnemyKind; tick: number }[]; }
export type Choice = { kind: "SKILL"; person: string; options: Skill[] } | { kind: "TRAVELER"; person: Person } | { kind: "POLICY"; options: string[] } | { kind: "TIER" };
export interface Legacy { births: number; retirees: number; bestNight: number; bestTier: number; traits: Trait[]; nextRun: number; }
export interface GameState {
    run: number; nextPerson: number; nextFamily: number; day: number; completed: number; lastDawn: number;
    phase: "DAY" | "NIGHT" | "DAWN" | "GAME_OVER"; food: number; wood: number; gate: number;
    houses: number; farm: number; logging: number; tier: number; policy: string | null;
    people: Person[]; families: Family[]; towers: Tower[];
    history: Person[]; favorites: string[]; choices: Choice[];
    wave: Wave | null; night: { adults: string[]; cared: string[]; hungry: boolean } | null;
    rng: { family: number; world: number; battle: number };
    stats: { births: number; retirees: number; generation: number }; legacy: Legacy;
    settings: { speed: 1 | 2 }; summary: string;
}
export function clone<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }
