/** 高清预渲染地图表现参数，单位为720逻辑画布；不参与PATH、射程、产出或存档。
 * 道路母图按参考720×1065画布绘制，足点仍取既有世界坐标；草地只平铺，不拉长纹理。
 */
export const WORLD_ART = {
    grassTile: 512, roadWidth: 720, roadHeight: 1065,
    dayTint: "#ffffff", nightTint: "#9ca9bd",
    // 参考图的城墙脚横向土路：锚定830墙脚，前后覆盖至门内；高度固定，避免长屏拉成宽土带。
    // 左右略超出画布使渐隐端藏在林带/屏幕边，单独地面层不改变PATH、寻路或城门占地。
    gateLane: { x: -12, anchorY: 830, top: -12, width: 744, height: 56 },
    // 六组路边石头复用同一贴图，大小29~42（原36），交错水平翻转；原画布底边中心保持不动。
    // 固定表现布置，不使用随机数，不改变道路、塔位或通行范围。
    rocks: { referenceSize: 36, placements: [
        { x: 182, y: 399, size: 32, scaleX: 1 }, { x: 530, y: 470, size: 39, scaleX: -1 },
        { x: 173, y: 591, size: 34, scaleX: -1 }, { x: 560, y: 643, size: 42, scaleX: 1 },
        { x: 297, y: 628, size: 29, scaleX: 1 }, { x: 411, y: 356, size: 36, scaleX: -1 }
    ] },
    // 阴影贴图中心位于192画布约(96,142)，软边保留alpha。地面投影向右下偏移，照明来自左上。
    shadow: { centerX: .5, centerY: .74, actorWidth: .72, buildingWidth: .94, treeWidth: .88, alpha: .36, x: 4, y: 3 },
    // 高清牌面为256×144母画布，下方木桩不参与文字居中。
    sign: { x: .08, y: .18, width: .84, height: .22, font: 22 },
    // 原箭矢素材朝右上45度；显示时补偿这一角度，不改变飞行轨迹或逻辑命中。
    arrowAngleOffset: 45
} as const;
