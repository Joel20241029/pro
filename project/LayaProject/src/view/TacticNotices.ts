import { TACTICS } from "../config/TacticConfig";
import { GameState } from "../game/GameState";
import { StoragePort } from "../storage/SaveStore";

/** 单独保存该局的查看状态，界面记录失败不会拦住战技列表或村庄存档。 */
const KEY = "daidai_village.tactic_notices";
type Notices = { run: number; completed: number; unread: string[] };

export class TacticNotices {
    private loaded = false;
    private current: Notices | null = null;
    constructor(private port: StoragePort) {}
    get unread() { return !!this.current?.unread.length; }
    observe(s: GameState, newVillage: boolean) {
        if (!this.loaded) {
            this.loaded = true;
            try {
                const raw = this.port.read(KEY);
                if (raw !== null) {
                    const stored: Notices = JSON.parse(raw);
                    if (stored && Number.isSafeInteger(stored.run) && stored.run > 0 &&
                        Number.isSafeInteger(stored.completed) && stored.completed >= 0 && Array.isArray(stored.unread))
                        this.current = stored;
                }
            } catch (e) { console.warn("[战技提示] 无法读取查看记录", e); }
        }
        const previous = this.current, sameRun = !!previous && previous.run === s.run && !newVillage;
        const unread = sameRun ? TACTICS.filter(t => t.unlockWaves > 0 && t.unlockWaves <= s.completed &&
            (previous.unread.includes(t.id) || (t.unlockWaves > previous.completed && !s.tactics.learned.includes(t.id)))).map(t => t.id) : [];
        this.current = { run: s.run, completed: s.completed, unread };
        if (!sameRun || previous.completed > s.completed || previous.unread.join("|") !== unread.join("|"))
            this.save();
    }
    markSeen() {
        if (!this.current?.unread.length) return;
        this.current.unread = [];
        this.save();
    }
    private save() {
        try { this.port.write(KEY, JSON.stringify(this.current)); }
        catch (e) { console.warn("[战技提示] 无法保存查看记录", e); }
    }
}
