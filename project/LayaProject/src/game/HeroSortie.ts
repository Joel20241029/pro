import { ExtendedHeroSortie, HERO, SLOWER_HERO_SORTIE, SONGLEI } from "../config/HeroConfig";
import type { WaveRhythm } from "../config/DefenseConfig";
import { ENEMIES } from "../config/EnemyConfig";
import { RULE } from "../config/RuleConfig";
import { PATH_LENGTH, pointAt, roadFootprintBounds, RoadPoint } from "./BattleRoad";
import type { Enemy } from "./BattleSimulation";
import { enemyPower } from "./Growth";
import { waveDifficulty } from "./WaveDifficulty";
import { appearanceSeed } from "./EnemySeed";
import type { GameState } from "./GameState";

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";
type Phase = "sortie" | "returning" | "resting";
type Motion = "idle" | "walk" | "attack";
export type HeroTarget = { enemy: Enemy; at: RoadPoint };
export type HeroHit = { at: RoadPoint; hurt: Enemy[]; strike: 0 | 1; direction: Direction; electric?: true };

const MOUTH = pointAt(PATH_LENGTH);
const FOOTPRINT = { halfWidth: HERO.roadEdgeInset, back: 0, front: 0 };
/** 独立战斗随机域，同一夜读档重试可复演，调整抽样不影响村民或敌阵。 */
const PARALYSIS_SEED = 0x50415241;
const DIRECTIONS: Record<Direction, RoadPoint> = {
    UP: { x: 0, y: -1 }, DOWN: { x: 0, y: 1 }, LEFT: { x: -1, y: 0 }, RIGHT: { x: 1, y: 0 }
};
/** 村委会预览与战斗快照共用单瓶伤害，按当夜成长取整。 */
export function heroStrikeDamage(day: number, rhythm: WaveRhythm | undefined, solo = true, electric = false) {
    return Math.floor((electric ? SONGLEI.damage : solo ? HERO.duel.bottleDamage : HERO.bottleDamage) *
        (rhythm === undefined ? enemyPower(day) : waveDifficulty(day, rhythm).health));
}

export function paralyzed(enemy: Enemy, tick: number) {
    return enemy.paralyzedUntil !== undefined && tick < enemy.paralyzedUntil;
}

/** 村委会与招募事务复用同一门槛。 */
export function songLeiRecruitmentReason(state: GameState) {
    const { waves, coins } = SONGLEI.recruitment;
    if (state.songLeiUnlocked) return `${SONGLEI.name}已加入`;
    if (state.completed < waves) return `守住 ${waves} 波后可招募`;
    if (state.coins < coins) return "尔币不足";
    return null;
}

/** Per-battle outing. Progress after the opening snapshot stays inside simulation, like the patrol. */
export class HeroSortie {
    readonly position: RoadPoint = { ...HERO.restPoint };
    direction: Direction = "UP";
    phase: Phase = "sortie";
    motion: Motion = "idle";
    motionSeconds = 0;
    private phaseEndsAt: number;
    private readonly sortieTicks: number;
    private readonly movementScale: number;
    private readonly walkTempo: number;
    private readonly attackTicks: number;
    private readonly strikeTicks: number[];
    private lockedTarget: number | null = null;
    private attackAt: number | null = null;
    private nextAttackAt = 0;

    constructor(readonly damage: number, reinforced: boolean, extended?: ExtendedHeroSortie, private readonly solo = false,
        readonly actorId: typeof HERO.actorId | typeof SONGLEI.actorId = HERO.actorId) {
        const pace = extended === SLOWER_HERO_SORTIE ? HERO.slowerPace : 1;
        this.movementScale = (extended ? HERO.extendedMovementScale : reinforced ? HERO.movementScale : 1) * pace;
        this.sortieTicks = Math.round((extended ? HERO.extendedSortieSeconds : HERO.sortieSeconds) / RULE.step);
        this.phaseEndsAt = this.sortieTicks;
        this.walkTempo = extended ? HERO.extendedWalkTempo * pace : 1;
        this.attackTicks = Math.round((this.electric ? SONGLEI.interval : solo ? HERO.duel.interval : HERO.attackSeconds) / RULE.step);
        // 四帧映射到当轮时长，命中始终与两张实际接触帧对齐。
        this.strikeTicks = HERO.strikeFrames.map(frame => Math.ceil(this.attackTicks * frame / HERO.attackFrames));
    }

    get electric() { return this.actorId === SONGLEI.actorId; }

    get atGate() {
        return this.phase !== "resting" && Math.abs(this.position.y - HERO.gateY) <= HERO.gateTriggerDistance;
    }

    secondsRemaining(tick: number) {
        return this.phase === "returning" ? 0 : Math.max(0, this.phaseEndsAt - tick) * RULE.step;
    }

    advance(tick: number, targets: readonly HeroTarget[]): HeroHit | null {
        if (this.phase === "resting") {
            if (tick < this.phaseEndsAt) return null;
            this.phase = "sortie";
            this.phaseEndsAt = tick + this.sortieTicks;
            this.nextAttackAt = tick;
        }
        if (this.phase === "sortie" && tick >= this.phaseEndsAt) {
            this.phase = "returning";
            this.attackAt = null;
        }
        if (this.phase === "returning") {
            const destination = this.position.y < MOUTH.y ? MOUTH : HERO.restPoint;
            if (this.move(destination, HERO.returnSpeed * this.movementScale) && destination === HERO.restPoint) {
                this.phase = "resting";
                this.phaseEndsAt = tick + Math.round(HERO.restSeconds / RULE.step);
                this.motion = "idle";
                this.motionSeconds = 0;
            }
            return null;
        }
        const speed = this.electric ? SONGLEI.walkSpeed : HERO.walkSpeed * this.movementScale;
        if (this.position.y > MOUTH.y) {
            this.move(MOUTH, speed);
            return null;
        }
        if (this.attackAt !== null) {
            const elapsed = tick - this.attackAt;
            if (elapsed < this.attackTicks) {
                this.motionSeconds = elapsed * HERO.attackSeconds / this.attackTicks;
                const strike = this.strikeTicks.indexOf(elapsed);
                return strike === 0 || strike === 1 ? this.strike(tick, targets, strike) : null;
            }
            this.attackAt = null;
        }
        const target = this.electric ? this.closestToGate(tick, targets) : this.closest(targets);
        if (!target) {
            this.motion = "idle";
            this.motionSeconds = 0;
        } else if (Math.hypot(target.at.x - this.position.x, target.at.y - this.position.y) <= (this.electric ? SONGLEI.windupRange : HERO.windupRange)) {
            this.face(target.at.x - this.position.x, target.at.y - this.position.y);
            if (tick < this.nextAttackAt) {
                this.motion = "idle";
                this.motionSeconds = 0;
                return null;
            }
            this.attackAt = tick;
            this.lockedTarget = this.solo || this.electric ? target.enemy.seq : null;
            this.motion = "attack";
            this.motionSeconds = 0;
        } else {
            this.move(target.at, speed);
        }
        return null;
    }

    private closestToGate(tick: number, targets: readonly HeroTarget[]) {
        let best: HeroTarget | undefined;
        for (const target of targets) {
            const { enemy } = target;
            if (enemy.hp <= 0 || paralyzed(enemy, tick)) continue;
            if (!best || enemy.progress > best.enemy.progress ||
                enemy.progress === best.enemy.progress && enemy.seq < best.enemy.seq) best = target;
        }
        return best;
    }

    private closest(targets: readonly HeroTarget[]) {
        let best: HeroTarget | undefined;
        let bestDistance = Infinity;
        let bestIsBoss = false;
        for (const target of targets) {
            const { enemy, at } = target;
            if (enemy.hp <= 0) continue;
            const distance = Math.hypot(at.x - this.position.x, at.y - this.position.y);
            const boss = this.solo && distance <= HERO.windupRange && ENEMIES[enemy.kind].boss;
            if (boss !== bestIsBoss ? boss : distance < bestDistance || distance === bestDistance && best && enemy.seq < best.enemy.seq) {
                best = target;
                bestDistance = distance;
                bestIsBoss = boss;
            }
        }
        return best;
    }

    private strike(tick: number, targets: readonly HeroTarget[], strike: 0 | 1): HeroHit {
        const forward = DIRECTIONS[this.direction], near: { target: HeroTarget; distance: number }[] = [];
        for (const target of targets) {
            if (target.enemy.hp <= 0 || ((this.solo || this.electric) && target.enemy.seq !== this.lockedTarget)) continue;
            if (this.electric && paralyzed(target.enemy, tick)) continue;
            const dx = target.at.x - this.position.x, dy = target.at.y - this.position.y;
            const distance = Math.hypot(dx, dy);
            if (distance <= (this.electric ? SONGLEI.hitRange : HERO.hitRange) && dx * forward.x + dy * forward.y >= distance * HERO.sweepCos)
                near.push({ target, distance });
        }
        near.sort((a, b) => a.distance - b.distance || a.target.enemy.seq - b.target.enemy.seq);
        const hurt = near.slice(0, this.solo || this.electric ? 1 : HERO.targetsPerBottle).map(({ target: { enemy } }) => {
            const boss = (this.solo || this.electric) && ENEMIES[enemy.kind].boss;
            enemy.hp -= !this.electric && this.solo && boss ? Math.floor(this.damage * HERO.duel.bossMultiplier) : this.damage;
            if (this.electric && enemy.hp > 0 && appearanceSeed(PARALYSIS_SEED, enemy.appearanceSeed, enemy.seq, tick, strike) % 100 < SONGLEI.paralysis.chancePercent) {
                enemy.paralyzedUntil = tick + Math.round((boss ? SONGLEI.paralysis.bossSeconds : SONGLEI.paralysis.seconds) / RULE.step);
                this.nextAttackAt = this.attackAt! + this.attackTicks;
                this.attackAt = null;
            }
            return { ...enemy };
        });
        return this.electric ? { at: { ...this.position }, hurt, strike, direction: this.direction, electric: true }
            : { at: { ...this.position }, hurt, strike, direction: this.direction };
    }

    private move(goal: RoadPoint, speed: number): boolean {
        const previous = { ...this.position };
        const dx = goal.x - previous.x, dy = goal.y - previous.y, distance = Math.hypot(dx, dy);
        const step = speed * RULE.step, reached = distance <= step;
        this.position.x = reached ? goal.x : previous.x + dx / distance * step;
        this.position.y = reached ? goal.y : previous.y + dy / distance * step;
        if (this.position.y <= MOUTH.y) {
            const { left, right } = roadFootprintBounds(this.position.y, FOOTPRINT);
            this.position.x = Math.max(left, Math.min(right, this.position.x));
        }
        this.face(this.position.x - previous.x, this.position.y - previous.y);
        this.motionSeconds = this.motion === "walk" ? this.motionSeconds + RULE.step * this.walkTempo : 0;
        this.motion = "walk";
        return reached;
    }

    private face(dx: number, dy: number) {
        if (dx === 0 && dy === 0) return;
        this.direction = Math.abs(dx) > Math.abs(dy) ? dx < 0 ? "LEFT" : "RIGHT" : dy < 0 ? "UP" : "DOWN";
    }
}
