import { BattleSimulation, CombatFeedback, Enemy, Shot } from '../game/BattleSimulation';
import { enemyPoint } from '../game/BattleRoad';
import { FEEDBACK } from './config/FeedbackConfig';
import { RULE } from '../game/GameConfig';
/** 独立视觉时间线。死亡快照不进入 simulation.enemies；保留统一死亡位置供迟到弹道使用。 */
export class CombatPresentation {
    private battle: BattleSimulation | null = null;
    private clock = 0;
    private tailSeconds = 0;
    private defeatCue = false;
    get time() { return this.clock; }
    /** 逻辑结算后仅补完在途弹体，绝不改写 simulation.tick 或重新运行战斗。 */
    get presentationTick() { return this.battle ? this.battle.tick + this.tailSeconds / RULE.step : 0; }
    readonly shots = new Map<Shot, Extract<CombatFeedback, { type: 'shot' }>>();
    readonly deaths = new Map<number, { enemy: Enemy; fatal: Shot | null; started: number | null }>();
    private deathPositions = new Map<number, { x: number; y: number }>();
    private flashes = new Map<number, number>();
    private retired = new Set<number>();
    sync(battle: BattleSimulation | null, events: CombatFeedback[]) {
        if (battle !== this.battle || !battle) {
            this.battle = battle; this.shots.clear(); this.deaths.clear(); this.deathPositions.clear(); this.flashes.clear(); this.retired.clear();
            this.tailSeconds = 0; this.defeatCue = false;
        }
        if (!battle) return;
        for (const event of events) {
            if (event.type === 'gate') {
                this.deathPositions.set(event.enemy.seq, enemyPoint(event.enemy));
                this.flashes.delete(event.enemy.seq);
                if (!this.retired.has(event.enemy.seq)) this.deaths.set(event.enemy.seq, { enemy: event.enemy, fatal: null, started: this.clock });
            } else {
                this.shots.set(event.shot, event);
                for (const enemy of event.hurt) if (enemy.hp <= 0 && !this.retired.has(enemy.seq)) {
                    this.deathPositions.set(enemy.seq, enemyPoint(enemy));
                    if (!this.deaths.has(enemy.seq)) this.deaths.set(enemy.seq, { enemy, fatal: event.shot, started: null });
                }
            }
        }
    }
    advance(delta: number) {
        this.clock += delta;
        if (this.battle?.outcome) this.tailSeconds += delta;
        for (const [seq, end] of this.flashes) if (end <= this.clock) this.flashes.delete(seq);
        const duration = FEEDBACK.death.squashSeconds + FEEDBACK.death.holdSeconds + FEEDBACK.death.fadeSeconds;
        for (const [seq, death] of this.deaths) if (death.started !== null && this.clock - death.started >= duration) { this.deaths.delete(seq); this.flashes.delete(seq); this.retired.add(seq); }
    }
    /** 死亡帧固定于快照；只压缩脚底以上的高度并淡出，等待致死弹体时仍保持完整身形。 */
    deathPose(seq: number): { scaleY: number; alpha: number } | undefined {
        const death = this.deaths.get(seq);
        if (!death || death.started === null) return undefined;
        const spec = FEEDBACK.death, age = this.clock - death.started;
        const t = Math.min(1, age / spec.squashSeconds);
        return { scaleY: 1 - (1 - spec.scaleY) * (1 - (1 - t) * (1 - t)),
            alpha: 1 - Math.max(0, Math.min(1, (age - spec.squashSeconds - spec.holdSeconds) / spec.fadeSeconds)) };
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
            const death = this.deaths.get(enemy.seq);
            if (death && death.started !== null) continue;
            if (this.battle?.enemies.some(e => e.seq === enemy.seq) || this.deaths.has(enemy.seq)) this.flashes.set(enemy.seq, this.clock + FEEDBACK.flashSeconds);
            if (death?.fatal === shot) this.startDefeat(death);
        }
    }
    flashing(seq: number) { return this.flashes.has(seq); }
    hitShake(seq: number) {
        const end = this.flashes.get(seq);
        if (end === undefined) return 0;
        const spec = FEEDBACK.hitShake, age = this.clock - (end - FEEDBACK.flashSeconds);
        const t = Math.max(0, Math.min(1, age / spec.seconds));
        return spec.pixels * (1 - t) * (1 - t) * Math.cos(t * Math.PI * 2 * spec.cycles);
    }
    /** 超出原弹道装饰上限时直接开始死亡过渡，不伪造红闪，也不留下等不到致死弹体的快照。 */
    discard(shot: Shot) {
        for (const death of this.deaths.values()) if (death.fatal === shot && death.started === null) this.startDefeat(death);
        this.shots.delete(shot);
    }
    private startDefeat(death: { started: number | null }) {
        death.started = this.clock;
        this.defeatCue = true;
    }
    /** 同一渲染帧内的多杀合成一次播放请求；暂停消耗请求，不堆积待播声音。 */
    takeDefeatCue() {
        const cue = this.defeatCue;
        this.defeatCue = false;
        return cue;
    }
}
