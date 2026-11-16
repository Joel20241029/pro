/** 发布纹理尺寸，单位为像素，不是场景显示尺寸。
 * 依据：720逻辑宽，覆盖1440物理宽（2倍），最大精英/升级缩放后再留5%余量，向上取16倍数。
 * 2026-11-13核对全部108建筑布局及人物/怪物入口；见 doc/tech/33_纹理尺寸与包体优化.md。
 * 只缩规范化后的完整画布，不重新fit主体；修改场景最大尺寸时须重查本表，不能改母版或玩法。
 */
export const runtimeTextureSizes = {
    // 成人/老人最大90×1.25=112.5逻辑宽；孩子48×90/56×1.25=96.43；婴儿原192足够。
    characters: { male: 240, female: 240, child: 208, elder: 240, baby: 192 },
    // 1.0.18小怪再放大15%、Boss再放大25%：最大134.55逻辑px，2倍采样+5%需282.56px。
    // 规范化画布直接从原始高清稿重新取样，96单位原生布局/挂件和足点不变。
    enemies: { raider: 192, runner: 192, armored: 192, boar: 176, disruptor: 192,
        chief: 272, commander: 272, wolfking: 272, tuskking: 288, shaman: 272 },
    // 配件实际宽高取enemy-layouts.mjs每帧矩形；叶饰最大92/96×134.55，2倍+5%取272。
    enemyParts: { enemy_acc_band: 144, enemy_acc_antlers: 160, enemy_acc_feathers: 96,
        enemy_acc_mask: 80, enemy_acc_banner: 144, enemy_acc_leaves: 272 },
    // 从全部等级/房数布局测最大宽高，含升级1.08倍。未列的主体/弓弩保留原尺寸。
    buildingParts: {
        hd_arrow_body_0: 240, hd_stone_body_0: 240, hd_slow_body_0: 240,
        hd_logging_body_0: 240, hd_logging_body_1: 240, hd_logging_body_2: 240, hd_logging_body_3: 240,
        hd_part_sling: 144, hd_part_crystals: 112, hd_part_rivet: 48, hd_part_banner: 96,
        hd_part_foundation: 64, hd_part_crest: 112, hd_part_wheel: 160, hd_part_lantern: 80,
        hd_part_grain: 96, hd_part_brace: 80,
        hd_house_wing_0: 144, hd_house_wing_1: 144, hd_house_wing_2: 144, hd_house_wing_3: 144,
        hd_gate_doors_0: 160, hd_gate_doors_1: 160, hd_gate_doors_2: 160, hd_gate_doors_3: 160
    },
    // 旅人头像可放大到210逻辑宽并按可见框铺满，独立保留原静止图，不能随世界帧降采样。
    portraitFrames: ['hd_male_down_idle', 'hd_female_down_idle', 'hd_child_down_idle', 'hd_elder_idle_1', 'hd_baby_idle_1']
};
