export type ResourceStage = "village" | "night";
/** 保留 Laya 编辑器预览路径；微信构建在隔离项目中生成两个普通分包。 */
export const GAMEPLAY_ROOT = "resources/gameplay";
export const NATIVE_RESOURCE_ROOTS = { village: GAMEPLAY_ROOT + "/village", night: GAMEPLAY_ROOT + "/night" } as const;
/** 在绘制启动页时从微信主包读取，再开始准备村庄分包。 */
export const LAUNCHER_IMAGE = "resources/launcher.jpg";
/** 白天、守夜音乐和音效随微信主包导出，供原生音频直接读取。 */
export const MUSIC_ROOT = "resources/music";
/** 前台连续 30 秒没有进度提示网络较慢，继续等待当前任务完成。 */
export const RESOURCE_SLOW_SECONDS = 30;
/** 进村阶段的两个原生建筑时间轴与布局一同载入，守夜复用。 */
export const STAGE_METADATA = {
    village: ["map/frames.bin", "characters/animations.bin", "buildings/buildings.bin", "buildings/building_upgrade.mc", "buildings/building_attack.mc"],
    night: ["enemies/frames.bin", "enemies/animations.bin", "enemies/enemies.bin"]
} as const;
