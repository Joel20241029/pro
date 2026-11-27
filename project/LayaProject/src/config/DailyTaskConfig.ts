import { EXPEDITION } from "./ExpeditionConfig";

/** 三项依次奖励维修和两种巡防消耗品，每种每日最多一件。 */
export const DAILY_TASKS = { limit: 3, rewards: ["gate_kit", "patrol_ration", "liang_indulgence"], winsToUnlock: 6, clockCheckMs: 1000 } as const;
/** 左侧入口的首次胜利门槛。0 表示开村即开放，不触发守夜解锁演出。 */
export const FEATURE_WINS = { ranking: 1, tactics: 3, dailyTasks: DAILY_TASKS.winsToUnlock, backpack: 0, shop: 0, expedition: EXPEDITION.wins } as const;

/** 目标区间是抽取上限，出题按生产、有效防线、现有人员及余额收紧至当前可完成的数值。 */
export const TASK_GOALS = {
    win: [1, 2], kills: [6, 12], gateHealth: [50, 70], gateHits: [2, 4], enemyKind: [2, 4], enemyTypes: [2, 3],
    casts: [1, 2], equipped: [1, 1], towersHit: [2, 3], arrowHits: [4, 8], stoneSplash: [2, 2], frostHits: [3, 6],
    sewCoins: [5, 12],
    towerBuild: [1, 1], towerUpgrade: [1, 1], factoryUpgrade: [1, 1], gateUpgrade: [1, 1], repair: [1, 1],
    houseBuild: [1, 1], marriage: [1, 1], child: [1, 1], operator: [1, 1]
} as const;
/** 三倍波次的随军数量类任务。沿用战前预演收紧上限，历史任务继续按原目标入档。 */
export const DENSE_TASK_GOALS = { kills: [18, 36], enemyKind: [6, 12] } as const;
export type TaskKind = keyof typeof TASK_GOALS;
export type DailyTaskReward = typeof DAILY_TASKS.rewards[number];
export type SideFeature = keyof typeof FEATURE_WINS;
export function featureUnlocked(bestNight: number, feature: SideFeature) { return bestNight >= FEATURE_WINS[feature]; }
