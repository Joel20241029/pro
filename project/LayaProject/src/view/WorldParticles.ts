import { ParticleEffect, ParticleLibrary } from './ParticleLibrary';
import { RULE } from '../game/GameConfig';
interface Burst { effect: ParticleEffect; age: number; }
/** 战斗命中与脚底环的生命周期所有者。实例复用，不跨人物身份残留。 */
export class WorldParticles {
    private free = new Map<string, ParticleEffect[]>();
    private bursts: Burst[] = [];
    private rings = new Map<string, ParticleEffect>();
    private visibleRings = new Set<string>();
    constructor(private library: ParticleLibrary, private world: Laya.Sprite, private overlay: Laya.Sprite) {}
    private acquire(id: string) { return this.free.get(id)?.pop() || this.library.create(id); }
    private release(effect: ParticleEffect) {
        effect.clear(); effect.node.removeSelf();
        if (!this.free.has(effect.id)) this.free.set(effect.id, []);
        this.free.get(effect.id)!.push(effect);
    }
    private retainBurst(burst: Burst) {
        // 与ProjectileMotion共享现有装饰上限；回收最旧纯表现实例。
        if (this.bursts.length >= RULE.effectCap) this.release(this.bursts.shift()!.effect);
        this.bursts.push(burst);
    }
    burst(id: string, x: number, y: number) {
        const effect = this.acquire(id); effect.start(this.overlay, x, y);
        this.retainBurst({ effect, age: 0 });
    }
    beginPeople() { this.visibleRings.clear(); }
    ring(id: string, x: number, y: number, scale: number): Laya.Sprite {
        this.visibleRings.add(id);
        let effect = this.rings.get(id);
        if (!effect) { effect = this.acquire('elite_ring'); effect.start(this.world, x, y); this.rings.set(id, effect); }
        effect.node.pos(x, y).scale(scale, scale); return effect.node;
    }
    endPeople() {
        for (const [id, effect] of this.rings) if (!this.visibleRings.has(id)) { this.release(effect); this.rings.delete(id); }
    }
    advance(delta: number, combatSpeed: number, active: boolean) {
        const dt = active ? Math.min(RULE.frameCap, Math.max(0, delta)) : 0;
        const clock = delta > 0 ? dt / delta : 0;
        for (const burst of this.bursts) {
            burst.effect.clock(clock * combatSpeed); burst.age += dt * combatSpeed;
        }
        this.bursts = this.bursts.filter(b => {
            // 主模块寿命为编辑器固定值；命中粒子消退后归还实例池。
            if (b.age < b.effect.system.main.startLifetime.constant + RULE.step * 2) return true;
            this.release(b.effect); return false;
        });
        for (const effect of this.rings.values()) {
            effect.clock(clock);
            // 编辑器椭圆边缘持续出粒子；位置固定在脚底，不随人物镜像。
        }
    }
    clearBattle() {
        for (const burst of this.bursts) this.release(burst.effect); this.bursts = [];
    }
    reset() {
        this.clearBattle();
        for (const effect of this.rings.values()) this.release(effect); this.rings.clear();
    }
    destroy() { this.reset(); for (const effects of this.free.values()) effects.forEach(e => e.destroy()); this.free.clear(); }
}
