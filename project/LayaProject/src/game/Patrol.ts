import { PATROL } from "../config/PatrolConfig";
import { RULE } from "../config/RuleConfig";
import { ENEMIES } from "../config/EnemyConfig";
import { SUMMON_CHARGE } from "../config/TacticConfig";
import { PATH_LENGTH, RoadPoint } from "./BattleRoad";
import { GameState } from "./GameState";
import { patrolCaptain, patrolSpinStats, patrolStats } from "./PatrolRules";
import { lanePoint, SummonCollision } from "./SummonCharge";
import { PatrolSpin } from "./PatrolSpin";
import type { Enemy } from "./BattleSimulation";

export interface PatrolTarget { enemy: Enemy; fromY: number; at: RoadPoint; }

interface PatrolUnit {
    index: number; progress: number; lane: number; speed: number; at: RoadPoint; distance: number;
}

/** 巡卫是夜战临时单位。碰撞坐标与显示脚底共用；夜战冷启动按战前快照重放。 */
export class Patrol {
    units: PatrolUnit[] = [];
    readonly stats: ReturnType<typeof patrolStats>;
    private readonly squad: boolean;
    readonly spin: PatrolSpin | null;
    private due = Math.round(PATROL.first / RULE.step);
    deployments = 0;
    kills = 0;

    constructor(state: GameState) {
        this.squad = state.night?.patrolSquad === true;
        const captain = patrolCaptain(state);
        this.stats = state.night?.patrolSpin ? patrolSpinStats(state.patrol.level, captain, state.night.patrolRation)
            : patrolStats(state.patrol.level, captain, this.squad);
        this.spin = state.night?.patrolSpin ? new PatrolSpin(this.stats) : null;
    }

    secondsUntil(tick: number) { return this.spin?.secondsUntil(tick) ?? Math.max(0, this.due - tick) * RULE.step; }

    advance(tick: number, targets: readonly PatrolTarget[]): SummonCollision[] {
        if (this.spin) {
            const hits = this.spin.advance(tick, targets);
            this.deployments = this.spin.deployments;
            this.kills += hits.filter(hit => hit.enemy.hp <= 0).length;
            return hits;
        }
        const activeLimit = this.squad ? PATROL.squad.maxActive : PATROL.legacy.maxActive;
        if (tick >= this.due && this.units.length < activeLimit) {
            // 相邻出征轮换速度和路径，夜战重放不消耗村庄随机源。
            const index = this.deployments++;
            const lanes = this.squad ? PATROL.squad.lanes : PATROL.legacy.lanes;
            const lane = lanes[index % lanes.length], speed = this.squad ? PATROL.squad.speeds[index % PATROL.squad.speeds.length] : PATROL.legacy.speed;
            this.units.push({ index, progress: PATH_LENGTH, lane, speed, at: lanePoint(PATH_LENGTH, 0), distance: 0 });
            this.due = tick + this.stats.ticks;
        }
        const hits: SummonCollision[] = [];
        const active: PatrolUnit[] = [];
        for (const unit of this.units) {
            const from = unit.at;
            unit.progress = Math.max(0, unit.progress - unit.speed * RULE.step);
            // 出门统一从中间开始，走过一段后才分到不同的路面位置。
            unit.at = lanePoint(unit.progress, unit.lane * Math.min(1, (PATH_LENGTH - unit.progress) / PATROL.spreadDistance));
            unit.distance += Math.hypot(unit.at.x - from.x, unit.at.y - from.y);
            let contact: PatrolTarget | null = null, first = Infinity;
            for (const target of targets) {
                const enemy = target.enemy;
                if (enemy.hp <= 0) continue;
                let order: number;
                if (this.squad) {
                    // 双方上一战斗步和本步都处在道路上。相对 Y 交错时按遇见先后结算，横向错开仍命中。
                    const startGap = from.y - target.fromY, endGap = unit.at.y - target.at.y;
                    if (startGap < 0 || endGap > 0) continue;
                    order = startGap === 0 ? 0 : startGap / (startGap - endGap);
                } else {
                    // 未标记的旧夜战沿用脚底椭圆与距离排序。
                    const radius = ENEMIES[enemy.kind].boss ? SUMMON_CHARGE.contact.boss : SUMMON_CHARGE.contact.ordinary;
                    const x = unit.at.x - target.at.x, y = unit.at.y - target.at.y;
                    if ((x / radius.x) ** 2 + (y / radius.y) ** 2 > 1) continue;
                    order = x * x + y * y;
                }
                if (order < first || order === first && contact && enemy.seq < contact.enemy.seq) {
                    contact = target;
                    first = order;
                }
            }
            if (!contact) {
                if (unit.progress > 0) active.push(unit);
                continue;
            }
            const enemy = contact.enemy;
            enemy.hp -= Math.max(1, Math.floor(this.stats.damage * (1 - ENEMIES[enemy.kind].armor)));
            if (enemy.hp <= 0) this.kills++;
            hits.push({ enemy: { ...enemy }, index: unit.index, at: this.squad ? contact.at : unit.at,
                dx: unit.at.x - from.x, dy: unit.at.y - from.y });
        }
        this.units = active;
        return hits;
    }
}
