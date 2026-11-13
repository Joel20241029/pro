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
    heartElapsed: number | null; mirror: boolean;
    /** 纯视觉累计路程；逐寻路段累计，停止、调岗和换屏都不重置，不写入存档。 */
    walkDistance: number;
    /** 从出发到休息结束预占的树；null表示当前未预占，不参与存档。 */
    loggingTree: string | null;
}
interface MovingPerson extends VillagerPose {
    signature: string; plan: Visit[]; routine: Visit[]; wedding: boolean; visit: number; route: GroundPoint[]; remaining: number; person: Person; lastLoggingTree: string | null;
}
interface Wedding { family: string; partners: string[]; elapsed: number | null; }

/** 自主行为只描述画面：不写 GameState、不消费业务随机数、不因走路增减生产/伤害。 */
export class VillagerMotion {
    private people = new Map<string, MovingPerson>();
    private run: number | null = null;
    private knownFamilies = new Set<string>();
    private weddings: Wedding[] = [];
    private wedding: Wedding | null = null;
    private campSlots = new Map<string, number>();
    private careStops = new Map<string, GroundPoint>();
    private night = false;
    /** 独立表现随机源，仅在真正分配下一棵树时抽取；可注入用于复现，不读写GameState.seed。 */
    constructor(public navigation = new VillageNavigation(), private stops = VILLAGE_STOPS, private visualRandom: () => number = Math.random) {}
    /** 只迁移显示坐标和路线，保留日程游标、驻足/动画计时、营火席位与已播放的成家记录。 */
    relayout(navigation: VillageNavigation, stops: typeof VILLAGE_STOPS, project: (p: GroundPoint) => GroundPoint) {
        const positions = new Map<GroundPoint, GroundPoint>();
        for (const key of Object.keys(this.stops) as (keyof typeof VILLAGE_STOPS)[]) {
            this.stops[key].forEach((p, i) => positions.set(p, stops[key][i]));
        }
        for (const [id, at] of this.careStops) {
            const child = this.people.get(id)!.person.careChild!;
            const before = this.stops.rest[this.campSlots.get(child)!], after = stops.rest[this.campSlots.get(child)!];
            const moved = navigation.relocate({ x: after.x + at.x - before.x, y: after.y + at.y - before.y });
            positions.set(at, moved); this.careStops.set(id, moved);
        }
        const visits = new Set<Visit>();
        for (const m of this.people.values()) for (const v of [...m.plan, ...m.routine]) visits.add(v);
        for (const v of visits) v.at = positions.get(v.at) || navigation.relocate(project(v.at));
        this.navigation = navigation; this.stops = stops;
        for (const m of this.people.values()) {
            const goal = m.plan[m.visit].at, at = m.walking ? navigation.relocate(project(m)) : goal;
            m.x = at.x; m.y = at.y;
            m.route = m.walking ? navigation.route(m, goal) : [];
        }
    }
    get count() { return this.people.size; }
    get(id: string): Readonly<VillagerPose> { const p = this.people.get(id); if (!p) throw new Error(`未同步村民表现：${id}`); return p; }
    sync(state: GameState, towers: Tower[]) {
        const newRun = this.run !== state.run;
        if (newRun) { this.people.clear(); this.campSlots.clear(); this.run = state.run; this.weddings = []; this.wedding = null; }
        const present = new Set(state.people.map(p => p.id));
        for (const id of this.people.keys()) if (!present.has(id)) this.people.delete(id);
        this.night = state.phase === "NIGHT";
        // 先整体释放无效预占，再分配，避免按人物遍历顺序留下已退休/调岗的树。
        for (const p of state.people) {
            const m = this.people.get(p.id);
            if (m && (this.night || m.wedding || !p.adult || isElder(p) || p.job !== "LOGGING")) m.loggingTree = null;
        }
        for (const id of this.campSlots.keys()) if (!present.has(id)) this.campSlots.delete(id);
        const sorted = state.people.slice().sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
        for (const p of sorted) if (!this.campSlots.has(p.id)) {
            const used = new Set(this.campSlots.values()), slot = this.stops.rest.findIndex((_, i) => !used.has(i));
            if (slot < 0) throw new Error("火堆站点少于在村人数");
            this.campSlots.set(p.id, slot);
        }
        // 先保护孩子的固定位置，再把照料者与最近的非孩子位置交换；满员也不会重叠或挪动婴儿。
        this.careStops.clear();
        const reserved = new Set(sorted.filter(p => !p.adult).map(p => p.id));
        for (const p of sorted) if (p.job === "CARE" && p.careChild) {
            const child = this.stops.rest[this.campSlots.get(p.careChild)!], old = this.campSlots.get(p.id)!;
            const slots = this.stops.rest.map((at, i) => ({ i, d: distance(at, child), owner: sorted.find(q => this.campSlots.get(q.id) === i)?.id }))
                .filter(q => (!q.owner || !reserved.has(q.owner)) && Math.abs(this.stops.rest[q.i].x - child.x) >= 24 && Math.abs(this.stops.rest[q.i].y - child.y) < Math.abs(this.stops.rest[q.i].x - child.x))
                .sort((a, b) => a.d - b.d || a.i - b.i);
            const best = slots[0];
            if (best) {
                if (best.owner && best.owner !== p.id) this.campSlots.set(best.owner, old);
                this.campSlots.set(p.id, best.i);
            } else {
                // 极多未成年人的满员场景：保留所有婴儿位置，在侧方找空隙，不能退回正上/正下招手。
                const occupied = sorted.filter(q => q.id !== p.id).map(q => this.careStops.get(q.id) || this.stops.rest[this.campSlots.get(q.id)!]);
                let at: GroundPoint | null = null;
                for (let dx = 24; dx <= 160 && !at; dx += 4) for (const dy of [0, 4, -4, 8, -8, 12, -12, 16, -16, 20, -20]) {
                    for (const side of [-1, 1]) { const candidate = { x: child.x + dx * side, y: child.y + dy }; if (this.navigation.walkable(candidate) && occupied.every(point => distance(point, candidate) >= 22)) { at = candidate; break; } }
                    if (at) break;
                }
                if (!at) throw new Error("照料者缺少侧方站位");
                this.careStops.set(p.id, at);
            }
            reserved.add(p.id);
        }
        for (const p of sorted) {
            const sequence = this.campSlots.get(p.id)! + 1, tower = towers.findIndex(t => t.operator === p.id);
            const coworkers = sorted.filter(q => q.adult && q.job === p.job), slot = p.job === "LOGGING" ? 0 : coworkers.findIndex(q => q.id === p.id);
            const careStop = this.careStops.get(p.id);
            const signature = `${state.phase === "NIGHT" ? "NIGHT" : "DAY"}:${p.adult}:${isElder(p)}:${p.growth}:${p.appearance}:${p.job}:${p.careChild}:${slot}:${tower}:${this.campSlots.get(p.id)}:${careStop?.x}:${careStop?.y}`;
            let m = this.people.get(p.id);
            if (!m) {
                const home = !p.adult && p.growth === 0 ? this.stops.rest[this.campSlots.get(p.id)!] : this.stops.homes[(sequence - 1) % this.stops.homes.length];
                m = { ...home, id: p.id, direction: "DOWN", walking: false, insideTower: false, clip: "", animated: false, elapsed: 0, heartElapsed: null, mirror: false, walkDistance: 0, loggingTree: null, lastLoggingTree: null, signature: "", plan: [], routine: [], wedding: false, visit: 0, route: [], remaining: 0, person: p };
                this.people.set(p.id, m);
            }
            m.person = p;
            if (m.signature === signature) continue;
            m.signature = signature; m.routine = this.itinerary(m, this.night, tower, slot, sequence);
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
            const m = this.people.get(id)!; m.wedding = true; m.heartElapsed = null; m.loggingTree = null;
            this.setPlan(m, [{ at: this.stops.wedding[i], seconds: Infinity, working: false, insideTower: false }]);
        });
    }
    private endWedding() {
        if (!this.wedding) return;
        for (const id of this.wedding.partners) {
            const m = this.people.get(id); if (!m) continue;
            m.wedding = false; m.heartElapsed = null;
            // 婚礼期间旧工位已释放，结束后在启用日程前重新预占；夜晚不领取白天工位。
            if (!this.night && m.person.adult && !isElder(m.person) && m.person.job === "LOGGING")
                m.routine.find(v => v.working)!.at = this.chooseLoggingTree(m);
            this.setPlan(m, m.routine);
        }
        this.wedding = null;
    }
    private chooseLoggingTree(m: MovingPerson) {
        const occupied = new Set([...this.people.values()].filter(p => p.id !== m.id).map(p => p.loggingTree));
        const candidates = this.stops.logging.filter(stop => !occupied.has(stop.treeId) && stop.treeId !== m.lastLoggingTree);
        if (!candidates.length) throw new Error("五个伐木工位不足以轮换，请检查人数与地图配置");
        const chosen = candidates[Math.floor(this.visualRandom() * candidates.length)];
        m.loggingTree = chosen.treeId; m.lastLoggingTree = chosen.treeId;
        return chosen;
    }
    private itinerary(m: MovingPerson, night: boolean, tower: number, slot: number, sequence: number): Visit[] {
        const p = m.person;
        const home = this.stops.homes[(sequence - 1) % this.stops.homes.length];
        const visit = (at: GroundPoint, seconds: number, working = false): Visit => ({ at, seconds, working, insideTower: false });
        const camp = this.careStops.get(p.id) || this.stops.rest[this.campSlots.get(p.id)!];
        if (!p.adult && p.growth === 0) return [visit(camp, Infinity)];
        if (night) return [{ ...visit(tower >= 0 ? this.stops.towers[tower] : camp, Infinity, tower < 0 && p.job === "CARE"), insideTower: tower >= 0 }];
        const rest = this.stops.rest[(sequence - 1) % this.stops.rest.length];
        const dwell = MOTION.workSeconds + (sequence % 4) * MOTION.staggerSeconds;
        if (isElder(p)) return [visit(rest, dwell), visit(home, dwell)];
        if (!p.adult) return [visit(this.stops.children[sequence - 1], MOTION.restSeconds), visit(home, MOTION.restSeconds)];
        if (p.job === "LOGGING") {
            // 婚礼期间只缓存日程；真正恢复工作前由endWedding选择树，不提前占位。
            const at = m.wedding ? rest : m.loggingTree ? this.stops.logging.find(stop => stop.treeId === m.loggingTree)! : this.chooseLoggingTree(m);
            return [visit(at, dwell, true), visit(rest, MOTION.restSeconds)];
        }
        if (p.job === "FARM") {
            const stops = this.stops.farm;
            if (slot < 0 || slot >= stops.length) throw new Error("工作表现站点少于已分配岗位");
            return [visit(stops[slot], dwell, true), visit(rest, MOTION.restSeconds)];
        }
        if (p.job === "CARE") {
            return [visit(camp, dwell, true), visit(home, MOTION.restSeconds)];
        }
        return [visit(rest, MOTION.restSeconds + (sequence % 3) * MOTION.staggerSeconds), visit(home, MOTION.restSeconds)];
    }
    private chooseAction(m: MovingPerson, walking: boolean) {
        const p = m.person;
        const elder = isElder(p);
        let clip = elder ? `villager_elder_${p.sex === "MALE" ? "male" : "female"}_${walking ? "walk" : "idle"}` : p.adult ? `villager_${p.appearance}_walk` : p.growth === 0 ? "villager_baby_idle" : `villager_${p.sex === "MALE" ? "boy" : "girl"}_walk`;
        let animated = walking || elder || (!p.adult && p.growth === 0);
        if (!walking && m.plan[m.visit].working) {
            if (p.job !== "WAITING") { clip = LABOR_CLIPS[p.appearance][p.job]; animated = true; }
        }
        // 移动仍按行走方向选择 walk；驻足伐木和照料时，根据工作目标镜像原美术。
        if (m.clip !== clip || m.animated !== animated) m.elapsed = 0;
        m.clip = clip; m.animated = animated; m.walking = walking;
        m.mirror = false;
        if (!walking && clip.endsWith("_chop")) {
            const target = this.stops.logging.find(stop => stop.treeId === m.loggingTree);
            if (!target) throw new Error("伐木动作缺少目标树");
            m.mirror = target.treeX < m.x;
        } else if (!walking && clip.endsWith("_care") && p.careChild) {
            const child = this.people.get(p.careChild) || this.stops.rest[this.campSlots.get(p.careChild)!];
            m.mirror = child.x < m.x;
        }
        // 夜间驻塔到达后视为进入塔内；仍保留位置与日程，调任/天亮会自然重新显示。
        m.insideTower = !walking && m.plan[m.visit].insideTower;
    }
    /** 调用者传实际视觉时间；传 0 表示暂停，当前位置、动作累计时间和帧均保持。 */
    update(delta: number) {
        const dt = Math.min(RULE.frameCap * RULE.maxSpeed, Math.max(0, delta));
        if (!dt) return;
        for (const m of this.people.values()) {
            if (m.animated) m.elapsed += dt;
            if (!m.walking) {
                m.remaining -= dt;
                if (m.remaining > 0 || m.plan.length === 1) continue;
                m.visit = (m.visit + 1) % m.plan.length;
                if (!this.night && !m.wedding && m.person.job === "LOGGING" && m.plan[m.visit].working)
                    m.plan[m.visit].at = this.chooseLoggingTree(m);
                m.route = this.navigation.route(m, m.plan[m.visit].at); this.chooseAction(m, true);
            }
            let travel = (isElder(m.person) ? MOTION.elderSpeed : m.person.adult ? MOTION.adultSpeed : MOTION.childSpeed) * dt;
            while (m.route.length && travel > 0) {
                const next = m.route[0], d = distance(m, next), dx = next.x - m.x, dy = next.y - m.y;
                m.walkDistance += Math.min(d, travel);
                if (d > .01) m.direction = walkDirection(dx, dy, m.direction);
                if (d <= travel) { m.x = next.x; m.y = next.y; travel -= d; m.route.shift(); }
                else { m.x += dx / d * travel; m.y += (next.y - m.y) / d * travel; travel = 0; }
            }
            if (!m.route.length) { m.remaining = m.plan[m.visit].seconds; this.chooseAction(m, false); }
        }
        for (const m of this.people.values()) if (!m.walking && m.clip.endsWith("_care") && m.person.careChild) {
            m.mirror = this.people.get(m.person.careChild)!.x < m.x;
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
