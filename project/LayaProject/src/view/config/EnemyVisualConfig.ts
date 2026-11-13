import { EnemyKind } from "../../config/EnemyConfig";
/** 高清整图轻微冷暖乘色，保留皮肤/金属/布料原有层次；8种组合与种子取数顺序保持不变，仅调整表现。 */
export const ENEMY_PALETTES = ["#ffffff", "#e5f1ff", "#edf9e3", "#ffe9df", "#f0e7ff", "#fff4d9", "#e2f6e9", "#edf1f6"] as const;
/** 控制可见体型范围；纯装饰缩放不改变碰撞、射程、速度或血量，最大首领小于道路旁塔标间距。 */
export const ENEMY_SCALES = [.96, 1, 1.04] as const;
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
