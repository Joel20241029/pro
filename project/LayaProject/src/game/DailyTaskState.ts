import { DAILY_BOTH_WOOD, DAILY_TASKS, DENSE_TASK_GOALS, TASK_GOALS, TaskKind, TaskMaterial, featureUnlocked } from "../config/DailyTaskConfig";
import { TACTICS } from "../config/TacticConfig";
import { validRationDate } from "./DailyRation";
import { ENEMIES, EnemyKind } from "./GameConfig";
import type { GameState } from "./GameState";
import { storageCapacity } from "./Growth";

export interface DailyTask {
    kind: TaskKind;
    goal: number;
    progress: number;
    enemy?: EnemyKind;
    tactic?: string;
    woodGoal?: number;
    material: TaskMaterial;
    reward: number;
    claimed: boolean;
}
export interface DailyTaskDay { date: string; tasks: DailyTask[]; }

export function activeDailyTasks(s: GameState, date: string) {
    return s.dailyTasks?.date === date ? s.dailyTasks : undefined;
}

export function dailyTaskStatus(s: GameState, task: DailyTask): "claimed" | "active" | "full" | "ready" {
    if (task.claimed) return "claimed";
    if (task.progress < task.goal) return "active";
    if (storageCapacity(s) - s[task.material] < task.reward) return "full";
    return "ready";
}
export function dailyTasksClaimable(s: GameState, date: string) {
    return s.phase === "DAY" && (activeDailyTasks(s, date)?.tasks.some(task => dailyTaskStatus(s, task) === "ready") ?? false);
}

export function claimDailyTask(s: GameState, kind: TaskKind, issuedDate: string, date: string) {
    if (!featureUnlocked(s.legacy.bestNight, "dailyTasks") || s.phase !== "DAY") throw new Error("请在白天领取任务奖励");
    const task = issuedDate === date ? activeDailyTasks(s, date)?.tasks.find(t => t.kind === kind) : undefined;
    if (!task) throw new Error("这项每日任务已刷新");
    switch (dailyTaskStatus(s, task)) {
        case "ready": s[task.material] += task.reward; task.claimed = true; break;
        case "full": throw new Error("请先腾出仓储空间");
        case "active": throw new Error("尚未完成任务");
        case "claimed": throw new Error("该奖励已经领取");
    }
}

export function validDailyTaskDay(day: DailyTaskDay): boolean {
    if (!day || !validRationDate(day.date) || !Array.isArray(day.tasks) || day.tasks.length > DAILY_TASKS.limit) return false;
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
            (task.material === "food" || task.material === "wood") && inRange(task.reward, DAILY_TASKS.rewardMin, DAILY_TASKS.rewardMax) &&
            (task.kind === "enemyKind" ? ENEMIES[task.enemy!]?.boss === false : task.enemy === undefined) &&
            (task.kind === "equipped" ? typeof task.tactic === "string" && TACTICS.some(t => t.id === task.tactic) : task.tactic === undefined) &&
            (task.kind === "both" ? inRange(task.woodGoal!, ...DAILY_BOTH_WOOD) : task.woodGoal === undefined);
    });
}
