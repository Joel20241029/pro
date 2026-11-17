/** 发布纹理尺寸，单位为像素，不是场景显示尺寸。
 * 依据：720逻辑宽，覆盖1440物理宽（2倍），最大精英/升级缩放后再留5%余量，向上取16倍数。
 * 2026-11-13核对全部108建筑布局及人物/怪物入口；见 doc/tech/33_纹理尺寸与包体优化.md。
 * 只缩规范化后的完整画布，不重新fit主体；修改场景最大尺寸时须重查本表，不能改母版或玩法。
 */
export const runtimeTextureSizes = {
    // 成人/老人最大90×1.25=112.5逻辑宽；孩子48×90/56×1.25=96.43；婴儿原192足够。
    // 劳动作画边界随武器取景增加，导入器在这些尺寸上乘同一倍率保持采样精度。
    characters: { adult: 240, child: 208, elder: 240, baby: 192, portrait: 384 },
    // 1.0.35 的首领显示再加 10%，取自高清母稿。保留 96 单位挂点、2 倍采样与 5% 余量，以 8 像素对齐。
    enemies: { raider: 200, runner: 200, armored: 200, boar: 184, disruptor: 200,
        chief: 320, commander: 328, wolfking: 320, tuskking: 336, shaman: 328 },
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
    }
};
