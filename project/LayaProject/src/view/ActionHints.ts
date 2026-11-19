import { patrolBuildReason } from "../game/PatrolRules";
import { GameSession, Pause } from "../game/GameSession";
import { GameState, isWorkingAdult, Person } from "../game/GameState";
import { RULE } from "../game/GameConfig";
import { birthUnavailableReason, canMarry } from "../game/VillageQueries";
import { gateCapacity, laborSlots, repairCost, residentialCost, upgradeCost, upgradeUnavailableReason, UpgradeKind } from "../game/Growth";

/** 这些状态暂时不能提交村务。普通面板的 CHOICE 暂停不遮掉红点，关闭面板也不会当成“已处理”。 */
const BLOCKING_PAUSES: readonly Pause[] = ["BACKGROUND", "WAIT_RESUME", "DAILY_RATION", "SAVE_PENDING", "ASSETS", "DISABLED"];
export function actionHintsBlocked(game: GameSession): boolean {
    return !!game.saves.pending || game.dailyRationDate !== null || BLOCKING_PAUSES.some(p => game.pauses.has(p));
}
/** 名册红点与列表优先级共用：该成人的详情中确有可安排的空岗或照料事项。 */
export function personNeedsAttention(s: GameState, p: Person): boolean {
    if (s.phase !== "DAY" || !isWorkingAdult(p)) return false;
    const vacancy = s.people.filter(q => q.job === "FARM").length < laborSlots("FARM", s.farm) ||
        s.people.filter(q => q.job === "LOGGING").length < laborSlots("LOGGING", s.logging);
    return (p.job === "WAITING" && vacancy) || (p.job !== "CARE" &&
        s.people.some(child => !child.adult && !s.people.some(a => a.careChild === child.id)));
}
/** 家庭入口与两个标签共用可执行条件；红点由当前可办事项决定。 */
export function familyActionHints(s: GameState, blocked: boolean) {
    if (blocked || s.phase !== "DAY") return { marriage: false, nurture: false };
    const adults = s.people.filter(isWorkingAdult);
    return {
        marriage: Number.isSafeInteger(s.nextFamily + 1) && adults.some((a, i) => adults.slice(i + 1).some(b => canMarry(s, a, b))),
        nurture: Number.isSafeInteger(s.nextPerson + 1) && s.families.some(f => birthUnavailableReason(s, f.id) === null)
    };
}
/** 只读可执行事项；复用命令预检，不抽随机数、不扣资源、不写档。只在 HUD refresh 时计算。 */
export function actionHints(s: GameState, blocked: boolean) {
    const hints = { people: false, families: false, build: false, history: false };
    if (blocked || s.phase !== "DAY") return hints;
    const adults = s.people.filter(isWorkingAdult);
    hints.people = adults.some(p => personNeedsAttention(s, p));
    const { marriage, nurture } = familyActionHints(s, blocked);
    hints.families = marriage || nurture;
    const buildings: [UpgradeKind, number][] = [["FARM", s.farm], ["LOGGING", s.logging], ["HOUSING", s.housing], ["GATE", s.gateLevel]];
    hints.build = patrolBuildReason(s) === null || (!!s.patrol && !s.patrol.captain && adults.length > 0) || buildings.some(([kind, level]) => upgradeUnavailableReason(s, upgradeCost(kind, level)) === null) ||
        (s.houses < RULE.houseMax && upgradeUnavailableReason(s, residentialCost(s.houses)) === null) || (s.gate < gateCapacity(s) && s.wood >= repairCost(s));
    return hints;
}
