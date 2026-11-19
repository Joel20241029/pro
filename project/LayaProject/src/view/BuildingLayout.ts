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
/** doc/tech/46：12档外观均匀分布于1～50级，之后固定最高档，数值继续成长。
 * 只选择表现，不参与价格、人口、战斗；保持编辑器中各建筑独立的范围与占地。
 */
export function buildingLayoutId(kind: BuildingLook, level: number, rooms = 1) {
    const stage = 1 + Math.floor(11 * (Math.min(50, Math.max(1, level)) - 1) / 49);
    return `${kind}_${stage}_${kind === "HOUSE" ? rooms : 1}`;
}
/** 保留佟楼扩建前 50 级的外观梯度，最多显示 3 间，住房容量独立结算。 */
export function houseRooms(houses: number) {
    const rooms = 2 + Math.floor(4 * (Math.min(50, Math.max(1, houses)) - 1) / 49);
    return Math.ceil(rooms / 2);
}
