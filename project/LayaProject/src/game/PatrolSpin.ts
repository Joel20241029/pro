import { PATROL } from "../config/PatrolConfig";
import { LIANG_INDULGENCE } from "../config/ShopConfig";
import { RULE } from "../config/RuleConfig";
import type { RoadPoint } from "./BattleRoad";
import type { PatrolTarget } from "./Patrol";
import type { SummonCollision } from "./SummonCharge";

const SPIN = PATROL.spin;
export interface PatrolSpinActor { index: number; at: RoadPoint; distance: number; lift?: number; rotation?: number; squash?: number; }
interface PairMember extends PatrolSpinActor {
    arrived: boolean; from: RoadPoint; exit: RoadPoint; to: RoadPoint;
    firstLeg: number; length: number; speed: number;
}
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const along = (from: RoadPoint, to: RoadPoint, t: number): RoadPoint =>
    ({ x: mix(from.x, to.x, t), y: mix(from.y, to.y, t) });


/** Flight trail and the thrown actor share one ground path and one visual height. */
export function patrolArc(from: RoadPoint, to: RoadPoint, progress: number) {
    const sway = Math.sin(Math.PI * progress);
    const x = mix(from.x, to.x, progress);
    // 朝地图内侧抛出一条弧，方向在一整次飞行中固定。
    const side = (from.x + to.x) / 2 <= SPIN.map.width / 2 ? SPIN.arcSway : -SPIN.arcSway;
    return { x: Math.max(0, Math.min(SPIN.map.width, x + sway * side)), y: mix(from.y, to.y, progress), lift: sway * SPIN.arcHeight };
}

export class PatrolSpin {
    private pair: PairMember[] = [];
    private start = 0;
    private flightTicks = 0;
    private target: RoadPoint | null = null;
    private due: number;
    private departure = 0;
    private nextPair: PairMember[];
    private walkTicks: number;
    deployments = 0;
    landing: { at: RoadPoint; actor: number; radius: number } | null = null;
    readonly radius: number;
    readonly center = SPIN.center;
    private releaseAngle = 0;

    constructor(private stats: { damage: number; ticks: number }, wideImpact?: true) {
        this.radius = wideImpact ? SPIN.radius * LIANG_INDULGENCE.radiusMultiplier : SPIN.radius;
        this.due = stats.ticks;
        this.nextPair = this.planPair();
        this.walkTicks = this.getWalkTicks();
    }
    private getWalkTicks() {
        return Math.max(...this.nextPair.map(actor => Math.ceil(actor.length / actor.speed / RULE.step)));
    }
    get canGather() { return !this.target && this.pair.length === 2; }
    get ready() { return this.canGather && this.pair.every(actor => actor.arrived); }

    /** 玩家选中了已经出场的双人，把他们就位到正常发射点。 */
    gather() {
        if (!this.canGather) return false;
        for (const actor of this.pair) {
            actor.at = actor.to;
            actor.distance = actor.length;
            actor.arrived = true;
        }
        return true;
    }
    get flying() { return this.target !== null; }
    get destination() { return this.target; }
    flightProgress(tick: number) { return this.target ? clamp((tick - this.start) / this.flightTicks) : 0; }
    get aimOrigin() { return this.orbit(1, this.releaseAngle).at; }
    orbit(slot: number, angle: number) {
        const side = slot === 0 ? -1 : 1;
        return {
            at: { x: this.center.x + side * SPIN.shoulder * Math.cos(angle), y: this.center.y + side * SPIN.orbitDepth * Math.sin(angle) },
            rotation: -side * Math.cos(angle) * 9
        };
    }
    get actors(): readonly PatrolSpinActor[] { return this.pair; }
    secondsUntil(tick: number) { return Math.max(0, this.due - tick) * RULE.step; }

    private planPair() {
        return [-1, 1].map((side, slot): PairMember => {
            const index = this.deployments + slot;
            const from = { x: SPIN.house.x + side * SPIN.exitOffset, y: SPIN.house.y + slot * SPIN.exitOffset };
            const exit = { x: SPIN.houseExit.x, y: SPIN.houseExit.y + slot * SPIN.exitOffset };
            const to = { x: this.center.x + side * SPIN.shoulder, y: this.center.y };
            const firstLeg = Math.hypot(exit.x - from.x, exit.y - from.y);
            return { index, from, exit, to, firstLeg, length: firstLeg + Math.hypot(to.x - exit.x, to.y - exit.y),
                speed: SPIN.walkSpeeds[index % SPIN.walkSpeeds.length], at: from, distance: 0, arrived: false };
        });
    }

    throwAt(tick: number, at: RoadPoint, angle = 0) {
        if (!this.ready || !Number.isFinite(at.x) || !Number.isFinite(at.y) ||
            at.x < 0 || at.x > SPIN.map.width || at.y < SPIN.map.top || at.y > SPIN.map.bottom) return false;
        this.releaseAngle = angle;
        this.pair.forEach((actor, slot) => Object.assign(actor, this.orbit(slot, angle)));
        this.target = { ...at };
        this.start = tick;
        const distance = Math.hypot(at.x - this.aimOrigin.x, at.y - this.aimOrigin.y);
        this.flightTicks = Math.round((SPIN.flight + SPIN.flightByDistance * clamp(distance / 720)) / RULE.step);
        return true;
    }

    advance(tick: number, targets: readonly PatrolTarget[]): SummonCollision[] {
        this.landing = null;
        if (!this.target) {
            if (!this.pair.length && tick >= this.due - this.walkTicks) {
                this.pair = this.nextPair;
                this.departure = tick;
                this.deployments += this.pair.length;
            }
            for (const actor of this.pair) {
                if (actor.arrived) continue;
                actor.distance = Math.min(actor.length, (tick - this.departure) * RULE.step * actor.speed);
                actor.at = actor.distance < actor.firstLeg
                    ? along(actor.from, actor.exit, actor.distance / actor.firstLeg)
                    : along(actor.exit, actor.to, clamp((actor.distance - actor.firstLeg) / (actor.length - actor.firstLeg)));
                actor.arrived = actor.distance >= actor.length;
            }
            return [];
        }
        const [first, second] = this.pair;
        const progress = this.flightProgress(tick);
        const position = patrolArc(this.aimOrigin, this.target, progress);
        second.at = position;
        second.lift = position.lift;
        second.rotation = this.orbit(1, this.releaseAngle).rotation + progress * 360;
        const retreat = this.orbit(0, this.releaseAngle);
        first.at = progress < .65 ? along(retreat.at, SPIN.houseExit, progress / .65)
            : along(SPIN.houseExit, SPIN.house, (progress - .65) / .35);
        first.distance += 2;
        first.rotation = retreat.rotation * (1 - progress);
        if (progress < 1) return [];

        const at = this.target;
        this.landing = { at, actor: second.index, radius: this.radius };
        this.target = null;
        this.pair = [];
        this.due = tick + this.stats.ticks;
        this.nextPair = this.planPair();
        this.walkTicks = this.getWalkTicks();
        return targets.filter(({ enemy, at: foot }) => enemy.hp > 0 && Math.hypot(foot.x - at.x, foot.y - at.y) <= this.radius)
            .map(({ enemy, at: foot }) => {
                enemy.hp -= this.stats.damage;
                return { enemy: { ...enemy }, at: foot, index: second.index, dx: foot.x - at.x, dy: foot.y - at.y };
            });
    }
}
