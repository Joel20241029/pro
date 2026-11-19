/** 已确认的淡紫儿系统首轮数值。时间单位为战斗秒，调参后需复跑有无建筑的波次对照。 */
export const PATROL = {
    building: "粉红色的回忆", actor: "淡紫儿", role: "淡紫儿队长",
    unlock: 5, build: { wood: 45, food: 20 }, upgrade: { wood: 35, food: 15 },
    damage: 26, powerShare: .45, strongBonus: .15,
    first: 3, interval: 7.5, perLevel: .25, minimum: 4.5, nimbleBonus: .08,
    qualityHaste: { COMMON: 0, ELITE: .05, HERO: .10, LEGENDARY: .15 },
    maxActive: 4, speed: 92, lanes: [0, -.19, .19],
    /** 前十二波维持原难度；新增单位在基线出场窗口内分散，首领数值不变。 */
    pressure: { firstDay: 13, secondDay: 25, kinds: ["enemy_runner", "enemy_armored"] }
} as const;
