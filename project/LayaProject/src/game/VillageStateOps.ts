import { RULE, Trait } from "./GameConfig";
import { GameState } from "./GameState";
/** 命令、建村与结算共用的原有校验和状态操作；保持原异常与变更顺序。 */
export function requireRule(ok: unknown, message: string): asserts ok {
    if (!ok)
        throw new Error(message);
}
export function spend(s: GameState, resource: "food" | "wood", amount: number) { requireRule(s[resource] >= amount, `还缺 ${amount - s[resource]} ${resource === "food" ? "粮食" : "木材"}`); s[resource] -= amount; }
export function newId(s: GameState): string { requireRule(Number.isSafeInteger(s.nextPerson + 1), "人口编号已达安全范围"); return `${s.run}:${s.nextPerson++}`; }
export function remember(s: GameState, trait: Trait) {
    if (!s.legacy.traits.includes(trait))
        s.legacy.traits.push(trait);
}
export function pruneHistory(s: GameState) {
    const normal = s.history.filter(p => !s.favorites.includes(p.id)).slice(-RULE.historyCap);
    s.history = s.history.filter(p => s.favorites.includes(p.id) || normal.includes(p));
}
