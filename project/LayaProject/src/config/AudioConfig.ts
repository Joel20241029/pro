/** 原生音乐只用一条循环，音量低于前景反馈；不随战斗倍速，遵循系统静音。 */
/** 原创单声道小音频；日间舒缓、夜间加快节奏，点击独立音轨。音量仅改变听感，不参与规则。 */
export const MUSIC = { file: "village_loop.mp3", battleFile: "battle_loop.mp3", clickFile: "ui_click.mp3", volume: .3, battleVolume: .28, clickVolume: .35 } as const;
