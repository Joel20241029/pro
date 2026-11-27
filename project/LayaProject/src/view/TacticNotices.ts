import { TACTICS } from "../config/TacticConfig";
import { GameState } from "../game/GameState";
import { StoragePort } from "../storage/SaveStore";
import { TACTIC_NOTICES_KEY } from "../storage/VillageGuides";

/** 单独保存该局的查看状态，界面记录失败不会拦住战技列表或村庄存档。 */
type Notices = { villageId?: string | null; run: number; completed: number; unread: string[] };

export class TacticNotices {
    private loaded = false;
    private current: Notices | null = null;
    constructor(private port: StoragePort, private owner = (): string | null => null) {}
    get unread() { return !!this.current?.unread.length; }
    hasUnread(id: string) { return this.current?.unread.includes(id) === true; }
    observe(s: GameState, newVillage: boolean) {
        if (!this.loaded) {
            this.loaded = true;
            try {
                const raw = this.port.read(TACTIC_NOTICES_KEY);
                if (raw !== null) {
                    const stored: Notices = JSON.parse(raw);
                    if (stored && Number.isSafeInteger(stored.run) && stored.run > 0 &&
                        Number.isSafeInteger(stored.completed) && stored.completed >= 0 && Array.isArray(stored.unread) &&
                        (stored.villageId === undefined || stored.villageId === this.owner()))
                        this.current = stored;
                }
            } catch (e) { console.warn("[战技提示] 无法读取查看记录", e); }
        }
        const villageId = this.owner(), previous = this.current;
        const sameRun = !!previous && previous.run === s.run && !newVillage && (previous.villageId === undefined || previous.villageId === villageId);
        const unread = sameRun ? TACTICS.filter(t => t.unlockWaves > 0 && t.unlockWaves <= s.completed &&
            (previous.unread.includes(t.id) || (t.unlockWaves > previous.completed && !s.tactics.learned.includes(t.id)))).map(t => t.id) : [];
        this.current = { villageId, run: s.run, completed: s.completed, unread };
        if (!sameRun || previous.villageId !== villageId || previous.completed !== s.completed || previous.unread.join("|") !== unread.join("|"))
            this.save();
    }
    markSeen(id: string) {
        if (!this.current?.unread.includes(id)) return;
        this.current.unread = this.current.unread.filter(tactic => tactic !== id);
        this.save();
    }
    private save() {
        try { this.port.write(TACTIC_NOTICES_KEY, JSON.stringify(this.current)); }
        catch (e) { console.warn("[战技提示] 无法保存查看记录", e); }
    }
}
