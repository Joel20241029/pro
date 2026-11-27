import { RELEASE } from "../config/ReleaseInfo";
import { RANKING_CANVAS } from "../config/RankingConfig";
import { RankingCanvasUnsupported, type RankingCanvasFailure } from "./WechatRankingCanvas";

type LogLevel = "info" | "warn" | "error";
interface GameLogger { log(options: { level: LogLevel; key: string; value: object; success(): void; fail(): void }): void; }
/** 主域官方游戏日志接口（基础库 >=3.7.4）；开放域不调用日志 API，也不把好友数据传回主域。 */
export interface RankingLogPlatform {
    getGameLogManager?(options: { commonInfo: object; fail(): void }): GameLogger;
    getAccountInfoSync?(): { miniProgram: { envVersion: string; version?: string } };
    getAppBaseInfo?(): { version: string; SDKVersion: string };
    getDeviceInfo?(): { platform: string };
    onError?(listener: (error: string) => void): void;
    offError?(listener: (error: string) => void): void;
}
type RankingEvent = "open" | "construct_start" | "native_canvas_ready" | "native_show" | "native_hide" | "attached" | "refresh_start" |
    "privacy_snapshot" | "friend_snapshot" | "render_sample" | "diagnostic_probe_error" |
    "constructed" | "viewport" | "message_returned" | "message_error" |
    "privacy_start" | "privacy_result" | "friend_start" | "friend_result" | "authorization_stale" |
    "view_error" | "runtime_error" | "close";
interface Fields {
    x?: number; y?: number; width?: number; height?: number; category?: string; code?: number; frames?: string[]; errorName?: string;
    nativeCanvasFailure?: RankingCanvasFailure;
    styleRetainedAfterAdapter?: boolean;
    result?: "ok" | "failed" | "unsupported"; needAuthorization?: boolean; contractPresent?: boolean; friendState?: "granted" | "denied" | "unset";
    canvasPresent?: boolean; canvasWidth?: number; canvasHeight?: number;
    styleWidth?: string; styleHeight?: string; styleLeft?: string; styleTop?: string; visible?: boolean; onStage?: boolean;
    message?: "viewport" | "show" | "refresh" | "authorization" | "close" | "score";
}
/** 每次启动最多240条（低于微信999条上限），同一面板同类错误只记一次；不逐帧上报。 */
const EVENT_BUDGET = 240;
/** 错误只记录固定分类和数值错误码。禁止发送原始错误全文、任意对象、昵称、头像URL、openid或云成绩。 */
function errorFields(error: unknown) {
    const e = error as { name?: unknown; message?: unknown; errMsg?: unknown; errCode?: unknown; errno?: unknown; stack?: unknown };
    const message = typeof error === "string" ? error : typeof e?.message === "string" ? e.message : typeof e?.errMsg === "string" ? e.errMsg : "";
    const category = /texStorage2D|immutable/i.test(message) ? "immutable_texture" : /texSubImage2D/i.test(message) ? "subimage_upload" :
        /privacy|announce your privacy/i.test(message) ? "privacy" : /auth|permission|deny/i.test(message) ? "authorization" :
        /security|taint|cross.origin|not allowed.*canvas/i.test(message) ? "canvas_security" : /not a function|not defined/i.test(message) ? "missing_api" :
        /cannot read|undefined|null/i.test(message) ? "null_reference" : "unclassified";
    const code = typeof e?.errCode === "number" ? e.errCode : typeof e?.errno === "number" ? e.errno : undefined;
    const stack = typeof e?.stack === "string" ? e.stack : message;
    // 只保留已知发布文件名和行列号，不发送错误正文或调用栈中的URL、参数和用户数据。
    const frames = (stack.match(/(?:bundle|laya\.core|laya\.webgl_2D|laya\.adapter-weixin|game|index|engine|render|score-store|WAGame)\.js:\d+:\d+/g) || []).slice(0, 3);
    const errorName = ["Error", "TypeError", "ReferenceError", "RangeError", "SecurityError"].find(name => e?.name === name);
    return { category, code: Number.isFinite(code) ? code : undefined, frames, errorName };
}
export class RankingDiagnostics {
    private logger: GameLogger | null = null;
    private count = 0;
    private sequence = 0;
    private openedAt = 0;
    private active: string | null = null;
    private errors = new Set<string>();
    private deliveryWarning = false;
    private deliveryConfirmed = false;
    private environment = "unavailable";
    get accountEnvironment() { return this.environment; }
    private readonly runtimeError = (error: string) => { if (this.active) this.failure("runtime_error", this.active, error); };
    constructor(private platform: RankingLogPlatform) {
        const common: Record<string, string> = { version: RELEASE.version, build: RELEASE.build, render: RANKING_CANVAS.mode, env: "unavailable" };
        // 环境采样只作诊断，失败不阻止独立初始化日志；仅提取版本和平台，不传整份设备/账户对象。
        try {
            const app = platform.getAccountInfoSync?.().miniProgram;
            if (app && ["release", "trial", "develop"].includes(app.envVersion)) common.env = this.environment = app.envVersion;
            if (app?.version && /^[\w.-]{1,40}$/.test(app.version)) common.codeVersion = app.version;
            const base = platform.getAppBaseInfo?.();
            if (base?.version && /^[\w.-]{1,40}$/.test(base.version)) common.wechatVersion = base.version;
            if (base?.SDKVersion && /^[\w.-]{1,40}$/.test(base.SDKVersion)) common.sdkVersion = base.SDKVersion;
            const os = platform.getDeviceInfo?.().platform;
            if (os && ["ios", "android", "ohos", "windows", "mac", "devtools"].includes(os)) common.platform = os;
        } catch (_) { this.warnDelivery(); }
        try {
            this.logger = platform.getGameLogManager?.({ commonInfo: common, fail: () => this.warnDelivery() }) || null;
        } catch (_) { this.warnDelivery(); }
        try { platform.onError?.(this.runtimeError); } catch (_) { this.warnDelivery(); }
    }
    begin(): string {
        const id = `${Date.now().toString(36)}-${++this.sequence}`;
        this.openedAt = Date.now();
        this.active = id;
        this.record("open", id);
        return id;
    }
    record(event: RankingEvent, request: string | null, fields: Fields = {}, level: LogLevel = "info") {
        if (this.count >= EVENT_BUDGET) return;
        this.count++;
        const time = Date.now();
        const value = { event, request, sequence: this.count, time, version: RELEASE.version, build: RELEASE.build, env: this.environment,
            elapsedMs: request && request === this.active ? time - this.openedAt : undefined, ...fields };
        try { console.info("[ranking-diagnostic]", RELEASE.build, value); } catch (_) { /* 本地输出与后台上报隔离。 */ }
        try {
            if (this.logger) this.logger.log({ key: "ranking", level, value, success: () => {
                if (this.deliveryConfirmed) return;
                this.deliveryConfirmed = true;
                try { console.info("[ranking-diagnostic] 微信日志接口已接受首条上报", RELEASE.build); } catch (_) { /* 不影响游戏及异步回调。 */ }
            }, fail: () => this.warnDelivery() });
        } catch (_) { this.warnDelivery(); }
    }
    failure(event: RankingEvent, request: string | null, error: unknown) {
        // 日志处理本身也可能遇到代理对象/异常getter；任何诊断失败都不能替换原异常或中断游戏。
        try {
            const key = `${request}:${event}`;
            if (this.errors.has(key) || this.count >= EVENT_BUDGET) return;
            this.errors.add(key);
            const fields: Fields = errorFields(error);
            if (error instanceof RankingCanvasUnsupported) fields.nativeCanvasFailure = error.reason;
            this.record(event, request, fields, "error");
        } catch (_) { this.warnDelivery(); }
    }
    end(request: string) {
        this.record("close", request);
        if (this.active === request) this.active = null;
    }
    dispose() {
        try { this.platform.offError?.(this.runtimeError); } catch (_) { this.warnDelivery(); }
        this.active = null;
    }
    private warnDelivery() {
        if (this.deliveryWarning) return;
        this.deliveryWarning = true;
        try { console.warn("[ranking-diagnostic] 游戏日志暂不可用；游戏流程不受影响"); } catch (_) { /* 日志不能引发二次错误。 */ }
    }
}
