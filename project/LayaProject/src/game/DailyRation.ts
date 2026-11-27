import type { GameState } from "./GameState";

/** 设备自然日礼从余额奖励改为一件修门工具。 */
export const DAILY_GIFT_ITEM = "gate_kit";

/** 日期属于离线设备日历，不使用UTC换日或网络时间；格式固定后可按字典序比较先后。 */
export function validGiftDate(value: unknown): value is string {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number), date = new Date(0);
    date.setHours(12, 0, 0, 0); date.setFullYear(year, month - 1, day);
    return year > 0 && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
export function localGiftDate(now: Date): string {
    const date = `${String(now.getFullYear()).padStart(4, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (!validGiftDate(date)) throw new Error("设备日期无效，无法核对每日礼");
    return date;
}
/** 日期字段沿用旧档，以免升级当天再次领奖。 */
export function dailyGiftAvailable(s: GameState, date: string): boolean {
    return validGiftDate(date) && (s.phase === "DAY" || s.phase === "NIGHT") &&
        (s.legacy.lastRationDate === null || date > s.legacy.lastRationDate);
}
