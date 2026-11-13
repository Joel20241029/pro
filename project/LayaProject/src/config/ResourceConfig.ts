export type ResourceBundle = "base" | "buildings" | "characters" | "battle";
/** 高清替换经确认增加建筑包（doc/tech/32）：base为UI/基础地图，建筑齐后显示完整村庄，人物随后加载，怪物守夜前加载。 */
export const RESOURCE_BUNDLES = {
    base: { root: "resources/base", native: false, title: "村庄" },
    buildings: { root: "resources/buildings", native: true, title: "村庄建筑" },
    characters: { root: "resources/characters", native: true, title: "村民" },
    battle: { root: "resources/battle", native: true, title: "守夜" }
} as const;
/** 前台连续30秒没有进度才提示网络较慢；只提示，不伪造原生任务超时或启动重叠下载。 */
export const RESOURCE_SLOW_SECONDS = 30;
