import { PATROL } from "../config/PatrolConfig";
import { RULE } from "../config/RuleConfig";
import { ENEMIES } from "../config/EnemyConfig";
import { PATH_LENGTH, RoadPoint } from "./BattleRoad";
import { GameState } from "./GameState";
import { patrolCaptain, patrolStats } from "./PatrolRules";
import { contactTime, EnemyRoadStep, lanePoint, SummonCollision } from "./SummonCharge";

interface PatrolUnit {
    index: number; progress: number; lane: number; at: RoadPoint; distance: number;
}

/** 巡卫是夜战临时单位。碰撞坐标与显示脚底共用；夜战冷启动按战前快照重放。 */
export class Patrol {
    units: PatrolUnit[] = [];
    readonly stats: ReturnType<typeof patrolStats>;
    private due = Math.round(PATROL.first / RULE.step);
    deployments = 0;
    kills = 0;

    constructor(state: GameState) {
        this.stats = patrolStats(state.patrol!.level, patrolCaptain(state));
    }

    secondsUntil(tick: number) { return Math.max(0, this.due - tick) * RULE.step; }

    advance(tick: number, targets: EnemyRoadStep[]): SummonCollision[] {
        if (tick >= this.due && this.units.length < PATROL.maxActive) {
            const index = this.deployments++;
            const lane = PATROL.lanes[index % PATROL.lanes.length];
            this.units.push({ index, progress: PATH_LENGTH, lane, at: lanePoint(PATH_LENGTH, 0), distance: 0 });
            this.due = tick + this.stats.ticks;
        }
        const stride = PATROL.speed * RULE.step;
        const contacts: { time: number; end: number; unit: PatrolUnit; target: EnemyRoadStep; from: RoadPoint }[] = [];
        for (const unit of this.units) {
            const from = unit.at, end = Math.min(1, unit.progress / stride);
            unit.progress = Math.max(0, unit.progress - stride);
            // 出门统一从中间开始，走过一段后才分到不同的路面位置。
            unit.at = lanePoint(unit.progress, unit.lane * Math.min(1, (PATH_LENGTH - unit.progress) / 55));
            unit.distance += Math.hypot(unit.at.x - from.x, unit.at.y - from.y);
            for (const target of targets) {
                if (target.enemy.hp <= 0) continue;
                const time = contactTime({ from, to: unit.at, end }, target);
                if (time <= end && (target.enemy.progress >= PATH_LENGTH ? time < target.end : time <= target.end))
                    contacts.push({ time, end, unit, target, from });
            }
        }
        contacts.sort((a, b) => a.time - b.time || a.unit.index - b.unit.index || a.target.enemy.seq - b.target.enemy.seq);
        const used = new Set<number>(), hits: SummonCollision[] = [];
        for (const { time, end, unit, target, from } of contacts) {
            const enemy = target.enemy;
            if (used.has(unit.index) || enemy.hp <= 0) continue;
            enemy.hp -= Math.max(1, Math.floor(this.stats.damage * (1 - ENEMIES[enemy.kind].armor)));
            if (enemy.hp <= 0) this.kills++;
            used.add(unit.index);
            const dx = unit.at.x - from.x, dy = unit.at.y - from.y, ratio = time / end;
            const progress = target.startProgress + (enemy.progress - target.startProgress) * time;
            hits.push({ enemy: { ...enemy, progress }, index: unit.index,
                at: { x: from.x + dx * ratio, y: from.y + dy * ratio }, dx, dy });
        }
        this.units = this.units.filter(unit => unit.progress > 0 && !used.has(unit.index));
        return hits;
    }
}
