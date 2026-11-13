/** 高清制作输入。这里只定义图片裁切/尺寸/共同足点，不定义玩法数值。
 * generated 为原始生成稿；directions/labor 为可编辑 Blender 源离线渲染。
 * 坚持真实方向，不通过镜像改变持物手或光源。未选中的 candidate 不发布。
 */
export const enemySources = {
    raider: [{ sheet: 'raider_front', columns: 2, cell: 0 }, { sheet: 'raider_front', columns: 2, cell: 1 }],
    runner: [0, 1, 2, 3].map(cell => ({ sheet: 'runner', columns: 4, cell })),
    armored: [0, 1, 2, 3].map(cell => ({ sheet: 'armored', columns: 4, cell })),
    boar: [0, 1].map(cell => ({ sheet: 'boar_front_impacts', crop: [cell * 768, 0, 768, 640] })),
    disruptor: [{ sheet: 'disruptor_front', columns: 2, cell: 0 }, { sheet: 'disruptor_front', columns: 2, cell: 1 }],
    chief: [{ sheet: 'chief_front_candidate', columns: 2, cell: 0 }, { sheet: 'chief_front_other', columns: 1, cell: 0 }],
    commander: [0, 1, 2, 3].map(cell => ({ sheet: 'commander', columns: 4, cell })),
    wolfking: [0, 1, 2, 3].map(cell => ({ sheet: 'wolfking', columns: 4, cell })),
    tuskking: [{ sheet: 'tuskking', columns: 4, cell: 0 }, { sheet: 'tuskking_opposite', columns: 1, cell: 0 }],
    shaman: [{ sheet: 'shaman', columns: 4, cell: 0 }, { sheet: 'shaman_opposite', columns: 1, cell: 0 }]
};
/** 四个结构档对应既有1/4/8/12级；中间等级在同一主体上增添结构件。 */
export const buildingSheets = {
    ARROW: 'arrow_bases', STONE: 'stone_bases', SLOW: 'frost_bases',
    HOUSE: 'houses', FARM: 'farms_ground', LOGGING: 'logging', GATE: 'gates'
};
export const componentCells = [
    'bow_right', 'bow_left', 'sling', 'crystals',
    'rivet', 'banner', 'foundation', 'crest',
    'wheel', 'lantern', 'grain', 'brace'
];
export const iconCells = [
    'food', 'wood', 'population', 'build', 'house', 'logging', 'family', 'heart',
    'arrow', 'stone', 'slow', 'shield', 'baby', 'view', 'trophy', 'close'
];
export const detailCells = [
    'fx_arrow', 'fx_stone', 'fx_ice', 'fx_hearts',
    'emote_happy', 'emote_proud', 'emote_sleepy', 'emote_peaceful',
    'emote_loving', 'emote_curious', 'deco_pear_pair', 'deco_blossom_ivory'
];
/** 保留完整渐变中心，不再压成两像素的中心行。四边为实际固定边缘像素。 */
export const panelCells = [
    'panel_button_green', 'panel_button_gold', 'panel_anchored_tip', 'panel_button_disabled',
    'panel_button_red', 'panel_parchment', 'panel_card', 'panel_tip'
];
export const environmentSources = [
    { id: 'deco_tree_oak', source: 'design/hd2d/environment/tree_oak_layers.png', crop: [140, 60, 956, 824] },
    { id: 'deco_tree_pine', source: 'design/hd2d/environment/tree_pine_layers.png', crop: [280, 53, 614, 850] },
    { id: 'deco_village_sign', source: 'design/hd2d/environment/sign.png', crop: [70, 44, 1627, 808], width: 256, height: 144 },
    { id: 'deco_rocks', source: 'design/hd2d/environment/rock_cluster.png', crop: [142, 178, 920, 923] },
    { id: 'deco_blossom_pink', source: 'design/hd2d/environment/flower.png', crop: [153, 102, 981, 956], width: 96, height: 96 },
    { id: 'deco_apple_pair', source: 'design/hd2d/environment/fruit_apple.png', crop: [96, 58, 320, 383], width: 96, height: 96, alphaCutoff: 0 }
];
