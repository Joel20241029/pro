import { BattleSimulation, CombatFeedback, Enemy, Shot } from '../game/BattleSimulation';
import { enemyPoint } from '../game/BattleRoad';
import { FEEDBACK } from './config/FeedbackConfig';
/** 独立视觉时间线。死亡快照不进入 simulation.enemies；保留统一死亡位置供迟到弹道使用。 */
export class CombatPresentation {
    private battle: BattleSimulation | null = null;
    private clock = 0;
    readonly shots = new Map<Shot, Extract<CombatFeedback, { type: 'shot' }>>();
    readonly deaths = new Map<number, { enemy: Enemy; fatal: Shot; until: number | null }>();
    private deathPositions = new Map<number, { x: number; y: number }>();
    private flashes = new Map<number, number>();
    private retired = new Set<number>();
    sync(battle: BattleSimulation | null, events: CombatFeedback[]) {
        if (battle !== this.battle || !battle || battle.outcome) {
            this.battle = battle; this.shots.clear(); this.deaths.clear(); this.deathPositions.clear(); this.flashes.clear(); this.retired.clear();
        }
        if (!battle || battle.outcome) return;
        for (const event of events) {
            if (event.type === 'gate') {
                this.deathPositions.set(event.enemy.seq, enemyPoint(event.enemy));
                this.retired.add(event.enemy.seq); this.deaths.delete(event.enemy.seq); this.flashes.delete(event.enemy.seq);
            } else {
                this.shots.set(event.shot, event);
                for (const enemy of event.hurt) if (enemy.hp <= 0 && !this.retired.has(enemy.seq)) {
                    this.deathPositions.set(enemy.seq, enemyPoint(enemy));
                    if (!this.deaths.has(enemy.seq)) this.deaths.set(enemy.seq, { enemy, fatal: event.shot, until: null });
                }
            }
        }
    }
    advance(delta: number) {
        this.clock += delta;
        for (const [seq, end] of this.flashes) if (end <= this.clock) this.flashes.delete(seq);
        for (const [seq, death] of this.deaths) if (death.until !== null && death.until <= this.clock) { this.deaths.delete(seq); this.retired.add(seq); }
    }
    target(shot: Shot): { x: number; y: number } {
        const event = this.shots.get(shot);
        if (!event) return { x: shot.x, y: shot.y }; // 现有Shot单独预览仍使用其原始落点。
        const alive = this.battle?.enemies.find(e => e.seq === event.target);
        return alive ? enemyPoint(alive) : this.deathPositions.get(event.target) || { x: shot.x, y: shot.y };
    }
    impact(shot: Shot) {
        const event = this.shots.get(shot);
        if (!event) return;
        for (const enemy of event.hurt) {
            if (this.retired.has(enemy.seq)) continue;
            if (this.battle?.enemies.some(e => e.seq === enemy.seq) || this.deaths.has(enemy.seq)) this.flashes.set(enemy.seq, this.clock + FEEDBACK.flashSeconds);
            const death = this.deaths.get(enemy.seq);
            if (death?.fatal === shot) death.until = this.clock + FEEDBACK.flashSeconds;
        }
    }
    flashing(seq: number) { return this.flashes.has(seq); }
    /** 超出现有弹道装饰上限时同步回收对应显示快照，不留下永远等不到的致死落点。 */
    discard(shot: Shot) {
        for (const [seq, death] of this.deaths) if (death.fatal === shot && death.until === null) { this.deaths.delete(seq); this.retired.add(seq); }
        this.shots.delete(shot);
    }
}
