export type ResourceBundle = "base" | "characters" | "battle";
/** 已确认三包边界（doc/tech/28）；base 属于主包，另外两项与发布分包 path 完全一致。 */
export const RESOURCE_BUNDLES = {
    base: { root: "resources/base", native: false, title: "村庄" },
    characters: { root: "resources/characters", native: true, title: "村民" },
    battle: { root: "resources/battle", native: true, title: "守夜" }
} as const;
/** 前台连续30秒没有进度才提示网络较慢；只提示，不伪造原生任务超时或启动重叠下载。 */
export const RESOURCE_SLOW_SECONDS = 30;
