import { GameState, isAvailableAdult, Job } from "./GameState";
import { laborSlots } from "./Growth";
import { person } from "./VillageQueries";
import { requireRule } from "./VillageStateOps";
export const JOB_NAMES: Record<Job, string> = { WAITING: "待安排", FARM: "耕作", LOGGING: "伐木" };
/** 用户确认的自动分配顺序：先农艺/伐木天赋对应空岗，再先农田后伐木；各轮按在村顺序。
 * 只处理待安排成年人，不换走在岗者、不自动照料、不使用随机数；没有空岗仍为待安排。
 */
export function autoAssignJobs(s: GameState) {
    const free = {
        FARM: laborSlots("FARM", s.farm) - s.people.filter(p => p.job === "FARM").length,
        LOGGING: laborSlots("LOGGING", s.logging) - s.people.filter(p => p.job === "LOGGING").length
    };
    for (const p of s.people)
        if (isAvailableAdult(s, p) && p.job === "WAITING") {
            const job = free.FARM > 0 && p.traits.includes("trait_diligent") ? "FARM" : p.traits.includes("trait_woodwise") ? "LOGGING" : null;
            if (job && free[job] > 0) {
                p.job = job;
                free[job]--;
            }
        }
    for (const p of s.people)
        if (isAvailableAdult(s, p) && p.job === "WAITING") {
            if (free.FARM > 0) {
                p.job = "FARM";
                free.FARM--;
            }
            else if (free.LOGGING > 0) {
                p.job = "LOGGING";
                free.LOGGING--;
            }
        }
}
/** 已建塔有成年村民就补满；沿用在村顺序与塔位顺序，不换已有驻守、不占白天岗位、不消耗随机数。 */
export function autoAssignOperators(s: GameState) {
    const assigned = new Set(s.towers.map(t => t.operator).filter(id => id !== null));
    const available = s.people.filter(p => isAvailableAdult(s, p) && !assigned.has(p.id) && p.id !== s.patrol.captain);
    for (const tower of s.towers)
        if (tower.kind && !tower.operator && available.length)
            tower.operator = available.shift()!.id;
}
/** 队长空岗先用夜间空闲成年人，其次由最后一座有人塔补任。保留玩家指定的塔手，独自驻塔时可暂缺队长。 */
export function autoAssignNightDuties(s: GameState, chosenOperator?: string) {
    if (s.patrol.captain === null) {
        const assigned = new Set(s.towers.map(t => t.operator));
        const available = s.people.find(p => isAvailableAdult(s, p) && !assigned.has(p.id));
        if (available) s.patrol.captain = available.id;
        else {
            const staffed = s.towers.filter(t => t.operator !== null);
            const lastStaffed = staffed.length > 1 ? staffed.reverse().find(t => t.operator !== chosenOperator) : undefined;
            if (lastStaffed) {
                s.patrol.captain = lastStaffed.operator;
                lastStaffed.operator = null;
            }
        }
    }
    autoAssignOperators(s);
}
/** 所有在村、未荣休的成年人都可以调整到这座塔。本塔现任单独在面板顶部展示。 */
export function replacementOperators(s: GameState, index: number) {
    const current = s.towers[index].operator;
    return s.people.filter(p => isAvailableAdult(s, p) && p.id !== current);
}
export function assignOperator(s: GameState, index: number, id: string) {
    const t = s.towers[index];
    requireRule(t && t.kind !== null, "此处尚未建塔");
    requireRule(typeof id === "string" && id.length > 0, "请选择驻守村民");
    requireRule(isAvailableAdult(s, person(s, id)), "驻塔需要在村、成年且未退休的村民");
    const previous = s.towers.find(tower => tower !== t && tower.operator === id);
    if (previous)
        previous.operator = t.operator;
    t.operator = id;
    if (s.patrol.captain === id) {
        s.patrol.captain = null;
        autoAssignNightDuties(s, id);
    } else autoAssignOperators(s);
}
