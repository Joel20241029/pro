import { appearanceSeed, APPEARANCE_DOMAIN } from "./EnemySeed";
import { COMBAT, FIXED_NIGHT, isDenseWave, WAVE, WAVE_RHYTHM } from "../config/DefenseConfig";
import { HEAVY_ORDINARY } from "../config/EnemyConfig";
import { PATROL } from "../config/PatrolConfig";
import { towerStats } from "./TowerStats";
import { ENEMIES, EnemyKind, PADS, RULE, TOWERS, TowerKind } from "./GameConfig";
import { enemyPoint, onBattleRoad, PATH_LENGTH, RoadPoint } from "./BattleRoad";
export { pointAt, PATH_LENGTH } from "./BattleRoad";
import { clone, GameState } from "./GameState";
import { assignOperator, person } from "./VillageRules";
import { waveDifficulty } from "./WaveDifficulty";
import { enemyPower, gateCapacity, levelPower } from "./Growth";
import { DRAGON_POISON, HAND_SPEED, KING_MERCY_TACTIC, TACTIC_NIGHT_USES, TACTIC_USE, TIMED_BLAST, TacticDefinition, tacticDefinition, ZHOU_LOVE_HEAL } from "../config/TacticConfig";
import { EnemyRoadStep, SummonCharge, SummonCollision } from "./SummonCharge";
import { Patrol, PatrolTarget } from "./Patrol";
import type { DailyTaskCombat } from "./DailyTaskCombat";
export interface Enemy {
    seq: number;
    kind: EnemyKind;
    appearanceSeed: number;
    progress: number;
    /** 累计实际二维路程；出生横向偏移不计，减速会同步放慢步态，不进入业务存档。 */
    walkDistance: number;
    hp: number;
    maxHp: number;
    speed: number;
    slow: number;
    slowTicks: number;
    born: number;
    summoned: number;
}
export interface Shot {
    tower: number;
    x: number;
    y: number;
    kind: TowerKind;
    tick: number;
    /** 发射当步的伤害强化快照；仅供弹体与命中表现，技能结束不能改写在途攻击。 */
    empowered: boolean;
}
/** 只读表现事件：快照不参与伤害、索敌或存档；每步由 GameSession 收集。 */
export type CombatFeedback = { type: "shot"; shot: Shot; target: number; hurt: Enemy[]; slowed?: number[] } |
    { type: "gate"; enemy: Enemy; blocked: boolean; tick: number; x: number; y: number } |
    { type: "blast"; at: RoadPoint; hurt: Enemy[]; tick: number } |
    { type: "handSpeed"; hurt: Enemy[]; tick: number } |
    { type: "mercy"; hurt: Enemy[] } |
    { type: "poison"; hurt: Enemy[] } |
    { type: "zhouLove"; cleared: boolean; targets: Enemy[] } |
    { type: "patrolLanding"; at: RoadPoint; actor: number; tick: number; radius: number } |
    ({ type: "summon"; tick: number } & SummonCollision) |
    ({ type: "patrol"; tick: number } & SummonCollision);
export class BattleSimulation {
    readonly base: GameState;
    readonly tactics: readonly TacticDefinition[];
    /** 当前或最近一次发动的战技，供效果退场动画继续读取。 */
    tactic: TacticDefinition;
    enemies: Enemy[] = [];
    shots: Shot[] = [];
    feedback: CombatFeedback[] = [];
    tick = 0;
    /** 累计有效齐射次数，仅供音效观察；分裂的三枚弹体仍计一次，不影响伤害或快照。 */
    volleys = 0;
    gate: number;
    private tacticUses = 0;
    readonly tacticBudget: number;
    private readonly personal = new Map<string, { uses: number; readyAt: number }>();
    bellTicks = 0;
    readonly patrol: Patrol | null;
    summonCharge: SummonCharge | null = null;
    blastAt: Readonly<RoadPoint> | null = null;
    private tapWindow: { remaining: number; taps: number } | null = null;
    /** 施放后保留至本夜结束。每只来敌从染毒的战斗步开始单独计时。 */
    private poison: { targets: Map<number, { nextTick: number; lastTick: number }>; extraSeconds: number } | null = null;
    get handSpeed(): Readonly<{ remaining: number; taps: number }> | null { return this.outcome ? null : this.tapWindow; }
    outcome: "WIN" | "LOSE" | null = null;
    private readonly denseWave: boolean;
    private readonly fixedPace: boolean;
    private readonly waveDifficulty: ReturnType<typeof waveDifficulty> | null;
    private readonly olderEnemyPower: number;
    private cursor = 0;
    private seq = 0;
    private charge = PADS.map(() => 1);
    private queued: {
        kind: EnemyKind;
        appearanceSeed: number;
        progress: number;
    }[] = [];
    constructor(state: GameState, private readonly tasks?: DailyTaskCombat) {
        if (state.phase !== "NIGHT" || !state.wave || !state.night)
            throw new Error("缺少已保存的战前状态");
        this.base = clone(state);
        this.fixedPace = state.wave.rhythm === WAVE_RHYTHM.fixed;
        this.waveDifficulty = state.wave.rhythm === undefined ? null : waveDifficulty(state.day, state.wave.rhythm);
        this.denseWave = this.waveDifficulty !== null || isDenseWave(state.wave.ordinaryHealthPercent);
        this.olderEnemyPower = enemyPower(state.day);
        this.patrol = this.base.patrol.captain ? new Patrol(this.base) : null;
        const loadout = [state.night.tactic, ...(state.night.extraSlots ?? [])];
        this.tactics = loadout.filter(id => id !== null).map(id => ({ ...tacticDefinition(id) }));
        this.tactic = this.tactics[0];
        this.tacticBudget = TACTIC_NIGHT_USES[loadout.length - 1];
        this.gate = state.gate;
        if (state.night.mercySpent) {
            this.tacticUses++;
            this.personal.set(KING_MERCY_TACTIC, { uses: 1, readyAt: 0 });
        }
    }
    get operators() { return this.base.towers.map(t => t.operator); }
    get pendingCount() { return this.base.wave!.entries.length - this.cursor + this.queued.length; }
    get tacticUsesLeft() { return this.tacticBudget - this.tacticUses; }
    get tacticCooldownTicks() { return this.cooldownFor(this.tactics[0].id); }
    get canCastTactic() { return this.canCast(this.tactics[0].id); }
    get mindLocked() { return !this.outcome && this.bellTicks > 0 && this.tactic.effect === "MIND_LOCK"; }
    isPoisoned(seq: number) { return !this.outcome && !!this.poison?.targets.has(seq); }
    usesLeftFor(tactic: TacticDefinition) { return tactic.usesPerNight - (this.personal.get(tactic.id)?.uses ?? 0); }
    cooldownFor(id: string) { return Math.max(0, (this.personal.get(id)?.readyAt ?? 0) - this.tick); }
    canCast(id: string) {
        const tactic = this.tactics.find(t => t.id === id);
        return !!tactic && !this.outcome && this.bellTicks === 0 && !this.tapWindow && this.tacticUsesLeft > 0 && this.usesLeftFor(tactic) > 0 && this.cooldownFor(id) === 0 &&
            (id !== KING_MERCY_TACTIC || !this.base.tactics.mercyCooldown?.wavesLeft);
    }
    /** 与扣血判定共用：最后一个有效步保护该步全部触门者，步末才减时。 */
    get gateProtected() { return !this.outcome && this.bellTicks > 0 && this.tactic.effect === "GATE_INVULNERABLE"; }
    bell(id = this.tactics[0].id, at?: RoadPoint) {
        if (id === KING_MERCY_TACTIC || !this.canCast(id)) return false;
        const tactic = this.tactics.find(t => t.id === id)!;
        if (tactic.effect === "TIMED_BLAST" && (!at || !onBattleRoad(at))) return false;
        const firstEvent = this.feedback.length;
        this.tactic = tactic;
        this.tacticUses++;
        this.personal.set(id, { uses: (this.personal.get(id)?.uses ?? 0) + 1, readyAt: this.tick + TACTIC_USE.cooldownTicks });
        if (tactic.effect === "HAND_SPEED") {
            this.patrol?.rapid?.stop();
            this.tapWindow = { remaining: HAND_SPEED.seconds, taps: 0 };
        }
        else if (tactic.effect === "ZHOU_LOVE") this.resolveZhouLove();
        else this.bellTicks = tactic.ticks;
        if (this.tactic.effect === "SUMMON_CHARGE") this.summonCharge = new SummonCharge();
        if (this.tactic.effect === "TIMED_BLAST") this.blastAt = { ...at! };
        if (tactic.effect === "DRAGON_POISON") {
            this.poison = { targets: new Map(), extraSeconds: 0 };
            for (const enemy of this.enemies) if (enemy.hp > 0) this.infect(enemy.seq);
        }
        this.tasks?.cast(id);
        if (this.tasks && this.feedback.length > firstEvent) this.tasks.observe(this.feedback.slice(firstEvent));
        return true;
    }
    /** 仅在同一夜的献纳提交成功后应用。待出怪仍走原队列，胜负由下一战斗步判定。 */
    applyPaidMercy() {
        const tactic = this.tactics.find(t => t.id === KING_MERCY_TACTIC);
        if (!tactic || !this.canCast(KING_MERCY_TACTIC)) return;
        this.tactic = tactic;
        this.tacticUses++;
        this.personal.set(KING_MERCY_TACTIC, { uses: 1, readyAt: 0 });
        this.gate = gateCapacity(this.base);
        const hurt = this.enemies.filter(e => e.hp > 0).map(e => ({ ...e, hp: 0 }));
        this.enemies = [];
        this.poison?.targets.clear();
        const event = { type: "mercy", hurt } as const;
        this.feedback.push(event);
        this.tasks?.cast(KING_MERCY_TACTIC);
        this.tasks?.observe([event]);
    }
    private infect(seq: number) {
        const spec = DRAGON_POISON, poisonedAt = this.tick - 1;
        this.poison?.targets.set(seq, {
            nextTick: poisonedAt + spec.intervalTicks,
            lastTick: poisonedAt + spec.seconds * spec.intervalTicks
        });
    }
    private tickPoison() {
        const poison = this.poison;
        if (!poison?.targets.size) return 0;
        const spec = DRAGON_POISON, hurt: Enemy[] = [];
        let kills = 0;
        for (const enemy of this.enemies) {
            const timer = poison.targets.get(enemy.seq);
            if (!timer) continue;
            if (enemy.hp > 0 && this.tick === timer.nextTick) {
                const permille = ENEMIES[enemy.kind].boss ? spec.bossPermille : spec.smallPermille;
                const damage = Math.floor(enemy.maxHp * permille / 1000);
                enemy.hp -= damage;
                timer.nextTick += spec.intervalTicks;
                if (damage > 0) hurt.push({ ...enemy });
            }
            if (enemy.hp <= 0) { kills++; poison.targets.delete(enemy.seq); }
        }
        if (hurt.length) this.feedback.push({ type: "poison", hurt });
        return kills;
    }
    private extendPoison(kills: number) {
        const poison = this.poison;
        if (!kills || !poison?.targets.size) return;
        const { intervalTicks, maxExtraSeconds } = DRAGON_POISON;
        const extra = Math.min(kills, maxExtraSeconds - poison.extraSeconds);
        if (!extra) return;
        poison.extraSeconds += extra;
        for (const timer of poison.targets.values()) timer.lastTick += extra * intervalTicks;
        if (this.tactic.effect === "DRAGON_POISON" && this.bellTicks > 0) this.bellTicks += extra * intervalTicks;
    }
    private resolveZhouLove() {
        // 战前快照中的成年居民包含老人和精英，儿童及家谱不参与。
        const majority = this.base.people.reduce((sum, p) => sum + (p.adult ? (p.sex === "FEMALE" ? 1 : -1) : 0), 0);
        const cleared = majority > 0, targets: Enemy[] = [];
        for (const enemy of this.enemies) {
            if (enemy.hp <= 0) continue;
            enemy.hp = cleared ? 0 : Math.min(enemy.maxHp, enemy.hp + Math.floor(enemy.maxHp * ZHOU_LOVE_HEAL));
            targets.push({ ...enemy });
        }
        // 只影响已经入场的目标，胜负继续由下一战斗步统一判定和保存。
        if (cleared) {
            this.enemies = [];
            this.poison?.targets.clear();
        }
        this.feedback.push({ type: "zhouLove", cleared, targets });
    }
    tapHandSpeed() {
        const window = this.tapWindow;
        if (this.outcome || !window || window.remaining <= 0) return false;
        window.taps++;
        if (window.taps === HAND_SPEED.burstTaps) {
            // 即时施放独立收集反馈，上一战斗步的事件已由会话消费。
            this.feedback = [];
            this.resolveHandSpeed(window.taps);
        }
        return true;
    }
    private resolveHandSpeed(taps: number) {
        this.tapWindow = null;
        if (!taps) return;
        const burst = taps === HAND_SPEED.burstTaps;
        const hurt: Enemy[] = [];
        for (const e of this.enemies) {
            if (e.hp <= 0) continue;
            if (burst) {
                e.hp = Math.min(e.hp, Math.max(1, Math.floor(e.maxHp * HAND_SPEED.burstRemainingPercent / 100)));
            } else {
                const permille = ENEMIES[e.kind].boss ? HAND_SPEED.bossPermille : HAND_SPEED.ordinaryPermille;
                const damage = Math.floor(e.maxHp * taps * permille / 1000);
                if (!damage) continue;
                e.hp -= damage;
            }
            hurt.push({ ...e });
        }
        this.feedback.push({ type: "handSpeed", hurt, tick: this.tick });
        this.extendPoison(hurt.filter(enemy => enemy.hp <= 0 && this.poison?.targets.delete(enemy.seq)).length);
        this.enemies = this.enemies.filter(e => e.hp > 0);
        if (!this.enemies.length && this.pendingCount === 0 && !this.patrol?.spin?.flying) this.outcome = "WIN";
        this.tasks?.observe(this.feedback);
    }
    private detonate(at: RoadPoint) {
        const hurt: Enemy[] = [];
        for (const e of this.enemies) {
            if (e.hp <= 0) continue;
            const foot = enemyPoint(e), distance = Math.hypot(foot.x - at.x, foot.y - at.y);
            if (distance > TIMED_BLAST.radius) continue;
            e.hp = 0;
            hurt.push({ ...e });
        }
        this.feedback.push({ type: "blast", at, hurt, tick: this.tick });
        this.blastAt = null;
    }
    reassign(index: number, id: string) { assignOperator(this.base, index, id); }
    private spawn(kind: EnemyKind, progress: number, seed: number) {
        const data = ENEMIES[kind], { affix, ordinaryHealthPercent } = this.base.wave!;
        const healthScale = data.boss ? 1 : ordinaryHealthPercent / 100;
        const difficulty = this.waveDifficulty;
        const power = difficulty ? (data.boss ? difficulty.bossHealth : difficulty.health) : this.olderEnemyPower;
        const speedScale = difficulty?.speed ?? 1;
        const heavyScale = difficulty && HEAVY_ORDINARY.has(kind) ? difficulty.heavyHealth : 1;
        const pressure = PATROL.spin.pressure, day = this.base.day;
        const patrolHealth = (this.patrol?.spin || this.patrol?.rapid) && !data.boss && day >= pressure.from
            ? 1 + pressure.start + (pressure.maximum - pressure.start) * Math.min(1, (day - pressure.from) / (pressure.full - pressure.from))
            : 1;
        const baseHp = this.fixedPace && !data.boss ? data.hp * (kind === "enemy_raider" ? FIXED_NIGHT.raiderHealth : FIXED_NIGHT.otherOrdinaryHealth) : data.hp;
        const baseSpeed = this.fixedPace ? data.speed * FIXED_NIGHT.enemySpeed : data.speed;
        const hp = Math.ceil(baseHp * power * heavyScale * (affix === "FAST" ? COMBAT.fastHealth : affix === "STURDY" ? COMBAT.sturdyHealth : 1) * healthScale * patrolHealth);
        const seq = this.seq++;
        this.enemies.push({ seq, kind, appearanceSeed: seed, progress, walkDistance: 0, hp, maxHp: hp, speed: baseSpeed * speedScale * (affix === "FAST" ? COMBAT.fastSpeed : affix === "STURDY" ? COMBAT.sturdySpeed : 1), slow: 0, slowTicks: 0, born: this.tick, summoned: 0 });
        if (this.poison) this.infect(seq);
    }
    step(realSeconds = RULE.step / RULE.battleSpeed) {
        if (this.outcome)
            return;
        this.feedback = [];
        if (this.tapWindow) {
            // 连点用实际时间，整个战场（含塔、出怪和冷却）保留当前战斗步。
            this.tapWindow.remaining -= realSeconds;
            if (this.tapWindow.remaining <= 1e-9) this.resolveHandSpeed(this.tapWindow.taps);
            return;
        }
        const entries = this.base.wave!.entries;
        while (this.cursor < entries.length && entries[this.cursor].tick <= this.tick)
            this.queued.push({ ...entries[this.cursor++], progress: 0 });
        for (const e of this.enemies)
            if (ENEMIES[e.kind].summon && e.summoned < RULE.summonTicks.length && this.tick - e.born >= RULE.summonTicks[e.summoned]) {
                e.summoned++;
                for (let child = 0; child < 2; child++) this.queued.push({ kind: "enemy_raider", progress: e.progress, appearanceSeed: appearanceSeed(APPEARANCE_DOMAIN.summon, e.appearanceSeed, e.summoned, child) });
            }
        while (this.queued.length && (this.denseWave || this.enemies.length < RULE.legacyEnemyCap)) {
            const q = this.queued.shift()!;
            this.spawn(q.kind, q.progress, q.appearanceSeed);
        }
        const existingSlow = new Set(this.enemies.filter(e => e.slowTicks > 0).map(e => e.seq));
        const refreshed = new Set<number>();
        const rush = this.summonCharge?.active ? this.summonCharge : null;
        const frozen = this.mindLocked;
        const traceEnemies = !!rush || this.patrol?.rapid?.needsTargets;
        const traces: EnemyRoadStep[] = [];
        const patrolTargets: PatrolTarget[] = [];
        for (const e of this.enemies) {
            const startProgress = e.progress;
            const before = enemyPoint(e);
            if (!frozen) e.progress += e.speed * RULE.step * (e.slowTicks > 0 ? 1 - e.slow : 1);
            const after = enemyPoint(e);
            e.walkDistance += Math.hypot(after.x - before.x, after.y - before.y);
            if (this.patrol && !this.patrol.rapid && e.hp > 0) patrolTargets.push({ enemy: e, fromY: before.y, at: after });
            if (traceEnemies && e.hp > 0) {
                const end = e.progress >= PATH_LENGTH
                    ? Math.max(0, (PATH_LENGTH - startProgress) / (e.progress - startProgress || 1)) : 1;
                traces.push({ enemy: e, startProgress, from: before, to: after, end });
            }
        }
        if (rush) {
            for (const hit of rush.advance(traces)) this.feedback.push({ type: "summon", tick: this.tick, ...hit });
            if (!rush.active) this.bellTicks = 0;
        }
        // 淡紫儿先于撞门扣血，同一战斗步只由仍存活的到门敌人伤害城门。
        if (this.patrol) for (const hit of this.patrol.advance(this.tick, patrolTargets, traces, realSeconds))
            this.feedback.push({ type: "patrol", tick: this.tick, ...hit });
        const landing = this.patrol?.spin?.landing;
        if (landing) this.feedback.push({ type: "patrolLanding", tick: this.tick, ...landing });
        // 读引爆这一战斗步的真实足点；同一步内先结算爆炸，再处理仍活着的触门敌人。
        if (this.blastAt && this.bellTicks === 1) this.detonate(this.blastAt);
        let poisonedKills = this.tickPoison();
        for (const e of this.enemies) {
            if (e.hp > 0 && e.progress >= PATH_LENGTH) {
                const blocked = this.gateProtected, at = enemyPoint(e);
                const enemy = ENEMIES[e.kind], impact = this.denseWave && !enemy.boss ? WAVE.ordinaryGateScale * (this.fixedPace ? FIXED_NIGHT.ordinaryGateDamage : 1) : 1;
                if (!blocked) this.gate -= Math.ceil(enemy.gate * impact * (this.waveDifficulty?.gate ?? this.olderEnemyPower));
                e.hp = 0;
                this.poison?.targets.delete(e.seq);
                // 快照记录逻辑坐标及当步保护状态；追帧、到期和窗口重排不能改写旧反馈。
                this.feedback.push({ type: "gate", enemy: { ...e }, blocked, tick: this.tick, x: at.x, y: at.y });
            }
        }
        this.enemies = this.enemies.filter(e => e.hp > 0);
        if (this.gate <= 0) {
            this.gate = 0;
            this.outcome = "LOSE";
            return;
        }
        for (let i = 0; i < this.base.towers.length; i++) {
            const tower = this.base.towers[i];
            if (!tower.kind || !tower.operator)
                continue;
            const p = person(this.base, tower.operator), t = TOWERS[tower.kind], at = PADS[i];
            const distance = (e: Enemy) => { const pos = enemyPoint(e); return Math.hypot(pos.x - at.x, pos.y - at.y); };
            const stats = towerStats(this.base, tower.kind, tower.level, p);
            let speed = stats.speed;
            if (this.bellTicks > 0 && this.tactic.effect === "ATTACK_SPEED")
                speed *= this.tactic.multiplier;
            if (this.base.night!.hungry)
                speed *= RULE.hungerSpeed;
            if (this.enemies.some(e => e.hp > 0 && ENEMIES[e.kind].disrupt && distance(e) <= COMBAT.disruptRange))
                speed *= RULE.disruptSpeed;
            this.charge[i] += RULE.step * speed / stats.interval;
            const range = stats.range;
            const candidates = this.enemies.filter(e => e.hp > 0 && distance(e) <= range).sort((a, b) => b.progress - a.progress || a.seq - b.seq);
            if (!candidates.length) {
                this.charge[i] = Math.min(1, this.charge[i]);
                continue;
            }
            if (this.charge[i] < 1)
                continue;
            this.charge[i] -= 1;
            this.volleys++;
            const targets = candidates.slice(0, this.bellTicks > 0 && this.tactic.effect === "MULTI_TARGET" ? this.tactic.targets : 1);
            // 同轮齐射先冻结主目标和覆盖范围；不得因第一发击杀而漏发、补选或改变后续落点。
            const volley = targets.map(target => {
                const center = enemyPoint(target);
                const nearby = tower.kind === "ARROW" ? [] : this.enemies.filter(e => {
                    const pos = enemyPoint(e);
                    return e.hp > 0 && Math.hypot(pos.x - center.x, pos.y - center.y) <= t.splash;
                });
                return { target, center, nearby };
            });
            const empowered = this.bellTicks > 0 && this.tactic.effect === "ATTACK_DAMAGE";
            const tacticDamage = this.bellTicks > 0 && this.tactic.effect === "ATTACK_DAMAGE" ? this.tactic.multiplier : 1;
            const claimed = new Set<Enemy>();
            for (const { target, center, nearby } of volley) {
                // 石塔只在本塔本轮去重；各主目标预留给自己的弹体，致死/红闪反馈才与实际落点一致。
                const hurt = tower.kind === "STONE" ? nearby.filter(e => {
                    if (claimed.has(e) || e !== target && targets.includes(e)) return false;
                    claimed.add(e); return true;
                }) : [target];
                for (const e of hurt) {
                    e.hp -= Math.max(1, Math.floor(stats.damage * tacticDamage));
                }
                const slowed: number[] | undefined = tower.kind === "SLOW" ? [] : undefined;
                if (slowed) {
                    const strength = stats.slow;
                    for (const e of nearby)
                        if (!e.slowTicks || strength >= e.slow) {
                            e.slow = strength;
                            e.slowTicks = RULE.slowTicks;
                            refreshed.add(e.seq);
                            if (e.hp > 0) {
                                slowed.push(e.seq);
                                this.tasks?.frost.add(e.seq);
                            }
                        }
                }
                const shot: Shot = { tower: i, x: center.x, y: center.y, kind: tower.kind, tick: this.tick, empowered };
                this.shots.push(shot);
                this.feedback.push({ type: "shot", shot, target: target.seq, hurt: hurt.map(e => ({ ...e })), ...(slowed?.length ? { slowed } : {}) });
            }
        }
        const poison = this.poison;
        if (poison) {
            // 防塔收掉的中毒目标同样续时，最后一跳当步也可延长其余毒效。
            for (const e of this.enemies) if (e.hp <= 0 && poison.targets.delete(e.seq)) poisonedKills++;
            this.extendPoison(poisonedKills);
            for (const [seq, timer] of poison.targets) if (timer.lastTick <= this.tick) poison.targets.delete(seq);
        }
        this.enemies = this.enemies.filter(e => e.hp > 0);
        this.shots = this.shots.filter(s => this.tick - s.tick < COMBAT.shotLifetimeTicks).slice(-RULE.effectCap);
        if (!this.enemies.length && this.pendingCount === 0 && !this.patrol?.spin?.flying)
            this.outcome = "WIN";
        for (const e of this.enemies)
            if (existingSlow.has(e.seq) && !refreshed.has(e.seq) && e.slowTicks > 0)
                e.slowTicks--;
        if (this.bellTicks > 0)
            this.bellTicks--;
        this.tasks?.observe(this.feedback);
        this.tick++;
    }
}
