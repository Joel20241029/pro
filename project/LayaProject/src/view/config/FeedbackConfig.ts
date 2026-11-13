/** 720逻辑画布的表现规格。秒均为可暂停的表现秒；不参与伤害、产出或存档。 */
export const FEEDBACK = {
    // 完整染红只保留0.14秒，仍能看清原有轮廓；多次命中重新计时。
    flashSeconds: .14, flashColor: '#ff6560',
    // 成人伐木序列为4帧、6FPS，第3帧落斧；复用原2D动作节奏，仅驱动树木反馈，不影响产出。
    chop: { villager_male_a_chop: { fps: 6, frames: 4, impact: 3 }, villager_female_a_chop: { fps: 6, frames: 4, impact: 3 } } as Record<string, { fps: number; frames: number; impact: number }>,
    tree: { degrees: 1.6, seconds: .32, oscillations: 1.5 }
} as const;
