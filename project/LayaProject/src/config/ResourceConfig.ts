export type ResourceStage = "village" | "night";
/** 供 Laya 编辑器预览。微信发布版将 gameplay 整组导出在包外。 */
export const GAMEPLAY_ROOT = "resources/gameplay";
/** 在绘制启动页时从微信主包读取，再开始准备远程资源。 */
export const LAUNCHER_IMAGE = "resources/launcher.jpg";
/** 白天、守夜音乐和音效随微信主包导出，供原生音频直接读取。 */
export const MUSIC_ROOT = "resources/music";
/** 前台连续 30 秒没有进度提示网络较慢，继续等待当前任务完成。 */
export const RESOURCE_SLOW_SECONDS = 30;
/** 进村阶段的两个原生建筑时间轴与布局一同载入，守夜复用。 */
export const STAGE_METADATA = {
    village: ["map/frames.vdata", "characters/animations.vdata", "buildings/buildings.vdata", "buildings/building_upgrade.mc", "buildings/building_attack.mc"],
    night: ["enemies/frames.vdata", "enemies/animations.vdata", "enemies/enemies.vdata"]
} as const;
