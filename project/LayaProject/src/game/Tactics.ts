import { TACTICS, tacticDefinition } from "../config/TacticConfig";
import { GameState } from "./GameState";
import { storageCapacity } from "./Growth";
import { requireRule } from "./VillageStateOps";

export type TacticAction = "LEARN" | "EQUIP";
/** 已学会的传承战技始终可见；其余守住对应波数才揭晓，列表和说明书共用。 */
export function tacticRevealed(s: GameState, id: string): boolean {
    return s.tactics.learned.includes(id) || s.completed >= tacticDefinition(id).unlockWaves;
}
/** 列表、详情、红点及提交共用的纯预检；不改状态、不抽随机数、不发起资源加载。 */
export function tacticUnavailableReason(s: GameState, id: string, action: TacticAction): string | null {
    const t = tacticDefinition(id), learned = s.tactics.learned.includes(id);
    if (s.phase !== "DAY") return "天亮后可学习 / 更换";
    if (action === "EQUIP") return !learned ? "请先学习此战技" : s.tactics.equipped === id ? "已携带" : null;
    if (learned) return "已学会，无需重复学习";
    if (s.completed < t.unlockWaves) return `还需守住 ${t.unlockWaves - s.completed} 波`;
    const cap = storageCapacity(s);
    if (Math.max(t.wood, t.food) > cap) return `先修缮民居，当前仓储 ${cap}`;
    const wood = Math.max(0, t.wood - s.wood), food = Math.max(0, t.food - s.food);
    if (wood && food) return `还缺 ${wood} 木、${food} 粮`;
    if (wood) return `还缺 ${wood} 木`;
    if (food) return `还缺 ${food} 粮`;
    return null;
}
/** 只改调用者的候选状态；GameSession 将双材料、学习与携带作为同一笔存档提交。 */
export function applyTactic(s: GameState, id: string, action: TacticAction) {
    const reason = tacticUnavailableReason(s, id, action);
    requireRule(reason === null, reason!);
    if (action === "LEARN") {
        const t = tacticDefinition(id);
        s.wood -= t.wood; s.food -= t.food;
        s.tactics.learned.push(id);
    }
    s.tactics.equipped = id;
}
export function canLearnTactic(s: GameState): boolean {
    return TACTICS.some(t => !s.tactics.learned.includes(t.id) && tacticUnavailableReason(s, t.id, "LEARN") === null);
}
