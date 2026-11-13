import { ResourceBundle, RESOURCE_BUNDLES, RESOURCE_SLOW_SECONDS } from "../config/ResourceConfig";
export type PreparationPhase = "IDLE" | "DOWNLOAD" | "DECODE" | "READY" | "FAILED";
export interface PreparationState { phase: PreparationPhase; progress: number; slow: boolean; error: string; }
export interface ResourcePort {
    download(root: string, progress: (value: number) => void): Promise<boolean>;
    decode(bundle: ResourceBundle): Promise<void>;
}
/** 每包唯一在途任务。原生下载不可取消，慢网仍等待原任务；真实失败后才允许手动重试。
 * 状态不进入存档，不修改经济。销毁后屏蔽晚回调，由解码器负责释放未提交的纹理。
 */
export class ResourcePreparation {
    readonly states: Record<ResourceBundle, PreparationState> = {
        base: { phase: "IDLE", progress: 0, slow: false, error: "" },
        buildings: { phase: "IDLE", progress: 0, slow: false, error: "" },
        characters: { phase: "IDLE", progress: 0, slow: false, error: "" },
        battle: { phase: "IDLE", progress: 0, slow: false, error: "" }
    };
    changed = () => {};
    private tasks = new Map<ResourceBundle, Promise<boolean>>();
    private registered = new Set<ResourceBundle>();
    private quiet: Record<ResourceBundle, number> = { base: 0, buildings: 0, characters: 0, battle: 0 };
    private disposed = false;
    constructor(private port: ResourcePort) {}
    ready(bundle: ResourceBundle) { return this.states[bundle].phase === "READY"; }
    ensure(bundle: ResourceBundle): Promise<boolean> {
        if (this.disposed) return Promise.resolve(false);
        if (this.ready(bundle)) return Promise.resolve(true);
        const running = this.tasks.get(bundle); if (running) return running;
        // 先登记 promise 再触发 changed，避免同步刷新中的重复点按重入。
        const task = Promise.resolve().then(() => this.prepare(bundle));
        this.tasks.set(bundle, task);
        return task;
    }
    private async prepare(bundle: ResourceBundle) {
        if (this.disposed) return false;
        const state = this.states[bundle], config = RESOURCE_BUNDLES[bundle];
        let notificationFailed = false;
        const publish = () => {
            if (this.disposed) return;
            try { this.changed(); }
            catch (error) { notificationFailed = true; throw error; }
        };
        try {
            state.error = ""; state.slow = false; state.progress = 0; this.quiet[bundle] = 0;
            if (config.native && !this.registered.has(bundle)) {
                state.phase = "DOWNLOAD"; publish();
                const ok = await this.port.download(config.root, value => {
                    if (this.disposed || !Number.isFinite(value)) return;
                    const progress = Math.max(0, Math.min(1, value));
                    if (progress <= state.progress) return;
                    const wasSlow = state.slow;
                    state.progress = progress; state.slow = false; this.quiet[bundle] = 0;
                    if (wasSlow) publish();
                });
                if (!ok) throw new Error("资源包下载失败");
                this.registered.add(bundle);
            }
            if (this.disposed) return false;
            state.phase = "DECODE"; state.progress = 1; state.slow = false; this.quiet[bundle] = 0; publish();
            await this.port.decode(bundle);
            if (this.disposed) return false;
            state.phase = "READY"; state.error = ""; return true;
        } catch (error) {
            // 编程/展示错误保留堆栈，不能伪装为“重新下载”能解决的资源失败，也不能重复通知。
            if (notificationFailed) throw error;
            if (!this.disposed) { state.phase = "FAILED"; state.error = error instanceof Error ? error.message : String(error); }
            return false;
        } finally {
            this.tasks.delete(bundle); if (!notificationFailed) publish();
        }
    }
    /** 只累计前台时长，后台不改任务、不算超时；再次前台沿用原下载。 */
    advance(seconds: number, foreground: boolean) {
        if (!foreground || this.disposed) return;
        for (const bundle of Object.keys(this.states) as ResourceBundle[]) {
            const state = this.states[bundle];
            if ((state.phase !== "DOWNLOAD" && state.phase !== "DECODE") || state.slow) continue;
            this.quiet[bundle] += Math.max(0, seconds);
            if (this.quiet[bundle] >= RESOURCE_SLOW_SECONDS) { state.slow = true; this.changed(); }
        }
    }
    destroy() { this.disposed = true; this.changed = () => {}; }
}
