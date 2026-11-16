import { PATH } from '../config/DefenseConfig';
import { ENEMIES, EnemyKind } from '../config/EnemyConfig';
import { ROAD_PROFILE } from '../config/RoadGeometry';
import { ROAD_MOVEMENT } from '../config/RoadMovementConfig';

// 保留首版进度轴及长度。道路变宽只改变横向坐标，不重算到门时间或索敌优先级。
const LENGTHS = PATH.slice(1).map((p, i) => Math.hypot(p.x - PATH[i].x, p.y - PATH[i].y));
export const PATH_LENGTH = LENGTHS.reduce((a, b) => a + b, 0);
export function pointAt(progress: number) {
    let left = progress;
    for (let i = 0; i < LENGTHS.length; i++) {
        if (left <= LENGTHS[i]) {
            const t = left / LENGTHS[i];
            return { x: PATH[i].x + (PATH[i + 1].x - PATH[i].x) * t, y: PATH[i].y + (PATH[i + 1].y - PATH[i].y) * t };
        }
        left -= LENGTHS[i];
    }
    return PATH[PATH.length - 1];
}

/** 取整个足部纵深内左右边界的交集；各段线性，因此只需区间端点和经过的采样行。 */
export function roadFootprintBounds(y: number, kind: EnemyKind) {
    const size = ENEMIES[kind].boss ? ROAD_MOVEMENT.boss : ROAD_MOVEMENT.ordinary;
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
    if (left > right) throw new Error('路面不足以容纳怪物足部：' + kind);
    return { left, right };
}

/** 渲染、索敌、溅射、扰阵、弹道和死亡快照的唯一敌人坐标。只读序号/种类/进度。 */
export function enemyPoint(enemy: { seq: number; kind: EnemyKind; progress: number }) {
    const { y } = pointAt(enemy.progress), bounds = roadFootprintBounds(y, enemy.kind);
    const lane = ((enemy.seq * ROAD_MOVEMENT.laneStep + .5) % 1 - .5) * ROAD_MOVEMENT.laneSpread;
    const t = Math.max(0, (y - ROAD_MOVEMENT.gatherY) / (PATH[PATH.length - 1].y - ROAD_MOVEMENT.gatherY));
    const gather = t * t * (3 - 2 * t);
    return { x: (bounds.left + bounds.right) / 2 + (bounds.right - bounds.left) * lane * (1 - gather), y };
}
