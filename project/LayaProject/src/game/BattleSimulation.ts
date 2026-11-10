import { ENEMIES, EnemyKind, PADS, PATH, RULE, TOWERS, TowerKind } from "./GameConfig";
import { clone, GameState } from "./GameState";
import { assignOperator, person, policy } from "./VillageRules";
export interface Enemy { seq: number; kind: EnemyKind; progress: number; hp: number; maxHp: number; speed: number; slow: number; slowTicks: number; born: number; summoned: number; }
export interface Shot { tower: number; x: number; y: number; kind: TowerKind; tick: number; }
const LENGTHS = PATH.slice(1).map((p, i) => Math.hypot(p.x - PATH[i].x, p.y - PATH[i].y));
export const PATH_LENGTH = LENGTHS.reduce((a, b) => a + b, 0);
export function pointAt(progress: number) {
    let left = progress;
    for (let i = 0; i < LENGTHS.length; i++) {
        if (left <= LENGTHS[i]) { const t = left / LENGTHS[i]; return { x: PATH[i].x + (PATH[i + 1].x - PATH[i].x) * t, y: PATH[i].y + (PATH[i + 1].y - PATH[i].y) * t }; }
        left -= LENGTHS[i];
    }
    return PATH[PATH.length - 1];
}
export class BattleSimulation {
    readonly base: GameState;
    enemies: Enemy[] = []; shots: Shot[] = []; tick = 0; gate: number;
    bellUsed = false; bellTicks = 0; outcome: "WIN" | "LOSE" | null = null;
    private cursor = 0; private seq = 0; private charge = [1, 1, 1, 1];
    private queued: { kind: EnemyKind; progress: number }[] = [];
    constructor(state: GameState) {
        if (state.phase !== "NIGHT" || !state.wave || !state.night) throw new Error("缺少已保存的战前状态");
        this.base = clone(state); this.gate = state.gate;
    }
    get operators() { return this.base.towers.map(t => t.operator); }
    get pendingCount() { return this.base.wave!.entries.length - this.cursor + this.queued.length; }
    bell() { if (!this.bellUsed && !this.outcome) { this.bellUsed = true; this.bellTicks = RULE.bellTicks; } }
    reassign(index: number, id: string | null) { assignOperator(this.base, index, id); }
    private spawn(kind: EnemyKind, progress: number) {
        const data = ENEMIES[kind], affix = this.base.wave!.affix;
        const hp = Math.ceil(data.hp * (affix === "FAST" ? .9 : affix === "STURDY" ? 1.15 : 1));
        this.enemies.push({ seq: this.seq++, kind, progress, hp, maxHp: hp, speed: data.speed * (affix === "FAST" ? 1.1 : affix === "STURDY" ? .9 : 1), slow: 0, slowTicks: 0, born: this.tick, summoned: 0 });
    }
    step() {
        if (this.outcome) return;
        const entries = this.base.wave!.entries;
        while (this.cursor < entries.length && entries[this.cursor].tick <= this.tick) this.queued.push({ kind: entries[this.cursor++].kind, progress: 0 });
        for (const e of this.enemies) if (e.kind === "enemy_chief" && e.summoned < RULE.summonTicks.length && this.tick - e.born >= RULE.summonTicks[e.summoned]) {
            e.summoned++; this.queued.push({ kind: "enemy_raider", progress: e.progress }, { kind: "enemy_raider", progress: e.progress });
        }
        while (this.queued.length && this.enemies.length < RULE.enemyCap) { const q = this.queued.shift()!; this.spawn(q.kind, q.progress); }
        const existingSlow = new Set(this.enemies.filter(e => e.slowTicks > 0).map(e => e.seq));
        const refreshed = new Set<number>();
        for (const e of this.enemies) {
            e.progress += e.speed * RULE.step * (e.slowTicks > 0 ? 1 - e.slow : 1);
            if (e.progress >= PATH_LENGTH) { this.gate -= Math.ceil(ENEMIES[e.kind].gate * (1 + (policy(this.base).gate || 0))); e.hp = 0; }
        }
        this.enemies = this.enemies.filter(e => e.hp > 0);
        if (this.gate <= 0) { this.gate = 0; this.outcome = "LOSE"; return; }
        const po = policy(this.base);
        for (let i = 0; i < this.base.towers.length; i++) {
            const tower = this.base.towers[i]; if (!tower.kind || !tower.operator) continue;
            const p = person(this.base, tower.operator), t = TOWERS[tower.kind], at = PADS[i];
            const distance = (e: Enemy) => { const pos = pointAt(e.progress); return Math.hypot(pos.x - at.x, pos.y - at.y); };
            let speed = 1 + (p.trait === "trait_nimble" ? .1 : 0) + (p.trait === "trait_focused" && tower.kind === "ARROW" ? .15 : 0) + (po.speed || 0) + (tower.kind === "ARROW" ? po.arrowSpeed || 0 : tower.kind === "STONE" ? po.stoneSpeed || 0 : 0);
            if (this.bellTicks > 0) speed *= 1.5;
            if (this.base.night!.hungry) speed *= RULE.hungerSpeed;
            if (this.enemies.some(e => e.hp > 0 && e.kind === "enemy_disruptor" && distance(e) <= 190)) speed *= RULE.disruptSpeed;
            this.charge[i] += RULE.step * speed / t.interval;
            const range = t.range * (1 + (p.trait === "trait_farsight" ? .15 : 0) + (po.range || 0));
            const candidates = this.enemies.filter(e => e.hp > 0 && distance(e) <= range).sort((a, b) => b.progress - a.progress || a.seq - b.seq);
            if (!candidates.length) { this.charge[i] = Math.min(1, this.charge[i]); continue; }
            if (this.charge[i] < 1) continue;
            this.charge[i] -= 1;
            const target = candidates[0], center = pointAt(target.progress);
            const nearby = this.enemies.filter(e => e.hp > 0 && Math.hypot(pointAt(e.progress).x - center.x, pointAt(e.progress).y - center.y) <= t.splash);
            const bonus = (po.damage || 0) + (tower.kind === "STONE" ? (p.trait === "trait_strong" ? .2 : 0) + (p.skill === "skill_throwing" ? .25 : 0) + (po.stoneDamage || 0) : tower.kind === "ARROW" && p.skill === "skill_archery" ? .25 : 0);
            for (const e of tower.kind === "STONE" ? nearby : [target]) {
                const armor = ENEMIES[e.kind].armor;
                e.hp -= Math.max(1, Math.floor(t.damage * RULE.levelDamage[tower.level - 1] * (1 + bonus) * (1 - armor / (tower.kind === "STONE" ? 2 : 1))));
            }
            if (tower.kind === "SLOW") {
                const strength = Math.min(.6, .3 + (p.trait === "trait_patient" ? .1 : 0) + (p.skill === "skill_warding" ? .1 : 0) + (po.slow || 0));
                for (const e of nearby) if (!e.slowTicks || strength >= e.slow) { e.slow = strength; e.slowTicks = RULE.slowTicks; refreshed.add(e.seq); }
            }
            this.shots.push({ tower: i, x: center.x, y: center.y, kind: tower.kind, tick: this.tick });
        }
        this.enemies = this.enemies.filter(e => e.hp > 0);
        this.shots = this.shots.filter(s => this.tick - s.tick < 5).slice(-RULE.effectCap);
        if (!this.enemies.length && this.pendingCount === 0) this.outcome = "WIN";
        for (const e of this.enemies) if (existingSlow.has(e.seq) && !refreshed.has(e.seq) && e.slowTicks > 0) e.slowTicks--;
        if (this.bellTicks > 0) this.bellTicks--;
        this.tick++;
    }
}
