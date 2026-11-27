import { HERO } from "./HeroConfig";

const XUYONG = "旭勇";

/** 本夜采用沿路索敌。已开打的旧夜以原巡路快照重演。 */
export const DELIVERY_PATROL_HUNT = "ROUTE_HUNT";

/** 第二名英雄在村委会一次招募。粮木费用与门槛让首五夜仍由智卓和原防线承担。 */
export const DELIVERY_HERO = {
    actorId: "Hero:delivery",
    name: `大王·${XUYONG}`,
    givenName: XUYONG,
    portrait: "delivery_portrait",
    spritePrefix: "hero_delivery",
    lore: "旭勇一单一单把粮木送进文明里村，成了村里的先贤。村民没见他歇过脚，只见他停下来找零，便叫他外卖大王。",
    attackName: "外卖加急",
    recruitment: { waves: 6, wood: 60, food: 40 },
    // 先骑到路肩。面板显示的是下车后的有效投掷窗口与进门后实际休息时间。
    fightSeconds: 12, restSeconds: 11, transitionSeconds: .36,
    rideSpeed: 130, parkingLead: 105, roadShoulder: 4,
    // 首夜基准低于石弹；同波体质等比成长。两秒一袋限制群伤的持续产出。
    damage: 14, splashRatio: .5, splashTargets: 2, range: 185, radius: 64,
    intervalSeconds: 2, windupSeconds: .36, flightSeconds: .52,
    // 单英雄夜战降低投掷频率，扩大群伤与有效出战窗口以补偿。旧夜重放保留上面的数值。
    solo: { damage: 26, intervalSeconds: 3.2, fightSeconds: 20, restSeconds: 8,
        range: 220, radius: 76, splashTargets: 4, splashRatio: .6 },
    // 骑车沿用智卓当前实际步速。实测两侧路肩外移 10 像素、y655–760 不碰塔底。
    patrol: { rideSpeed: HERO.walkSpeed * HERO.extendedMovementScale * HERO.slowerPace, walkSpeed: 46,
        shoulder: 10, stops: [665, 700, 735], nearY: 760, farY: 655, stride: 12, gateHalfWidth: 41,
        // 两个单人投掷射程的路程约抵一只近敌的选位权重，让大王肯绕几步接近被前排塔拦下的怪群。
        parkingTravelWeight: 440,
        // 按投掷射程观察战况。冷却时走一小段再看怪群，始终留出返回电动车的时间。
        scanSeconds: .8, leash: 58,
        // 外卖与冰塔分别计时，实际移速只取当前较强的减速。
        slow: .20, slowSeconds: 2.4 },
    // 左右线贴着路面走，门前 45 像素并线。投掷落地后走 30 像素再出手，足够看清换位。
    hunt: { laneOffset: .20, gateMergeDistance: 45, stepAfterThrow: 30 },
    // 村门内侧的车位。进出从村内门心转弯，避开门柱和右栅栏。
    garage: { x: 454, y: 852 },
    // 预瞄按目标当前移速估算飞行窗口的三分之二；图效和命中共用固定点。
    lead: .66, directTolerance: 32
} as const;
