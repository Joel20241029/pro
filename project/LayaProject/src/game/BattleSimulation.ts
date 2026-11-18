import { appearanceSeed, APPEARANCE_DOMAIN } from "./EnemySeed";
import { COMBAT } from "../config/DefenseConfig";
import { ELITE, ENEMIES, EnemyKind, PADS, RULE, TOWERS, TowerKind } from "./GameConfig";
import { enemyPoint, PATH_LENGTH } from "./BattleRoad";
export { pointAt, PATH_LENGTH } from "./BattleRoad";
import { clone, GameState } from "./GameState";
import { assignOperator, person, policy } from "./VillageRules";
import { enemyPower, levelPower } from "./Growth";
import { TACTIC_NIGHT_USES, TACTIC_USE, TacticDefinition, tacticDefinition } from "../config/TacticConfig";
import { EnemyRoadStep, SummonCharge, SummonCollision } from "./SummonCharge";
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
export type CombatFeedback = { type: "shot"; shot: Shot; target: number; hurt: Enemy[] } |
    { type: "gate"; enemy: Enemy; blocked: boolean; tick: number; x: number; y: number } |
    ({ type: "summon"; tick: number } & SummonCollision);
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
    private sharedReadyAt = 0;
    bellTicks = 0;
    summonCharge: SummonCharge | null = null;
    outcome: "WIN" | "LOSE" | null = null;
    private cursor = 0;
    private seq = 0;
    private charge = PADS.map(() => 1);
    private queued: {
        kind: EnemyKind;
        appearanceSeed: number;
        progress: number;
    }[] = [];
    constructor(state: GameState) {
        if (state.phase !== "NIGHT" || !state.wave || !state.night)
            throw new Error("缺少已保存的战前状态");
        this.base = clone(state);
        const loadout = [state.night.tactic, ...(state.night.extraSlots ?? [])];
        this.tactics = loadout.filter(id => id !== null).map(id => ({ ...tacticDefinition(id) }));
        this.tactic = this.tactics[0];
        this.tacticBudget = TACTIC_NIGHT_USES[loadout.length - 1];
        this.gate = state.gate;
    }
    get operators() { return this.base.towers.map(t => t.operator); }
    get pendingCount() { return this.base.wave!.entries.length - this.cursor + this.queued.length; }
    get tacticUsesLeft() { return this.tacticBudget - this.tacticUses; }
    get tacticCooldownTicks() { return this.cooldownFor(this.tactics[0].id); }
    get canCastTactic() { return this.canCast(this.tactics[0].id); }
    get mindLocked() { return !this.outcome && this.bellTicks > 0 && this.tactic.effect === "MIND_LOCK"; }
    usesLeftFor(tactic: TacticDefinition) { return tactic.usesPerNight - (this.personal.get(tactic.id)?.uses ?? 0); }
    cooldownFor(id: string) { return Math.max(0, this.sharedReadyAt - this.tick, (this.personal.get(id)?.readyAt ?? 0) - this.tick); }
    canCast(id: string) {
        const tactic = this.tactics.find(t => t.id === id);
        return !!tactic && !this.outcome && this.bellTicks === 0 && this.tacticUsesLeft > 0 && this.usesLeftFor(tactic) > 0 && this.cooldownFor(id) === 0;
    }
    /** 与扣血判定共用：最后一个有效步保护该步全部触门者，步末才减时。 */
    get gateProtected() { return !this.outcome && this.bellTicks > 0 && this.tactic.effect === "GATE_INVULNERABLE"; }
    bell(id = this.tactics[0].id) {
        if (!this.canCast(id)) return;
        this.tactic = this.tactics.find(t => t.id === id)!;
        this.tacticUses++;
        this.personal.set(id, { uses: (this.personal.get(id)?.uses ?? 0) + 1, readyAt: this.tick + TACTIC_USE.cooldownTicks });
        this.bellTicks = this.tactic.ticks;
        if (this.tactic.effect === "SUMMON_CHARGE") this.summonCharge = new SummonCharge();
    }
    reassign(index: number, id: string) { assignOperator(this.base, index, id); }
    private spawn(kind: EnemyKind, progress: number, seed: number) {
        const data = ENEMIES[kind], { affix, ordinaryHealthPercent } = this.base.wave!;
        const healthScale = data.boss ? 1 : (ordinaryHealthPercent ?? 100) / 100;
        const hp = Math.ceil(data.hp * enemyPower(this.base.day) * (affix === "FAST" ? COMBAT.fastHealth : affix === "STURDY" ? COMBAT.sturdyHealth : 1) * healthScale);
        this.enemies.push({ seq: this.seq++, kind, appearanceSeed: seed, progress, walkDistance: 0, hp, maxHp: hp, speed: data.speed * (affix === "FAST" ? COMBAT.fastSpeed : affix === "STURDY" ? COMBAT.sturdySpeed : 1), slow: 0, slowTicks: 0, born: this.tick, summoned: 0 });
    }
    step() {
        if (this.outcome)
            return;
        this.feedback = [];
        const entries = this.base.wave!.entries;
        while (this.cursor < entries.length && entries[this.cursor].tick <= this.tick)
            this.queued.push({ ...entries[this.cursor++], progress: 0 });
        for (const e of this.enemies)
            if (ENEMIES[e.kind].summon && e.summoned < RULE.summonTicks.length && this.tick - e.born >= RULE.summonTicks[e.summoned]) {
                e.summoned++;
                for (let child = 0; child < 2; child++) this.queued.push({ kind: "enemy_raider", progress: e.progress, appearanceSeed: appearanceSeed(APPEARANCE_DOMAIN.summon, e.appearanceSeed, e.summoned, child) });
            }
        while (this.queued.length && this.enemies.length < RULE.enemyCap) {
            const q = this.queued.shift()!;
            this.spawn(q.kind, q.progress, q.appearanceSeed);
        }
        const existingSlow = new Set(this.enemies.filter(e => e.slowTicks > 0).map(e => e.seq));
        const refreshed = new Set<number>(), po = policy(this.base);
        const rush = this.summonCharge?.active ? this.summonCharge : null;
        const hadEffect = this.bellTicks > 0, frozen = this.mindLocked;
        const traces: EnemyRoadStep[] = [];
        for (const e of this.enemies) {
            const startProgress = e.progress;
            const before = enemyPoint(e);
            if (!frozen) e.progress += e.speed * RULE.step * (e.slowTicks > 0 ? 1 - e.slow : 1);
            const after = enemyPoint(e);
            e.walkDistance += Math.hypot(after.x - before.x, after.y - before.y);
            if (rush && e.hp > 0) {
                const end = e.progress >= PATH_LENGTH
                    ? Math.max(0, (PATH_LENGTH - startProgress) / (e.progress - startProgress || 1)) : 1;
                traces.push({ enemy: e, startProgress, from: before, to: after, end });
            }
        }
        if (rush) {
            for (const hit of rush.advance(traces)) this.feedback.push({ type: "summon", tick: this.tick, ...hit });
            if (!rush.active) this.bellTicks = 0;
        }
        for (const e of this.enemies) {
            if (e.hp > 0 && e.progress >= PATH_LENGTH) {
                const blocked = this.gateProtected, at = enemyPoint(e);
                if (!blocked) this.gate -= Math.ceil(ENEMIES[e.kind].gate * enemyPower(this.base.day) * (1 + (po.gate || 0)));
                e.hp = 0;
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
            let speed = 1 + (p.trait === "trait_nimble" ? COMBAT.nimbleSpeed : 0) + (p.trait === "trait_focused" && tower.kind === "ARROW" ? COMBAT.focusedSpeed : 0) + (po.speed || 0) + (tower.kind === "ARROW" ? po.arrowSpeed || 0 : tower.kind === "STONE" ? po.stoneSpeed || 0 : 0);
            if (this.bellTicks > 0 && this.tactic.effect === "ATTACK_SPEED")
                speed *= this.tactic.multiplier;
            if (this.base.night!.hungry)
                speed *= RULE.hungerSpeed;
            if (this.enemies.some(e => e.hp > 0 && ENEMIES[e.kind].disrupt && distance(e) <= COMBAT.disruptRange))
                speed *= RULE.disruptSpeed;
            this.charge[i] += RULE.step * speed / t.interval;
            const range = t.range * (1 + (p.trait === "trait_farsight" ? COMBAT.farsightRange : 0) + (po.range || 0));
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
            const bonus = (po.damage || 0) + (tower.kind === "STONE" ? (p.trait === "trait_strong" ? COMBAT.strongDamage : 0) + (p.skill === "skill_throwing" ? COMBAT.throwingDamage : 0) + (po.stoneDamage || 0) : tower.kind === "ARROW" && p.skill === "skill_archery" ? COMBAT.archeryDamage : 0);
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
                    const armor = ENEMIES[e.kind].armor;
                    e.hp -= Math.max(1, Math.floor(t.damage * levelPower(tower.level) * (1 + bonus) * (p.elite ? ELITE.damageMultiplier : 1) * tacticDamage * (1 - armor / (tower.kind === "STONE" ? COMBAT.stoneArmorDivisor : 1))));
                }
                if (tower.kind === "SLOW") {
                    const strength = Math.min(COMBAT.slowMax, COMBAT.slowBase + (p.trait === "trait_patient" ? COMBAT.patientSlow : 0) + (p.skill === "skill_warding" ? COMBAT.wardingSlow : 0) + (po.slow || 0));
                    for (const e of nearby)
                        if (!e.slowTicks || strength >= e.slow) {
                            e.slow = strength;
                            e.slowTicks = RULE.slowTicks;
                            refreshed.add(e.seq);
                        }
                }
                const shot: Shot = { tower: i, x: center.x, y: center.y, kind: tower.kind, tick: this.tick, empowered };
                this.shots.push(shot);
                this.feedback.push({ type: "shot", shot, target: target.seq, hurt: hurt.map(e => ({ ...e })) });
            }
        }
        this.enemies = this.enemies.filter(e => e.hp > 0);
        this.shots = this.shots.filter(s => this.tick - s.tick < COMBAT.shotLifetimeTicks).slice(-RULE.effectCap);
        if (!this.enemies.length && this.pendingCount === 0)
            this.outcome = "WIN";
        for (const e of this.enemies)
            if (existingSlow.has(e.seq) && !refreshed.has(e.seq) && e.slowTicks > 0)
                e.slowTicks--;
        if (this.bellTicks > 0)
            this.bellTicks--;
        if (hadEffect && this.bellTicks === 0) this.sharedReadyAt = this.tick + 1 + TACTIC_USE.recoveryTicks;
        this.tick++;
    }
}
