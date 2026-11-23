import { RELEASE } from "../config/ReleaseInfo";
import type { ResourceStage } from "../config/ResourceConfig";
import type { RankingLogPlatform } from "./RankingDiagnostics";

type Platform = Pick<RankingLogPlatform, "getGameLogManager" | "getAccountInfoSync"> & {
    getNetworkType?(options: { success(result: { networkType: string }): void; fail(): void }): void;
};
export interface AssetAttempt { id: string; stage: ResourceStage; started: number; }
/** 启动期限流：与排行榜日志合计仍低于微信单生命周期配额。 */
const EVENT_LIMIT = 120;
const NETWORK_TYPES = ["wifi", "2g", "3g", "4g", "5g", "ethernet", "none", "unknown"];

export function assetError(error: unknown) {
    try {
        const e = error as { errMsg?: string; message?: string; errCode?: number; errno?: number };
        const raw = typeof error === "string" ? error : e?.errMsg || e?.message;
        const message = typeof raw === "string" ? raw : "";
        const match = message.match(/(?:errcode|cronet_error_code):\s*(-?\d+)/i);
        const code = e?.errCode ?? e?.errno ?? (match ? Number(match[1]) : undefined);
        const reason = /offline mode/i.test(message) ? "offline_mode" :
            /CONNECTION_RESET/i.test(message) ? "connection_reset" :
            /domain|域名/i.test(message) ? "domain" :
            /timeout|timed out/i.test(message) ? "timeout" : "other";
        return { reason, code: Number.isSafeInteger(code) ? code : undefined };
    } catch (_) { return { reason: "other" }; }
}

export class AssetDiagnostics {
    private logger?: ReturnType<NonNullable<Platform["getGameLogManager"]>>;
    private sequence = 0;
    private count = 0;
    private readonly common = { delivery: "native", version: RELEASE.version, build: RELEASE.build, env: "unknown" };
    constructor(private platform: Platform) {
        try {
            const env = platform.getAccountInfoSync?.().miniProgram.envVersion;
            if (env && ["release", "trial", "develop"].includes(env)) this.common.env = env;
        } catch (_) { /* 环境读取独立于日志和游戏启动。 */ }
    }
    begin(stage: ResourceStage): AssetAttempt {
        const started = Date.now(), attempt = { id: `${started.toString(36)}-${++this.sequence}`, started, stage };
        this.record(attempt, "start");
        this.network(attempt, "start");
        return attempt;
    }
    record(attempt: AssetAttempt, event: string, fields = {}, level: "info" | "error" = "info") {
        if (this.count++ >= EVENT_LIMIT) return;
        const value = { ...this.common, event, attempt: attempt.id, stage: attempt.stage, elapsedMs: Date.now() - attempt.started, ...fields };
        try { console[level]("[asset_download]", value); } catch (_) { /* vConsole 不是加载依赖。 */ }
        try {
            this.logger ??= this.platform.getGameLogManager?.({ commonInfo: this.common, fail() {} });
            this.logger?.log({ key: "asset_download", value, level, success() {}, fail() {} });
        } catch (_) { /* 微信日志不可用时保留本地输出。 */ }
    }
    network(attempt: AssetAttempt, at: "start" | "failure") {
        const report = (value: string) => this.record(attempt, "network", { at, network: NETWORK_TYPES.includes(value) ? value : "unknown" });
        try {
            if (this.platform.getNetworkType) this.platform.getNetworkType({ success: r => report(r?.networkType), fail: () => report("unknown") });
            else report("unknown");
        } catch (_) { report("unknown"); }
    }
}
