/** 高清预渲染地图表现参数，单位为720逻辑画布；不参与PATH、射程、产出或存档。
 * 道路母图按参考720×1065画布绘制，足点仍取既有世界坐标；草地只平铺，不拉长纹理。
 */
export const WORLD_ART = {
    grassTile: 512, roadWidth: 720, roadHeight: 1065,
    dayTint: "#ffffff", nightTint: "#9ca9bd",
    // 阴影贴图中心位于192画布约(96,142)，软边保留alpha。地面投影向右下偏移，照明来自左上。
    shadow: { centerX: .5, centerY: .74, actorWidth: .72, buildingWidth: .94, treeWidth: .88, alpha: .36, x: 4, y: 3 },
    // 高清牌面为256×144母画布，下方木桩不参与文字居中。
    sign: { x: .08, y: .14, width: .84, height: .22, font: 22 },
    // 原箭矢素材朝右上45度；显示时补偿这一角度，不改变飞行轨迹或逻辑命中。
    arrowAngleOffset: 45
} as const;
