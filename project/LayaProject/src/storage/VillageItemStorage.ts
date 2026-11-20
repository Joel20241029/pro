import type { StoragePort } from "./SaveStore";

/** 各功能只写自己的键。版本仅描述本功能数据，与村庄封套版本无关。 */
export const VILLAGE_ITEM_KEYS = { backpack: "daidai_village.backpack", shop: "daidai_village.shop" } as const;
const ITEM_SAVE_VERSION = 1;

export type ItemFeature = keyof typeof VILLAGE_ITEM_KEYS;
interface FeatureSave { version: number; villageId: string | null; guideSeen: boolean; }
interface BackpackSave extends FeatureSave { items: Record<string, number>; lastAppliedOperation?: string; }
/** A/B 封套记录库存前值和改变量。背包一次写入库存与操作号，断电后可安全重复执行。 */
export interface BackpackChange { id: string; delta: 1 | -1; before: number; }
export function validBackpackChange(change: BackpackChange) {
    return change && typeof change.id === "string" && /^[a-z][a-z0-9_]*$/.test(change.id) &&
        (change.delta === 1 || change.delta === -1) && Number.isSafeInteger(change.before) && change.before >= 0 &&
        change.before + change.delta >= 0 && Number.isSafeInteger(change.before + change.delta);
}

function validItems(items: unknown): items is Record<string, number> {
    return !!items && typeof items === "object" && !Array.isArray(items) &&
        Object.entries(items).every(([id, count]) => /^[a-z][a-z0-9_]*$/.test(id) && typeof count === "number" && Number.isSafeInteger(count) && count > 0);
}

/** 首份新村档确认后执行。读回时键仍存在就停在原保存候选内重试。 */
export function clearVillageItemSaves(port: StoragePort) {
    for (const key of Object.values(VILLAGE_ITEM_KEYS)) {
        port.remove?.(key);
        if (port.read(key) !== null) throw new Error("背包或商城的旧存档尚未清除，请重试");
    }
}

export class VillageItemStorage {
    constructor(private port: StoragePort, private owner: () => string | null) { }

    backpack() { return this.read("backpack"); }
    shop() { return this.read("shop"); }

    /** 库存写回只改背包，保留已有的引导状态。 */
    saveItems(items: Record<string, number>) {
        if (!validItems(items)) throw new Error("背包库存无效");
        this.port.write(VILLAGE_ITEM_KEYS.backpack, JSON.stringify({ ...this.backpack(), items }));
    }

    applied(operation: string) { return this.backpack().lastAppliedOperation === operation; }

    applyChange(change: BackpackChange, operation: string) {
        const current = this.backpack();
        if (current.lastAppliedOperation === operation) return;
        if ((current.items[change.id] ?? 0) !== change.before) throw new Error("背包库存已变化，请重试核对");
        const items = { ...current.items }, count = change.before + change.delta;
        if (count === 0) delete items[change.id];
        else items[change.id] = count;
        this.port.write(VILLAGE_ITEM_KEYS.backpack, JSON.stringify({ ...current, items, lastAppliedOperation: operation }));
        if (!this.applied(operation)) throw new Error("背包保存尚未核对完成，请重试");
    }

    private read(feature: "backpack"): BackpackSave;
    private read(feature: "shop"): FeatureSave;
    private read(feature: ItemFeature): FeatureSave | BackpackSave;
    private read(feature: ItemFeature): FeatureSave | BackpackSave {
        const key = VILLAGE_ITEM_KEYS[feature], villageId = this.owner();
        const raw = this.port.read(key);
        // 旧村没有这两个键，首次打开读取空内容；尚未交互时也无需写入空档。
        const empty: FeatureSave = { version: ITEM_SAVE_VERSION, villageId, guideSeen: false };
        if (raw === null) return feature === "backpack" ? { ...empty, items: {} } : empty;
        const save: BackpackSave = JSON.parse(raw);
        if (!save || save.version !== ITEM_SAVE_VERSION || save.villageId !== villageId ||
            typeof save.guideSeen !== "boolean" || feature === "backpack" && (!validItems(save.items) ||
                save.lastAppliedOperation !== undefined && (typeof save.lastAppliedOperation !== "string" || !save.lastAppliedOperation)))
            throw new Error("背包或商城存档无法读取，原数据已保留");
        return save;
    }
}
