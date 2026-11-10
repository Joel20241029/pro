import { GameState, Person, Tower } from "../game/GameState";
import { RULE } from "../game/GameConfig";
import { distance, GroundPoint, MOTION, VillageNavigation, VILLAGE_STOPS } from "./VillageScene";

interface Visit { at: GroundPoint; seconds: number; working: boolean; }
export type WalkDirection = "UP" | "DOWN" | "LEFT" | "RIGHT";
/** 斜向拐弯时使用 15% 主轴滞回，减少方向反复切换；只影响朝向，不改速度与路线。 */
export function walkDirection(dx: number, dy: number, previous: WalkDirection): WalkDirection {
    if (dx === 0 && dy === 0) return previous;
    const horizontal = previous === "LEFT" || previous === "RIGHT", threshold = 1.15;
    if (horizontal ? Math.abs(dy) > Math.abs(dx) * threshold : Math.abs(dy) >= Math.abs(dx) / threshold) return dy < 0 ? "UP" : "DOWN";
    return dx < 0 ? "LEFT" : "RIGHT";
}
export interface VillagerPose extends GroundPoint {
    id: string; direction: WalkDirection; walking: boolean; clip: string; animated: boolean; elapsed: number;
}
interface MovingPerson extends VillagerPose {
    signature: string; sequence: number; plan: Visit[]; visit: number; route: GroundPoint[]; remaining: number; person: Person;
}

/** 自主行为只描述画面：不写 GameState、不消费业务随机数、不因走路增减生产/伤害。 */
export class VillagerMotion {
    private people = new Map<string, MovingPerson>();
    private run: number | null = null;
    constructor(readonly navigation = new VillageNavigation()) {}
    get count() { return this.people.size; }
    get(id: string): Readonly<VillagerPose> { const p = this.people.get(id); if (!p) throw new Error(`未同步村民表现：${id}`); return p; }
    sync(state: GameState, towers: Tower[]) {
        if (this.run !== state.run) { this.people.clear(); this.run = state.run; }
        const present = new Set(state.people.map(p => p.id));
        for (const id of this.people.keys()) if (!present.has(id)) this.people.delete(id);
        const sorted = state.people.slice().sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
        for (const p of sorted) {
            const sequence = Number(p.id.split(":")[1]), tower = towers.findIndex(t => t.operator === p.id);
            const coworkers = sorted.filter(q => q.adult && q.job === p.job), slot = coworkers.findIndex(q => q.id === p.id);
            const signature = `${state.phase === "NIGHT" ? "NIGHT" : "DAY"}:${p.adult}:${p.growth}:${p.appearance}:${p.job}:${p.careChild}:${slot}:${tower}`;
            let m = this.people.get(p.id);
            if (!m) {
                const home = VILLAGE_STOPS.homes[(sequence - 1) % VILLAGE_STOPS.homes.length];
                m = { ...home, id: p.id, direction: "DOWN", walking: false, clip: "", animated: false, elapsed: 0, signature: "", sequence, plan: [], visit: 0, route: [], remaining: 0, person: p };
                this.people.set(p.id, m);
            }
            m.person = p;
            if (m.signature === signature) continue;
            m.signature = signature; m.plan = this.itinerary(p, state.phase === "NIGHT", tower, slot, sequence); m.visit = 0;
            m.route = this.navigation.route(m, m.plan[0].at); m.remaining = 0;
            this.chooseAction(m, distance(m, m.plan[0].at) > .01);
        }
    }
    private itinerary(p: Person, night: boolean, tower: number, slot: number, sequence: number): Visit[] {
        const home = VILLAGE_STOPS.homes[(sequence - 1) % VILLAGE_STOPS.homes.length];
        const visit = (at: GroundPoint, seconds: number, working = false): Visit => ({ at, seconds, working });
        if (!p.adult && p.growth === 0) return [visit(home, Infinity)];
        if (night) return [visit(tower >= 0 ? VILLAGE_STOPS.towers[tower] : home, Infinity)];
        const rest = VILLAGE_STOPS.rest[(sequence - 1) % VILLAGE_STOPS.rest.length];
        const dwell = MOTION.workSeconds + (sequence % 4) * MOTION.staggerSeconds;
        if (!p.adult) return [visit(VILLAGE_STOPS.children[sequence % VILLAGE_STOPS.children.length], MOTION.restSeconds), visit(home, MOTION.restSeconds)];
        if (p.job === "FARM" || p.job === "LOGGING") {
            const stops = p.job === "FARM" ? VILLAGE_STOPS.farm : VILLAGE_STOPS.logging;
            if (slot < 0 || slot >= stops.length) throw new Error("工作表现站点少于已分配岗位");
            return [visit(stops[slot], dwell, true), visit(rest, MOTION.restSeconds)];
        }
        if (p.job === "CARE") {
            const childSequence = Number(p.careChild!.split(":")[1]);
            const childHome = VILLAGE_STOPS.homes[(childSequence - 1) % VILLAGE_STOPS.homes.length];
            return [visit({ x: childHome.x + 14, y: childHome.y + 8 }, dwell), visit(home, MOTION.restSeconds)];
        }
        return [visit(rest, MOTION.restSeconds + (sequence % 3) * MOTION.staggerSeconds), visit(VILLAGE_STOPS.rest[(sequence + 2) % VILLAGE_STOPS.rest.length], MOTION.restSeconds), visit(home, MOTION.restSeconds)];
    }
    private chooseAction(m: MovingPerson, walking: boolean) {
        const p = m.person;
        let clip = p.adult ? `villager_${p.appearance}_walk` : p.growth === 0 ? "villager_baby_idle" : `villager_${p.sex === "MALE" ? "boy" : "girl"}_walk`;
        let animated = walking || (!p.adult && p.growth === 0);
        if (!walking && m.plan[m.visit].working) {
            if (p.job === "FARM" && p.appearance === "male_a") { clip = "villager_male_a_farm"; animated = true; }
            else if (p.job === "FARM" && p.appearance === "female_a") { clip = "villager_female_a_harvest"; animated = true; }
            else if (p.job === "LOGGING" && p.appearance === "male_b") { clip = "villager_male_b_chop"; animated = true; }
        }
        // 专用劳动动作固定为原美术视角；所有移动都选择方向 walk，不能用只有正面的 carry 代替。
        if (m.clip !== clip || m.animated !== animated) m.elapsed = 0;
        m.clip = clip; m.animated = animated; m.walking = walking;
    }
    /** 调用者传实际视觉时间；传 0 表示暂停，当前位置、动作累计时间和帧均保持。 */
    update(delta: number) {
        const dt = Math.min(RULE.frameCap * 2, Math.max(0, delta));
        if (!dt) return;
        for (const m of this.people.values()) {
            if (m.animated) m.elapsed += dt;
            if (!m.walking) {
                m.remaining -= dt;
                if (m.remaining > 0 || m.plan.length === 1) continue;
                m.visit = (m.visit + 1) % m.plan.length;
                m.route = this.navigation.route(m, m.plan[m.visit].at); this.chooseAction(m, true);
            }
            let travel = (m.person.adult ? MOTION.adultSpeed : MOTION.childSpeed) * dt;
            while (m.route.length && travel > 0) {
                const next = m.route[0], d = distance(m, next), dx = next.x - m.x, dy = next.y - m.y;
                if (d > .01) m.direction = walkDirection(dx, dy, m.direction);
                if (d <= travel) { m.x = next.x; m.y = next.y; travel -= d; m.route.shift(); }
                else { m.x += dx / d * travel; m.y += (next.y - m.y) / d * travel; travel = 0; }
            }
            if (!m.route.length) { m.remaining = m.plan[m.visit].seconds; this.chooseAction(m, false); }
        }
    }
}
