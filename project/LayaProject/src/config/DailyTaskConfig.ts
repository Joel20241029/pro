/** 每日任务池按五个主题抽取；一条常规守夜优先，其余优先选不同主题。调整奖励会影响每日资源上限。 */
export const DAILY_TASKS = { limit: 3, rewardMin: 5, rewardMax: 8, winsToUnlock: 6, clockCheckMs: 1000 } as const;
/** 左侧入口的首次胜利门槛。背包、商城错开开放，预留各自的解锁演出与引导节奏。 */
export const FEATURE_WINS = { ranking: 1, tactics: 3, dailyTasks: DAILY_TASKS.winsToUnlock, backpack: 8, shop: 13 } as const;

/** 目标区间是抽取上限，出题按生产、有效防线、现有人员及材料收紧至当前可完成的数值。 */
export const TASK_GOALS = {
    win: [1, 2], kills: [6, 12], gateHealth: [50, 70], gateHits: [2, 4], enemyKind: [2, 4], enemyTypes: [2, 3],
    casts: [1, 2], equipped: [1, 1], towersHit: [2, 3], arrowHits: [4, 8], stoneSplash: [2, 2], frostHits: [3, 6],
    food: [16, 24], wood: [10, 18], both: [12, 18], farmers: [2, 2], loggers: [2, 2], rations: [1, 1],
    towerBuild: [1, 1], towerUpgrade: [1, 1], farmUpgrade: [1, 1], loggingUpgrade: [1, 1], gateUpgrade: [1, 1], repair: [1, 1],
    houseBuild: [1, 1], marriage: [1, 1], child: [1, 1],
    // 已发的手动派工任务仍可读档、计数和领奖，后续刷新不再抽取。
    worker: [1, 1], operator: [1, 1]
} as const;
/** 三倍波次的随军数量类任务。沿用战前预演收紧上限，历史任务继续按原目标入档。 */
export const DENSE_TASK_GOALS = { kills: [18, 36], enemyKind: [6, 12] } as const;
export const DAILY_BOTH_WOOD = [6, 12] as const;
export type TaskKind = keyof typeof TASK_GOALS;
export type TaskMaterial = "food" | "wood";
export type SideFeature = keyof typeof FEATURE_WINS;
export function featureUnlocked(bestNight: number, feature: SideFeature) { return bestNight >= FEATURE_WINS[feature]; }
