import { BattleSimulation, Enemy, Shot } from "../game/BattleSimulation";
import { RULE, PADS } from "../game/GameConfig";
import { GroundPoint, towerLaunch } from "./VillageScene";
import { CombatPresentation } from "./CombatPresentation";
import { GameLayout } from "./GameLayout";
import { RAGE_VISUAL } from "./config/RageVisualConfig";
import { FEEDBACK, TOWER_IMPACT } from "./config/FeedbackConfig";

/**
 * 720 逻辑画布的投射物表现参数：高清图片恢复完整母画布（包含透明边）。
 * 此轮按手机实绘收小箭、石、冰主体约 20%，保留发射口、旋转和视觉命中定位。
 * 石块用弧线与自转表现重量，冰球轻微抛弧。
 * flight/impact 为战斗秒，size/arc 为逻辑像素，spin 为每秒角度；只影响视觉，不参与命中、伤害或存档。
 */
export const PROJECTILE_STYLE = {
    ARROW: { frame: "fx_arrow", size: 37, flight: .24, arc: 0, spin: 0, hit: "fx_hit", hitSize: 42, impact: .15 },
    STONE: { frame: "fx_stone", size: 34, flight: .4, arc: 48, spin: 360, hit: "fx_hit", hitSize: 66, impact: .2 },
    SLOW: { frame: "fx_ice", size: 29, flight: .3, arc: 8, spin: 0, hit: "fx_slow_ring", hitSize: 72, impact: .2 }
} as const;

/** 单独播放的弹道预览没有敌人模型时，沿用原来的 20 px 身体偏移。 */
const PREVIEW_TARGET_LIFT = 20;
/** 短距离弹道限制相对拱高，避免塔下的近目标也触发全高抛物线。只作用于显示。 */
const ARC_TO_DISTANCE = .35;
/** 当前128px箭图尖端实测(124,8)；归一化后随显示尺寸旋转，避免错误使用角色足底锚点。 */
export const ARROW_TIP = { x: 124 / 128, y: 8 / 128 } as const;
export interface ProjectilePose {
    shot: Shot; impacted: boolean; frame: string; x: number; y: number; rotation: number; size: number; alpha: number;
    from: GroundPoint;
    launchOffset: GroundPoint;
    impactTick: number | null;
    impactTime: number | null;
    contact: boolean;
    impactFrame?: string;
    impactAngle?: number;
    impactShift?: number;
    /** 石塔冲击锁定命中时的路面坐标，换屏时重新投影。 */
    impactGround?: GroundPoint;
    impactAt?: GroundPoint;
}

/** 已结算 Shot 的纯表现；保留自身引用直到命中淡出，不依赖 Shot 在逻辑队列中停留的五个 tick。 */
export class ProjectileMotion {
    poses: ProjectilePose[] = [];
    readonly arrivals: ProjectilePose[] = [];
    private battle: BattleSimulation | null = null;
    private seen = new WeakSet<Shot>();

    update(battle: BattleSimulation | null, layout?: GameLayout, pads: readonly GroundPoint[] = PADS, launch?: (tower: number) => GroundPoint, feedback?: CombatPresentation, bodyLift?: (enemy: Enemy) => number) {
        this.arrivals.length = 0;
        if (battle !== this.battle) { this.battle = battle; this.poses = []; this.seen = new WeakSet<Shot>(); }
        if (!battle || battle.outcome && !feedback) { this.poses = []; return; }
        const tick = feedback ? feedback.presentationTick : battle.tick, now = feedback ? feedback.time : tick * RULE.step;
        for (const shot of [...battle.shots, ...(feedback ? feedback.shots.keys() : [])]) {
            if (this.seen.has(shot)) continue;
            this.seen.add(shot);
            const from = launch ? launch(shot.tower) : towerLaunch(shot.tower, shot.kind, pads), pad = pads[shot.tower];
            this.poses.push({ shot, impacted: false, frame: "", x: 0, y: 0, rotation: 0, size: 0, alpha: 1, from,
                launchOffset: { x: from.x - pad.x, y: from.y - pad.y }, impactTick: null, impactTime: null, contact: false });
        }
        // 与现有战斗特效上限相同：拥挤时只保留最新装饰，始终不影响逻辑攻击。
        this.poses = this.poses.filter(p => {
            const style = PROJECTILE_STYLE[p.shot.kind];
            const impact = TOWER_IMPACT[p.shot.kind];
            const expired = p.impacted && now - p.impactTime! >= impact.frameCount / impact.fps &&
                (tick - p.impactTick!) * RULE.step >= (p.shot.empowered ? RAGE_VISUAL.hitSeconds : style.impact);
            if (expired) feedback?.discard(p.shot);
            return !expired;
        });
        while (this.poses.length > RULE.effectCap) { const removed = this.poses.shift()!; feedback?.discard(removed.shot); }
        for (const p of this.poses) {
            const shot = p.shot, style = PROJECTILE_STYLE[shot.kind], pad = pads[shot.tower];
            // 固定发射瞬间相对塔位的偏移，后坐不拉动弹道，屏幕重排则跟随塔位整体移动。
            const from = p.from = { x: pad.x + p.launchOffset.x, y: pad.y + p.launchOffset.y };
            const at = feedback ? feedback.target(shot) : shot;
            const enemy = bodyLift && feedback?.targetEnemy(shot);
            const lift = enemy ? bodyLift!(enemy) : PREVIEW_TARGET_LIFT;
            const y = layout ? layout.worldY(at.y) : at.y;
            const event = feedback?.shots.get(shot);
            const recoil = event && feedback!.patrolRecoil(event.target, layout ? layout.worldY(at.y + 1) - y : 1);
            const air = event && feedback!.patrolAir(event.target);
            const target = { x: at.x + (recoil?.x ?? 0), y: y + (recoil?.y ?? 0) - lift - (air?.lift ?? 0) };
            // step 完成后 tick 已加一；最后一次 step 新发射的弹道年龄为零。只读实际 tick，暂停/倍速天然同步。
            const age = (tick - shot.tick - 1) * RULE.step;
            const dx = target.x - from.x, dy = target.y - from.y;
            if (age < style.flight) {
                const t = age / style.flight;
                p.frame = style.frame; p.size = style.size; p.alpha = 1;
                const arc = Math.min(style.arc, Math.hypot(dx, dy) * ARC_TO_DISTANCE);
                p.x = from.x + dx * t; p.y = from.y + dy * t - 4 * arc * t * (1 - t);
                p.rotation = shot.kind === "ARROW" ? Math.atan2(dy, dx) * 180 / Math.PI : age * style.spin;
            } else {
                if (!p.impacted) {
                    p.impacted = true; p.impactTick = tick; p.impactTime = now;
                    if (shot.kind === "STONE") p.impactGround = { x: at.x, y: at.y };
                    this.arrivals.push(p); feedback?.impact(shot);
                }
                const impact = TOWER_IMPACT[shot.kind];
                const impactAge = now - p.impactTime!, impactIndex = Math.floor(impactAge * impact.fps);
                p.contact = impactAge < FEEDBACK.contactSeconds;
                p.impactFrame = impactIndex < impact.frameCount ? `${impact.clip}_${impactIndex + 1}` : undefined;
                p.impactAngle = shot.kind === "ARROW" ? Math.atan2(dy, dx) * 180 / Math.PI : 0;
                // 石塔尘圈留在地上。霜晶和箭击跟随身体落点及受击震动。
                p.impactShift = !p.impactGround && impactAge > 0 && event ? feedback!.hitShake(event.target) : 0;
                if (p.impactGround) p.impactAt = {
                    x: p.impactGround.x, y: layout ? layout.worldY(p.impactGround.y) : p.impactGround.y
                };
                p.x = target.x; p.y = target.y;
                if (p.contact) {
                    // 首次落点必须实际显示弹体；按时间保持，抵御同帧refresh与update的两次render。
                    p.frame = style.frame; p.size = style.size; p.alpha = 1;
                    p.rotation = shot.kind === "ARROW" ? Math.atan2(dy, dx) * 180 / Math.PI : style.flight * style.spin;
                } else {
                    const t = Math.min(1, (tick - p.impactTick!) * RULE.step / (shot.empowered ? RAGE_VISUAL.hitSeconds : style.impact));
                    p.frame = shot.empowered ? "fx_rage_hit" : style.hit; p.rotation = 0;
                    p.size = (shot.empowered ? RAGE_VISUAL.hitSize[shot.kind] : style.hitSize) * (.7 + .3 * t) * FEEDBACK.impactScale;
                    p.alpha = 1 - t;
                }
            }
        }
    }
}
