/** 发布纹理尺寸，单位为像素，不是场景显示尺寸。
 * 其他纹理按720逻辑宽覆盖1440物理宽，最大升级缩放后再留5%余量。
 * 2026-11-13核对全部108建筑布局及人物/怪物入口；见 doc/tech/33_纹理尺寸与包体优化.md。
 * 只缩规范化后的完整画布，不重新fit主体；修改场景最大尺寸时须重查本表，不能改母版或玩法。
 */
export const runtimeTextureSizes = {
    // 按390逻辑宽/3倍屏对照，村民动画从母版以旧宽高的一半重采样。
    // 劳作仍按动作取景倍率扩画布，头像仍用384像素供详情面板展示。
    characters: { adult: 120, child: 104, elder: 120, baby: 96, portrait: 384 },
    // 十种怪物和独立配饰按1.0.49发布宽高各减半，96单位挂点和帧序沿用已校准布局。
    enemies: { raider: 100, runner: 100, armored: 100, boar: 92, disruptor: 100,
        chief: 160, commander: 164, wolfking: 160, tuskking: 168, shaman: 164 },
    enemyParts: { enemy_acc_band: 72, enemy_acc_antlers: 80, enemy_acc_feathers: 48,
        enemy_acc_mask: 40, enemy_acc_banner: 72, enemy_acc_leaves: 136 },
    // 箭塔主体和双向弩机按1.0.49发布宽高各减半，显示尺寸仍取原生预制体。
    buildingParts: {
        hd_arrow_body_0: 120, hd_arrow_body_1: 128, hd_arrow_body_2: 128, hd_arrow_body_3: 128,
        hd_part_bow_left: 96, hd_part_bow_right: 96, hd_stone_body_0: 240, hd_slow_body_0: 240,
        // 村内主体和独占配件取1.0.48发布宽度的一半，编辑器显示尺寸继续用各自的128单位布局。
        hd_house_body_0: 128, hd_house_body_1: 128, hd_house_body_2: 128, hd_house_body_3: 128,
        hd_farm_body_0: 128, hd_farm_body_1: 128, hd_farm_body_2: 128, hd_farm_body_3: 128,
        hd_gate_body_0: 128, hd_gate_body_1: 128, hd_gate_body_2: 128, hd_gate_body_3: 128,
        hd_logging_body_0: 120, hd_logging_body_1: 120, hd_logging_body_2: 120, hd_logging_body_3: 120,
        hd_part_sling: 144, hd_part_crystals: 112, hd_part_rivet: 48, hd_part_banner: 96,
        hd_part_foundation: 64, hd_part_crest: 112, hd_part_wheel: 80, hd_part_lantern: 40,
        hd_part_grain: 48, hd_part_brace: 80,
        hd_house_wing_0: 72, hd_house_wing_1: 72, hd_house_wing_2: 72, hd_house_wing_3: 72,
        hd_gate_doors_0: 80, hd_gate_doors_1: 80, hd_gate_doors_2: 80, hd_gate_doors_3: 80,
        deco_torch: 96, building_hearth_lit: 96, hearth_burn_2: 96, hearth_burn_3: 96, hearth_burn_4: 96
    }
};
