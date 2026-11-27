import type { GameLayout } from "./GameLayout";
import type { GroundPoint, VillageNavigation } from "./VillageScene";
import { WalkDirection, walkDirection } from "./VillagerAppearance";

/** 白天人物沿现有村庄障碍图走动。逻辑像素与表现秒独立于存档和夜战。 */
const MOTION = { speed: 42, idleSeconds: 2.3, tempo: .65 } as const;

export class HeroStroll {
    private at: GroundPoint | null = null;
    private nextStop = 1;
    private path: GroundPoint[] = [];
    direction: WalkDirection = "DOWN";
    private pause: number = MOTION.idleSeconds;
    elapsed = 0;

    constructor(private readonly points: readonly GroundPoint[]) {}

    get standing() { return this.pause > 0; }
    get walking() { return this.path.length > 0; }

    position(layout: GameLayout) {
        return this.at ?? { x: this.points[0].x, y: layout.worldY(this.points[0].y) };
    }

    reset() {
        this.at = null;
        this.nextStop = 1;
        this.path = [];
        this.direction = "DOWN";
        this.pause = MOTION.idleSeconds;
        this.elapsed = 0;
    }

    relayout(previous: GameLayout, next: GameLayout, navigation: VillageNavigation) {
        if (!this.at) return;
        this.at = navigation.relocate({ x: this.at.x, y: next.worldY(previous.referenceY(this.at.y)) });
        this.path = [];
    }

    advance(delta: number, layout: GameLayout, navigation: VillageNavigation) {
        const at = this.at ??= this.position(layout);
        if (this.pause > 0) {
            this.pause = Math.max(0, this.pause - delta);
            return;
        }
        if (!this.path.length) {
            const goal = this.points[this.nextStop];
            this.path = navigation.route(at, { x: goal.x, y: layout.worldY(goal.y) });
            this.elapsed = 0;
        }
        const goal = this.path[0], dx = goal.x - at.x, dy = goal.y - at.y;
        const distance = Math.hypot(dx, dy), step = MOTION.speed * delta;
        this.direction = walkDirection(dx, dy, this.direction);
        if (distance <= step) {
            this.at = this.path.shift()!;
            if (!this.path.length) {
                this.nextStop = (this.nextStop + 1) % this.points.length;
                this.pause = MOTION.idleSeconds;
            }
        } else {
            at.x += dx * step / distance;
            at.y += dy * step / distance;
        }
        this.elapsed += delta * MOTION.tempo;
    }
}
