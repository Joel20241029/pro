import { EXPEDITION, EXPEDITION_EVENTS, EXPEDITION_ROUTES, ExpeditionRoute } from "../config/ExpeditionConfig";
import { clone, GameState, isWorkingAdult } from "./GameState";
import { storageCapacity } from "./Growth";
import { SeededRandom } from "./SeededRandom";
import { autoAssignJobs, autoAssignNightDuties } from "./VillageJobs";
import { economy } from "./VillageQueries";
import { requireRule } from "./VillageStateOps";

export type ExpeditionMaterials = { wood: number; food: number };
export type ExpeditionReport = ExpeditionMaterials & { event: keyof typeof EXPEDITION_EVENTS };
export type Expedition = {
    route: ExpeditionRoute;
    personId: string;
    name: string;
    departedAfter: number;
    reports: ExpeditionReport[];
    /** 最新胜利产生的战报待玩家确认，跟随同一份胜利存档提交。 */
    reportPending?: true;
    /** 存在即表示已回村，粮木已领部分从此处扣除。 */
    remaining?: ExpeditionMaterials;
    /** 已处理回村弹窗；部分奖励可继续从入口领。 */
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

/** 白天预览用真实补岗和生产计算，人员变化后会随村庄当前状态更新。 */
export function expeditionDeparturePreview(s: GameState, id: string, route: ExpeditionRoute) {
    const next = clone(s), before = economy(s);
    startExpedition(next, id, route);
    const after = economy(next);
    const replacements = next.people.filter(p => s.people.some(q => q.id === p.id && q.job === "WAITING" && p.job !== q.job));
    return { wood: after.wood - before.wood, food: after.food - before.food, rations: after.rations - before.rations, replacements };
}

export function expeditionTotal(trip: Expedition) {
    return trip.reports.reduce((sum, report) => ({ food: sum.food + report.food, wood: sum.wood + report.wood }), { food: 0, wood: 0 });
}

export function expeditionNightsLeft(trip: Expedition) {
    return EXPEDITION_ROUTES[trip.route].nights.length - trip.reports.length;
}

/** 只在胜利结算候选写一次。s.completed 指完成这场战斗前的波数。 */
export function advanceExpedition(s: GameState) {
    const trip = s.expedition;
    if (!trip || trip.remaining) return;
    const step = EXPEDITION_ROUTES[trip.route].nights[trip.reports.length];
    const random = new SeededRandom((s.rng.world ^ EXPEDITION_RANDOM_DOMAIN ^ s.run ^ Math.imul(trip.departedAfter, 0x45d9f3b) ^ s.completed) >>> 0);
    const available = (Object.keys(EXPEDITION_EVENTS) as ExpeditionReport["event"][]).filter(event => !trip.reports.some(report => report.event === event));
    const amount = ([min, max]: readonly [number, number]) => min + random.range(max - min + 1);
    trip.reports.push({ event: available[random.range(available.length)], wood: amount(step.wood), food: amount(step.food) });
    trip.reportPending = true;
    if (expeditionNightsLeft(trip) === 0) trip.remaining = expeditionTotal(trip);
}

export function expeditionClaimQuote(s: GameState): ExpeditionMaterials {
    const cap = storageCapacity(s), remaining = s.expedition?.remaining;
    return remaining ? { wood: Math.min(remaining.wood, cap - s.wood), food: Math.min(remaining.food, cap - s.food) } : { wood: 0, food: 0 };
}

export function settleExpedition(s: GameState, claim: boolean) {
    const trip = s.expedition;
    requireRule((s.phase === "DAY" || s.phase === "DAWN") && !!trip?.remaining, "暂无已归村的探索");
    requireRule(!trip?.reportPending, "请先查看探索战报");
    if (claim) {
        const amount = expeditionClaimQuote(s);
        requireRule(amount.food > 0 || amount.wood > 0, "仓储已满，奖励留在行囊");
        s.food += amount.food;
        s.wood += amount.wood;
        trip!.remaining!.food -= amount.food;
        trip!.remaining!.wood -= amount.wood;
        if (!(trip!.remaining!.food || trip!.remaining!.wood)) { delete s.expedition; return; }
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
        !Array.isArray(trip.reports) || trip.reports.length > route.nights.length ||
        trip.departedAfter + trip.reports.length > s.completed ||
        (trip.reportPending !== undefined && (trip.reportPending !== true || !trip.reports.length ||
            trip.departedAfter + trip.reports.length !== s.completed || !member || member.name !== trip.name || trip.noticed ||
            (s.phase !== "DAY" && s.phase !== "DAWN"))) ||
        (trip.noticed !== undefined && (trip.noticed !== true || !trip.remaining))) return false;
    const range = (n: number, min: number, max: number) => Number.isSafeInteger(n) && n >= min && n <= max;
    if (!trip.reports.every((report, i) => report && Object.prototype.hasOwnProperty.call(EXPEDITION_EVENTS, report.event) &&
        range(report.wood, route.nights[i].wood[0], route.nights[i].wood[1]) &&
        range(report.food, route.nights[i].food[0], route.nights[i].food[1])) ||
        new Set(trip.reports.map(report => report.event)).size !== trip.reports.length) return false;
    if (trip.remaining !== undefined) {
        const total = expeditionTotal(trip);
        return !!trip.remaining && trip.reports.length === route.nights.length &&
            range(trip.remaining.food, 0, total.food) && range(trip.remaining.wood, 0, total.wood) &&
            trip.remaining.food + trip.remaining.wood > 0;
    }
    return trip.reports.length < route.nights.length && trip.departedAfter + trip.reports.length === s.completed &&
        !!member && member.name === trip.name && isWorkingAdult(member) && member.job === "WAITING" &&
        s.patrol.captain !== trip.personId && !s.towers.some(t => t.operator === trip.personId);
}
