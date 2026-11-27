import { DAILY_TASKS, DENSE_TASK_GOALS, TASK_GOALS, TaskKind, DailyTaskReward, featureUnlocked } from "../config/DailyTaskConfig";
import { TACTICS } from "../config/TacticConfig";
import { validGiftDate } from "./DailyRation";
import { ENEMIES, EnemyKind } from "./GameConfig";
import type { GameState } from "./GameState";

export interface DailyTask {
    kind: TaskKind;
    goal: number;
    progress: number;
    enemy?: EnemyKind;
    tactic?: string;
    reward: DailyTaskReward;
    claimed: boolean;
}
export interface DailyTaskDay { date: string; tasks: DailyTask[]; }

export function activeDailyTasks(s: GameState, date: string) {
    return s.dailyTasks?.date === date ? s.dailyTasks : undefined;
}

export function dailyTaskStatus(task: DailyTask): "claimed" | "active" | "ready" {
    if (task.claimed) return "claimed";
    if (task.progress < task.goal) return "active";
    return "ready";
}
export function dailyTasksClaimable(s: GameState, date: string) {
    return s.phase === "DAY" && (activeDailyTasks(s, date)?.tasks.some(task => dailyTaskStatus(task) === "ready") ?? false);
}

export function claimDailyTask(s: GameState, kind: TaskKind, issuedDate: string, date: string) {
    if (!featureUnlocked(s.legacy.bestNight, "dailyTasks") || s.phase !== "DAY") throw new Error("请在白天领取任务奖励");
    const task = issuedDate === date ? activeDailyTasks(s, date)?.tasks.find(t => t.kind === kind) : undefined;
    if (!task) throw new Error("这项每日任务已刷新");
    switch (dailyTaskStatus(task)) {
        case "ready": task.claimed = true; return task.reward;
        case "active": throw new Error("尚未完成任务");
        case "claimed": throw new Error("该奖励已经领取");
    }
}

export function validDailyTaskDay(day: DailyTaskDay): boolean {
    if (!day || !validGiftDate(day.date) || !Array.isArray(day.tasks) || day.tasks.length > DAILY_TASKS.limit) return false;
    if (new Set(day.tasks.map(task => task?.kind)).size !== day.tasks.length) return false;
    const inRange = (value: number, min: number, max: number) => Number.isInteger(value) && value >= min && value <= max;
    return day.tasks.every(task => {
        if (!task || !Object.prototype.hasOwnProperty.call(TASK_GOALS, task.kind)) return false;
        const [min, max] = TASK_GOALS[task.kind];
        const denseGoal = task.kind === "kills" || task.kind === "enemyKind" ? DENSE_TASK_GOALS[task.kind] : null;
        const goalValid = inRange(task.goal, task.kind === "gateHealth" ? 1 : min, max) ||
            (denseGoal !== null && inRange(task.goal, denseGoal[0], denseGoal[1]));
        return goalValid &&
            inRange(task.progress, 0, task.goal) && typeof task.claimed === "boolean" && (!task.claimed || task.progress === task.goal) &&
            DAILY_TASKS.rewards.includes(task.reward) &&
            (task.kind === "enemyKind" ? ENEMIES[task.enemy!]?.boss === false : task.enemy === undefined) &&
            (task.kind === "equipped" ? typeof task.tactic === "string" && TACTICS.some(t => t.id === task.tactic) : task.tactic === undefined);
    });
}

type LegacyDailyTask = Omit<DailyTask, "kind" | "reward"> & {
    kind: string; material: "wood" | "food"; reward: number; woodGoal?: number;
};
/** 已退役的 V22 目标区间，仅用于验证和折算旧任务。 */
const OLD_TASK_GOALS: Readonly<Partial<Record<string, readonly [number, number]>>> = {
    food: [16, 24], wood: [10, 18], both: [12, 18], farmers: [2, 2], loggers: [2, 2], rations: [1, 1],
    farmUpgrade: [1, 1], loggingUpgrade: [1, 1], worker: [1, 1]
};
/** V22 专用。已挣得的未领奖励按旧仓折算，同一日保留，避免重新抽取或重复领取。 */
export function migrateLegacyDailyTaskDay(raw: unknown): { day?: DailyTaskDay; coins: number } {
    if (raw === undefined) return { coins: 0 };
    const legacy = raw as { date: string; tasks: LegacyDailyTask[] };
    if (!legacy || !validGiftDate(legacy.date) || !Array.isArray(legacy.tasks) || legacy.tasks.length > DAILY_TASKS.limit)
        throw new Error("旧每日任务存档无效");
    const tasks: DailyTask[] = [];
    let coins = 0;
    if (new Set(legacy.tasks.map(task => task?.kind)).size !== legacy.tasks.length)
        throw new Error("旧每日任务重复");
    legacy.tasks.forEach((task, index) => {
        if (!task || !Number.isSafeInteger(task.goal) || task.goal < 1 ||
            !Number.isSafeInteger(task.progress) || task.progress < 0 || task.progress > task.goal ||
            typeof task.claimed !== "boolean" || task.claimed && task.progress !== task.goal ||
            !Number.isInteger(task.reward) || task.reward < 5 || task.reward > 8 ||
            (task.material !== "food" && task.material !== "wood"))
            throw new Error("旧每日任务奖励无效");
        const originalGoal = Object.prototype.hasOwnProperty.call(OLD_TASK_GOALS, task.kind) ? OLD_TASK_GOALS[task.kind] : undefined;
        if ((originalGoal && (task.goal < originalGoal[0] || task.goal > originalGoal[1] || task.enemy !== undefined || task.tactic !== undefined)) ||
            (task.kind === "both" ? !Number.isSafeInteger(task.woodGoal) || task.woodGoal! < 6 || task.woodGoal! > 12 : task.woodGoal !== undefined))
            throw new Error("旧每日任务目标无效");
        const completed = task.progress === task.goal;
        if (completed && !task.claimed) coins += task.material === "wood" ? task.reward : Math.floor(task.reward / 2);
        if (originalGoal) return;
        if (task.kind === "sewCoins" || task.kind === "factoryUpgrade" || !Object.prototype.hasOwnProperty.call(TASK_GOALS, task.kind))
            throw new Error("旧每日任务类型无效");
        tasks.push({ kind: task.kind as TaskKind, goal: task.goal, progress: task.progress,
            ...(task.enemy === undefined ? {} : { enemy: task.enemy }),
            ...(task.tactic === undefined ? {} : { tactic: task.tactic }),
            claimed: completed, reward: DAILY_TASKS.rewards[index] });
    });
    const day = { date: legacy.date, tasks };
    if (!validDailyTaskDay(day)) throw new Error("旧每日任务进度无效");
    return { day, coins };
}
