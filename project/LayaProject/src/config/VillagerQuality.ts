import { RULE } from "./RuleConfig";

/** 每人固定拥有 1/2/2/3 项不同天赋；英雄与精英的差异另由产出、战力和寿命决定。 */
export const VILLAGER_QUALITY = {
    COMMON: { label: "普通", traitCount: 1, minWins: 0, birth: 0, traveler: 0, production: 1, damage: 1, adultNights: RULE.adultNights, elderNights: RULE.elderNights, scale: 1 },
    ELITE: { label: "精英", traitCount: 2, minWins: 0, birth: 15, traveler: 45, production: 1.5, damage: 1.25, adultNights: 18, elderNights: 5, scale: 1.25 },
    HERO: { label: "英雄", traitCount: 2, minWins: 12, birth: 3, traveler: 7, production: 1.7, damage: 1.4, adultNights: 20, elderNights: 6, scale: 1.36 },
    LEGENDARY: { label: "传说", traitCount: 3, minWins: 30, birth: 1, traveler: 3, production: 1.9, damage: 1.55, adultNights: 22, elderNights: 7, scale: 1.48 }
} as const;

export type VillagerQuality = keyof typeof VILLAGER_QUALITY;
const SPECIAL_QUALITIES = ["ELITE", "HERO", "LEGENDARY"] as const;
/** 继续使用原来的百分率随机档位；新增档从普通区间划出，精英原档位不变。 */
export const QUALITY_CHANCE_SCALE = 100;
export function rollVillagerQuality(roll: number, completed: number, source: "birth" | "traveler"): VillagerQuality {
    for (const quality of SPECIAL_QUALITIES) {
        const rule = VILLAGER_QUALITY[quality];
        if (completed < rule.minWins) continue;
        roll -= rule[source];
        if (roll < 0) return quality;
    }
    return "COMMON";
}
