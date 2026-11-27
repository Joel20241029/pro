import { CONFIG_VERSION } from "../game/GameConfig";
import { GameState, nightReturnPoint } from "../game/GameState";
import { LEGACY_COIN_CONFIG_VERSION, migrateLegacyCoinSave, restoreLegacyNight } from "./LegacyCoinSave";
import { validateState } from "./StateValidation";
import { BackpackChange, clearVillageItemSaves, validBackpackChange, VillageItemStorage } from "./VillageItemStorage";
import { clearVillageGuides } from "./VillageGuides";
/** 微信实现将读异常向外抛出；null 只能表示 keys 列表确认键不存在。 */
export interface StoragePort { read(key: string): string | null; write(key: string, value: string): void; remove?(key: string): void; }
const KEYS = ["daidai_village.save.a", "daidai_village.save.b"];
// 第五版引入村级弹药等级、移除照料岗位。旧封套进入已有的确认重开流程。
const SCHEMA_VERSION = 5;
/** 普通进度轮换单槽；纯净开局的标记让启动时可补齐同一份双槽候选。 */
type CommitType = "NORMAL" | "CLEAN_START";
/** RESET 是异版/坏档的显式覆盖流程，仍拒绝跨异版槽自动续写。 */
export type SaveMode = CommitType | "RESET";
interface Envelope { schemaVersion: number; configVersion: number; revision: number; commitId: string; commitType: CommitType; villageId?: string; backpackChange?: BackpackChange; payload: unknown; checksum: string; }
export function canonical(v: unknown): string {
    if (v === null) return "null";
    if (typeof v === "number") { if (!Number.isSafeInteger(v) || Object.is(v, -0)) throw new Error("存档数值超出安全范围"); return String(v); }
    if (typeof v === "string" || typeof v === "boolean") return JSON.stringify(v);
    if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
    if (typeof v === "object") return "{" + Object.keys(v!).sort().map(k => JSON.stringify(k) + ":" + canonical((v as Record<string, unknown>)[k])).join(",") + "}";
    throw new Error("存档含有不支持的字段类型");
}
export function crc32(value: string): string {
    const utf8 = unescape(encodeURIComponent(value)); let crc = 0xffffffff;
    for (let i = 0; i < utf8.length; i++) { crc ^= utf8.charCodeAt(i); for (let b = 0; b < 8; b++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
    return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0");
}
type ValidSlot = { kind: "valid"; data: Envelope; state: GameState };
type Slot = { kind: "missing" } | ValidSlot | { kind: "corrupt" | "version" };
function decode(raw: string | null): Slot {
    if (raw === null) return { kind: "missing" };
    try {
        const e: Envelope = JSON.parse(raw);
        if (!e || !Number.isSafeInteger(e.schemaVersion) || !Number.isSafeInteger(e.configVersion)) return { kind: "corrupt" };
        if (e.schemaVersion !== SCHEMA_VERSION || e.configVersion !== CONFIG_VERSION && e.configVersion !== LEGACY_COIN_CONFIG_VERSION) return { kind: "version" };
        if (e.commitType !== "NORMAL" && e.commitType !== "CLEAN_START") return { kind: "corrupt" };
        if (e.backpackChange !== undefined && (e.commitType !== "NORMAL" || !validBackpackChange(e.backpackChange))) return { kind: "corrupt" };
        if (e.villageId !== undefined && (typeof e.villageId !== "string" || !e.villageId.length)) return { kind: "corrupt" };
        const { checksum, ...body } = e;
        if (typeof checksum !== "string" || crc32(canonical(body)) !== checksum || !Number.isSafeInteger(e.revision) || e.revision < 1 || typeof e.commitId !== "string" || !e.commitId.length) return { kind: "corrupt" };
        // 只转换 v22 的运行态。原封套参与槽位比较和道具事务补写，当前版本不会重复兑换。
        const legacy = e.configVersion === LEGACY_COIN_CONFIG_VERSION;
        const state = legacy ? migrateLegacyCoinSave(e.payload) : e.payload as GameState;
        validateState(state, legacy);
        return { kind: "valid", data: e, state };
    } catch { return { kind: "corrupt" }; }
}
/** 补写结果对应已重建的 pending，双槽核对成功前不发布其状态。 */
export type LoadResult = { kind: "new" | "complete-clean-start" | "complete-backpack-change" } | { kind: "ready" | "recover"; state: GameState } | { kind: "incompatible"; reason: string } | { kind: "blocked"; reason: string; canReset: boolean };
interface Pending { raw: string; state: GameState; revision: number; target: number; baseline: (string | null)[]; mode: SaveMode; villageId: string | null; opening: boolean; backpack?: { change: BackpackChange; operation: string }; }
export class SaveStore {
    private baseline: (string | null)[] = []; private revision = 0; private active = -1;
    private owner: string | null = null;
    get villageId() { return this.owner; }
    pending: Pending | null = null;
    constructor(readonly port: StoragePort) {}
    inspect(): LoadResult {
        this.baseline = KEYS.map(k => this.port.read(k));
        const slots = this.baseline.map(decode);
        if (slots.some(s => s.kind === "version")) return { kind: "incompatible", reason: "旧进度来自其他版本，当前版本无法读取。\n确认前保留旧进度，重开后替换旧进度。" };
        const valid = slots.map((s, i) => ({ s, i })).filter(v => v.s.kind === "valid") as { s: ValidSlot; i: number }[];
        if (!valid.length) {
            if (slots.every(s => s.kind === "missing")) { this.revision = 0; this.active = -1; this.owner = null; return { kind: "new" }; }
            return { kind: "blocked", reason: "无法读取有效进度。可保留存档退出，或明确确认重新开村。", canReset: true };
        }
        valid.sort((a, b) => b.s.data.revision - a.s.data.revision);
        if (valid.length === 2 && valid[0].s.data.revision === valid[1].s.data.revision && this.baseline[0] !== this.baseline[1]) return { kind: "blocked", reason: "两个存档版本冲突，未覆盖任何进度。", canReset: false };
        const { i, s: { data, state } } = valid[0]; this.revision = data.revision; this.active = i;
        this.owner = data.villageId ?? null;
        const previous = valid[1]?.s;
        // 旧夜只有另一槽明确是同村、同一天的上一笔白天进度时，才能补齐精确的回退点。
        const sameDay = data.villageId !== undefined && previous?.data.villageId === data.villageId && previous.data.configVersion === data.configVersion &&
            previous.data.revision === data.revision - 1 && previous.state.phase === "DAY" &&
            previous.state.run === state.run && previous.state.day === state.day;
        const back = state.night && (state.night.returnPoint ?? (sameDay ? nightReturnPoint(previous.state) : undefined));
        const restored = data.configVersion === LEGACY_COIN_CONFIG_VERSION ? restoreLegacyNight(state, back) : state;
        if (restored !== state) validateState(restored);
        if (data.backpackChange && !new VillageItemStorage(this.port, () => this.owner).applied(data.commitId)) {
            this.pending = { raw: this.baseline[i]!, state: restored, revision: data.revision, target: i, baseline: this.baseline.slice(),
                mode: "NORMAL", villageId: this.owner, opening: false, backpack: { change: data.backpackChange, operation: data.commitId } };
            return { kind: "complete-backpack-change" };
        }
        if (data.commitType === "CLEAN_START" && this.baseline[0] !== this.baseline[1]) {
            // 异版与同 revision 冲突已拒绝。保留原始候选字节，只补低 revision、空槽或坏槽。
            this.pending = { raw: this.baseline[i]!, state: restored, revision: data.revision, target: i, baseline: this.baseline.slice(),
                mode: "CLEAN_START", villageId: this.owner, opening: this.owner !== null };
            return { kind: "complete-clean-start" };
        }
        return { kind: slots.some(s => s.kind === "corrupt") ? "recover" : "ready", state: restored };
    }
    /** RESET 仅由玩家确认放弃异版或损坏进度后传入；同一候选替换双槽，不做旧档迁移。 */
    prepare(state: GameState, mode: SaveMode = "NORMAL", opening = mode !== "NORMAL", backpackChange?: BackpackChange) {
        if (this.pending) throw new Error("请先核对待保存的进度");
        validateState(state);
        if (backpackChange && (mode !== "NORMAL" || opening || !validBackpackChange(backpackChange))) throw new Error("无效的背包操作");
        const revision = mode === "RESET" ? 1 : this.revision + 1;
        if (!Number.isSafeInteger(revision)) throw new Error("存档版本已达安全范围");
        // run 会从 1 重新开始。独立身份一次生成并跟随存档候选，重试不会改变它。
        const villageId = opening ? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}` : this.owner;
        const commitId = `${state.run}:${revision}:${crc32(canonical(state))}`;
        const body = { schemaVersion: SCHEMA_VERSION, configVersion: CONFIG_VERSION, revision, commitId,
            commitType: mode === "NORMAL" ? "NORMAL" : "CLEAN_START", ...(villageId === null ? {} : { villageId }),
            ...(backpackChange ? { backpackChange } : {}), payload: state };
        // 混合版本先替换当前/损坏/空槽，异版槽最后写；中途退出仍会提示确认，不会复活旧村。
        const target = mode === "RESET" ? (decode(this.baseline[0]).kind === "version" && decode(this.baseline[1]).kind !== "version" ? 1 : 0) : this.active === 0 ? 1 : 0;
        this.pending = { raw: canonical({ ...body, checksum: crc32(canonical(body)) }), state, revision, target, baseline: this.baseline.slice(), mode, villageId, opening,
            ...(backpackChange ? { backpack: { change: backpackChange, operation: commitId } } : {}) };
    }
    commit(): GameState {
        const p = this.pending; if (!p) throw new Error("没有待保存的进度");
        const current = KEYS.map(k => this.port.read(k)), other = 1 - p.target;
        if (p.mode !== "NORMAL") {
            if (current.some((raw, i) => {
                if (raw === p.baseline[i] || raw === p.raw) return false;
                if (p.mode === "RESET") return true;
                // 纯净开局重试可替换失败写入留下的空槽或坏槽，拒绝异版或新出现的有效记录。
                const slot = decode(raw);
                return slot.kind !== "missing" && slot.kind !== "corrupt";
            })) throw new Error("存档在确认重开后发生变化，请重新进入核对，未继续覆盖");
            if (current[p.target] !== p.raw) {
                this.port.write(KEYS[p.target], p.raw);
            }
            // 校验首槽后清副档，最后写另一槽。退出后 CLEAN_START 可继续清理并补槽。
            if (this.port.read(KEYS[p.target]) !== p.raw || this.port.read(KEYS[other]) !== current[other])
                throw new Error("保存尚未核对完成，请重试核对");
            if (p.opening) {
                clearVillageItemSaves(this.port);
                clearVillageGuides(this.port);
            }
            if (current[other] !== p.raw) this.port.write(KEYS[other], p.raw);
        } else if (p.backpack) {
            if (current.some((raw, i) => raw !== p.baseline[i] && raw !== p.raw &&
                decode(raw).kind !== "missing" && decode(raw).kind !== "corrupt")) throw new Error("道具保存期间存档发生变化，请重新进入核对");
            for (const i of [p.target, other]) {
                if (current[i] !== p.raw) this.port.write(KEYS[i], p.raw);
                if (this.port.read(KEYS[i]) !== p.raw) throw new Error("保存尚未核对完成，请重试核对");
            }
            new VillageItemStorage(this.port, () => p.villageId).applyChange(p.backpack.change, p.backpack.operation);
        } else {
            if (current[other] !== p.baseline[other]) throw new Error("存档在保存期间发生变化，请保留现场并重进核对");
            if (current[p.target] !== p.raw) {
                const target = decode(current[p.target]);
                if (current[p.target] !== p.baseline[p.target] && target.kind !== "missing" && target.kind !== "corrupt") throw new Error("目标存档存在另一份有效进度，停止覆盖");
                // 两槽都为空的首次开村，也要先清可能残留的独立数据。
                if (p.opening) {
                    clearVillageItemSaves(this.port);
                    clearVillageGuides(this.port);
                }
                this.port.write(KEYS[p.target], p.raw);
            }
        }
        const confirmed = KEYS.map(k => this.port.read(k));
        if (confirmed[p.target] !== p.raw || confirmed[other] !== (p.mode === "NORMAL" && !p.backpack ? p.baseline[other] : p.raw)) throw new Error("保存尚未核对完成，请重试核对");
        this.baseline = confirmed; this.revision = p.revision; this.active = p.target; this.owner = p.villageId; this.pending = null; return p.state;
    }
}
