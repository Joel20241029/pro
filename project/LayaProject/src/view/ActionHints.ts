import { patrolCaptain, patrolSpinStats } from "../game/PatrolRules";
import { patrolRapidCapacity, patrolRapidDamage, patrolReloadSeconds } from "../game/PatrolRapid";
import { PATROL, PATROL_MODE, PatrolMode } from "../config/PatrolConfig";
import { TOWER_AMMO, TOWER_BUILD_WOOD } from "../config/DefenseConfig";
import { SHOP_PRODUCTS } from "../config/ShopConfig";
import { GameSession, Pause } from "../game/GameSession";
import { GameState, isAvailableAdult, ownsTowerAmmo, Person } from "../game/GameState";
import { birthUnavailableReason, canMarry } from "../game/VillageQueries";
import { gateCapacity, laborSlots, repairCost, residentialUpgradeReason, upgradeCost, upgradeUnavailableReason } from "../game/Growth";
import { replacementOperators } from "../game/VillageJobs";
import type { TowerKind } from "../config/DefenseConfig";
import { patrolActionHints } from "./PatrolActionHints";

/** 这些状态暂时不能提交村务。普通面板的 CHOICE 暂停不遮掉红点，关闭面板也不会当成“已处理”。 */
const BLOCKING_PAUSES: readonly Pause[] = ["BACKGROUND", "WAIT_RESUME", "DAILY_RATION", "SAVE_PENDING", "ASSETS", "DISABLED"];
export function actionHintsBlocked(game: GameSession): boolean {
    return !!game.saves.pending || game.dailyRationDate !== null || BLOCKING_PAUSES.some(p => game.pauses.has(p));
}

/** 只标记有待安排成年人可以实际填补的白天空岗。 */
export function jobVacancyHints(s: GameState, blocked: boolean) {
    const ready = !blocked && s.phase === "DAY" && s.people.some(q => q.job === "WAITING" && isAvailableAdult(s, q));
    return {
        FARM: ready && s.people.filter(q => q.job === "FARM").length < laborSlots("FARM", s.farm),
        LOGGING: ready && s.people.filter(q => q.job === "LOGGING").length < laborSlots("LOGGING", s.logging)
    };
}
/** 家庭入口与两个标签共用可执行条件；红点由当前可办事项决定。 */
export function familyActionHints(s: GameState, blocked: boolean, identifyOnlyPair = false) {
    const hints = { marriage: false, nurture: false, onlyPair: null as [Person, Person] | null };
    if (blocked || s.phase !== "DAY") return hints;
    hints.nurture = Number.isSafeInteger(s.nextPerson + 1) && s.families.some(f => birthUnavailableReason(s, f.id) === null);
    if (!Number.isSafeInteger(s.nextFamily + 1)) return hints;
    const partnered = new Set<string>();
    for (const family of s.families) for (const id of family.partners) partnered.add(id);
    const singles = s.people.filter(p => isAvailableAdult(s, p) && !partnered.has(p.id));
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
/** 各入口共用命令预检，开得起但已经完好的城门无需修复。 */
export function constructionHints(s: GameState, blocked: boolean) {
    const ready = !blocked && s.phase === "DAY";
    return {
        REPAIR: ready && s.gate < gateCapacity(s) && s.wood >= repairCost(s),
        HOUSE: ready && residentialUpgradeReason(s) === null,
        PATROL: Object.values(patrolActionHints(s, blocked)).some(Boolean),
        FARM: ready && upgradeUnavailableReason(s, upgradeCost("FARM", s.farm)) === null,
        LOGGING: ready && upgradeUnavailableReason(s, upgradeCost("LOGGING", s.logging)) === null,
        GATE: ready && upgradeUnavailableReason(s, upgradeCost("GATE", s.gateLevel)) === null
    };
}

/** 塔内只提示已解锁弹药的升级和首次装配。购买提醒由商城计算。 */
export function towerAmmoActionHints(s: GameState, kind: TowerKind, blocked: boolean) {
    const owned = ownsTowerAmmo(s, kind), active = !blocked && s.phase === "DAY";
    const offer = SHOP_PRODUCTS.find(product => product.ammo === kind);
    return {
        upgrade: active && owned && upgradeUnavailableReason(s, upgradeCost("TOWER", s.ammoLevels[kind])) === null,
        equip: active && owned && !!offer && !s.towers.some(tower => tower.kind === kind)
    };
}

/** 塔详情及弹药库共用可办事项。驻塔红点要求有空闲人选，避免只把空岗挪到另一座塔。 */
export function towerActionHints(s: GameState, index: number, blocked: boolean) {
    const hints = { build: false, upgrade: false, staff: false, ammo: false };
    const tower = s.towers[index];
    if (!tower || blocked || s.phase !== "DAY") return hints;
    if (!tower.kind) {
        hints.build = upgradeUnavailableReason(s, { wood: TOWER_BUILD_WOOD, food: 0 }) === null;
        return hints;
    }
    hints.upgrade = upgradeUnavailableReason(s, upgradeCost("TOWER", tower.level)) === null;
    hints.staff = !tower.operator && replacementOperators(s, index).some(person =>
        person.id !== s.patrol.captain && !s.towers.some(other => other.operator === person.id));
    hints.ammo = (Object.keys(TOWER_AMMO) as TowerKind[]).some(kind =>
        Object.values(towerAmmoActionHints(s, kind, blocked)).some(Boolean));
    return hints;
}

/** 旋甩按每批伤害，连发按整仓含补弹的持续输出比较，与打法候选排序共用。 */
export function patrolOutput(level: number, mode: PatrolMode, person: Person) {
    const stats = patrolSpinStats(level, person);
    if (mode === PATROL_MODE.spin) return stats.damage / stats.seconds;
    const rounds = patrolRapidCapacity(level);
    const cycle = (rounds - 1) / PATROL.rapid.shotsPerSecond + patrolReloadSeconds(person);
    return patrolRapidDamage(stats.damage) * rounds / cycle;
}

export function captainRecommendation(s: GameState, blocked: boolean) {
    if (blocked || s.phase !== "DAY") return null;
    const current = patrolCaptain(s), mode = s.patrol.mode ?? PATROL_MODE.spin;
    if (!current) return null;
    const stationed = new Set(s.towers.map(t => t.operator));
    let best: Person | undefined, output = patrolOutput(s.patrol.level, mode, current);
    for (const p of s.people) {
        if (!isAvailableAdult(s, p) || p === current || stationed.has(p.id)) continue;
        const value = patrolOutput(s.patrol.level, mode, p);
        if (value > output || (best && value === output && p.nights > best.nights)) {
            best = p;
            output = value;
        }
    }
    return best ?? null;
}

export function actionHints(s: GameState, blocked: boolean) {
    const hints = { people: false, families: false, build: false, history: false };
    if (blocked || s.phase !== "DAY") return hints;
    const jobs = jobVacancyHints(s, blocked);
    hints.people = jobs.FARM || jobs.LOGGING;
    const { marriage, nurture } = familyActionHints(s, blocked);
    hints.families = marriage || nurture;
    const building = constructionHints(s, blocked);
    hints.build = Object.values(building).some(Boolean);
    return hints;
}
