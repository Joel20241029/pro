import { RELEASE } from "../config/ReleaseInfo";

type LogLevel = "info" | "warn" | "error";
interface GameLogger { log(options: { level: LogLevel; key: string; value: object; fail(): void }): void; }
/** 主域官方游戏日志接口（基础库 >=3.7.4）；开放域不调用日志 API，也不把好友数据传回主域。 */
export interface RankingLogPlatform {
    getGameLogManager?(options: { commonInfo: object; fail(): void }): GameLogger;
    getAccountInfoSync?(): { miniProgram: { envVersion: string } };
    onError?(listener: (error: string) => void): void;
    offError?(listener: (error: string) => void): void;
}
type RankingEvent = "open" | "constructed" | "viewport" | "message_returned" | "message_error" |
    "privacy_start" | "privacy_result" | "friend_start" | "friend_result" | "authorization_stale" |
    "texture_allocated" | "texture_updated" | "texture_error" | "view_error" | "runtime_error" | "close";
interface Fields { x?: number; y?: number; width?: number; height?: number; uploads?: number; category?: string; code?: number; frames?: string[]; result?: "ok" | "failed"; message?: "viewport" | "show" | "refresh" | "authorization" | "close" | "score"; }
/** 每次启动最多240条（低于微信999条上限），同一面板同类错误只记一次；纹理只记首次两次上传，不逐帧上报。 */
const EVENT_BUDGET = 240;
/** 错误只记录固定分类和数值错误码。禁止发送原始错误全文、任意对象、昵称、头像URL、openid或云成绩。 */
function errorFields(error: unknown) {
    const e = error as { message?: unknown; errMsg?: unknown; errCode?: unknown; errno?: unknown; stack?: unknown };
    const message = typeof error === "string" ? error : typeof e?.message === "string" ? e.message : typeof e?.errMsg === "string" ? e.errMsg : "";
    const category = /texStorage2D|immutable/i.test(message) ? "immutable_texture" : /texSubImage2D/i.test(message) ? "subimage_upload" :
        /privacy|announce your privacy/i.test(message) ? "privacy" : /auth|permission|deny/i.test(message) ? "authorization" : "unclassified";
    const code = typeof e?.errCode === "number" ? e.errCode : typeof e?.errno === "number" ? e.errno : undefined;
    const stack = typeof e?.stack === "string" ? e.stack : message;
    // 只保留已知发布文件名和行列号，不发送错误正文或调用栈中的URL、参数和用户数据。
    const frames = (stack.match(/(?:bundle|laya\.core|laya\.webgl_2D|laya\.adapter-weixin|game|index|WAGame)\.js:\d+:\d+/g) || []).slice(0, 3);
    return { category, code: Number.isFinite(code) ? code : undefined, frames };
}
export class RankingDiagnostics {
    private logger: GameLogger | null = null;
    private count = 0;
    private sequence = 0;
    private active: string | null = null;
    private errors = new Set<string>();
    private deliveryWarning = false;
    private readonly runtimeError = (error: string) => { if (this.active) this.failure("runtime_error", this.active, error); };
    constructor(private platform: RankingLogPlatform) {
        try {
            const env = platform.getAccountInfoSync?.().miniProgram.envVersion;
            this.logger = platform.getGameLogManager?.({ commonInfo: { version: RELEASE.version, build: RELEASE.build, render: "offscreenCanvas", env: env === "release" || env === "trial" || env === "develop" ? env : "unavailable" }, fail: () => this.warnDelivery() }) || null;
        } catch (_) { this.warnDelivery(); }
        try { platform.onError?.(this.runtimeError); } catch (_) { this.warnDelivery(); }
    }
    begin(): string {
        const id = `${Date.now().toString(36)}-${++this.sequence}`;
        this.active = id;
        this.record("open", id);
        return id;
    }
    record(event: RankingEvent, request: string | null, fields: Fields = {}, level: LogLevel = "info") {
        if (this.count >= EVENT_BUDGET) return;
        this.count++;
        const value = { event, request, sequence: this.count, ...fields };
        try {
            if (this.logger) this.logger.log({ key: "ranking", level, value, fail: () => this.warnDelivery() });
            else console.info("[ranking-diagnostic]", RELEASE.build, value);
        } catch (_) { this.warnDelivery(); }
    }
    failure(event: RankingEvent, request: string | null, error: unknown) {
        // 日志处理本身也可能遇到代理对象/异常getter；任何诊断失败都不能替换原异常或中断游戏。
        try {
            const key = `${request}:${event}`;
            if (this.errors.has(key) || this.count >= EVENT_BUDGET) return;
            this.errors.add(key);
            this.record(event, request, errorFields(error), "error");
        } catch (_) { this.warnDelivery(); }
    }
    end(request: string, uploads: number) {
        this.record("close", request, { uploads });
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
