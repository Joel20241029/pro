/** 720逻辑画布的表现规格。秒均为可暂停的表现秒；不参与伤害、产出或存档。 */
export const FEEDBACK = {
    // 完整染红只保留0.14秒，仍能看清原有轮廓；多次命中重新计时。
    flashSeconds: .14, flashColor: '#ff6560',
    // 视觉接触后短促衰减，位移是 720 画布像素。身体和挂件使用同一偏移，足点及阴影固定。
    hitShake: { seconds: .10, pixels: 4.2, cycles: 1.5 },
    // 用户指定压扁后完整停留0.5秒；两端各用短过渡。可暂停的实际表现秒，不随守夜倍速缩短，不参与结算。
    death: { squashSeconds: .12, scaleY: .22, holdSeconds: .5, fadeSeconds: .24 },
    // 让落点上的弹体至少停留一个30FPS画面；同帧refresh不会提前删掉接触姿态，不改变伤害时点。
    contactSeconds: .045,
    // 怪物接触和受击特效共用，按玩家要求在原 2 倍的基础上将显示宽高各增加 25%。
    impactScale: 2.5,
    // 共享命中帧 5 帧，保持箭塔、巡防和战技的原有时长。尺寸为 720 画布逻辑像素。
    impact: { fps: 24, frameCount: 5, size: { ARROW: 74, STONE: 85, SLOW: 80 } },
    // 连点与怜悯复用石弹帧。终场连点或巡防命中结束后留出渲染缓冲，再打开胜负面板。
    tacticBurst: { bodySizeScale: 1.12 },
    finalImpactSeconds: .28,
    // 最后一只怪物淡出后，胜利结算前保留的空场时间（真实表现秒）。
    victoryClearSeconds: .18,
    // 周博回血的红十字挂在受影响怪物头顶，按表现时间向上浮起并淡出。
    loveHeal: { seconds: .9, lift: 18, size: 28, stroke: 6, red: "#ff3943" },
    // 头顶状态并排占位，以逻辑画布像素计。间距按最宽的毒标留白，普通怪和首领共用同一显示尺寸。
    enemyStatus: { spacing: 34, lift: 24 },
    poisonMark: { size: 32 },
    frostMark: { size: 24, alpha: .84 },
    tree: { degrees: 1.6, seconds: .32, oscillations: 1.5 }
} as const;


/** 两类重击独立播放 8 帧，48px 局部母图的绘制尺寸再放大 25%。箭击沿用原表现。 */
export const TOWER_IMPACT = {
    ARROW: { clip: "fx_impact_arrow", fps: FEEDBACK.impact.fps, frameCount: FEEDBACK.impact.frameCount, displayScale: 1 },
    STONE: { clip: "fx_tower_stone_impact", fps: 16, frameCount: 8, displayScale: 1.25 },
    SLOW: { clip: "fx_tower_frost_impact", fps: 16, frameCount: 8, displayScale: 1.25 }
} as const;
