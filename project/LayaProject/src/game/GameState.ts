import { EnemyKind, TowerKind, Trait } from "./GameConfig";
import type { PatrolMode } from "../config/PatrolConfig";
import type { TowerFlag, WaveRhythm } from "../config/DefenseConfig";
import type { ExtendedHeroSortie, HERO, SONGLEI } from "../config/HeroConfig";
import type { DELIVERY_HERO, DELIVERY_PATROL_HUNT } from "../config/DeliveryHeroConfig";
import type { VillagerQuality } from "../config/VillagerQuality";
import type { DailyTaskDay } from "./DailyTaskState";
import type { Expedition } from "./Expedition";
export type Job = "WAITING" | "SEWING";
export type HeroChoice = typeof HERO.actorId | typeof DELIVERY_HERO.actorId | typeof SONGLEI.actorId;
export interface Person {
    id: string; name: string; sex: "MALE" | "FEMALE"; origin: "FOUNDER" | "TRAVELER" | "BORN";
    appearance: string; traits: Trait[]; generation: number;
    /** 出生或来访时抽定，成年、荣休和家谱沿用同一品质。 */
    quality: VillagerQuality;
    parents: string[]; ancestors: string[]; adult: boolean; nights: number; growth: number;
    /** 荣休后剩余成功守夜夜数；儿童、劳动成人及已入家谱者为 0，不使用现实时间。 */
    elderNights: number;
    /** 曾为该村民使用的续寿道具数，随本人和家谱保存。旧档缺席表示从未使用。 */
    retirementDelayUses?: number;
    job: Job;
}
export interface Family { id: string; partners: string[]; lastBirth: number | null; }
/** kind 保存该塔所装弹种；null 表示塔位尚未建设。 */
export interface Tower { kind: TowerKind | null; level: number; operator: string | null; flag?: TowerFlag; }
export interface Wave {
    budget: number; tier: number; affix: "NONE" | "FAST" | "STURDY" | "GROUP";
    entries: { kind: EnemyKind; tick: number; appearanceSeed: number }[];
    /** 固化普通怪生命倍率，守夜和任务预演使用同一份波次数据。 */
    ordinaryHealthPercent: number;
    /** 可选规则标记。已经保存的旧波次继续使用原规则。 */
    rhythm?: WaveRhythm;
}
export type Choice = { kind: "TRAVELER"; person: Person };
export interface Legacy {
    births: number; retirees: number; bestNight: number; traits: Trait[]; nextRun: number;
    /** 每日村礼最后成功入档的本地日历日期 YYYY-MM-DD；null 表示未领过，每次新开村清空。 */
    lastRationDate: string | null;
}
/** 开战时冻结的胜利奖励。旧版已经预发收益的夜战没有这个字段。 */
export interface NightReward { base: number; sewing: number; boss: number; total: number; }
export interface GameState {
    run: number; nextPerson: number; nextFamily: number; day: number; completed: number;
    phase: "DAY" | "NIGHT" | "DAWN" | "GAME_OVER"; coins: number; gate: number;
    houses: number; gateLevel: number; tier: number;
    /** 批次、入账与部分进度随钱包共同入档；成功守夜才刷新。 */
    factory: { level: number; batches: number; earned: number; elapsedMs: number };
    /** 上次提供旅人时的成功守夜数；谢绝也记时，新村null，不迁移旧配置。 */
    lastTraveler: number | null;
    people: Person[]; families: Family[]; towers: Tower[];
    /** 冰弹一次买断，与扣款同笔写入村庄；开局赠送的两种弹药无需存储。 */
    iceAmmoUnlocked?: true;
    /** 外卖大王的招募和尔币扣款随本村一起提交。 */
    deliveryUnlocked?: true;
    /** 招募与尔币扣款同笔保存，缺席表示尚未招募。 */
    songLeiUnlocked?: true;
    /** 白天选择下次派谁。旧村缺此字段时沿用开局英雄智卓。 */
    selectedHero?: HeroChoice;
    /** 每村独立保存弹种等级。同弹种的所有塔共享升级结果。 */
    ammoLevels: Record<TowerKind, number>;
    /** 开局即有此建筑，夜战只读战前快照。 */
    patrol: { level: number; captain: string | null; mode?: PatrolMode; rationReady?: true; radiusReady?: true };
    /** 已投出的点数，等下一场开战转入战前快照。 */
    rewardDie?: number;
    /** 战技学习结果与当前携带；资格由本村成功波数推导，查看提醒使用独立的界面记录。 */
    // 旧档携带项仍是第一槽。额外数组的长度记录已购槽数，null 表示空槽。
    tactics: {
        learned: string[]; equipped: string; extraSlots?: (string | null)[];
        /** 怜悯首次施放前无记录。累计次数和剩余波数随已学战技保存，与当前装配无关。 */
        mercyCooldown?: { casts: number; wavesLeft: number };
    };
    history: Person[]; favorites: string[]; choices: Choice[];
    wave: Wave | null; night: {
        adults: string[]; elders: string[]; hungry?: true; reward?: NightReward; tactic: string; extraSlots?: (string | null)[];
        /** 每个新夜只有一名出战英雄，读档重打仍使用开战时的人选。 */
        activeHero?: HeroChoice;
        /** true 是路肩停车，ROUTE_HUNT 是沿路索敌。已开始的夜战保留其战前规则。 */
        deliveryPatrol?: true | typeof DELIVERY_PATROL_HUNT;
        /** 单英雄规则以前的战前快照。 */
        heroSortie?: true;
        deliveryHero?: true;
        /** 新夜使用延长出战与更慢的行走。旧夜读取原参数，保留本夜战前重放结果。 */
        extendedHeroSortie?: ExtendedHeroSortie;
        /** 新夜的怪物生命曲线与英雄移速。升级前正在打的夜战缺此标记，仍按原规则重放。 */
        reinforcedEnemies?: true;
        /** 新开的夜战使用五段散阵。缺标记的历史夜战按三段分布重演。 */
        spreadEnemyFormation?: true;
        /** 只回退本夜产生的库存、门血、任务与献纳变化。历史夜战可以没有这个记录。 */
        returnPoint?: NightReturnPoint;
        /** 与献纳和门血同笔保存，夜间冷启动恢复已用次数并排除施放当夜。 */
        mercySpent?: true;
        /** 历史字段名。标记现代交会判定与出征间隔；无标记的旧夜战沿用原接触规则。 */
        patrolSquad?: true;
        patrolSpin?: true;
        /** 本夜实际出战的打法。历史夜战无此字段，按原有出征标记重演。 */
        patrolMode?: PatrolMode;
        patrolRation?: true;
        patrolWideImpact?: true;
        /** 本夜基础奖励的骰子点数。退出守夜时转回白天。 */
        rewardDie?: number;
    } | null;
    rng: { family: number; world: number };
    stats: { births: number; retirees: number; generation: number }; legacy: Legacy;
    /** Optional in existing saves. Stored with inventory so claiming is a single save transaction. */
    dailyTasks?: DailyTaskDay;
    /** 探索者、战报与待领资源随村庄事务共同提交。旧档空缺表示无探索。 */
    expedition?: Expedition;
    /** speed 保留原存档字段以兼容旧档；读入会话和新开村均使用固定常速。 */
    settings: { speed: 2 | 3; music: boolean }; summary: string;
}
type NightReturnPoint = Pick<GameState, "coins" | "gate" | "dailyTasks"> &
    Pick<GameState["tactics"], "mercyCooldown">;

export function nightReturnPoint(s: GameState): NightReturnPoint {
    const { coins, gate, dailyTasks, tactics: { mercyCooldown } } = s;
    return { coins, gate, ...(dailyTasks ? { dailyTasks: clone(dailyTasks) } : {}),
        ...(mercyCooldown ? { mercyCooldown: { ...mercyCooldown } } : {}) };
}
/** 本村免费获赠两种弹药，冰弹由买断标记解锁。 */
export function ownsTowerAmmo(s: GameState, kind: TowerKind): boolean {
    return kind === "ARROW" || kind === "STONE" || kind === "SLOW" && s.iceAmmoUnlocked === true;
}
export function clone<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }
/** 工作、驻塔与成家共用资格；已成年并不代表仍在劳作期。 */
export function isWorkingAdult(p: Person): boolean { return p.adult && p.nights > 0; }
/** 离村不改变人口、亲缘或年龄，只影响当前可参与的村务。 */
export function isExploring(s: GameState, id: string): boolean {
    return s.expedition?.personId === id && !s.expedition.remaining;
}
export function isAvailableAdult(s: GameState, p: Person): boolean {
    return isWorkingAdult(p) && !isExploring(s, p.id);
}
/** 在村老人的阶段判断；家谱成员的晚年计时归零，显示由家谱上下文决定。 */
export function isElder(p: Person): boolean { return p.adult && p.nights === 0 && p.elderNights > 0; }
