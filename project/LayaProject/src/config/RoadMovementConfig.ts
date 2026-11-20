/** 路面分散行走参数，参考720宽地图；与当前放大后的最大足部占地一起校准。
 * 普通怪物半宽18、Boss半宽29，另有RoadGeometry内收6像素；不计向外伸出的武器和头饰。
 * back/front覆盖最短屏缩放下脚部相对排序点的纵向范围，碰撞体不随外观种子变化。
 * 修改会影响塔覆盖、溅射和扰阵距离，必须验证十类敌人及五塔×三塔种。
 */
export const ROAD_MOVEMENT = {
    ordinary: { halfWidth: 18, back: 24, front: 3 },
    boss: { halfWidth: 29, back: 36, front: 3 },
    // 左、右、中三条带的横向距离，带内继续用黄金比例按序号错开。
    laneBands: [-.43, .43, 0], laneStep: .6180339887498949, laneJitter: .13,
    // 每七名入场怪物共用一个倾向车道，约一半走偏向车道，其余两路均分。提高占比会改变局部溅射和索敌密度。
    formation: { size: 7, mainWeight: 50, secondWeight: 25, sampleSize: 100, seedDomain: 0x524f4144 },
    // 允许外侧怪物稍跨路肩。逻辑画布放宽 14，扣除原剖面内收 6 后最多约 8 像素踏入草边；再放宽会漏掉第一塔位寒塔的射程。
    shoulderAllowance: 14,
    // 参考 y=700 后平滑收拢，门前保留更多横向错落，到门仍按原 PATH_LENGTH 判断。
    gatherY: 700
} as const;
