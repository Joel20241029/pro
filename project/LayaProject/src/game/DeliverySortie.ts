import { DELIVERY_HERO as C, DELIVERY_PATROL_HUNT } from "../config/DeliveryHeroConfig";
import { RULE } from "../config/RuleConfig";
import type { WaveRhythm } from "../config/DefenseConfig";
import type { Enemy } from "./BattleSimulation";
import type { HeroTarget } from "./HeroSortie";
import { enemyPoint, PATH_LENGTH, pointAt, roadFootprintBounds, RoadPoint } from "./BattleRoad";
import { enemyPower } from "./Growth";
import { HERO } from "../config/HeroConfig";
import { waveDifficulty } from "./WaveDifficulty";
import type { GameState } from "./GameState";
import { appearanceSeed } from "./EnemySeed";

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";
type Phase = "ridingOut" | "dismount" | "fighting" | "walkingBack" | "mounting" | "ridingBack" | "resting";
type Side = -1 | 1;
type DeliveryFlight = { at: RoadPoint; from: RoadPoint; seq: number; start: number; landing: number; direction: Direction };
export type DeliveryEvent =
    { type: "deliveryThrow"; flight: DeliveryFlight } |
    { type: "deliveryHit"; at: RoadPoint; hurt: Enemy[]; direction: Direction; radius: number };

const ticks = (seconds: number) => Math.ceil(seconds / RULE.step);
const mouth = pointAt(PATH_LENGTH);
const roadHead = pointAt(0);
/** 车位与村门内侧转弯点分开，先横移再通过中央门洞。 */
const home = C.garage, turn = HERO.restPoint;
const stop = pointAt(PATH_LENGTH - C.parkingLead);
const edge = roadFootprintBounds(stop.y, { halfWidth: 0, back: 0, front: 0 });
/** 在道旁下车，出入仍经过城门中心。战斗位置不阻塞怪物或其他英雄。 */
const park = { x: edge.left - C.roadShoulder, y: stop.y };
const P = C.patrol;
const HUNT = C.hunt;
/** 本地选敌只用战斗步做抽样，读回同一夜仍可复演，不影响村庄随机状态。 */
const HUNT_DIRECTION_SEED = 0x44544854;

function roadside(y: number, side: Side | 0): RoadPoint {
    const { left, right } = roadFootprintBounds(y, { halfWidth: 0, back: 0, front: 0 });
    return { x: side < 0 ? left - P.shoulder : side > 0 ? right + P.shoulder : (left + right) / 2, y };
}

function huntLane(y: number, side: Side | 0): RoadPoint {
    const { left, right } = roadFootprintBounds(y, { halfWidth: 0, back: 0, front: 0 });
    const spread = Math.min(1, (mouth.y - y) / HUNT.gateMergeDistance);
    return { x: (left + right) / 2 + (right - left) * HUNT.laneOffset * spread * side, y };
}

export function deliveryEnemySlow(enemy: Pick<Enemy, "deliverySlowUntil">, tick: number) {
    return enemy.deliverySlowUntil !== undefined && tick < enemy.deliverySlowUntil ? P.slow : 0;
}

export function deliveryDamage(day: number, rhythm: WaveRhythm | undefined, solo = true) {
    return Math.floor((solo ? C.solo.damage : C.damage) * (rhythm === undefined ? enemyPower(day) : waveDifficulty(day, rhythm).health));
}

/** 同一招募条件供村委会按钮和事务提交前复核。 */
export function deliveryRecruitmentReason(state: GameState) {
    const { waves, coins } = C.recruitment;
    if (state.deliveryUnlocked) return `${C.name}已加入`;
    if (state.completed < waves) return `守住 ${waves} 波后可招募`;
    if (state.coins < coins) return "尔币不足";
    return null;
}

export class DeliverySortie {
    readonly position: RoadPoint = { ...home };
    private parkedAt: RoadPoint = park;
    private side: Side = -1;
    private chosen = false;
    private merged = false;
    private lap = 0;
    private nextLook = 0;
    private footGoal = 0;
    walking = false;
    walkDistance = 0;
    phase: Phase = "ridingOut";
    direction: Direction = "UP";
    phaseAt = 0;
    attackAt: number | null = null;
    flight: DeliveryFlight | null = null;
    private nextAttack = 0;
    private aimedEnemy: number | null = null;
    private lastThrowDirection?: Direction;

    readonly rules: typeof C.solo | typeof C;
    readonly roaming: boolean;
    readonly hunting: boolean;

    constructor(readonly damage: number, solo = true, patrol?: boolean | typeof DELIVERY_PATROL_HUNT) {
        this.rules = solo ? C.solo : C;
        this.roaming = Boolean(patrol);
        this.hunting = patrol === DELIVERY_PATROL_HUNT;
    }

    get parked(): Readonly<RoadPoint> { return this.parkedAt; }
    get needsTargets() {
        return this.phase === "fighting" || this.roaming && this.phase === "ridingOut" && !this.chosen;
    }

    get atGate() {
        return this.phase !== "resting" && Math.abs(this.position.y - HERO.gateY) <= HERO.gateTriggerDistance &&
            (!this.roaming || Math.abs(this.position.x - turn.x) <= P.gateHalfWidth);
    }

    private enter(phase: Phase, tick: number) {
        this.phase = phase;
        this.phaseAt = tick;
    }

    advance(tick: number, targets: readonly HeroTarget[]): DeliveryEvent | null {
        this.walking = false;
        if (this.flight && tick >= this.flight.landing) {
            const flight = this.flight;
            this.flight = null;
            return this.land(flight, targets);
        }
        const elapsed = tick - this.phaseAt;
        switch (this.phase) {
            case "resting":
                if (elapsed >= ticks(this.rules.restSeconds)) {
                    this.chosen = this.merged = false;
                    if (this.hunting) this.side = this.side === -1 ? 1 : -1;
                    this.enter("ridingOut", tick);
                }
                break;
            case "ridingOut": {
                if (this.position.y === turn.y && this.position.x !== turn.x) this.ride(turn);
                else if (this.position.y > mouth.y) this.ride(mouth);
                else if (this.hunting) {
                    if (targets.some(t => this.inReach(t))) {
                        this.parkedAt = { ...this.position };
                        this.enter("dismount", tick);
                    } else this.followRoad(roadHead.y, this.side, P.rideSpeed);
                } else {
                    if (this.roaming && !this.chosen) this.chooseParking(targets);
                    if (this.roaming && this.position.y !== this.parked.y) this.followRoad(this.parked.y, 0, P.rideSpeed);
                    else if (this.ride(this.parked)) this.enter("dismount", tick);
                }
                break;
            }
            case "dismount":
                if (elapsed >= ticks(C.transitionSeconds)) {
                    this.enter("fighting", tick);
                    this.nextAttack = tick;
                    this.nextLook = tick;
                    this.footGoal = this.parked.y;
                }
                break;
            case "fighting": {
                if (elapsed >= ticks(this.rules.fightSeconds)) {
                    this.attackAt = null;
                    this.enter(this.roaming ? "walkingBack" : "mounting", tick);
                    break;
                }
                if (this.flight) break;
                if (this.hunting && this.position.y !== this.footGoal) {
                    this.walk(this.footGoal);
                    break;
                }
                if (this.attackAt === null) {
                    if (tick >= this.nextAttack && elapsed + ticks(C.windupSeconds) + ticks(C.flightSeconds) < ticks(this.rules.fightSeconds)) {
                        const target = this.hunting ? this.huntTarget(targets, tick) : this.target(targets);
                        if (target) {
                            this.face(target.at.x - this.position.x, target.at.y - this.position.y);
                            this.aimedEnemy = target.enemy.seq;
                            this.attackAt = tick;
                            break;
                        }
                    }
                    if (this.hunting) {
                        if (!targets.some(t => this.inReach(t))) this.walk(roadHead.y);
                        this.footGoal = this.position.y;
                    } else if (this.roaming) this.reposition(tick, targets);
                } else if (tick >= this.attackAt + ticks(C.windupSeconds)) {
                    const target = this.hunting
                        ? targets.find(t => t.enemy.seq === this.aimedEnemy && this.inReach(t)) ?? this.huntTarget(targets, tick)
                        : this.target(targets);
                    this.nextAttack = this.attackAt + ticks(this.rules.intervalSeconds);
                    if (!target) { this.attackAt = null; break; }
                    this.face(target.at.x - this.position.x, target.at.y - this.position.y);
                    this.lastThrowDirection = this.direction;
                    const lead = 1 - Math.max(target.enemy.slowTicks > 0 ? target.enemy.slow : 0, deliveryEnemySlow(target.enemy, tick));
                    const aheadProgress = Math.min(PATH_LENGTH, target.enemy.progress + target.enemy.speed * C.flightSeconds * C.lead * lead);
                    let at: RoadPoint;
                    if (this.roaming) at = enemyPoint({ ...target.enemy, progress: aheadProgress });
                    else {
                        const ahead = pointAt(aheadProgress), now = pointAt(target.enemy.progress);
                        at = { x: target.at.x + ahead.x - now.x, y: target.at.y + ahead.y - now.y };
                    }
                    this.flight = { at, from: { ...this.position }, seq: target.enemy.seq, start: tick,
                        landing: tick + ticks(C.flightSeconds), direction: this.direction };
                    return { type: "deliveryThrow", flight: this.flight };
                }
                break;
            }
            case "walkingBack":
                if (this.walk(this.parked.y)) this.enter("mounting", tick);
                break;
            case "mounting":
                if (elapsed >= ticks(C.transitionSeconds)) this.enter("ridingBack", tick);
                break;
            case "ridingBack": {
                const returnSide = this.hunting ? this.side === -1 ? 1 : -1 : 0;
                if (this.roaming && !this.merged) {
                    const lane = this.hunting ? huntLane(this.parked.y, returnSide) : roadside(this.parked.y, returnSide);
                    this.merged = this.ride(lane);
                    break;
                }
                if (this.roaming && this.position.y < mouth.y) {
                    this.followRoad(mouth.y, returnSide, P.rideSpeed);
                    break;
                }
                const destination = this.position.y < mouth.y ? mouth : this.position.y < turn.y ? turn : home;
                if (this.ride(destination) && destination === home) this.enter("resting", tick);
                break;
            }
        }
        return null;
    }

    private target(targets: readonly HeroTarget[]): HeroTarget | undefined {
        let nearest: HeroTarget | undefined, distance = Infinity;
        for (const t of targets) {
            if (t.enemy.hp <= 0 || t.enemy.progress >= PATH_LENGTH) continue;
            const d = Math.hypot(t.at.x - this.position.x, t.at.y - this.position.y);
            if (d <= this.rules.range && (d < distance || d === distance && nearest && t.enemy.seq < nearest.enemy.seq)) {
                nearest = t;
                distance = d;
            }
        }
        return nearest;
    }

    private inReach(t: HeroTarget) {
        return t.enemy.hp > 0 && t.enemy.progress < PATH_LENGTH &&
            Math.hypot(t.at.x - this.position.x, t.at.y - this.position.y) <= this.rules.range;
    }

    private huntTarget(targets: readonly HeroTarget[], tick: number): HeroTarget | undefined {
        const passed: { target: HeroTarget; direction: Direction; distance: number }[] = [];
        const directions = new Map<Direction, { target: HeroTarget; distance: number }>();
        for (const target of targets) {
            if (!this.inReach(target)) continue;
            const dx = target.at.x - this.position.x, dy = target.at.y - this.position.y;
            const direction = this.facing(dx, dy), distance = Math.hypot(dx, dy);
            if (dy > 0) passed.push({ target, direction, distance });
            else {
                const current = directions.get(direction);
                if (!current || distance < current.distance || distance === current.distance && target.enemy.seq < current.target.enemy.seq)
                    directions.set(direction, { target, distance });
            }
        }
        if (passed.length) {
            passed.sort((a, b) => Number(a.direction === this.lastThrowDirection) - Number(b.direction === this.lastThrowDirection) ||
                a.distance - b.distance || a.target.enemy.seq - b.target.enemy.seq);
            return passed[0].target;
        }
        const options = [...directions.keys()].sort();
        if (options.length > 1 && this.lastThrowDirection) {
            const previous = options.indexOf(this.lastThrowDirection);
            if (previous >= 0) options.splice(previous, 1);
        }
        if (options.length) return directions.get(options[appearanceSeed(HUNT_DIRECTION_SEED, tick) % options.length])?.target;
    }

    private land(flight: DeliveryFlight, targets: readonly HeroTarget[]): DeliveryEvent {
        this.attackAt = null;
        if (this.hunting) {
            const ahead = this.position.y - HUNT.stepAfterThrow;
            this.footGoal = ahead >= roadHead.y ? ahead : this.position.y + HUNT.stepAfterThrow;
        }
        const near = targets.filter(t => t.enemy.hp > 0 && (!this.roaming || t.enemy.progress < PATH_LENGTH)).map(target => ({
            target, distance: Math.hypot(target.at.x - flight.at.x, target.at.y - flight.at.y)
        })).filter(t => t.distance <= this.rules.radius).sort((a, b) => a.distance - b.distance || a.target.enemy.seq - b.target.enemy.seq);
        const direct = near.find(t => t.target.enemy.seq === flight.seq && t.distance <= C.directTolerance);
        const hit = [...(direct ? [direct] : []), ...near.filter(t => t !== direct).slice(0, this.rules.splashTargets)];
        const hurt = hit.map(t => {
            const enemy = t.target.enemy;
            enemy.hp -= t === direct ? this.damage : Math.max(1, Math.floor(this.damage * this.rules.splashRatio));
            // 落地在当步移动之后，因此从下一步起计足完整时长。
            if (this.roaming && enemy.hp > 0) enemy.deliverySlowUntil = flight.landing + 1 + ticks(P.slowSeconds);
            return { ...enemy };
        });
        return { type: "deliveryHit", at: flight.at, hurt, direction: flight.direction, radius: this.rules.radius };
    }

    private chooseParking(targets: readonly HeroTarget[]) {
        const preferredSide: Side = this.lap % 2 ? 1 : -1;
        const lastY = this.parkedAt.y, lastSide = this.side;
        let best = -Infinity;
        for (const side of [preferredSide, -preferredSide] as Side[]) for (const y of P.stops) {
            // 连续出征换一处视野，固定怪阵下也会从相邻点重新接近。
            if (this.lap && y === lastY && side === lastSide) continue;
            const spot = roadside(y, side);
            let score = -(mouth.y - y) / P.parkingTravelWeight;
            for (const { enemy, at } of targets)
                if (enemy.hp > 0 && enemy.progress < PATH_LENGTH)
                    score += Math.max(0, 1 - Math.hypot(at.x - spot.x, at.y - spot.y) / this.rules.range);
            if (score > best) { best = score; this.parkedAt = spot; this.side = side; }
        }
        this.lap++;
        this.chosen = true;
    }

    private reposition(tick: number, targets: readonly HeroTarget[]) {
        if (tick >= this.nextLook) {
            this.nextLook = tick + ticks(P.scanSeconds);
            let sum = 0, weight = 0;
            for (const { at, enemy } of targets) {
                if (enemy.hp <= 0 || enemy.progress >= PATH_LENGTH) continue;
                const proximity = Math.max(0, 1 - Math.abs(this.position.y - at.y) / this.rules.range);
                sum += at.y * proximity;
                weight += proximity;
            }
            const min = Math.max(P.farY, this.parked.y - P.leash), max = Math.min(P.nearY, this.parked.y + P.leash);
            this.footGoal = weight ? Math.max(min, Math.min(max, Math.round(sum / weight))) : this.parked.y;
        }
        if (Math.abs(this.position.y - this.footGoal) >= P.stride / 2) this.walk(this.footGoal);
    }

    private walk(y: number) {
        const { x, y: before } = this.position;
        const returningToBike = this.hunting && this.phase === "walkingBack";
        const reached = returningToBike && before === y
            ? this.move(this.parked, P.walkSpeed)
            : this.followRoad(y, this.side, P.walkSpeed);
        const distance = Math.hypot(this.position.x - x, this.position.y - before);
        this.walking = distance > 0;
        this.walkDistance += distance;
        return reached && (!returningToBike || this.position.x === this.parked.x);
    }

    private followRoad(y: number, side: Side | 0, speed: number) {
        const delta = y - this.position.y;
        const stepY = Math.abs(delta) <= P.stride ? y : this.position.y + Math.sign(delta) * P.stride;
        const goal = this.hunting ? huntLane(stepY, side) : roadside(stepY, side);
        return this.move(goal, speed) && stepY === y;
    }

    private ride(goal: RoadPoint) {
        return this.move(goal, this.roaming ? P.rideSpeed : C.rideSpeed);
    }

    private move(goal: RoadPoint, speed: number) {
        const dx = goal.x - this.position.x, dy = goal.y - this.position.y, distance = Math.hypot(dx, dy);
        const step = speed * RULE.step;
        this.face(dx, dy);
        if (distance <= step) {
            Object.assign(this.position, goal);
            return true;
        }
        this.position.x += step * dx / distance;
        this.position.y += step * dy / distance;
        return false;
    }

    private facing(dx: number, dy: number): Direction {
        if (!dx && !dy) return this.direction;
        return Math.abs(dx) > Math.abs(dy) ? dx < 0 ? "LEFT" : "RIGHT" : dy < 0 ? "UP" : "DOWN";
    }
    private face(dx: number, dy: number) {
        this.direction = this.facing(dx, dy);
    }
}
