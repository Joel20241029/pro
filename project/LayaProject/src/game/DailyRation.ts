import { RULE } from "./GameConfig";
import { GameState } from "./GameState";
import { storageCapacity } from "./Growth";

/** 日期属于离线设备日历，不使用UTC换日或网络时间；格式固定后可按字典序比较先后。 */
export function validRationDate(value: unknown): value is string {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number), date = new Date(0);
    date.setHours(12, 0, 0, 0); date.setFullYear(year, month - 1, day);
    return year > 0 && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
export function localRationDate(now: Date): string {
    const date = `${String(now.getFullYear()).padStart(4, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (!validRationDate(date)) throw new Error("设备日期无效，无法核对每日口粮");
    return date;
}
/** null 为不可领取，0 为满仓但仍可确认当日领取；界面与命令共用，不能按真假值判断奖励。 */
export function dailyRationAmount(s: GameState, date: string): number | null {
    if (!validRationDate(date) || (s.phase !== "DAY" && s.phase !== "NIGHT") || (s.legacy.lastRationDate !== null && date <= s.legacy.lastRationDate)) return null;
    return Math.min(RULE.dailyFood, storageCapacity(s) - s.food);
}
