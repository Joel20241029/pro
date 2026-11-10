import { GameState, isElder, Person, Tower } from "../game/GameState";
import { LABOR_CLIPS, RULE } from "../game/GameConfig";
import { distance, GroundPoint, MOTION, VillageNavigation, VILLAGE_STOPS, WEDDING } from "./VillageScene";

interface Visit { at: GroundPoint; seconds: number; working: boolean; insideTower: boolean; }
export type WalkDirection = "UP" | "DOWN" | "LEFT" | "RIGHT";
/** 斜向拐弯时使用 15% 主轴滞回，减少方向反复切换；只影响朝向，不改速度与路线。 */
export function walkDirection(dx: number, dy: number, previous: WalkDirection): WalkDirection {
    if (dx === 0 && dy === 0) return previous;
    const horizontal = previous === "LEFT" || previous === "RIGHT", threshold = 1.15;
    if (horizontal ? Math.abs(dy) > Math.abs(dx) * threshold : Math.abs(dy) >= Math.abs(dx) / threshold) return dy < 0 ? "UP" : "DOWN";
    return dx < 0 ? "LEFT" : "RIGHT";
}
export interface VillagerPose extends GroundPoint {
    id: string; direction: WalkDirection; walking: boolean; insideTower: boolean; clip: string; animated: boolean; elapsed: number;
    heartElapsed: number | null;
}
interface MovingPerson extends VillagerPose {
    signature: string; sequence: number; plan: Visit[]; routine: Visit[]; wedding: boolean; visit: number; route: GroundPoint[]; remaining: number; person: Person;
}
interface Wedding { family: string; partners: string[]; elapsed: number | null; }

/** 自主行为只描述画面：不写 GameState、不消费业务随机数、不因走路增减生产/伤害。 */
export class VillagerMotion {
    private people = new Map<string, MovingPerson>();
    private run: number | null = null;
    private knownFamilies = new Set<string>();
    private weddings: Wedding[] = [];
    private wedding: Wedding | null = null;
    constructor(readonly navigation = new VillageNavigation()) {}
    get count() { return this.people.size; }
    get(id: string): Readonly<VillagerPose> { const p = this.people.get(id); if (!p) throw new Error(`未同步村民表现：${id}`); return p; }
    sync(state: GameState, towers: Tower[]) {
        const newRun = this.run !== state.run;
        if (newRun) { this.people.clear(); this.run = state.run; this.weddings = []; this.wedding = null; }
        const present = new Set(state.people.map(p => p.id));
        for (const id of this.people.keys()) if (!present.has(id)) this.people.delete(id);
        const sorted = state.people.slice().sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
        for (const p of sorted) {
            const sequence = Number(p.id.split(":")[1]), tower = towers.findIndex(t => t.operator === p.id);
            const coworkers = sorted.filter(q => q.adult && q.job === p.job), slot = coworkers.findIndex(q => q.id === p.id);
            const signature = `${state.phase === "NIGHT" ? "NIGHT" : "DAY"}:${p.adult}:${isElder(p)}:${p.growth}:${p.appearance}:${p.job}:${p.careChild}:${slot}:${tower}`;
            let m = this.people.get(p.id);
            if (!m) {
                const home = VILLAGE_STOPS.homes[(sequence - 1) % VILLAGE_STOPS.homes.length];
                m = { ...home, id: p.id, direction: "DOWN", walking: false, insideTower: false, clip: "", animated: false, elapsed: 0, heartElapsed: null, signature: "", sequence, plan: [], routine: [], wedding: false, visit: 0, route: [], remaining: 0, person: p };
                this.people.set(p.id, m);
            }
            m.person = p;
            if (m.signature === signature) continue;
            m.signature = signature; m.routine = this.itinerary(p, state.phase === "NIGHT", tower, slot, sequence);
            if (!m.wedding) this.setPlan(m, m.routine);
        }
        const families = new Set(state.families.map(f => f.id));
        const valid = (w: Wedding) => families.has(w.family) && w.partners.every(id => present.has(id));
        if (this.wedding && (state.phase !== "DAY" || !valid(this.wedding))) this.endWedding();
        this.weddings = state.phase === "DAY" ? this.weddings.filter(valid) : [];
        // 初次加载只记基线；只对当前已提交状态中新增的家庭庆祝，打开面板/读档不会重复播放。
        if (!newRun && state.phase === "DAY") for (const f of state.families) {
            if (!this.knownFamilies.has(f.id)) this.weddings.push({ family: f.id, partners: f.partners.slice(), elapsed: null });
        }
        this.knownFamilies = families;
        this.startWedding();
    }
    /** 切换日程统一从当前足底寻路；已在目的地时直接开始驻足，避免跳过第一个停留点。 */
    private setPlan(m: MovingPerson, plan: Visit[]) {
        m.plan = plan; m.visit = 0;
        const walking = distance(m, plan[0].at) > .01;
        m.route = walking ? this.navigation.route(m, plan[0].at) : [];
        m.remaining = walking ? 0 : plan[0].seconds; this.chooseAction(m, walking);
    }
    private startWedding() {
        if (this.wedding || !this.weddings.length) return;
        const w = this.weddings.shift()!; this.wedding = w;
        w.partners.forEach((id, i) => {
            const m = this.people.get(id)!; m.wedding = true; m.heartElapsed = null;
            this.setPlan(m, [{ at: VILLAGE_STOPS.wedding[i], seconds: Infinity, working: false, insideTower: false }]);
        });
    }
    private endWedding() {
        if (!this.wedding) return;
        for (const id of this.wedding.partners) {
            const m = this.people.get(id); if (!m) continue;
            m.wedding = false; m.heartElapsed = null; this.setPlan(m, m.routine);
        }
        this.wedding = null;
    }
    private itinerary(p: Person, night: boolean, tower: number, slot: number, sequence: number): Visit[] {
        const home = VILLAGE_STOPS.homes[(sequence - 1) % VILLAGE_STOPS.homes.length];
        const visit = (at: GroundPoint, seconds: number, working = false): Visit => ({ at, seconds, working, insideTower: false });
        if (!p.adult && p.growth === 0) return [visit(home, Infinity)];
        if (night) return [{ ...visit(tower >= 0 ? VILLAGE_STOPS.towers[tower] : home, Infinity), insideTower: tower >= 0 }];
        const rest = VILLAGE_STOPS.rest[(sequence - 1) % VILLAGE_STOPS.rest.length];
        const dwell = MOTION.workSeconds + (sequence % 4) * MOTION.staggerSeconds;
        if (isElder(p)) return [visit(rest, dwell), visit(home, dwell)];
        if (!p.adult) return [visit(VILLAGE_STOPS.children[sequence % VILLAGE_STOPS.children.length], MOTION.restSeconds), visit(home, MOTION.restSeconds)];
        if (p.job === "FARM" || p.job === "LOGGING") {
            const stops = p.job === "FARM" ? VILLAGE_STOPS.farm : VILLAGE_STOPS.logging;
            if (slot < 0 || slot >= stops.length) throw new Error("工作表现站点少于已分配岗位");
            return [visit(stops[slot], dwell, true), visit(rest, MOTION.restSeconds)];
        }
        if (p.job === "CARE") {
            const childSequence = Number(p.careChild!.split(":")[1]);
            const childHome = VILLAGE_STOPS.homes[(childSequence - 1) % VILLAGE_STOPS.homes.length];
            // 留出婴儿可见宽度，避免照料者在前景覆盖孩子；仅调整表现站位。
            return [visit({ x: childHome.x + 34, y: childHome.y + 8 }, dwell, true), visit(home, MOTION.restSeconds)];
        }
        return [visit(rest, MOTION.restSeconds + (sequence % 3) * MOTION.staggerSeconds), visit(VILLAGE_STOPS.rest[(sequence + 2) % VILLAGE_STOPS.rest.length], MOTION.restSeconds), visit(home, MOTION.restSeconds)];
    }
    private chooseAction(m: MovingPerson, walking: boolean) {
        const p = m.person;
        const elder = isElder(p);
        let clip = elder ? `villager_elder_${p.sex === "MALE" ? "male" : "female"}_${walking ? "walk" : "idle"}` : p.adult ? `villager_${p.appearance}_walk` : p.growth === 0 ? "villager_baby_idle" : `villager_${p.sex === "MALE" ? "boy" : "girl"}_walk`;
        let animated = walking || elder || (!p.adult && p.growth === 0);
        if (!walking && m.plan[m.visit].working) {
            if (p.job !== "WAITING") { clip = LABOR_CLIPS[p.appearance][p.job]; animated = true; }
        }
        // 专用劳动动作固定为原美术视角；所有移动都选择方向 walk，不能用只有正面的 carry 代替。
        if (m.clip !== clip || m.animated !== animated) m.elapsed = 0;
        m.clip = clip; m.animated = animated; m.walking = walking;
        // 夜间驻塔到达后视为进入塔内；仍保留位置与日程，调任/天亮会自然重新显示。
        m.insideTower = !walking && m.plan[m.visit].insideTower;
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
            let travel = (isElder(m.person) ? MOTION.elderSpeed : m.person.adult ? MOTION.adultSpeed : MOTION.childSpeed) * dt;
            while (m.route.length && travel > 0) {
                const next = m.route[0], d = distance(m, next), dx = next.x - m.x, dy = next.y - m.y;
                if (d > .01) m.direction = walkDirection(dx, dy, m.direction);
                if (d <= travel) { m.x = next.x; m.y = next.y; travel -= d; m.route.shift(); }
                else { m.x += dx / d * travel; m.y += (next.y - m.y) / d * travel; travel = 0; }
            }
            if (!m.route.length) { m.remaining = m.plan[m.visit].seconds; this.chooseAction(m, false); }
        }
        const w = this.wedding;
        if (w && w.partners.every(id => !this.people.get(id)!.walking)) {
            w.elapsed = w.elapsed === null ? 0 : w.elapsed + dt;
            if (w.elapsed >= WEDDING.heartSeconds) { this.endWedding(); this.startWedding(); }
            else w.partners.forEach((id, i) => {
                const m = this.people.get(id)!; m.heartElapsed = w.elapsed; m.direction = i === 0 ? "RIGHT" : "LEFT";
            });
        }
    }
}
