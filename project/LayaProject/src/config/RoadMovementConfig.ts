/** 路面分散行走参数，参考720宽地图；与当前放大后的最大足部占地一起校准。
 * 普通怪物半宽18、Boss半宽29，另有RoadGeometry内收6像素；不计向外伸出的武器和头饰。
 * back/front覆盖最短屏缩放下脚部相对排序点的纵向范围，碰撞体不随外观种子变化。
 * 修改会影响塔覆盖、溅射和扰阵距离，必须验证十类敌人及四塔×三塔种。
 */
export const ROAD_MOVEMENT = {
    ordinary: { halfWidth: 18, back: 24, front: 3 },
    boss: { halfWidth: 29, back: 36, front: 3 },
    // 黄金比例分布让相邻出生序号错开，不使用随机数，不改变经营/外观抽签或存档。
    laneStep: .6180339887498949, laneSpread: .94,
    // 参考y=680后平滑收拢至末段路心；到门仍按原PATH_LENGTH判断。
    gatherY: 680
} as const;
