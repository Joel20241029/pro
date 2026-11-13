/** 720逻辑画布的表现规格。秒均为可暂停的表现秒；不参与伤害、产出或存档。 */
export const FEEDBACK = {
    // 完整染红只保留0.14秒，仍能看清原有轮廓；多次命中重新计时。
    flashSeconds: .14, flashColor: '#ff6560', targetY: -20,
    // 按钮内缘距离、圆角和一周时长，避开底板边线与文字。
    button: { inset: 6, radius: 10, period: 2.6 },
    // 成人伐木序列为4帧、6FPS，第3帧落斧；复用原2D动作节奏，仅驱动树木反馈，不影响产出。
    chop: { villager_male_a_chop: { fps: 6, frames: 4, impact: 3 }, villager_female_a_chop: { fps: 6, frames: 4, impact: 3 } } as Record<string, { fps: number; frames: number; impact: number }>,
    tree: { degrees: 1.6, seconds: .32, oscillations: 1.5 },
    particles: { base: ['button_ready'], characters: ['elite_ring'], battle: ['hit_arrow', 'hit_stone', 'hit_ice', 'hit_gate'] } as Record<string, string[]>,
    attacks: { ARROW: { hit: 'hit_arrow' }, STONE: { hit: 'hit_stone' }, SLOW: { hit: 'hit_ice' } }
} as const;
