import { EnemyKind } from "../../config/EnemyConfig";
/** Laya独立怪物prefab导出的可视矩形。behind取自节点相对Body的真实顺序。 */
export interface EnemyAccessory { x: number; y: number; width: number; height: number; behind: boolean; }
export interface EnemyLayout {
    canvas: number; fps: number; stride: number; foot: { x: number; y: number };
    /** 来自原生ContactShadow节点；与身体共用96画布根变换，纹理复用已加载的建筑包。 */
    shadow: { frame: string; x: number; y: number; width: number; height: number; alpha: number };
    frames: { body: string; x: number; y: number; parts: Record<string, EnemyAccessory> }[];
}
/** 高清整图轻微冷暖乘色，保留皮肤/金属/布料原有层次；8种组合与种子取数顺序保持不变，仅调整表现。 */
export const ENEMY_PALETTES = ["#ffffff", "#e5f1ff", "#edf9e3", "#ffe9df", "#f0e7ff", "#fff4d9", "#e2f6e9", "#edf1f6"] as const;
/** 控制可见体型范围；纯装饰缩放不改变碰撞、射程、速度或血量，最大首领小于道路旁塔标间距。 */
export const ENEMY_SCALES = [.96, 1, 1.04] as const;
/** 1.0.18 小怪相对1.0.17放大15%、Boss放大25%；只改显示，足部通行范围见RoadMovementConfig。
 * 配套发布采样从原始高清稿重制，不能对旧小图直接插值放大。
 */
const ENEMY_SIZE_SCALE = { ordinary: 1.15, boss: 1.25 } as const;
/** 新版完整轮廓已有明确头饰和装备，只给适合的角色附加小背旗/羽毛。
 * 不给野兽叠人类头饰，不让配件盖脸。阴影布局读取原生预制体，不在这里维护第二份位置。
 */
export const ENEMY_LOOKS: Record<EnemyKind, { size: number; head: (string | null)[]; back: (string | null)[] }> = {
    enemy_raider: { size: 72 * ENEMY_SIZE_SCALE.ordinary, head: [null], back: [null, "enemy_acc_banner"] },
    enemy_runner: { size: 72 * ENEMY_SIZE_SCALE.ordinary, head: [null], back: [null, "enemy_acc_feathers"] },
    enemy_armored: { size: 72 * ENEMY_SIZE_SCALE.ordinary, head: [null], back: [null, "enemy_acc_banner"] },
    enemy_boar: { size: 67.5 * ENEMY_SIZE_SCALE.ordinary, head: [null], back: [null] },
    enemy_disruptor: { size: 72 * ENEMY_SIZE_SCALE.ordinary, head: [null], back: [null] },
    enemy_chief: { size: 96.75 * ENEMY_SIZE_SCALE.boss, head: [null], back: [null, "enemy_acc_banner"] },
    enemy_commander: { size: 99 * ENEMY_SIZE_SCALE.boss, head: [null], back: [null] },
    enemy_wolfking: { size: 96.75 * ENEMY_SIZE_SCALE.boss, head: [null], back: [null] },
    enemy_tuskking: { size: 103.5 * ENEMY_SIZE_SCALE.boss, head: [null], back: [null] },
    enemy_shaman: { size: 99 * ENEMY_SIZE_SCALE.boss, head: [null], back: [null] },
};
