import { RULE } from "../game/GameConfig";
import { GameState, isElder, isWorkingAdult, Person } from "../game/GameState";

import { SPEECH, VILLAGER_LINES } from "./config/VillagerSpeechConfig";

type Moment = "retire" | "farewell" | "ordinary";
export interface VillagerThought { id: string; text: string; remaining: number; priority: boolean; moment: Moment; }
export class VillagerThoughts {
    current: VillagerThought | null = null;
    private run = 0;
    private stages = new Map<string, Moment>();
    private pending: { id: string; moment: Moment }[] = [];
    private wait = SPEECH.initialWait as number;
    private random = 0x4c414d50;
    private stage(p: Person): Moment { return isElder(p) && p.elderNights === 1 ? "farewell" : isWorkingAdult(p) && p.nights <= RULE.retirementNoticeNights ? "retire" : "ordinary"; }
    sync(s: GameState) {
        const baseline = this.run !== s.run;
        if (baseline) { this.run = s.run; this.stages.clear(); this.pending = []; this.current = null; this.wait = SPEECH.initialWait; }
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
        if (this.current || this.wait > 0) return;
        const index = this.pending.findIndex(q => visible(q.id));
        const event = index < 0 ? null : this.pending.splice(index, 1)[0];
        const candidates = s.people.filter(p => (p.adult || p.growth > 0) && visible(p.id));
        if (!candidates.length) return;
        const p = event ? s.people.find(p => p.id === event.id)! : candidates[Math.floor(this.sample() * candidates.length)];
        const lines = event ? VILLAGER_LINES[event.moment as "retire" | "farewell"] : isElder(p) ? VILLAGER_LINES.elder : !p.adult ? VILLAGER_LINES.child : p.elite ? VILLAGER_LINES.elite : VILLAGER_LINES[p.job];
        this.current = { id: p.id, text: lines[Math.floor(this.sample() * lines.length)], remaining: SPEECH.seconds, priority: !!event, moment: event ? event.moment : "ordinary" };
        this.wait = SPEECH.idleMin + this.sample() * SPEECH.idleSpread;
    }
}
