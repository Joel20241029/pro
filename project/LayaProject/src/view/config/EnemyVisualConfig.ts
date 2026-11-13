import { EnemyKind } from "../../config/EnemyConfig";
/** 2D怪物主体层乘色；细节层与头背配件保留原色，受击时各层同步闪红，只影响外观。 */
export const ENEMY_PALETTES = ["#c5ad91", "#93b5c4", "#a6b581", "#c49b89", "#b2a2c7", "#d0c296", "#8fb29d", "#bec6cd"] as const;
/** 控制可见体型范围；纯装饰缩放不改变碰撞、射程、速度或血量，最大首领小于道路旁塔标间距。 */
export const ENEMY_SCALES = [.96, 1, 1.04] as const;
/** 原2D怪物四帧行走以6FPS播放；使用战斗表现秒，暂停和倍速跟随原有时钟。 */
export const ENEMY_VISUAL_FPS = 6;
/** 配件按轮廓声明兼容，头饰及背饰最多各一件。null 表示明确设计的无装饰组合。 */
export const ENEMY_LOOKS: Record<EnemyKind, { size: number; head: (string | null)[]; back: (string | null)[]; headSize: number; backSize: number }> = {
    enemy_raider: { size: 64, head: [null, "enemy_acc_band", "enemy_acc_feathers"], back: [null, "enemy_acc_banner", "enemy_acc_leaves"], headSize: 28, backSize: 50 },
    enemy_runner: { size: 64, head: [null, "enemy_acc_band", "enemy_acc_feathers"], back: [null, "enemy_acc_leaves"], headSize: 24, backSize: 36 },
    enemy_armored: { size: 64, head: [null, "enemy_acc_feathers"], back: [null, "enemy_acc_banner"], headSize: 28, backSize: 50 },
    enemy_boar: { size: 60, head: [null, "enemy_acc_antlers", "enemy_acc_band"], back: [null, "enemy_acc_leaves"], headSize: 28, backSize: 38 },
    enemy_disruptor: { size: 64, head: [null, "enemy_acc_mask", "enemy_acc_feathers"], back: [null, "enemy_acc_leaves", "enemy_acc_banner"], headSize: 28, backSize: 48 },
    enemy_chief: { size: 86, head: [null, "enemy_acc_mask"], back: [null, "enemy_acc_banner", "enemy_acc_leaves"], headSize: 26, backSize: 50 },
    enemy_commander: { size: 88, head: [null, "enemy_acc_feathers"], back: [null, "enemy_acc_banner"], headSize: 24, backSize: 50 },
    enemy_wolfking: { size: 86, head: [null, "enemy_acc_antlers", "enemy_acc_band"], back: [null, "enemy_acc_leaves"], headSize: 28, backSize: 38 },
    enemy_tuskking: { size: 92, head: [null, "enemy_acc_antlers", "enemy_acc_feathers"], back: [null, "enemy_acc_leaves"], headSize: 30, backSize: 40 },
    enemy_shaman: { size: 88, head: [null, "enemy_acc_feathers"], back: [null, "enemy_acc_banner", "enemy_acc_leaves"], headSize: 24, backSize: 50 }
};
