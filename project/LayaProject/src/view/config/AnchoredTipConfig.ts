import { UI } from "../UiTheme";

/** 已确认的建筑文字气泡，单位为720宽设计像素；小九宫格与独立指角保持像素边缘。
 * 箭头尖端为缩放原点，8px屋顶间隔避免压住建筑；字体/内边距只影响阅读与美术。
 */
export const ANCHORED_TIP = {
    bodyFrame: "panel_anchored_tip", tailFrame: "panel_anchored_tip_tail",
    width: 120, height: 64, inset: 12, font: 28,
    tailWidth: 20, tailHeight: 14, tailOverlap: 6, roofGap: 8,
    // 总时长沿用用户确认的2秒；出现/收起阶段沿原短提示节奏，改用以指角尖端为原点的缩放。
    seconds: UI.tipSeconds, growSeconds: .16, shrinkSeconds: .28
} as const;

/** 两栋现有住宅的显示名，不表示居民归属或增加房数；扩建仍沿用原建筑根。 */
export const HOUSE_TIP_NAMES: Readonly<Record<string, string>> = {
    "building:house-a": "佟楼",
    "building:house-b": "南楼"
};
