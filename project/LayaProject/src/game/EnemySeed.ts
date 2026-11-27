import { TOWER_FLAGS } from "../config/DefenseConfig";

/** 各单位的外观使用独立混合域，装饰不会消耗村庄随机序列。 */
export const APPEARANCE_DOMAIN = { wave: 0x56495355, summon: 0x53554d4d, patrol: 0x50415452, towerFlag: 0x464c4147 } as const;
/** 32位整数混合，保存结果可在同一波重进/重试时复现；外观组合用取模而非额外业务抽签。 */
export function appearanceSeed(domain: number, ...values: number[]) {
    let seed = domain >>> 0;
    for (const value of values) { seed = Math.imul(seed ^ value, 0x45d9f3b); seed ^= seed >>> 16; }
    return seed >>> 0;
}
/** 新建时混入世界种子并保存。初始塔和早期存档以村号和塔位决定固定样式。 */
export function towerFlag(run: number, slot: number, buildSeed = 0) {
    return TOWER_FLAGS[appearanceSeed(APPEARANCE_DOMAIN.towerFlag, run, slot, buildSeed) % TOWER_FLAGS.length];
}
