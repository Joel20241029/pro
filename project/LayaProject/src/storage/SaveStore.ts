import { CONFIG_VERSION } from "../game/GameConfig";
import { GameState } from "../game/GameState";
import { validateState } from "./StateValidation";
/** 微信实现将读异常向外抛出；null 只能表示 keys 列表确认键不存在。 */
export interface StoragePort { read(key: string): string | null; write(key: string, value: string): void; }
const KEYS = ["daidai_village.save.a", "daidai_village.save.b"];
const SCHEMA_VERSION = 1;
interface Envelope { schemaVersion: number; configVersion: number; revision: number; commitId: string; payload: GameState; checksum: string; }
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
type Slot = { kind: "missing" } | { kind: "valid"; data: Envelope } | { kind: "corrupt" | "version" };
function decode(raw: string | null): Slot {
    if (raw === null) return { kind: "missing" };
    try {
        const e: Envelope = JSON.parse(raw);
        if (!e || !Number.isSafeInteger(e.schemaVersion) || !Number.isSafeInteger(e.configVersion)) return { kind: "corrupt" };
        if (e.schemaVersion !== SCHEMA_VERSION || e.configVersion !== CONFIG_VERSION) return { kind: "version" };
        const { checksum, ...body } = e;
        if (typeof checksum !== "string" || crc32(canonical(body)) !== checksum || !Number.isSafeInteger(e.revision) || e.revision < 1 || typeof e.commitId !== "string" || !e.commitId.length) return { kind: "corrupt" };
        validateState(e.payload); return { kind: "valid", data: e };
    } catch { return { kind: "corrupt" }; }
}
export type LoadResult = { kind: "new" } | { kind: "ready" | "recover"; state: GameState } | { kind: "blocked"; reason: string; canReset: boolean };
interface Pending { raw: string; state: GameState; revision: number; target: number; baseline: (string | null)[]; }
export class SaveStore {
    private baseline: (string | null)[] = []; private revision = 0; private active = -1;
    pending: Pending | null = null;
    constructor(private port: StoragePort) {}
    inspect(): LoadResult {
        this.baseline = KEYS.map(k => this.port.read(k));
        const slots = this.baseline.map(decode);
        if (slots.some(s => s.kind === "version")) return { kind: "blocked", reason: "存档属于其他版本，请使用对应版本。原存档已保留。", canReset: false };
        const valid = slots.map((s, i) => ({ s, i })).filter(v => v.s.kind === "valid") as { s: { kind: "valid"; data: Envelope }; i: number }[];
        if (!valid.length) {
            if (slots.every(s => s.kind === "missing")) { this.revision = 0; this.active = -1; return { kind: "new" }; }
            return { kind: "blocked", reason: "无法读取有效进度。可保留存档退出，或明确确认重新开村。", canReset: true };
        }
        valid.sort((a, b) => b.s.data.revision - a.s.data.revision);
        if (valid.length === 2 && valid[0].s.data.revision === valid[1].s.data.revision && this.baseline[0] !== this.baseline[1]) return { kind: "blocked", reason: "两个存档版本冲突，未覆盖任何进度。", canReset: false };
        const best = valid[0]; this.revision = best.s.data.revision; this.active = best.i;
        return { kind: slots.some(s => s.kind === "corrupt") ? "recover" : "ready", state: best.s.data.payload };
    }
    /** 只有用户明确确认损坏档重开后调用；第一个新提交仍只覆盖一个槽。 */
    allowReset() { this.revision = 0; this.active = -1; }
    prepare(state: GameState) {
        if (this.pending) throw new Error("请先核对待保存的进度");
        validateState(state);
        const revision = this.revision + 1;
        if (!Number.isSafeInteger(revision)) throw new Error("存档版本已达安全范围");
        const body = { schemaVersion: SCHEMA_VERSION, configVersion: CONFIG_VERSION, revision, commitId: `${state.run}:${revision}:${crc32(canonical(state))}`, payload: state };
        this.pending = { raw: canonical({ ...body, checksum: crc32(canonical(body)) }), state, revision, target: this.active === 0 ? 1 : 0, baseline: this.baseline.slice() };
    }
    commit(): GameState {
        const p = this.pending; if (!p) throw new Error("没有待保存的进度");
        const current = KEYS.map(k => this.port.read(k)), other = 1 - p.target;
        if (current[other] !== p.baseline[other]) throw new Error("存档在保存期间发生变化，请保留现场并重进核对");
        if (current[p.target] !== p.raw) {
            const target = decode(current[p.target]);
            if (current[p.target] !== p.baseline[p.target] && target.kind !== "missing" && target.kind !== "corrupt") throw new Error("目标存档存在另一份有效进度，停止覆盖");
            this.port.write(KEYS[p.target], p.raw);
        }
        const confirmed = KEYS.map(k => this.port.read(k));
        if (confirmed[p.target] !== p.raw || confirmed[other] !== p.baseline[other]) throw new Error("保存尚未核对完成，请重试核对");
        this.baseline = confirmed; this.revision = p.revision; this.active = p.target; this.pending = null; return p.state;
    }
}
