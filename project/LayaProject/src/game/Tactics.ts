import { KING_MERCY, TACTICS, TACTIC_SLOTS, tacticDefinition } from "../config/TacticConfig";
import { GameState } from "./GameState";
import { requireRule, spend } from "./VillageStateOps";

export type TacticAction = "LEARN" | "EQUIP";
export function equippedTactics(s: GameState) { return [s.tactics.equipped, ...(s.tactics.extraSlots ?? [])]; }
/** 读实时余额，确认面板与提交共用同一献纳报价。 */
export function mercyOffering(s: Pick<GameState, "coins">) {
    const coins = Math.max(KING_MERCY.minimumCoins, Math.ceil(s.coins * KING_MERCY.offeringPercent / 100));
    return { coins, reason: s.coins < coins ? `需要至少 ${KING_MERCY.minimumCoins} 尔币，祈求未成` : null };
}
/** 已学会的传承战技始终可见；其余守住对应波数才揭晓，列表和说明书共用。 */
export function tacticRevealed(s: GameState, id: string): boolean {
    return s.tactics.learned.includes(id) || s.completed >= tacticDefinition(id).unlockWaves;
}
/** 列表、详情、红点及提交共用的纯预检；不改状态、不抽随机数、不发起资源加载。 */
export function tacticUnavailableReason(s: GameState, id: string, action: TacticAction, slot?: number): string | null {
    const t = tacticDefinition(id), learned = s.tactics.learned.includes(id);
    if (s.phase !== "DAY") return "天亮后可学习 / 更换";
    if (slot !== undefined && (!Number.isInteger(slot) || slot < 0 || slot >= equippedTactics(s).length)) return "请先解锁此槽位";
    if (action === "EQUIP") return !learned ? "请先学习此战技" : equippedTactics(s).includes(id) ? "已携带" : null;
    if (learned) return "已学会，无需重复学习";
    if (s.completed < t.unlockWaves) return `还需守住 ${t.unlockWaves - s.completed} 波`;
    return materialsUnavailable(s, t);
}
function materialsUnavailable(s: GameState, cost: { coins: number }) {
    return s.coins < cost.coins ? `还缺 ${cost.coins - s.coins} 尔币` : null;
}
export function applyTactic(s: GameState, id: string, action: TacticAction, slot = 0) {
    const reason = tacticUnavailableReason(s, id, action, slot);
    requireRule(reason === null, reason!);
    if (action === "LEARN") {
        const t = tacticDefinition(id);
        spend(s, t.coins);
        s.tactics.learned.push(id);
    }
    if (slot === 0) s.tactics.equipped = id;
    else s.tactics.extraSlots![slot - 1] = id;
}
export function slotUnavailableReason(s: GameState, slot: number): string | null {
    if (s.phase !== "DAY") return "天亮后可解锁战技槽";
    const cost = TACTIC_SLOTS[slot - 1];
    if (!cost || slot !== equippedTactics(s).length) return "请按顺序解锁战技槽";
    if (s.completed < cost.unlockWaves) return `还需守住 ${cost.unlockWaves - s.completed} 波`;
    return materialsUnavailable(s, cost);
}
export function unlockTacticSlot(s: GameState, slot: number) {
    const reason = slotUnavailableReason(s, slot);
    requireRule(reason === null, reason!);
    const cost = TACTIC_SLOTS[slot - 1];
    spend(s, cost.coins);
    (s.tactics.extraSlots ??= []).push(null);
}
export function canLearnTactic(s: GameState): boolean {
    return TACTICS.some(t => !s.tactics.learned.includes(t.id) && tacticUnavailableReason(s, t.id, "LEARN") === null);
}

/** 世界入口和槽位卡共用解锁资格，只有下一槽满足波数和费用才提醒。 */
export function nextTacticSlotReady(s: GameState) {
    return slotUnavailableReason(s, equippedTactics(s).length) === null;
}
