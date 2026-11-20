/** 各单位的外观使用独立混合域，新增巡防外观不会消耗村庄随机序列。 */
export const APPEARANCE_DOMAIN = { wave: 0x56495355, summon: 0x53554d4d, patrol: 0x50415452 } as const;
/** 32位整数混合，保存结果可在同一波重进/重试时复现；外观组合用取模而非额外业务抽签。 */
export function appearanceSeed(domain: number, ...values: number[]) {
    let seed = domain >>> 0;
    for (const value of values) { seed = Math.imul(seed ^ value, 0x45d9f3b); seed ^= seed >>> 16; }
    return seed >>> 0;
}
