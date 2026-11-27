import { BattleSimulation, CombatFeedback, Enemy, Shot } from '../game/BattleSimulation';
import { enemyPoint } from '../game/BattleRoad';
import { FEEDBACK, TOWER_IMPACT } from './config/FeedbackConfig';
import { ENEMIES, RULE } from '../game/GameConfig';
interface PatrolHop { at: number; seconds: number; dx: number; dy: number; distance: number; lift: number; }
interface Defeat { enemy: Enemy; fatal: Shot | null; started: number | null; hop?: PatrolHop; }
export interface ZhouLoveCue { cleared: boolean; age: number; }
const HERO_FACING = { RIGHT: { x: 1, y: 0 }, LEFT: { x: -1, y: 0 }, UP: { x: 0, y: -1 }, DOWN: { x: 0, y: 1 } } as const;
const HERO_IMPACT_SECONDS = TOWER_IMPACT.ARROW.frameCount / TOWER_IMPACT.ARROW.fps;
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
    readonly deaths = new Map<number, Defeat>();
    private deathPositions = new Map<number, { x: number; y: number }>();
    private flashes = new Map<number, number>();
    private visibleFrost = new Set<number>();
    private retired = new Set<number>();
    private loveTargets = new Map<number, { cleared: boolean; started: number }>();
    private burstTargets = new Map<number, number>();
    private patrolHits = new Map<number, { started: number; recoil: { dx: number; dy: number; pixels: number } | null }>();
    private heroHits = new Map<number, { started: number; dx: number; dy: number; delivery: boolean; electric: boolean }>();
    sync(battle: BattleSimulation | null, events: CombatFeedback[]) {
        if (battle !== this.battle || !battle) {
            this.battle = battle; this.shots.clear(); this.deaths.clear(); this.deathPositions.clear(); this.flashes.clear(); this.retired.clear();
            this.loveTargets.clear(); this.burstTargets.clear();
            this.visibleFrost.clear();
            this.patrolHits.clear();
            this.heroHits.clear();
            this.tailSeconds = 0; this.defeatCue = false;
        }
        if (!battle) return;
        if (this.visibleFrost.size) {
            const active = new Set(battle.enemies.filter(e => e.hp > 0 && e.slowTicks > 0).map(e => e.seq));
            for (const seq of this.visibleFrost) if (!active.has(seq)) this.visibleFrost.delete(seq);
        }
        for (const event of events) {
            if (event.type === 'patrolLanding') continue;
            if (event.type === 'gate') {
                this.deathPositions.set(event.enemy.seq, enemyPoint(event.enemy));
                this.flashes.delete(event.enemy.seq);
                if (!this.retired.has(event.enemy.seq)) this.deaths.set(event.enemy.seq, { enemy: event.enemy, fatal: null, started: this.clock });
            } else if (event.type === 'summon' || event.type === 'patrol') {
                if (event.type === 'patrol') {
                    const spec = FEEDBACK.patrolHit;
                    const boss = ENEMIES[event.enemy.kind].boss;
                    const pixels = boss ? spec.bossRecoil : spec.commonRecoil;
                    const angle = (event.enemy.seq % 8) * Math.PI / 4;
                    const vector = event.dx === 0 && event.dy === 0
                        ? { dx: Math.cos(angle), dy: Math.sin(angle) } : { dx: event.dx, dy: event.dy };
                    const recoil = battle.patrol?.spin ? { ...vector, pixels } : null;
                    this.patrolHits.set(event.enemy.seq, { started: this.clock, recoil });
                    if (recoil && event.enemy.hp <= 0) {
                        const death = FEEDBACK.patrolDeath;
                        this.deathPositions.set(event.enemy.seq, event.at);
                        this.deaths.set(event.enemy.seq, { enemy: event.enemy, fatal: null, started: null,
                            hop: { ...vector, at: this.clock, seconds: boss ? death.bossAirSeconds : death.airSeconds,
                                distance: boss ? death.bossDistance : death.distance, lift: boss ? death.bossLift : death.lift } });
                        this.flashes.delete(event.enemy.seq);
                        continue;
                    }
                }
                this.immediateHit(event.enemy);
            } else if (event.type === 'handSpeed' || event.type === 'mercy') {
                for (const enemy of event.hurt) {
                    this.burstTargets.set(enemy.seq, this.clock);
                    this.immediateHit(enemy);
                }
            } else if (event.type === 'heroHit' || event.type === 'deliveryHit') {
                for (const enemy of event.hurt) {
                    if (this.retired.has(enemy.seq)) continue;
                    const point = enemyPoint(enemy);
                    let dx = point.x - event.at.x, dy = point.y - event.at.y;
                    if (dx === 0 && dy === 0) ({ x: dx, y: dy } = HERO_FACING[event.direction]);
                    this.heroHits.set(enemy.seq, { started: this.clock, dx, dy, delivery: event.type === 'deliveryHit',
                        electric: event.type === 'heroHit' && event.electric === true });
                    this.immediateHit(enemy);
                }
            } else if (event.type === 'blast' || event.type === 'poison') {
                event.hurt.forEach(enemy => this.immediateHit(enemy));
            } else if (event.type === 'zhouLove') {
                for (const enemy of event.targets) {
                    this.loveTargets.set(enemy.seq, { cleared: event.cleared, started: this.clock });
                    if (event.cleared) this.immediateHit(enemy);
                }
            } else if (event.type === 'shot') {
                this.shots.set(event.shot, event);
                for (const enemy of event.hurt) if (enemy.hp <= 0 && !this.retired.has(enemy.seq)) {
                    this.deathPositions.set(enemy.seq, enemyPoint(enemy));
                    if (!this.deaths.has(enemy.seq)) this.deaths.set(enemy.seq, { enemy, fatal: event.shot, started: null });
                }
            }
        }
    }
    private immediateHit(enemy: Enemy) {
        if (enemy.hp > 0) {
            this.flashes.set(enemy.seq, this.clock + FEEDBACK.flashSeconds);
            return;
        }
        if (this.deaths.get(enemy.seq)?.hop) return;
        const death: Defeat = { enemy, fatal: null, started: null };
        this.deathPositions.set(enemy.seq, enemyPoint(enemy));
        this.deaths.set(enemy.seq, death);
        this.flashes.delete(enemy.seq);
        this.startDefeat(death);
    }
    advance(delta: number) {
        this.clock += delta;
        if (this.battle?.outcome) this.tailSeconds += delta;
        for (const [seq, end] of this.flashes) if (end <= this.clock) this.flashes.delete(seq);
        for (const [seq, started] of this.burstTargets)
            if (this.clock - started >= FEEDBACK.impact.frameCount / FEEDBACK.impact.fps) this.burstTargets.delete(seq);
        for (const [seq, hit] of this.patrolHits) {
            const spec = FEEDBACK.patrolHit;
            if (this.clock - hit.started >= (hit.recoil ? Math.max(spec.seconds, spec.recoilSeconds) : spec.seconds)) this.patrolHits.delete(seq);
        }
        for (const [seq, hit] of this.heroHits)
            if (this.clock - hit.started >= HERO_IMPACT_SECONDS) this.heroHits.delete(seq);
        for (const [seq, cue] of this.loveTargets) {
            const seconds = cue.cleared ? FEEDBACK.impact.frameCount / FEEDBACK.impact.fps : FEEDBACK.loveHeal.seconds;
            if (this.clock - cue.started >= seconds) this.loveTargets.delete(seq);
        }
        for (const [seq, death] of this.deaths) {
            if (death.hop && death.started === null && this.clock >= death.hop.at + death.hop.seconds)
                this.startDefeat(death, death.hop.at + death.hop.seconds);
            const spec = death.hop ? FEEDBACK.patrolDeath : FEEDBACK.death;
            const duration = spec.squashSeconds + spec.holdSeconds + spec.fadeSeconds;
            if (death.started !== null && this.clock - death.started >= duration) {
                this.deaths.delete(seq); this.flashes.delete(seq); this.retired.add(seq);
            }
        }
    }
    zhouLoveCue(seq: number): ZhouLoveCue | undefined {
        const cue = this.loveTargets.get(seq);
        if (cue) return { cleared: cue.cleared, age: this.clock - cue.started };
    }
    burstAge(seq: number) {
        const started = this.burstTargets.get(seq);
        return started === undefined ? undefined : this.clock - started;
    }
    get hasPatrolImpact() {
        if (this.patrolHits.size) return true;
        for (const death of this.deaths.values()) if (death.hop) return true;
        return false;
    }
    patrolImpactAge(seq: number) {
        const hit = this.patrolHits.get(seq);
        if (!hit) return undefined;
        const age = this.clock - hit.started;
        return age < FEEDBACK.patrolHit.seconds ? age : undefined;
    }
    heroImpact(seq: number, verticalScale: number): { age: number; x: number; y: number; delivery: boolean; electric?: true } | undefined {
        const hit = this.heroHits.get(seq);
        if (!hit) return undefined;
        const age = this.clock - hit.started, spec = FEEDBACK.heroRecoil;
        const y = hit.dy * verticalScale, distance = Math.hypot(hit.dx, y);
        const strength = age < spec.peakSeconds ? Math.sin(age / spec.peakSeconds * Math.PI / 2)
            : Math.max(0, (spec.seconds - age) / (spec.seconds - spec.peakSeconds)) ** 2;
        const scale = !hit.electric && distance > 0 ? strength * spec.pixels / distance : 0;
        const impact = { age, x: hit.dx * scale, y: y * scale, delivery: hit.delivery };
        return hit.electric ? { ...impact, electric: true } : impact;
    }
    patrolRecoil(seq: number, verticalScale: number) {
        const hop = this.deaths.get(seq)?.hop;
        if (hop) {
            const t = Math.min(1, (this.clock - hop.at) / hop.seconds);
            const y = hop.dy * verticalScale;
            const distance = t * t * (3 - 2 * t) * hop.distance / Math.hypot(hop.dx, y);
            return { x: hop.dx * distance, y: y * distance };
        }
        const hit = this.patrolHits.get(seq), spec = FEEDBACK.patrolHit;
        if (!hit?.recoil) return undefined;
        const age = this.clock - hit.started;
        if (age >= spec.recoilSeconds) return undefined;
        const { dx, dy, pixels } = hit.recoil;
        const y = dy * verticalScale, length = Math.hypot(dx, y);
        const strength = age < spec.recoilPeak ? Math.sin(age / spec.recoilPeak * Math.PI / 2)
            : (1 - (age - spec.recoilPeak) / (spec.recoilSeconds - spec.recoilPeak)) ** 2;
        const scale = strength * pixels / length;
        return { x: dx * scale, y: y * scale };
    }
    patrolAir(seq: number) {
        const hop = this.deaths.get(seq)?.hop;
        if (!hop) return undefined;
        const t = (this.clock - hop.at) / hop.seconds;
        if (t >= 1) return undefined;
        return { lift: hop.lift * Math.sin(t * Math.PI),
            degrees: (hop.dx < 0 ? -1 : 1) * 360 * t * FEEDBACK.patrolDeath.turns };
    }
    /** 死亡帧固定于快照；只压缩脚底以上的高度并淡出，等待致死弹体时仍保持完整身形。 */
    deathPose(seq: number): { scaleY: number; alpha: number } | undefined {
        const death = this.deaths.get(seq);
        if (!death || death.started === null) return undefined;
        const spec = death.hop ? FEEDBACK.patrolDeath : FEEDBACK.death, age = this.clock - death.started;
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
    /** 视觉落点使用活体或致死前的姿态快照，旁支飞来的子弹不会瞄准被压扁的残影。 */
    targetEnemy(shot: Shot): Enemy | undefined {
        const event = this.shots.get(shot);
        if (!event) return undefined;
        return this.battle?.enemies.find(enemy => enemy.seq === event.target) ??
            this.deaths.get(event.target)?.enemy ?? event.hurt.find(enemy => enemy.seq === event.target);
    }
    impact(shot: Shot) {
        const event = this.shots.get(shot);
        if (!event) return;
        this.revealFrost(shot);
        for (const enemy of event.hurt) {
            if (this.retired.has(enemy.seq)) continue;
            const death = this.deaths.get(enemy.seq);
            if (death && death.started !== null) continue;
            if (this.battle?.enemies.some(e => e.seq === enemy.seq) || this.deaths.has(enemy.seq)) this.flashes.set(enemy.seq, this.clock + FEEDBACK.flashSeconds);
            if (death?.fatal === shot) this.startDefeat(death);
        }
    }
    flashing(seq: number) { return this.flashes.has(seq) || this.patrolImpactAge(seq) !== undefined; }
    frosted(seq: number) { return this.visibleFrost.has(seq); }
    hitShake(seq: number) {
        const patrolAge = this.patrolImpactAge(seq);
        if (patrolAge !== undefined && patrolAge < FEEDBACK.patrolHit.shakeSeconds) {
            const spec = FEEDBACK.patrolHit, t = patrolAge / spec.shakeSeconds;
            return spec.pixels * (1 - t) * Math.cos(t * Math.PI * 2 * spec.cycles);
        }
        if (this.heroHits.has(seq)) return 0;
        const end = this.flashes.get(seq);
        if (end === undefined) return 0;
        const spec = FEEDBACK.hitShake, age = this.clock - (end - FEEDBACK.flashSeconds);
        const t = Math.max(0, Math.min(1, age / spec.seconds));
        return spec.pixels * (1 - t) * (1 - t) * Math.cos(t * Math.PI * 2 * spec.cycles);
    }
    /** 超出原弹道装饰上限时直接开始死亡过渡，不伪造红闪，也不留下等不到致死弹体的快照。 */
    discard(shot: Shot) {
        for (const death of this.deaths.values()) if (death.fatal === shot && death.started === null) this.startDefeat(death);
        this.revealFrost(shot);
        this.shots.delete(shot);
    }
    /** 冰弹抵达后标记实际减速目标。弹道被表现上限省略时仍显示生效的状态。 */
    private revealFrost(shot: Shot) {
        const targets = this.shots.get(shot)?.slowed;
        if (!targets || !this.battle) return;
        for (const enemy of this.battle.enemies)
            if (enemy.hp > 0 && enemy.slowTicks > 0 && targets.includes(enemy.seq)) this.visibleFrost.add(enemy.seq);
    }
    private startDefeat(death: { started: number | null }, at = this.clock) {
        death.started = at;
        this.defeatCue = true;
    }
    /** 同一渲染帧内的多杀合成一次播放请求；暂停消耗请求，不堆积待播声音。 */
    takeDefeatCue() {
        const cue = this.defeatCue;
        this.defeatCue = false;
        return cue;
    }
}
