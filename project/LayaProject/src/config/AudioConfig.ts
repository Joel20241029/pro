/** 原生音乐只用一条循环，音量低于前景反馈；不随战斗倍速，遵循系统静音。 */
/** 原创单声道小音频；日间舒缓、夜间加快节奏，点击独立音轨。音量仅改变听感，不参与规则。 */
export const MUSIC = { file: "village_loop.mp3", battleFile: "battle_loop.mp3", clickFile: "ui_click.mp3", volume: .3, battleVolume: .25, clickVolume: .35,
    // doc/tech/46：三塔共用短促发射音；按现实时间限频，最高档（实际倍率3）与齐射不叠成噪声，不参与战斗计时。
    towerFile: "tower_fire.mp3", towerVolume: .22, towerIntervalMs: 120
} as const;
