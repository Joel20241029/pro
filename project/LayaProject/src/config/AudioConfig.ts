/** 原生音乐只用一条循环，音量低于前景反馈；不随战斗倍速，遵循系统静音。 */
/** 原创单声道小音频；日间舒缓、夜间加快节奏，点击独立音轨。音量仅改变听感，不参与规则。 */
export const MUSIC = { file: "village_loop.mp3", battleFile: "battle_loop.mp3", clickFile: "ui_click.mp3", volume: .3, battleVolume: .25, clickVolume: .35,
    // doc/tech/46：三塔共用短促发射音；按现实时间限频，最高档（实际倍率3）与齐射不叠成噪声，不参与战斗计时。
    tower: { file: "tower_fire.mp3", volume: .22, intervalMs: 120 },
    // 小怪和首领共用 0.43 秒喉音。两次播放留出 20 毫秒余量，密集击杀不会打断尾音。
    defeat: { file: "enemy_defeat.mp3", volume: .27, intervalMs: 450 }
} as const;
