import { ResourceStage, RESOURCE_SLOW_SECONDS } from "../config/ResourceConfig";
import { RELEASE } from "../config/ReleaseInfo";
import { AssetAttempt, AssetDiagnostics, assetError } from "./AssetDiagnostics";

export type PreparationPhase = "IDLE" | "DOWNLOAD" | "DECODE" | "READY" | "FAILED" | "UNSUPPORTED";
export class UnsupportedResourceDevice extends Error {}
export interface PreparationState { phase: PreparationPhase; progress: number; slow: boolean; error: string; }
export interface ResourcePort {
    download?(stage: ResourceStage, progress: (value: number) => void, attempt?: AssetAttempt): Promise<void>;
    decode(stage: ResourceStage): Promise<void>;
}

/** 每阶段共用唯一任务。普通进度由当前进度条读取，状态切换才通知界面。 */
export class ResourcePreparation {
    readonly states: Record<ResourceStage, PreparationState> = {
        village: { phase: "IDLE", progress: 0, slow: false, error: "" },
        night: { phase: "IDLE", progress: 0, slow: false, error: "" }
    };
    changed = () => {};
    private tasks = new Map<ResourceStage, Promise<boolean>>();
    private quiet: Record<ResourceStage, number> = { village: 0, night: 0 };
    private disposed = false;

    constructor(private port: ResourcePort, private diagnostics?: AssetDiagnostics) {}

    ready(stage: ResourceStage) { return this.states[stage].phase === "READY"; }

    ensure(stage: ResourceStage): Promise<boolean> {
        if (this.disposed) return Promise.resolve(false);
        if (this.ready(stage)) return Promise.resolve(true);
        if (this.states[stage].phase === "UNSUPPORTED") return Promise.resolve(false);
        const running = this.tasks.get(stage);
        if (running) return running;
        // 先登记再刷新，防止界面刷新触发同阶段重入。
        const task = Promise.resolve().then(() => this.prepare(stage));
        this.tasks.set(stage, task);
        return task;
    }

    private async prepare(stage: ResourceStage) {
        if (this.disposed) return false;
        const state = this.states[stage];
        const attempt = this.diagnostics?.begin(stage);
        let notificationFailed = false;
        const publish = () => {
            if (this.disposed) return;
            try { this.changed(); }
            catch (error) { notificationFailed = true; throw error; }
        };
        try {
            state.error = ""; state.slow = false; this.quiet[stage] = 0;
            if (this.port.download) {
                state.phase = "DOWNLOAD";
                publish();
                await this.port.download(stage, value => {
                    if (this.disposed || !Number.isFinite(value)) return;
                    const progress = Math.max(0, Math.min(1, value));
                    if (progress === state.progress) return;
                    const advancing = progress > state.progress;
                    state.progress = progress;
                    if (!advancing) return;
                    const wasSlow = state.slow;
                    state.slow = false; this.quiet[stage] = 0;
                    if (wasSlow) publish();
                }, attempt);
            }
            if (this.disposed) return false;
            state.phase = "DECODE"; state.progress = 1; state.slow = false; this.quiet[stage] = 0;
            publish();
            await this.port.decode(stage);
            if (this.disposed) return false;
            state.phase = "READY";
            if (attempt) this.diagnostics?.record(attempt, "ready");
            return true;
        } catch (error) {
            if (notificationFailed) throw error;
            if (!this.disposed) {
                const operation = state.phase;
                state.phase = error instanceof UnsupportedResourceDevice ? "UNSUPPORTED" : "FAILED";
                state.error = error instanceof Error ? error.message : String(error);
                console.error("[资源准备失败]", {
                    version: RELEASE.version, build: RELEASE.build, stage, operation, progress: state.progress,
                    ...assetError(error)
                });
                if (attempt) {
                    this.diagnostics?.record(attempt, "failed", { operation, progress: state.progress, ...assetError(error) }, "error");
                    this.diagnostics?.network(attempt, "failure");
                }
            }
            return false;
        } finally {
            this.tasks.delete(stage);
            if (!notificationFailed) publish();
        }
    }

    advance(seconds: number, foreground: boolean) {
        if (!foreground || this.disposed) return;
        for (const stage of Object.keys(this.states) as ResourceStage[]) {
            const state = this.states[stage];
            if ((state.phase !== "DOWNLOAD" && state.phase !== "DECODE") || state.slow) continue;
            this.quiet[stage] += Math.max(0, seconds);
            if (this.quiet[stage] >= RESOURCE_SLOW_SECONDS) { state.slow = true; this.changed(); }
        }
    }

    destroy() { this.disposed = true; this.changed = () => {}; }
}
