/** 淡紫儿之家出征配置。时间以战斗秒计，调参后用同种子对照漏门和出征人数。 */
export const PATROL = {
    building: "淡紫儿之家", actor: "淡紫儿", role: "淡紫队长", appoint: "任命淡紫队长",
    // 开村配发 1 级空岗；首次升级沿用原巡防升级费用。
    startLevel: 1, upgrade: { wood: 35, food: 15 },
    powerShare: .45, strongBonus: .15,
    first: 3, interval: 7.5, minimum: 4.5, nimbleBonus: .08,
    qualityHaste: { COMMON: 0, ELITE: .05, HERO: .10, LEGENDARY: .15 },
    // 1.0.71 单人规则只用于恢复已开始的旧夜战，保持数值、速度及碰撞轨迹。
    legacy: { damage: 26, perLevel: .25, maxActive: 4, speed: 46, lanes: [0, -.19, .19] },
    // 前三级扩队后再增伤。应玩家要求四档移动速度减半，仍按逻辑像素/战斗秒计算；在路时间改变可用队列名额。
    squad: { initialSize: 2, maxSize: 4, maxActive: 12, damage: 16,
        speeds: [19, 21.5, 24.5, 27], lanes: [-.30, .30, -.10, .10], delayTicks: [0, 4, 8, 13] },
    // 走过城门前这段逻辑距离后展到目标车道，沿用单人的道路约束。
    spreadDistance: 55,
    /** 前十二波维持原难度；新增单位在基线出场窗口内分散，首领数值不变。 */
    pressure: { firstDay: 13, secondDay: 25, kinds: ["enemy_runner", "enemy_armored"] }
} as const;
