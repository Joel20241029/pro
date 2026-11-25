import { patrolUpgradeReason } from "../game/PatrolRules";
import { GameSession, Pause } from "../game/GameSession";
import { GameState, isWorkingAdult, Person } from "../game/GameState";
import { birthUnavailableReason, canMarry } from "../game/VillageQueries";
import { gateCapacity, repairCost, residentialUpgradeReason, upgradeCost, upgradeUnavailableReason, UpgradeKind } from "../game/Growth";

/** 这些状态暂时不能提交村务。普通面板的 CHOICE 暂停不遮掉红点，关闭面板也不会当成“已处理”。 */
const BLOCKING_PAUSES: readonly Pause[] = ["BACKGROUND", "WAIT_RESUME", "DAILY_RATION", "SAVE_PENDING", "ASSETS", "DISABLED"];
export function actionHintsBlocked(game: GameSession): boolean {
    return !!game.saves.pending || game.dailyRationDate !== null || BLOCKING_PAUSES.some(p => game.pauses.has(p));
}
/** 家庭入口与两个标签共用可执行条件；红点由当前可办事项决定。 */
export function familyActionHints(s: GameState, blocked: boolean, identifyOnlyPair = false) {
    const hints = { marriage: false, nurture: false, onlyPair: null as [Person, Person] | null };
    if (blocked || s.phase !== "DAY") return hints;
    hints.nurture = Number.isSafeInteger(s.nextPerson + 1) && s.families.some(f => birthUnavailableReason(s, f.id) === null);
    if (!Number.isSafeInteger(s.nextFamily + 1)) return hints;
    const partnered = new Set<string>();
    for (const family of s.families) for (const id of family.partners) partnered.add(id);
    const singles = s.people.filter(p => isWorkingAdult(p) && !partnered.has(p.id));
    for (let i = 0; i < singles.length; i++) {
        for (let j = i + 1; j < singles.length; j++) {
            if (!canMarry(s, singles[i], singles[j])) continue;
            if (hints.marriage) { hints.onlyPair = null; return hints; }
            hints.marriage = true;
            if (!identifyOnlyPair) return hints;
            hints.onlyPair = [singles[i], singles[j]];
        }
    }
    return hints;
}
/** 只读可执行事项；复用命令预检，不抽随机数、不扣资源、不写档。只在 HUD refresh 时计算。 */
export function actionHints(s: GameState, blocked: boolean) {
    const hints = { people: false, families: false, build: false, history: false };
    if (blocked || s.phase !== "DAY") return hints;
    const { marriage, nurture } = familyActionHints(s, blocked);
    hints.families = marriage || nurture;
    const buildings: [UpgradeKind, number][] = [["FARM", s.farm], ["LOGGING", s.logging], ["GATE", s.gateLevel]];
    hints.build = patrolUpgradeReason(s) === null || buildings.some(([kind, level]) => upgradeUnavailableReason(s, upgradeCost(kind, level)) === null) ||
        residentialUpgradeReason(s) === null || (s.gate < gateCapacity(s) && s.wood >= repairCost(s));
    return hints;
}
