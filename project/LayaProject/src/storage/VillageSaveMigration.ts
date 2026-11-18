import { RULE } from "../config/RuleConfig";
import type { Choice, GameState } from "../game/GameState";

/** 1.0.24 的双槽格式与当前相同，年度难度可选 0 至 3。该标识仅用于读取旧档。 */
export const ANNUAL_CHALLENGE_CONFIG = 17;
/** 旧版跨年分支的存档值。只在已核验的跨年清晨移除。 */
const ANNUAL_CHALLENGE = "TIER";
type AnnualChallengeSave = Omit<GameState, "choices"> & { choices: (Choice | { kind: typeof ANNUAL_CHALLENGE })[] };

/** 保留已排的来敌与塔位序号。转换只改变内存候选，原双槽字节留到正常提交。 */
export function migrateAnnualChallenge(payload: GameState): GameState {
    const old = payload as AnnualChallengeSave;
    if (!Number.isInteger(old.tier) || old.tier < 0 || old.tier > RULE.maxTier ||
        (old.wave && old.wave.tier !== old.tier) || !Array.isArray(old.choices))
        throw new Error("旧村庄的年度难度不合法");
    const choices = old.choices.filter((choice): choice is Choice => choice.kind !== ANNUAL_CHALLENGE);
    const retiredChoices = old.choices.length - choices.length;
    if (retiredChoices && (retiredChoices !== 1 || old.phase !== "DAWN" ||
        old.completed < RULE.yearDays || old.completed % RULE.yearDays !== 0))
        throw new Error("旧村庄的年度挑战状态不合法");
    return { ...old, tier: RULE.maxTier, choices,
        wave: old.wave ? { ...old.wave, tier: RULE.maxTier } : old.wave };
}
