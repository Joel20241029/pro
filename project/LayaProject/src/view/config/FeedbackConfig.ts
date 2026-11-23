/** 720逻辑画布的表现规格。秒均为可暂停的表现秒；不参与伤害、产出或存档。 */
export const FEEDBACK = {
    // 完整染红只保留0.14秒，仍能看清原有轮廓；多次命中重新计时。
    flashSeconds: .14, flashColor: '#ff6560',
    // 视觉接触后短促衰减，位移是 720 画布像素。身体和挂件使用同一偏移，足点及阴影固定。
    hitShake: { seconds: .10, pixels: 4.2, cycles: 1.5 },
    // 淡紫落地对实际命中的怪单独加重反馈，720 画布像素，不参与塔弹或伤害计算。
    patrolHit: { seconds: .26, shakeSeconds: .19, pixels: 13, cycles: 2, frameSizeScale: 1.48,
        // 旋甩落地的径向回弹，约一帧起动后向外到顶，再回到站位。数值是屏幕逻辑像素。
        recoilSeconds: .28, recoilPeak: .075, commonRecoil: 26, bossRecoil: 14 },
    // 淡紫旋甩直接击杀才会翻转一周。按评审提高升空高度和弹开距离，并延长滞空给玩家看清落地。
    // 距离和高度为屏幕逻辑像素，秒数仅影响死亡演出和等待演出结束的结算。
    patrolDeath: { airSeconds: .78, bossAirSeconds: .85, distance: 88, bossDistance: 52, lift: 120,
        bossLift: 83, turns: 1, squashSeconds: .09, holdSeconds: .18, fadeSeconds: .30, scaleY: .27 },
    // 用户指定压扁后完整停留0.5秒；两端各用短过渡。可暂停的实际表现秒，不随守夜倍速缩短，不参与结算。
    death: { squashSeconds: .12, scaleY: .22, holdSeconds: .5, fadeSeconds: .24 },
    // 让落点上的弹体至少停留一个30FPS画面；同帧refresh不会提前删掉接触姿态，不改变伤害时点。
    contactSeconds: .045,
    // 其他战技特效仍用既有倍率。三塔命中独立使用定稿尺寸。
    impactScale: 2.5,
    // 共享命中帧 5 帧，保持箭塔、巡防和战技的原有时长。尺寸为 720 画布逻辑像素。
    impact: { fps: 24, frameCount: 5 },
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


/** 定稿在 128 px 画布绘制，运行画布宽高放大 25%。使用完整源画布和同一锚点，
 * 保持不同帧的有效轮廓比例。仅用于三塔命中及复用箭击的表现。 */
const TOWER_IMPACT_SIZE = 128 * 1.25;
export const TOWER_IMPACT = {
    ARROW: { clip: "fx_impact_arrow", fps: FEEDBACK.impact.fps, frameCount: FEEDBACK.impact.frameCount, size: TOWER_IMPACT_SIZE },
    STONE: { clip: "fx_tower_stone_impact", fps: 28, frameCount: 8, size: TOWER_IMPACT_SIZE },
    SLOW: { clip: "fx_tower_frost_impact", fps: 30, frameCount: 8, size: TOWER_IMPACT_SIZE }
} as const;
