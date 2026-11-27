import { PATH } from '../config/DefenseConfig';
import { ENEMIES, EnemyKind } from '../config/EnemyConfig';
import { ROAD_PROFILE } from '../config/RoadGeometry';
import { ROAD_MOVEMENT } from '../config/RoadMovementConfig';
import { appearanceSeed } from './EnemySeed';

// 保留首版进度轴及长度。道路变宽只改变横向坐标，不重算到门时间或索敌优先级。
const LENGTHS = PATH.slice(1).map((p, i) => Math.hypot(p.x - PATH[i].x, p.y - PATH[i].y));
export const PATH_LENGTH = LENGTHS.reduce((a, b) => a + b, 0);
function progressY(progress: number) {
    let left = progress;
    for (let i = 0; i < LENGTHS.length; i++) {
        if (left <= LENGTHS[i])
            return PATH[i].y + (PATH[i + 1].y - PATH[i].y) * left / LENGTHS[i];
        left -= LENGTHS[i];
    }
    return PATH[PATH.length - 1].y;
}
export function pointAt(progress: number) {
    const y = progressY(progress);
    const { left, right } = roadFootprintBounds(y, { halfWidth: 0, back: 0, front: 0 });
    return { x: (left + right) / 2, y };
}

type RoadFootprint = { halfWidth: number; back: number; front: number };
export interface RoadPoint { x: number; y: number; }
/** 施放目标只允许当前来敌经过的土路，排除草地和城门后的横路。 */
export function onBattleRoad(at: RoadPoint): boolean {
    if (!Number.isFinite(at.x) || !Number.isFinite(at.y) || at.y < PATH[0].y || at.y > PATH[PATH.length - 1].y) return false;
    const { left, right } = roadFootprintBounds(at.y, { halfWidth: 0, back: 0, front: 0 });
    return at.x >= left && at.x <= right;
}
/** 取整个足部纵深内左右边界的交集；怪物与临时冲锋角色复用同一道路剖面。 */
export function roadFootprintBounds(y: number, footprint: EnemyKind | RoadFootprint) {
    const size = typeof footprint === "string" ? (ENEMIES[footprint].boss ? ROAD_MOVEMENT.boss : ROAD_MOVEMENT.ordinary) : footprint;
    const top = y - size.back, bottom = y + size.front;
    const first = ROAD_PROFILE[0][0], step = ROAD_PROFILE[1][0] - first;
    if (!Number.isFinite(y) || top < first || bottom > ROAD_PROFILE[ROAD_PROFILE.length - 1][0]) throw new Error('怪物足点超出道路采样范围');
    let left = -Infinity, right = Infinity;
    const sample = (at: number) => {
        const i = Math.min(Math.floor((at - first) / step), ROAD_PROFILE.length - 2), a = ROAD_PROFILE[i], b = ROAD_PROFILE[i + 1], t = (at - a[0]) / step;
        left = Math.max(left, a[1] + (b[1] - a[1]) * t);
        right = Math.min(right, a[2] + (b[2] - a[2]) * t);
    };
    sample(top); sample(bottom);
    for (let at = first + (Math.floor((top - first) / step) + 1) * step; at < bottom; at += step) sample(at);
    left += size.halfWidth; right -= size.halfWidth;
    if (left > right) throw new Error('路面不足以容纳足部：' + (typeof footprint === "string" ? footprint : y));
    return { left, right };
}

/** 新入场单怪预采样一个固定横位，无需为路径或表现消耗业务随机数。 */
export function spreadRoadLane(seq: number) {
    const { formation, spread, laneStep } = ROAD_MOVEMENT;
    const group = Math.floor(seq / formation.size), count = spread.laneBands.length;
    const lead = appearanceSeed(spread.seedDomain, group) % count;
    const roll = appearanceSeed(spread.seedDomain, seq, group) % formation.sampleSize;
    const offset = spread.offsets[roll < spread.mainWeight ? 0 : 1 + Math.floor((roll - spread.mainWeight) / spread.otherWeight)];
    const jitter = ((seq * laneStep + .5) % 1 - .5) * spread.laneJitter;
    return spread.laneBands[(lead + offset + count) % count] + jitter;
}

function originalRoadLane(seq: number) {
    const { laneBands, laneStep, laneJitter, formation } = ROAD_MOVEMENT;
    const group = Math.floor(seq / formation.size);
    const leadLane = appearanceSeed(formation.seedDomain, group) % laneBands.length;
    const roll = appearanceSeed(formation.seedDomain, seq, group) % formation.sampleSize;
    const laneOffset = roll < formation.mainWeight ? 0 : roll < formation.mainWeight + formation.secondWeight ? 1 : 2;
    const laneIndex = (leadLane + laneOffset) % laneBands.length;
    const phase = (seq * laneStep + .5) % 1 - .5;
    return laneBands[laneIndex] + phase * laneJitter;
}

/** 渲染与战斗共用足点。没有预采样横位的旧夜继续按原三条带重演。 */
export function enemyPoint(enemy: { seq: number; kind: EnemyKind; progress: number; roadLane?: number }) {
    const y = progressY(enemy.progress), bounds = roadFootprintBounds(y, enemy.kind);
    const lane = enemy.roadLane ?? originalRoadLane(enemy.seq);
    const t = Math.max(0, (y - ROAD_MOVEMENT.gatherY) / (PATH[PATH.length - 1].y - ROAD_MOVEMENT.gatherY));
    const gather = t * t * (3 - 2 * t);
    const width = bounds.right - bounds.left + 2 * ROAD_MOVEMENT.shoulderAllowance;
    return { x: (bounds.left + bounds.right) / 2 + width * lane * (1 - gather), y };
}
