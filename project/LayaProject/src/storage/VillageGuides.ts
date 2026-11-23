import type { StoragePort } from "./SaveStore";
import { VillageItemStorage } from "./VillageItemStorage";

/** 独立引导进度，开村时随旧键一起清除。版本只描述引导记录，村庄双槽格式独立。 */
export const GUIDE_SAVE_KEY = "daidai_village.guides";
export const TACTIC_NOTICES_KEY = "daidai_village.tactic_notices";
const GUIDE_SAVE_VERSION = 1;
const LEGACY = { starter: "daidai_village.starter_guide", patrol: "daidai_village.patrol_intro_guide", slot: "daidai_village.tactic_slot_guide_dismissed" } as const;
export type GuideTrack = keyof typeof LEGACY | "backpack" | "shop" | "tacticChange" | "tacticAction" | "patrolLaunch";
interface GuideSave { version: number; villageId: string | null; progress: Partial<Record<GuideTrack, number>>; }

export function clearVillageGuides(port: StoragePort) {
    for (const key of [GUIDE_SAVE_KEY, ...Object.values(LEGACY), TACTIC_NOTICES_KEY]) {
        if (port.read(key) === null) continue;
        port.remove?.(key);
        if (port.read(key) !== null) throw new Error("旧村引导进度尚未清除，请重试");
    }
}

export class VillageGuides {
    constructor(private port: StoragePort, private owner: () => string | null) {}

    /** StarterGuide 仍读写单条轨迹数字，不接触导入和副档归属。 */
    track(name: GuideTrack): StoragePort {
        // 白天的巡防介绍只剩一条。读到旧版第 2 / 3 步仍视为看过，保留原始进度。
        return { read: () => String(name === "patrol" ? Math.min(this.get(name), 1) : this.get(name)),
            write: (_key, value) => this.mark(name, Number(value)) };
    }

    get(name: GuideTrack) { return this.read().progress[name] ?? 0; }

    mark(name: GuideTrack, step = 1) {
        if (!Number.isSafeInteger(step) || step < 1) throw new Error("引导进度无效");
        const save = this.read();
        if ((save.progress[name] ?? 0) >= step) return;
        save.progress[name] = step;
        this.port.write(GUIDE_SAVE_KEY, JSON.stringify(save));
    }

    private read(): GuideSave {
        const raw = this.port.read(GUIDE_SAVE_KEY), villageId = this.owner();
        if (raw !== null) {
            const save: GuideSave = JSON.parse(raw);
            if (save?.version !== GUIDE_SAVE_VERSION || save.villageId !== villageId || !save.progress ||
                typeof save.progress !== "object" || Array.isArray(save.progress) ||
                Object.values(save.progress).some(n => !Number.isSafeInteger(n) || n < 0)) throw new Error("无法读取引导进度，原记录已保留");
            return save;
        }
        const save: GuideSave = { version: GUIDE_SAVE_VERSION, villageId, progress: {} };
        for (const [track, key] of Object.entries(LEGACY) as [keyof typeof LEGACY, string][]) {
            const old = this.port.read(key);
            if (old !== null && /^\d+$/.test(old) && Number.isSafeInteger(Number(old))) save.progress[track] = Number(old);
        }
        const items = new VillageItemStorage(this.port, this.owner);
        for (const track of ["backpack", "shop"] as const) {
            try { if (items[track]().guideSeen) save.progress[track] = 1; }
            catch (error) { console.warn("[智卓引导] 无法导入旧功能查看记录", error); }
        }
        // 先保存新格式，再在重开时一并清理旧键。中途失败可再次从旧键导入。
        if (Object.keys(save.progress).length) this.port.write(GUIDE_SAVE_KEY, JSON.stringify(save));
        return save;
    }
}
