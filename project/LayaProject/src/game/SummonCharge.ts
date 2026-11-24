import { ENEMIES } from "../config/EnemyConfig";
import { RULE } from "../config/RuleConfig";
import { SUMMON_CHARGE as C } from "../config/TacticConfig";
import { PATH_LENGTH, pointAt, roadFootprintBounds } from "./BattleRoad";
import type { Enemy } from "./BattleSimulation";

type Point = { x: number; y: number };
/** end 是本步仍在道路上的时间比例。触门或跑出道路后不再参与碰撞。 */
interface RoadStep { from: Point; to: Point; end: number; }
export interface EnemyRoadStep extends RoadStep { enemy: Enemy; startProgress: number; }
export interface SummonedVillager {
    index: number;
    progress: number;
    lane: number;
    speed: number;
    delay: number;
    at: Point;
    from: Point;
    distance: number;
    retired: boolean;
}
export interface SummonCollision { enemy: Enemy; index: number; at: Point; dx: number; dy: number; }

export function lanePoint(progress: number, lane: number): Point {
    const { y } = pointAt(progress);
    const { left, right } = roadFootprintBounds(y, C.footprint);
    return { x: (left + right) / 2 + (right - left) * lane, y };
}

export function contactTime(unit: RoadStep, target: EnemyRoadStep, size: Readonly<Point>) {
    // 相对位移与按脚部尺寸归一化的圆相交。除以 end，保留截断前的速度。
    const x = (unit.from.x - target.from.x) / size.x, y = (unit.from.y - target.from.y) / size.y;
    const dx = ((unit.to.x - unit.from.x) / (unit.end || 1) - (target.to.x - target.from.x) / (target.end || 1)) / size.x;
    const dy = ((unit.to.y - unit.from.y) / (unit.end || 1) - (target.to.y - target.from.y) / (target.end || 1)) / size.y;
    const c = x * x + y * y - 1;
    if (c <= 0) return 0;
    const a = dx * dx + dy * dy, b = x * dx + y * dy, d = b * b - a * c;
    return a && b < 0 && d >= 0 ? c / (-b + Math.sqrt(d)) : Infinity;
}

/** 临时冲锋队列。位移、命中和可见足点共用同一坐标，不进村民名册或存档。 */
export class SummonCharge {
    private age = 0;
    private readonly bossDamagePercent = new Map<number, number>();
    readonly villagers: SummonedVillager[] = Array.from({ length: C.count }, (_, index) => {
        // 用与20互质的步长遍历横向与速度分位；错开顺序，重播不消耗村庄随机数。
        const last = C.count - 1;
        const lane = (((index * 7 + 10) % C.count) / last - .5) * C.laneSpread;
        const speed = C.minSpeed + (C.maxSpeed - C.minSpeed) * ((index * 13) % C.count) / last;
        const delay = (index * 5) % (C.startDelayTicks + 1);
        const depth = (index + (index % 3 === 1 ? .45 : -.35)) / last;
        const progress = PATH_LENGTH - C.gateInset - C.formationDepth * Math.max(0, depth);
        const at = lanePoint(progress, lane);
        return { index, progress, lane, speed, delay, at, from: at, distance: 0, retired: false };
    });
    get active() { return this.villagers.some(v => !v.retired); }
    get gathered() { return Math.min(1, this.age / C.gatherTicks); }

    advance(targets: EnemyRoadStep[]): SummonCollision[] {
        const chargeTick = this.age++ - C.gatherTicks;
        if (chargeTick < 0) return [];
        const departing: SummonedVillager[] = [];
        const contacts: { time: number; unit: SummonedVillager; step: RoadStep; target: EnemyRoadStep }[] = [];
        for (const unit of this.villagers) {
            if (unit.retired || chargeTick < unit.delay) continue;
            const distance = unit.speed * RULE.step;
            const end = Math.min(1, unit.progress / distance);
            const from = unit.at;
            unit.progress = Math.max(0, unit.progress - distance);
            unit.from = from;
            unit.at = lanePoint(unit.progress, unit.lane);
            unit.distance += Math.hypot(unit.at.x - from.x, unit.at.y - from.y);
            const step = { from, to: unit.at, end };
            if (unit.progress === 0) departing.push(unit);
            for (const target of targets) {
                const time = contactTime(step, target, ENEMIES[target.enemy.kind].boss ? C.contact.boss : C.contact.ordinary);
                const reachesGate = target.enemy.progress >= PATH_LENGTH;
                if (time <= end && (reachesGate ? time < target.end : time <= target.end))
                    contacts.push({ time, unit, step, target });
            }
        }
        // 同步扫掠后按真实接触先后匹配。同一怪先被另一人击倒时，后一个分身继续冲锋。
        contacts.sort((a, b) => a.time - b.time || a.unit.index - b.unit.index || a.target.enemy.seq - b.target.enemy.seq);
        const hits: SummonCollision[] = [];
        for (const { time, unit, step, target } of contacts) {
            const enemy = target.enemy;
            if (unit.retired || enemy.hp <= 0) continue;
            if (ENEMIES[enemy.kind].boss) {
                const prior = this.bossDamagePercent.get(enemy.seq) ?? 0;
                if (prior >= C.bossMaxPercent) continue;
                const next = prior + C.bossHitPercent;
                enemy.hp -= Math.floor(enemy.maxHp * next / 100) - Math.floor(enemy.maxHp * prior / 100);
                this.bossDamagePercent.set(enemy.seq, next);
            } else enemy.hp = 0;
            unit.retired = true;
            const dx = step.to.x - step.from.x, dy = step.to.y - step.from.y, t = time / (step.end || 1);
            const progress = target.startProgress + (enemy.progress - target.startProgress) * time;
            hits.push({ enemy: { ...enemy, progress }, index: unit.index, at: { x: step.from.x + dx * t, y: step.from.y + dy * t }, dx, dy });
        }
        for (const unit of departing) unit.retired = true;
        return hits;
    }
}
