export type BuildingLook = "HOUSE" | "FARM" | "LOGGING" | "GATE" | "ARROW" | "STONE" | "SLOW";
/** 编辑器 Sprite 的已验证属性子集，转换器拒绝其余属性，运行时不猜测纹理或布局。 */
export interface BuildingNode {
    name: string; frame?: string; clip?: "upgrade" | "attack"; children?: BuildingNode[];
    x?: number; y?: number; width?: number; height?: number; anchorX?: number; anchorY?: number;
    scaleX?: number; scaleY?: number; rotation?: number; alpha?: number; visible?: boolean;
}
export interface BuildingRegion { x: number; y: number; width: number; height: number; }
export interface BuildingDefinition extends BuildingNode {
    bounds: BuildingRegion; footprint: BuildingRegion; sort: { x: number; y: number }; aboveFootprint?: BuildingRegion;
}
/** 水车唯一的固定预留底座（128源画布坐标），对应编辑器 AboveFootprint。
 * 从开村起预留，升级时不挤开人物；田畦其余区域仍可耕作。转换结果由范围测试核对。
 */
export const FARM_WHEEL_FOOTPRINT: BuildingRegion = { x: 91, y: 85, width: 26, height: 8 };
/** 1～12级逐级变化，后续循环四种同档高级主体，防止无限扩大占地，等级数始终精确显示。
 * 来源：tech/23。只选择表现，不参与价格、人口、战斗。修改须同步布局覆盖测试。
 */
export function buildingLayoutId(kind: BuildingLook, level: number, rooms = 1) {
    const stage = level <= 12 ? level : 9 + (level - 13) % 4;
    return `${kind}_${stage}_${kind === "HOUSE" ? rooms : 1}`;
}
/** 两个住宅根分摊真实房数：2→1+1，3→2+1，4→2+2，5→3+2，保持原导航占地。 */
export function houseRooms(houses: number, second: boolean) { return second ? Math.floor(houses / 2) : Math.ceil(houses / 2); }
