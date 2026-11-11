import { RULE } from "../game/GameConfig";
import { GameState, isElder, isWorkingAdult, Person } from "../game/GameState";

/** 轻量头顶表情：真实时间显示3秒，间隔18～30秒；全村最多一个，沿用原彩蛋节奏。
 * 生命周期优先级只用于表现，不能驱动退休、照料或业务随机数。 */
export const EMOTE = { seconds: 3, idleMin: 18, idleSpread: 12, initialWait: 8, size: 48 } as const;
type Moment = "retire" | "farewell" | "ordinary";
/** 用户要求用无文字表情代替台词；ID与资源配方对应，每组仍抽取一次表现随机数。 */
const EXPRESSIONS = {
    retire: ["emote_sleepy", "emote_peaceful"],
    farewell: ["emote_peaceful", "emote_loving"],
    elite: ["emote_proud", "emote_happy"],
    FARM: ["emote_happy", "emote_proud"],
    LOGGING: ["emote_proud", "emote_sleepy"],
    CARE: ["emote_loving", "emote_happy"],
    WAITING: ["emote_curious", "emote_peaceful"],
    child: ["emote_happy", "emote_curious"],
    elder: ["emote_peaceful", "emote_loving"]
} as const;

interface VillagerEmote { id: string; frameId: string; remaining: number; priority: boolean; moment: Moment; }
export class VillagerEmotes {
    current: VillagerEmote | null = null;
    private run = 0;
    private stages = new Map<string, Moment>();
    private pending: { id: string; moment: Moment }[] = [];
    private wait = EMOTE.initialWait as number;
    private random = 0x4c414d50;
    private stage(p: Person): Moment { return isElder(p) && p.elderNights === 1 ? "farewell" : isWorkingAdult(p) && p.nights <= RULE.retirementNoticeNights ? "retire" : "ordinary"; }
    sync(s: GameState) {
        const baseline = this.run !== s.run;
        if (baseline) { this.run = s.run; this.stages.clear(); this.pending = []; this.current = null; this.wait = EMOTE.initialWait; }
        const living = new Set(s.people.map(p => p.id));
        for (const id of this.stages.keys()) if (!living.has(id)) this.stages.delete(id);
        this.pending = this.pending.filter(q => living.has(q.id) && this.stage(s.people.find(p => p.id === q.id)!) === q.moment);
        if (this.current && (!living.has(this.current.id) || (this.current.priority && this.stage(s.people.find(p => p.id === this.current!.id)!) !== this.current.moment))) this.current = null;
        for (const p of s.people) {
            const stage = this.stage(p), old = this.stages.get(p.id);
            if (!baseline && old !== undefined && stage !== old && stage !== "ordinary") this.pending.push({ id: p.id, moment: stage });
            this.stages.set(p.id, stage);
        }
        this.pending.sort((a, b) => Number(b.moment === "farewell") - Number(a.moment === "farewell"));
    }
    private sample() { this.random = (Math.imul(this.random, 1664525) + 1013904223) >>> 0; return this.random / 0x100000000; }
    update(s: GameState, delta: number, visible: (id: string) => boolean) {
        if (delta <= 0) return;
        if (this.current) { this.current.remaining -= delta; if (this.current.remaining <= 0 || !visible(this.current.id)) this.current = null; }
        this.wait -= delta;
        if (this.current) return;
        const index = this.pending.findIndex(q => visible(q.id));
        const event = index < 0 ? null : this.pending.splice(index, 1)[0];
        if (!event && this.wait > 0) return;
        const candidates = s.people.filter(p => (p.adult || p.growth > 0) && visible(p.id));
        if (!candidates.length) return;
        const p = event ? s.people.find(p => p.id === event.id)! : candidates[Math.floor(this.sample() * candidates.length)];
        const frames = event ? EXPRESSIONS[event.moment as "retire" | "farewell"] : isElder(p) ? EXPRESSIONS.elder : !p.adult ? EXPRESSIONS.child : p.elite ? EXPRESSIONS.elite : EXPRESSIONS[p.job];
        this.current = { id: p.id, frameId: frames[Math.floor(this.sample() * frames.length)], remaining: EMOTE.seconds, priority: !!event, moment: event ? event.moment : "ordinary" };
        this.wait = EMOTE.idleMin + this.sample() * EMOTE.idleSpread;
    }
}
