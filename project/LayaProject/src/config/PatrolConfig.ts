/** 玩家在之家选择的守夜打法，也是存档标识。缺少选择的村庄沿用旋甩；变更标识会影响旧档。 */
export const PATROL_MODE = { spin: "spin", rapid: "rapid" } as const;
export type PatrolMode = typeof PATROL_MODE[keyof typeof PATROL_MODE];

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
    // 每次出征只派一人。沿用半速的四档步速（逻辑像素/战斗秒）、车道和在场上限。
    squad: { maxActive: 12, damage: 16, speeds: [19, 21.5, 24.5, 27], lanes: [-.30, .30, -.10, .10] },
    // 走过城门前这段逻辑距离后展到目标车道，沿用单人的道路约束。
    spreadDistance: 55,
    // 城门连发按实际操作秒计时。一级八发，此后每升一级加三发，延长一仓可连射的时间。
    rapid: {
        name: "淡紫儿突突队", capacity: 8, roundsPerLevel: 3, shotsPerSecond: 4, reloadSeconds: 4,
        // 连发单发基于同级无道具旋甩伤害。按首夜常见袭村怪 35 生命校准，普通队长一级每发 20，两发击倒。
        damageShare: 1.25,
        // 标准地图的城门转台和枪口；触摸时表现层提供当前屏幕对应的屋顶投影。弹速以参考像素/现实秒计。
        origin: { x: 360, y: 777 }, muzzleDistance: 104, speed: 700,
        // 小人撞到角色躯干即退场；碰撞中心从脚底上移，首领按较大的形体对齐。
        ordinaryCenterHeight: 22, bossCenterHeight: 35,
        // 单发扫掠的躯干椭圆半轴（地图逻辑像素）。在 1.0.113 的判定上横纵各扩大 50%，分别匹配普通怪和首领的体型。
        contact: { ordinary: { x: 48, y: 28.5 }, boss: { x: 66, y: 37.5 } }
    },
    // 双人旋转按战斗步推进。冷却来自补员，后期每级仍加伤害，补员趋近保底时间。
    spin: {
        name: "淡紫儿飞速旋转",
        // 瞄准采用固定守夜常速的一半。弧顶与横摆以逻辑像素计，只影响飞行演出。
        aimSpeedRatio: .5, arcHeight: 155, arcSway: 70,
        damageGrowth: .16, earlyDamageGrowth: .24,
        // 以两人到位为准，从开战或前一组落地开始计时。首级 4.5 秒，队长或升级可缩短。
        interval: 4.5, intervalGrowth: .16, intervalFloor: 3.2, minimum: 2.8,
        // 落地按足点判断圈内所有活怪。半径为地图参考像素，调整会改变命中范围。
        radius: 90,
        // 门内集合点与之家入口用地图参考像素。集合步速独立于旧版撞怪出征。
        house: { x: 226, y: 940 }, houseExit: { x: 274, y: 945 }, center: { x: 360, y: 910 },
        exitOffset: 9, shoulder: 43, orbitDepth: 19, walkSpeeds: [72, 78, 82, 87],
        flight: 1.7, flightByDistance: .55,
        // 地图参考坐标横跨战场与村内。拖拽用 GameLayout 投影，伤害始终在参考坐标计算。
        map: { width: 720, top: 140, bottom: 1038 },
        // 新玩法启用的夜战从第 13 波加 3% 普通来敌生命，到第 30 波过渡为 5%。
        pressure: { from: 13, full: 30, start: .03, maximum: .05 }
    },
    /** 前十二波维持原难度；新增单位在基线出场窗口内分散，首领数值不变。 */
    pressure: { firstDay: 13, secondDay: 25, kinds: ["enemy_runner", "enemy_armored"] }
} as const;
