export type BuildingLook = "HOUSE" | "GATE" | "CANNON" | "PATROL" | "HEARTH";
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
/** 各等级共用同一个主体。原有住宅扩建仍用于升级提示和玩法容量。 */
export const PATROL_BOOTH_FRAME = "motion_patrol_icon";
export function buildingLayoutId(kind: BuildingLook) {
    return `${kind}_1_1`;
}
