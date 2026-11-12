import { BattleSimulation, Shot } from "../game/BattleSimulation";
import { RULE } from "../game/GameConfig";
import { GroundPoint, towerLaunch } from "./VillageScene";
import { GameLayout } from "./GameLayout";

/**
 * 720 逻辑画布的投射物表现参数：图片为现有 48×48 原画布（包含透明边）。
 * 箭矢原图朝右，0 度直接朝向目标；石块用弧线与自转表现重量，冰球轻微抛弧。
 * flight/impact 为战斗秒，size/arc 为逻辑像素，spin 为每秒角度；只影响视觉，不参与命中、伤害或存档。
 */
export const PROJECTILE_STYLE = {
    ARROW: { frame: "fx_arrow", size: 68, flight: .24, arc: 0, spin: 0, hit: "fx_hit", hitSize: 42, impact: .15 },
    STONE: { frame: "fx_stone", size: 72, flight: .4, arc: 48, spin: 360, hit: "fx_hit", hitSize: 66, impact: .2 },
    SLOW: { frame: "fx_ice", size: 60, flight: .3, arc: 12, spin: 0, hit: "fx_slow_ring", hitSize: 72, impact: .2 }
} as const;

/** 落点位于敌人足底上方20px身体处；发射口与塔图共享源画布挂点，均只改变表现。 */
const TARGET_Y = -20;
export interface ProjectilePose {
    shot: Shot; frame: string; x: number; y: number; rotation: number; size: number; alpha: number;
}

/** 已结算 Shot 的纯表现；保留自身引用直到命中淡出，不依赖 Shot 在逻辑队列中停留的五个 tick。 */
export class ProjectileMotion {
    poses: ProjectilePose[] = [];
    private battle: BattleSimulation | null = null;
    private seen = new WeakSet<Shot>();

    update(battle: BattleSimulation | null, layout?: GameLayout, pads?: readonly GroundPoint[]) {
        if (battle !== this.battle) { this.battle = battle; this.poses = []; this.seen = new WeakSet<Shot>(); }
        if (!battle || battle.outcome) { this.poses = []; return; }
        for (const shot of battle.shots) {
            if (this.seen.has(shot)) continue;
            this.seen.add(shot);
            this.poses.push({ shot, frame: "", x: 0, y: 0, rotation: 0, size: 0, alpha: 1 });
        }
        // 与现有战斗特效上限相同：拥挤时只保留最新装饰，始终不影响逻辑攻击。
        this.poses = this.poses.filter(p => {
            const style = PROJECTILE_STYLE[p.shot.kind];
            return (battle.tick - p.shot.tick - 1) * RULE.step < style.flight + style.impact;
        }).slice(-RULE.effectCap);
        for (const p of this.poses) {
            const shot = p.shot, style = PROJECTILE_STYLE[shot.kind], from = towerLaunch(shot.tower, shot.kind, pads);
            const target = { x: shot.x, y: (layout ? layout.worldY(shot.y) : shot.y) + TARGET_Y };
            // step 完成后 tick 已加一；最后一次 step 新发射的弹道年龄为零。只读实际 tick，暂停/倍速天然同步。
            const age = (battle.tick - shot.tick - 1) * RULE.step;
            const dx = target.x - from.x, dy = target.y - from.y;
            if (age < style.flight) {
                const t = age / style.flight;
                p.frame = style.frame; p.size = style.size; p.alpha = 1;
                p.x = from.x + dx * t; p.y = from.y + dy * t - 4 * style.arc * t * (1 - t);
                p.rotation = shot.kind === "ARROW" ? Math.atan2(dy, dx) * 180 / Math.PI : age * style.spin;
            } else {
                const t = (age - style.flight) / style.impact;
                p.frame = style.hit; p.x = target.x; p.y = target.y; p.rotation = 0;
                p.size = style.hitSize * (.7 + .3 * t); p.alpha = 1 - t;
            }
        }
    }
}
