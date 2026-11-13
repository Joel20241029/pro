export type TowerKind = "ARROW" | "STONE" | "SLOW";
export const TOWERS = {
    ARROW: { name: "箭楼", damage: 12, interval: .8, range: 170, cost: 30, splash: 0, image: "building_tower_arrow" },
    STONE: { name: "石塔", damage: 22, interval: 1.6, range: 155, cost: 45, splash: 70, image: "building_tower_stone" },
    SLOW: { name: "寒塔", damage: 4, interval: 1.5, range: 150, cost: 35, splash: 60, image: "building_tower_slow" }
} as const;
/** 720×1280 的固定逻辑路径/塔位，首版地图配置；改变坐标会影响射程和到门时间。 */
export const PATH = [{ x: 360, y: 230 }, { x: 360, y: 350 }, { x: 250, y: 435 }, { x: 470, y: 550 }, { x: 360, y: 655 }, { x: 360, y: 760 }];
/** 2026-11-13按高清道路真实边缘与72×20塔基地调整，短长屏下保留相近草地间距。
 * 唯一坐标源同时驱动战斗、立绘、点击区、进塔与弹道；位置改变会改变覆盖起止，须验证4位置×3塔种。
 */
export const PADS = [{ x: 210, y: 330 }, { x: 470, y: 450 }, { x: 300, y: 560 }, { x: 505, y: 660 }];
/** 原 WaveGenerator 中的波次预算和词缀参数，键序仍由原 ENEMIES 决定。
 * 按原调用位置取随机数，不增加抽样；改值会改变战前存档重演与难度，须升配置版本。
 */
export const WAVE = {
    baseBudget: 8, dailyBudget: 2, yearlyBudget: 6, boostedYears: 2, tierBudget: 8,
    affixStartDay: 7, affixes: ["NONE", "FAST", "STURDY", "GROUP"], seasonalWeight: 2, groupSize: 3
} as const;
/** 原 BattleSimulation 的词缀、天赋、专长及减速参数，单位为倍率/逻辑距离/战斗步。
 * 保留原加法、乘法、取整与扣减顺序；本表只替代散落字面量，不改变战斗规则。
 */
export const COMBAT = {
    fastHealth: .9, sturdyHealth: 1.15, fastSpeed: 1.1, sturdySpeed: .9,
    nimbleSpeed: .1, focusedSpeed: .15, farsightRange: .15, disruptRange: 190,
    strongDamage: .2, throwingDamage: .25, archeryDamage: .25, stoneArmorDivisor: 2,
    slowMax: .6, slowBase: .3, patientSlow: .1, wardingSlow: .1, shotLifetimeTicks: 5
} as const;
