import { EXPEDITION, EXPEDITION_EVENTS, EXPEDITION_ROUTES, ExpeditionRewardId, ExpeditionRoute } from "../config/ExpeditionConfig";
import { clone, GameState, isWorkingAdult } from "./GameState";
import { SeededRandom } from "./SeededRandom";
import { autoAssignJobs, autoAssignNightDuties } from "./VillageJobs";
import { economy } from "./VillageQueries";
import { requireRule } from "./VillageStateOps";

export type ExpeditionReport = { event: keyof typeof EXPEDITION_EVENTS };
export type Expedition = {
    route: ExpeditionRoute;
    personId: string;
    name: string;
    departedAfter: number;
    reports: ExpeditionReport[];
    /** 最新胜利产生的战报待玩家确认，跟随同一份胜利存档提交。 */
    reportPending?: true;
    /** 存在即表示已回村，路线道具可以一次领取。 */
    remaining?: true;
    /** 旧档未读终章仍需显示；旧奖励已计入币余额，不再发放路线道具。 */
    rewardConverted?: true;
    /** 已处理回村弹窗；奖励可继续从入口领。 */
    noticed?: true;
};

/** 不消耗家庭和世界的随机流。按开村、出发时间和获胜夜生成各自事件。 */
const EXPEDITION_RANDOM_DOMAIN = 0x35323145;

export function expeditionUnavailableReason(s: GameState, id: string): string | null {
    if (s.phase !== "DAY") return "白天才可派出探索";
    if (s.completed < EXPEDITION.wins) return `守住第 ${EXPEDITION.wins} 波后开放`;
    if (s.expedition) return s.expedition.remaining ? "请先收下上一趟的奖励" : "已有村民在探索";
    const p = s.people.find(q => q.id === id);
    if (!p || !isWorkingAdult(p)) return "只能派出成年、未退休的村民";
    if (s.patrol.captain === id) return "淡紫队长需留村";
    if (s.towers.some(t => t.operator === id)) return "正在驻塔，请先调换塔手";
    return null;
}

export function startExpedition(s: GameState, id: string, route: ExpeditionRoute) {
    const reason = expeditionUnavailableReason(s, id);
    requireRule(reason === null, reason!);
    requireRule(Object.prototype.hasOwnProperty.call(EXPEDITION_ROUTES, route), "探索路线无效");
    const member = s.people.find(q => q.id === id)!;
    s.expedition = { route, personId: id, name: member.name, departedAfter: s.completed, reports: [] };
    member.job = "WAITING";
    autoAssignJobs(s);
    autoAssignNightDuties(s);
}

/** 白天预览用真实补岗计算守夜缝纫加成变化，人员变化后更新。 */
export function expeditionDeparturePreview(s: GameState, id: string, route: ExpeditionRoute) {
    const next = clone(s);
    startExpedition(next, id, route);
    const replacements = next.people.filter(p => s.people.some(q => q.id === p.id && q.job === "WAITING" && p.job !== q.job));
    return { coins: economy(next).sewing - economy(s).sewing, replacements };
}

export function expeditionNightsLeft(trip: Expedition) {
    return EXPEDITION_ROUTES[trip.route].nights - trip.reports.length;
}

/** 只在胜利结算候选写一次。s.completed 指完成这场战斗前的波数。 */
export function advanceExpedition(s: GameState) {
    const trip = s.expedition;
    if (!trip || trip.remaining) return;
    const random = new SeededRandom((s.rng.world ^ EXPEDITION_RANDOM_DOMAIN ^ s.run ^ Math.imul(trip.departedAfter, 0x45d9f3b) ^ s.completed) >>> 0);
    const available = (Object.keys(EXPEDITION_EVENTS) as ExpeditionReport["event"][]).filter(event => !trip.reports.some(report => report.event === event));
    trip.reports.push({ event: available[random.range(available.length)] });
    trip.reportPending = true;
    if (expeditionNightsLeft(trip) === 0) trip.remaining = true;
}

export function expeditionClaimQuote(s: GameState): ExpeditionRewardId | null {
    const trip = s.expedition;
    return trip?.remaining && !trip.rewardConverted ? EXPEDITION_ROUTES[trip.route].reward : null;
}

export function settleExpedition(s: GameState, claim: boolean) {
    const trip = s.expedition;
    requireRule((s.phase === "DAY" || s.phase === "DAWN") && !!trip?.remaining, "暂无已归村的探索");
    requireRule(!trip?.reportPending, "请先查看探索战报");
    if (claim) {
        requireRule(expeditionClaimQuote(s) !== null, "这趟奖励已经领取");
        delete s.expedition;
        return;
    }
    trip!.noticed = true;
}

export function validExpedition(s: GameState) {
    const trip = s.expedition;
    if (trip === undefined) return true;
    if (!trip || !Object.prototype.hasOwnProperty.call(EXPEDITION_ROUTES, trip.route)) return false;
    const route = EXPEDITION_ROUTES[trip.route], member = s.people.find(p => p.id === trip.personId);
    if (typeof trip.personId !== "string" || typeof trip.name !== "string" || !trip.name.length ||
        !Number.isSafeInteger(trip.departedAfter) || trip.departedAfter < EXPEDITION.wins ||
        !Array.isArray(trip.reports) || trip.reports.length > route.nights ||
        trip.departedAfter + trip.reports.length > s.completed ||
        (trip.reportPending !== undefined && (trip.reportPending !== true || !trip.reports.length ||
            trip.departedAfter + trip.reports.length !== s.completed || !member || member.name !== trip.name || trip.noticed ||
            (s.phase !== "DAY" && s.phase !== "DAWN"))) ||
        (trip.noticed !== undefined && (trip.noticed !== true || !trip.remaining)) ||
        (trip.rewardConverted !== undefined && (trip.rewardConverted !== true || !trip.remaining || !trip.reportPending))) return false;
    if (!trip.reports.every(report => report && Object.prototype.hasOwnProperty.call(EXPEDITION_EVENTS, report.event)) ||
        new Set(trip.reports.map(report => report.event)).size !== trip.reports.length) return false;
    if (trip.remaining !== undefined) return trip.remaining === true && trip.reports.length === route.nights;
    return trip.reports.length < route.nights && trip.departedAfter + trip.reports.length === s.completed &&
        !!member && member.name === trip.name && isWorkingAdult(member) && member.job === "WAITING" &&
        s.patrol.captain !== trip.personId && !s.towers.some(t => t.operator === trip.personId);
}

/** V22 的逐夜物资范围，用来核验待折算的旧探索报告。 */
const OLD_REPORT_AMOUNTS = {
    lobby: [[4, 6, 3, 4], [5, 7, 3, 4], [5, 7, 4, 6]],
    overnight: [[5, 7, 3, 4], [5, 7, 3, 4], [5, 7, 4, 5], [5, 6, 4, 5], [6, 7, 4, 6]]
} as const;

/** V22 专用。保留旧报告中的事件，旧货物只转换已回村的未领余量。 */
export function migrateLegacyExpedition(raw: unknown, completed: number): { trip?: Expedition; coins: number } {
    if (raw === undefined) return { coins: 0 };
    type OldMaterials = { food: number; wood: number };
    const old = raw as Omit<Expedition, "reports" | "remaining"> & {
        reports: (ExpeditionReport & OldMaterials)[];
        remaining?: OldMaterials;
    };
    const range = (n: number, min: number, max: number) => Number.isSafeInteger(n) && n >= min && n <= max;
    if (!old || !Object.prototype.hasOwnProperty.call(EXPEDITION_ROUTES, old.route) ||
        typeof old.personId !== "string" || typeof old.name !== "string" || !old.name.length ||
        !Array.isArray(old.reports) || old.reports.length > EXPEDITION_ROUTES[old.route].nights || old.rewardConverted !== undefined ||
        !range(old.departedAfter, EXPEDITION.wins, completed - old.reports.length) ||
        (old.reportPending !== undefined && (old.reportPending !== true || !old.reports.length ||
            old.departedAfter + old.reports.length !== completed || old.noticed !== undefined)) ||
        (old.noticed !== undefined && (old.noticed !== true || old.remaining === undefined)) ||
        !old.reports.every((report, i) => {
            const [woodMin, woodMax, foodMin, foodMax] = OLD_REPORT_AMOUNTS[old.route][i];
            return report && Object.prototype.hasOwnProperty.call(EXPEDITION_EVENTS, report.event) &&
                range(report.wood, woodMin, woodMax) && range(report.food, foodMin, foodMax);
        }) || new Set(old.reports.map(report => report.event)).size !== old.reports.length)
        throw new Error("旧探索战报无效");
    const { reports, remaining, ...state } = old;
    const trip: Expedition = { ...state, reports: reports.map(({ event }) => ({ event })) };
    if (remaining === undefined) return { trip, coins: 0 };
    const earned = reports.reduce((sum, report) => ({ food: sum.food + report.food, wood: sum.wood + report.wood }), { food: 0, wood: 0 });
    if (reports.length !== EXPEDITION_ROUTES[old.route].nights || !remaining ||
        !range(remaining.food, 0, earned.food) || !range(remaining.wood, 0, earned.wood) || !(remaining.food || remaining.wood))
        throw new Error("旧探索奖励无效");
    const coins = remaining.wood + Math.floor(remaining.food / 2);
    return trip.reportPending ? { trip: { ...trip, remaining: true, rewardConverted: true }, coins } : { coins };
}
