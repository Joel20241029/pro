import { GameState, isElder, isWorkingAdult, Person, Tower } from "../game/GameState";
import { RULE, SEWING } from "../game/GameConfig";
import { sewingDayCap } from "../game/Growth";
import { distance, GroundPoint, MOTION, VillageNavigation, VILLAGE_STOPS, WEDDING } from "./VillageScene";
import { VisibleResidents } from "./VisibleResidents";
import { VILLAGE_GATE } from "./config/VillageSceneConfig";
import { villagerModel, walkDirection, WalkDirection } from "./VillagerAppearance";

interface Visit { at: GroundPoint; seconds: number; working: boolean; insideTower: boolean; insideFactory?: boolean; }
export { walkDirection, WalkDirection } from "./VillagerAppearance";
export interface VillagerPose extends GroundPoint {
    id: string; direction: WalkDirection; walking: boolean; insideTower: boolean; insideFactory: boolean; clip: string; animated: boolean; elapsed: number;
    heartElapsed: number | null;
    /** 纯视觉累计路程；逐寻路段累计，停止、调岗和换屏都不重置，不写入存档。 */
    walkDistance: number;

}
interface MovingPerson extends VillagerPose {
    signature: string; plan: Visit[]; routine: Visit[]; wedding: boolean; visit: number; route: GroundPoint[]; remaining: number; person: Person;
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
    private waitingSlots = new Map<string, number>();
    private night = false;
    private patrolNight = false;
    private sewingDay = 0;
    private sewingBatches = 0;
    private selection = new VisibleResidents();
    visiblePeople: readonly Person[] = [];
    constructor(public navigation = new VillageNavigation(), private stops = VILLAGE_STOPS) {}
    /** 只迁移显示坐标和路线，保留日程游标、驻足/动画计时、营火席位与已播放的成家记录。 */
    relayout(navigation: VillageNavigation, stops: typeof VILLAGE_STOPS, project: (p: GroundPoint) => GroundPoint) {
        const positions = new Map<GroundPoint, GroundPoint>();
        for (const key of Object.keys(this.stops) as (keyof typeof VILLAGE_STOPS)[]) {
            this.stops[key].forEach((p, i) => positions.set(p, stops[key][i]));
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
    /** 中央门洞是城墙唯一通路。只为近门且目的地在城墙另一侧的行人开门。 */
    crossingGate(gateY: number) {
        for (const m of this.people.values()) {
            if (m.walking && Math.abs(m.x - VILLAGE_GATE.x) <= MOTION.gateApproachWidth &&
                Math.abs(m.y - gateY) <= MOTION.gateApproachDepth &&
                (m.y - gateY) * (m.plan[m.visit].at.y - gateY) <= 0) return true;
        }
        return false;
    }
    sync(state: GameState, towers: Tower[], focus?: string) {
        const newRun = this.run !== state.run;
        const batchFinished = !newRun && state.phase === "DAY" && this.sewingDay === state.day &&
            state.factory.batches > this.sewingBatches;
        const sewingClosed = state.factory.batches >= SEWING.maxBatches || state.factory.earned >= sewingDayCap(state);
        this.sewingDay = state.day;
        this.sewingBatches = state.factory.batches;
        if (newRun) { this.people.clear(); this.campSlots.clear(); this.waitingSlots.clear(); this.run = state.run; this.weddings = []; this.wedding = null; }
        const families = new Set(state.families.map(f => f.id));
        // 新婚先入队，再挑选演员。暂未进入20人窗口的家庭仍保留，轮到时才播放。
        // 初次加载只记基线；夜间或家庭消失沿用原规则取消，不在读档后补放旧婚礼。
        this.weddings = state.phase === "DAY" ? this.weddings.filter(w => families.has(w.family)) : [];
        if (!newRun && state.phase === "DAY") for (const f of state.families) {
            if (!this.knownFamilies.has(f.id)) this.weddings.push({ family: f.id, partners: f.partners.slice(), elapsed: null });
        }
        this.knownFamilies = families;
        this.visiblePeople = this.selection.select(state, towers, [
            ...(this.wedding ? this.wedding.partners : []), ...this.weddings.reduce<string[]>((ids, w) => ids.concat(w.partners), [])
        ], focus);
        const present = new Set(this.visiblePeople.map(p => p.id));
        for (const id of this.people.keys()) if (!present.has(id)) this.people.delete(id);
        this.night = state.phase === "NIGHT";
        this.patrolNight = this.night && state.night?.patrolSpin === true;
        for (const id of this.campSlots.keys()) if (!present.has(id)) this.campSlots.delete(id);
        const sorted = this.visiblePeople.slice().sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
        for (const p of sorted) if (!this.campSlots.has(p.id)) {
            const used = new Set(this.campSlots.values()), slot = this.stops.rest.findIndex((_, i) => !used.has(i));
            if (slot < 0) throw new Error("村中休息站点少于在村人数");
            this.campSlots.set(p.id, slot);
        }
        const camp = this.patrolNight ? this.stops.nightRest : this.stops.rest;
        if (!this.night) this.placeWaitingResidents(sorted);
        for (const p of sorted) {
            const sequence = this.campSlots.get(p.id)! + 1, tower = towers.findIndex(t => t.operator === p.id);
            const coworkers = sorted.filter(q => q.adult && q.job === p.job), slot = coworkers.findIndex(q => q.id === p.id);
            const sewing = !this.night && p.job === "SEWING";
            const signature = `${state.phase === "NIGHT" ? "NIGHT" : "DAY"}:${p.adult}:${isElder(p)}:${p.growth}:${p.appearance}:${p.job}:${slot}:${tower}:${this.campSlots.get(p.id)}:${this.waitingSlots.get(p.id)}:${sewing && sewingClosed}`;
            let m = this.people.get(p.id);
            if (!m) {
                const home = !p.adult && p.growth === 0 ? camp[this.campSlots.get(p.id)!] : this.stops.homes[(sequence - 1) % this.stops.homes.length];
                m = { ...home, id: p.id, direction: "DOWN", walking: false, insideTower: false, insideFactory: false, clip: "", animated: false, elapsed: 0, heartElapsed: null, walkDistance: 0, signature: "", plan: [], routine: [], wedding: false, visit: 0, route: [], remaining: 0, person: p };
                this.people.set(p.id, m);
            }
            m.person = p;
            const takingBreak = sewing && batchFinished && !sewingClosed && !m.wedding;
            if (m.signature !== signature) {
                m.signature = signature;
                m.routine = this.itinerary(m, tower, slot, sequence, sewingClosed);
                if (!m.wedding && !takingBreak) this.setPlan(m, m.routine);
            }
            if (takingBreak) {
                const at = this.stops.rest[this.campSlots.get(p.id)!];
                this.setPlan(m, [{ at, seconds: MOTION.sewingBreakSeconds, working: false, insideTower: false }, ...m.routine]);
            }
        }
        const valid = (w: Wedding) => families.has(w.family) && w.partners.every(id => present.has(id));
        if (this.wedding && (state.phase !== "DAY" || !valid(this.wedding))) this.endWedding();
        this.startWedding();
    }
    private placeWaitingResidents(people: readonly Person[]) {
        const waiting = people.filter(p => isWorkingAdult(p) && p.job === "WAITING");
        const claimed = new Set(waiting.map(p => p.id));
        const reserved = [...this.stops.sewing, ...this.stops.wedding];
        for (const p of people) if (!claimed.has(p.id)) {
            const slot = this.campSlots.get(p.id)!;
            reserved.push(this.stops.rest[slot]);
            if ((p.adult || p.growth > 0) && !isElder(p)) reserved.push(this.stops.homes[slot]);
        }
        const open = this.stops.waiting.map((at, i) => ({ at, i })).filter(({ at }) =>
            this.navigation.walkable(at) && reserved.every(point => distance(point, at) >= 17)).map(({ i }) => i);
        const old = this.waitingSlots, next = new Map<string, number>();
        for (const p of waiting) {
            const index = old.get(p.id);
            const slot = index === undefined ? -1 : open.indexOf(index);
            if (slot >= 0) next.set(p.id, open.splice(slot, 1)[0]);
        }
        for (const p of waiting) if (!next.has(p.id)) {
            const index = open.shift();
            if (index === undefined) throw new Error("村中待命站位不足");
            next.set(p.id, index);
        }
        this.waitingSlots = next;
    }
    /** 切换日程统一从当前足底寻路；已在目的地时直接开始驻足，避免跳过第一个停留点。 */
    private setPlan(m: MovingPerson, plan: Visit[]) {
        m.plan = plan; m.visit = 0;
        if (isElder(m.person)) { m.x = plan[0].at.x; m.y = plan[0].at.y; }
        const walking = distance(m, plan[0].at) > .01;
        m.route = walking ? this.navigation.route(m, plan[0].at) : [];
        m.remaining = walking ? 0 : plan[0].seconds; this.chooseAction(m, walking);
    }
    private startWedding() {
        if (this.wedding || !this.weddings.length) return;
        if (!this.weddings[0].partners.every(id => this.people.has(id))) return;
        const w = this.weddings.shift()!; this.wedding = w;
        w.partners.forEach((id, i) => {
            const m = this.people.get(id)!; m.wedding = true; m.heartElapsed = null;
            this.setPlan(m, [{ at: this.stops.wedding[i], seconds: Infinity, working: false, insideTower: false }]);
        });
    }
    private endWedding() {
        if (!this.wedding) return;
        for (const id of this.wedding.partners) {
            const m = this.people.get(id); if (!m) continue;
            m.wedding = false; m.heartElapsed = null;
            this.setPlan(m, m.routine);
        }
        this.wedding = null;
    }
    private itinerary(m: MovingPerson, tower: number, slot: number, sequence: number, sewingClosed: boolean): Visit[] {
        const p = m.person;
        const home = this.stops.homes[(sequence - 1) % this.stops.homes.length];
        const visit = (at: GroundPoint, seconds: number, working = false): Visit => ({ at, seconds, working, insideTower: false });
        const camp = (this.patrolNight ? this.stops.nightRest : this.stops.rest)[this.campSlots.get(p.id)!];
        if (isElder(p) || !p.adult && p.growth === 0) return [visit(camp, Infinity)];
        if (this.night) return [{ ...visit(tower >= 0 ? this.stops.towers[tower] : camp, Infinity), insideTower: tower >= 0 }];
        if (!p.adult) return [visit(this.stops.children[sequence - 1], MOTION.restSeconds), visit(home, MOTION.restSeconds)];
        if (p.job === "SEWING") {
            if (sewingClosed) return [visit(camp, Infinity)];
            if (slot < this.stops.sewing.length) return [visit(this.stops.sewing[slot], Infinity, true)];
            // 其余在岗者实际走进门后隐去，晨间仍能从驻守塔位逐段走回厂区。
            return [{ ...visit(this.stops.factoryDoor[0], Infinity), insideFactory: true }];
        }
        return [visit(this.stops.waiting[this.waitingSlots.get(p.id)!], Infinity)];
    }
    private chooseAction(m: MovingPerson, walking: boolean) {
        const p = m.person;
        const model = villagerModel(p);
        let clip = model === "baby" ? "villager_baby_idle" : model === "elder" ? "hd_elder_chair" : `villager_${model}_walk`;
        let animated = walking || model === "baby" || model === "elder";
        if (!walking && m.plan[m.visit].working) {
            m.direction = "DOWN"; clip = "sewing"; animated = true;
        }
        if (m.clip !== clip || m.animated !== animated) m.elapsed = 0;
        m.clip = clip; m.animated = animated; m.walking = walking;
        if (!walking && !this.night && !m.wedding && isWorkingAdult(p) && p.job === "WAITING")
            m.direction = "DOWN";
        // 夜间驻塔到达后视为进入塔内；仍保留位置与日程，调任/天亮会自然重新显示。
        m.insideTower = !walking && m.plan[m.visit].insideTower;
        m.insideFactory = !walking && m.plan[m.visit].insideFactory === true;
    }
    /** 调用者传实际视觉时间；暂停保持动作。婚礼结束返回true，要求重选下一组可见演员。 */
    update(delta: number): boolean {
        const dt = Math.min(RULE.frameCap * RULE.battleSpeed, Math.max(0, delta));
        if (!dt) return false;
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
                m.walkDistance += Math.min(d, travel);
                if (d > .01) m.direction = walkDirection(dx, dy, m.direction);
                if (d <= travel) { m.x = next.x; m.y = next.y; travel -= d; m.route.shift(); }
                else { m.x += dx / d * travel; m.y += (next.y - m.y) / d * travel; travel = 0; }
            }
            if (!m.route.length) { m.remaining = m.plan[m.visit].seconds; this.chooseAction(m, false); }
        }
        const w = this.wedding;
        if (w && w.partners.every(id => !this.people.get(id)!.walking)) {
            w.elapsed = w.elapsed === null ? 0 : w.elapsed + dt;
            if (w.elapsed >= WEDDING.heartSeconds) { this.endWedding(); this.startWedding(); return true; }
            else w.partners.forEach((id, i) => {
                const m = this.people.get(id)!; m.heartElapsed = w.elapsed; m.direction = i === 0 ? "RIGHT" : "LEFT";
            });
        }
        return false;
    }
}
