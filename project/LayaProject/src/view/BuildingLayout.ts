export type BuildingLook = "HOUSE" | "FARM" | "LOGGING" | "GATE" | "ARROW" | "STONE" | "SLOW" | "PATROL" | "HEARTH";
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
/** 各等级共用同一个主体。原有住宅扩建仍用于升级提示和玩法容量。 */
export const PATROL_BOOTH_FRAME = "motion_patrol_icon";
export function buildingLayoutId(kind: BuildingLook) {
    return `${kind}_1_1`;
}
