export type TowerKind = "ARROW" | "STONE" | "SLOW";
export type EnemyKind = "enemy_raider" | "enemy_runner" | "enemy_armored" | "enemy_disruptor" | "enemy_chief";
export const TOWERS = {
    ARROW: { name: "箭楼", damage: 12, interval: .8, range: 170, cost: 30, splash: 0, image: "building_tower_arrow" },
    STONE: { name: "石塔", damage: 22, interval: 1.6, range: 155, cost: 45, splash: 70, image: "building_tower_stone" },
    SLOW: { name: "寒塔", damage: 4, interval: 1.5, range: 150, cost: 35, splash: 60, image: "building_tower_slow" }
} as const;
export const ENEMIES = {
    enemy_raider: { name: "山匪", hp: 36, speed: 36, armor: 0, gate: 8, cost: 1, weight: 6, unlock: 1 },
    enemy_runner: { name: "疾行匪", hp: 24, speed: 70, armor: 0, gate: 6, cost: 2, weight: 3, unlock: 2 },
    enemy_armored: { name: "甲兵", hp: 160, speed: 22, armor: .4, gate: 18, cost: 5, weight: 2, unlock: 4 },
    enemy_disruptor: { name: "扰阵师", hp: 96, speed: 28, armor: 0, gate: 12, cost: 4, weight: 1, unlock: 7 },
    enemy_chief: { name: "匪首", hp: 480, speed: 18, armor: .2, gate: 40, cost: 12, weight: 0, unlock: 12 }
} as const;
/** 720×1280 的固定逻辑路径/塔位，首版地图配置；改变坐标会影响射程和到门时间。 */
export const PATH = [{ x: 360, y: 230 }, { x: 360, y: 350 }, { x: 250, y: 435 }, { x: 470, y: 550 }, { x: 360, y: 655 }, { x: 360, y: 760 }];
/** 2026-11-12用户箭头微调：左下向右50，右下向上40；最短150射程的四塔覆盖并集仍贯通道路。
 * 唯一坐标源同时驱动战斗、立绘、点击区、进塔与弹道；右下仍覆盖终点，再上移需重算，见doc/tech/14。
 */
export const PADS = [{ x: 255, y: 330 }, { x: 475, y: 460 }, { x: 300, y: 535 }, { x: 455, y: 650 }];
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
