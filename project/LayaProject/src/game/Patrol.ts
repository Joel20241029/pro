import { PATROL } from "../config/PatrolConfig";
import { RULE } from "../config/RuleConfig";
import { ENEMIES } from "../config/EnemyConfig";
import { SUMMON_CHARGE } from "../config/TacticConfig";
import { PATH_LENGTH, RoadPoint } from "./BattleRoad";
import { GameState } from "./GameState";
import { patrolCaptain, patrolStats } from "./PatrolRules";
import { lanePoint, SummonCollision } from "./SummonCharge";
import type { Enemy } from "./BattleSimulation";

export interface PatrolTarget { enemy: Enemy; at: RoadPoint; }

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

    advance(tick: number, targets: readonly PatrolTarget[]): SummonCollision[] {
        if (tick >= this.due && this.units.length < PATROL.maxActive) {
            const index = this.deployments++;
            const lane = PATROL.lanes[index % PATROL.lanes.length];
            this.units.push({ index, progress: PATH_LENGTH, lane, at: lanePoint(PATH_LENGTH, 0), distance: 0 });
            this.due = tick + this.stats.ticks;
        }
        const stride = PATROL.speed * RULE.step;
        const hits: SummonCollision[] = [];
        const active: PatrolUnit[] = [];
        for (const unit of this.units) {
            const from = unit.at;
            unit.progress = Math.max(0, unit.progress - stride);
            // 出门统一从中间开始，走过一段后才分到不同的路面位置。
            unit.at = lanePoint(unit.progress, unit.lane * Math.min(1, (PATH_LENGTH - unit.progress) / 55));
            unit.distance += Math.hypot(unit.at.x - from.x, unit.at.y - from.y);
            // 用这一战斗步更新后的脚点判定，沿用此前普通怪和首领的碰撞范围。
            let enemy: Enemy | null = null, nearest = Infinity;
            for (const target of targets) {
                const candidate = target.enemy;
                if (candidate.hp <= 0) continue;
                const radius = ENEMIES[candidate.kind].boss ? SUMMON_CHARGE.contact.boss : SUMMON_CHARGE.contact.ordinary;
                const x = unit.at.x - target.at.x, y = unit.at.y - target.at.y;
                if ((x / radius.x) ** 2 + (y / radius.y) ** 2 > 1) continue;
                const distance = x * x + y * y;
                if (distance < nearest || distance === nearest && enemy && candidate.seq < enemy.seq) {
                    enemy = candidate;
                    nearest = distance;
                }
            }
            if (!enemy) {
                if (unit.progress > 0) active.push(unit);
                continue;
            }
            enemy.hp -= Math.max(1, Math.floor(this.stats.damage * (1 - ENEMIES[enemy.kind].armor)));
            if (enemy.hp <= 0) this.kills++;
            hits.push({ enemy: { ...enemy }, index: unit.index, at: unit.at, dx: unit.at.x - from.x, dy: unit.at.y - from.y });
        }
        this.units = active;
        return hits;
    }
}
