import { PATROL } from "../config/PatrolConfig";
import { ENEMIES } from "../config/EnemyConfig";
import type { RoadPoint } from "./BattleRoad";
import { contactTime, EnemyRoadStep, SummonCollision } from "./SummonCharge";

import type { Person } from "./GameState";

const spec = PATROL.rapid;

export function patrolRapidCapacity(level: number) {
    return spec.capacity + (level - PATROL.startLevel) * spec.roundsPerLevel;
}

export function patrolRapidDamage(spinDamage: number) {
    return Math.max(1, Math.round(spinDamage * spec.damageShare));
}

/** 灵巧在机关枪模式，仅缩短打空后的整仓补弹。 */
export function patrolReloadSeconds(captain?: Person) {
    return spec.reloadSeconds * (captain?.traits.includes("trait_nimble") ? 1 - spec.nimbleReloadReduction : 1);
}

interface RapidProjectile {
    index: number;
    at: RoadPoint;
    direction: RoadPoint;
}

/** 城门弹仓和在途小人属于单场夜战。射向取自扣弹瞬间，松手只停后续发射。 */
export class PatrolRapid {
    readonly capacity: number;
    ammo: number;
    reloadRemaining = 0;
    shotsFired = 0;
    elapsedSeconds = 0;
    direction: RoadPoint = { x: 0, y: -1 };
    readonly projectiles: RapidProjectile[] = [];
    readonly damage: number;
    private held = false;
    private intervalLeft = 0;
    private muzzle: RoadPoint = spec.origin;

    constructor(spinDamage: number, level: number, readonly reloadSeconds: number) {
        this.capacity = patrolRapidCapacity(level);
        this.ammo = this.capacity;
        this.damage = patrolRapidDamage(spinDamage);
    }

    aim(direction: RoadPoint, origin: RoadPoint, muzzleDistance: number) {
        const length = Math.hypot(direction.x, direction.y);
        if (!this.ammo || !Number.isFinite(length) || length === 0 || !Number.isFinite(origin.x) ||
            !Number.isFinite(origin.y) || !Number.isFinite(muzzleDistance) || muzzleDistance < 0) return false;
        this.direction = { x: direction.x / length, y: direction.y / length };
        this.muzzle = { x: origin.x + muzzleDistance * this.direction.x, y: origin.y + muzzleDistance * this.direction.y };
        this.held = true;
        return true;
    }

    stop() { this.held = false; this.intervalLeft = Math.max(0, this.intervalLeft); }

    get needsTargets() { return this.held || this.projectiles.length > 0; }

    advance(realSeconds: number, traces: readonly EnemyRoadStep[]): SummonCollision[] {
        this.elapsedSeconds += realSeconds;
        if (!this.ammo) {
            this.reloadRemaining = Math.max(0, this.reloadRemaining - realSeconds);
            if (this.reloadRemaining < 1e-9) { this.reloadRemaining = 0; this.ammo = this.capacity; }
        }
        if (this.held && this.intervalLeft <= 1e-9) {
            this.projectiles.push({ index: this.shotsFired++, at: this.muzzle, direction: this.direction });
            this.ammo--;
            this.intervalLeft += 1 / spec.shotsPerSecond;
            if (!this.ammo) { this.stop(); this.reloadRemaining = this.reloadSeconds; }
        }
        this.intervalLeft -= realSeconds;
        // 半速时两发之间是 7.5 个战斗步。连射保留不足一步的余量，停火不积攒弹数。
        if (!this.held) this.intervalLeft = Math.max(0, this.intervalLeft);
        const hits: SummonCollision[] = [];
        const distance = spec.speed * realSeconds;
        for (let i = 0; i < this.projectiles.length;) {
            const bullet = this.projectiles[i], from = bullet.at;
            const dx = bullet.direction.x * distance, dy = bullet.direction.y * distance;
            const to = { x: from.x + dx, y: from.y + dy };
            // 同一弹步只有普通/首领两个躯干高度，不逐怪为弹道创建临时对象。
            const ordinary = { from: { x: from.x, y: from.y + spec.ordinaryCenterHeight },
                to: { x: to.x, y: to.y + spec.ordinaryCenterHeight }, end: 1 };
            const boss = { from: { x: from.x, y: from.y + spec.bossCenterHeight },
                to: { x: to.x, y: to.y + spec.bossCenterHeight }, end: 1 };
            let first = Infinity, contact: EnemyRoadStep | undefined;
            for (const trace of traces) {
                if (trace.enemy.hp <= 0) continue;
                const isBoss = ENEMIES[trace.enemy.kind].boss;
                const point = contactTime(isBoss ? boss : ordinary, trace, isBoss ? spec.contact.boss : spec.contact.ordinary);
                if (point <= trace.end && (point < first || point === first && contact && trace.enemy.seq < contact.enemy.seq)) {
                    first = point;
                    contact = trace;
                }
            }
            if (contact) {
                contact.enemy.hp -= this.damage;
                hits.push({ enemy: { ...contact.enemy }, index: bullet.index, at: { x: from.x + dx * first, y: from.y + dy * first }, dx, dy });
            }
            if (contact || to.x < 0 || to.x > PATROL.spin.map.width || to.y < PATROL.spin.map.top || to.y > PATROL.spin.map.bottom) {
                this.projectiles.splice(i, 1);
            } else {
                bullet.at = to;
                i++;
            }
        }
        return hits;
    }
}
