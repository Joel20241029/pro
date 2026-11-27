import { PATROL_MODE } from "../config/PatrolConfig";
import { GameState, isAvailableAdult } from "../game/GameState";
import { patrolCaptain, patrolUpgradeReason } from "../game/PatrolRules";

/** 建设和巡防弹窗共用这三项可办状态，切换打法只提示已有旋甩增益待生效时。 */
export function patrolActionHints(state: GameState, blocked: boolean) {
    const ready = !blocked && state.phase === "DAY", captain = patrolCaptain(state);
    return {
        upgrade: ready && patrolUpgradeReason(state) === null,
        appoint: ready && !captain && state.people.some(p => isAvailableAdult(state, p)),
        activateBuff: ready && !!captain && state.patrol.mode === PATROL_MODE.rapid &&
            !!(state.patrol.rationReady || state.patrol.radiusReady)
    };
}
