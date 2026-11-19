/** 高清预渲染地图表现参数，单位为720逻辑画布。 */
export const WORLD_ART = {
    // 进村阶段的整图，将图集 pivot.y 当作墙脚线，随 GameLayout 映射战场和居民区。
    terrain: "map_scene",
    dayTint: "#ffffff", nightTint: "#9ca9bd",
    // 阴影贴图中心位于192画布约(96,142)，软边保留alpha。地面投影向右下偏移，照明来自左上。
    shadow: { centerX: .5, centerY: .74, actorWidth: .72, buildingWidth: .94, treeWidth: .88, alpha: .36, x: 4, y: 3 },
    // 复用百毅靓之怒的俯视红环，放在精英脚下压扁成地面椭圆。相位和尺寸仅为身份提示。
    // 正俯视小图在足底压成地面椭圆，由人物自然遮挡后缘。
    qualityRing: {
        frames: { ELITE: "fx_quality_elite", HERO: "fx_quality_hero", LEGENDARY: "fx_quality_legendary" },
        width: 59, heightRatio: .43, turnSeconds: 5.6, alpha: .88
    },
    // 高清牌面为256×144母画布，下方木桩不参与文字居中。
    sign: { x: .08, y: .18, width: .84, height: .22, font: 22 },
    // 原箭矢素材朝右上45度；显示时补偿这一角度，不改变飞行轨迹或逻辑命中。
    arrowAngleOffset: 45
} as const;
