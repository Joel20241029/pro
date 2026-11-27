/** 原生音乐只用一条循环，音量低于前景反馈；不随战斗倍速，遵循系统静音。 */
/** 原创单声道小音频；日间舒缓、夜间加快节奏，点击独立音轨。音量仅改变听感，不参与规则。 */
export const MUSIC = { file: "village_loop.mp3", battleFile: "battle_loop.mp3", clickFile: "ui_click.mp3", volume: .3, battleVolume: .25, clickVolume: .35,
    // doc/tech/46：三塔共用短促发射音；按现实时间限频，最高档（实际倍率3）与齐射不叠成噪声，不参与战斗计时。
    tower: { file: "tower_fire.mp3", volume: .22, intervalMs: 120 },
    // 小怪和首领共用 0.43 秒喉音。两次播放留出 20 毫秒余量，密集击杀不会打断尾音。
    defeat: { file: "enemy_defeat.mp3", volume: .27, intervalMs: 450 },
    // 淡紫儿脱手后循环播放轻风声，音量低于落地瞬态；时长由真实在飞状态决定。
    patrolFlight: { file: "patrol_flight.mp3", volume: .24 },
    // 每次真实落地只产生一个事件，空砸和群体命中使用同一声，无需现实时间限频。
    patrolLanding: { file: "patrol_landing.mp3", volume: .36, intervalMs: 0 },
    // 机关枪每次实际扣弹播放一次发射声，使用原试听稿的音量。
    rapidFire: { file: "patrol_rapid_fire.mp3", volume: .30, intervalMs: 0 },
    // 所有英雄共用实际命中的短击声。50 毫秒间隔防重播，保留三倍速下相距约 83 毫秒的双瓶接触。
    heroHit: { file: "hero_hit.mp3", volume: .35, intervalMs: 50 },
    // 一袋落地只发一次餐盒与汤汁声，群伤不会叠音。
    deliverySplash: { file: "delivery_splash.mp3", volume: .38, intervalMs: 0 }
} as const;
