import { RANKING_CANVAS, supportsNativeRankingSdk } from "../config/RankingConfig";
import { RankingDiagnostics } from "./RankingDiagnostics";

interface NativeCanvas {
    width: number; height: number;
    style: { width: string; height: string; left: string; top: string };
}
interface OpenData { canvas: NativeCanvas; postMessage(message: object): void; }
export interface RankingCanvasApi {
    getAppBaseInfo?(): { SDKVersion: string };
    getOpenDataContext(options: { sharedCanvasMode: "screenCanvas" }): OpenData;
}
export interface RankingViewport { x: number; y: number; width: number; height: number; }
export class RankingCanvasUnsupported extends Error {
    constructor() { super(RANKING_CANVAS.unsupportedText); }
}
/** 微信单例画布的唯一持有者。好友内容留在开放域；主域只控制 CSS 位置，不接触像素。 */
export class WechatRankingCanvas {
    private opened: OpenData | null = null;
    private prepared = false;
    private owner: string | null = null;
    constructor(private api: RankingCanvasApi, private diagnostics: RankingDiagnostics) { }
    get context(): OpenData {
        if (this.prepared) return this.opened!;
        if (!this.opened) {
            const version = this.api.getAppBaseInfo?.().SDKVersion;
            if (!supportsNativeRankingSdk(version, RANKING_CANVAS.minimumSdk)) throw new RankingCanvasUnsupported();
            if (typeof this.api.getOpenDataContext !== "function") throw new RankingCanvasUnsupported();
            // 首次云成绩同步也明确指定模式；取得后即保留，样式失败不能被当成可重新选模式。
            this.opened = this.api.getOpenDataContext({ sharedCanvasMode: RANKING_CANVAS.mode });
        }
        const canvas = this.opened.canvas;
        if (!canvas?.style) throw new RankingCanvasUnsupported();
        this.conceal(canvas);
        canvas.width = RANKING_CANVAS.width; canvas.height = RANKING_CANVAS.height;
        this.prepared = true;
        this.diagnostics.record("native_canvas_ready", null, { canvasPresent: true, canvasWidth: canvas.width, canvasHeight: canvas.height });
        return this.opened;
    }
    owns(request: string) { return this.owner === request; }
    show(request: string, box: RankingViewport | null) {
        const canvas = this.context.canvas;
        // 先取得拥有权；原生 style 部分写入失败时，面板销毁仍能将已露出的画布隐藏。
        this.owner = request;
        if (box) {
            this.place(canvas, box);
            this.diagnostics.record("native_show", request, box);
        } else this.conceal(canvas);
    }
    move(request: string, box: RankingViewport) {
        if (!this.owns(request)) return;
        this.place(this.opened!.canvas, box);
    }
    hide(request: string): boolean {
        if (!this.owns(request)) return false;
        this.conceal(this.opened!.canvas);
        this.owner = null;
        this.diagnostics.record("native_hide", request);
        return true;
    }
    observe(request: string, onStage: boolean) {
        try {
            const canvas = this.opened?.canvas;
            this.diagnostics.record("render_sample", request, {
                canvasPresent: !!canvas, canvasWidth: canvas?.width, canvasHeight: canvas?.height,
                visible: this.owns(request), onStage,
                styleWidth: canvas?.style.width, styleHeight: canvas?.style.height,
                styleLeft: canvas?.style.left, styleTop: canvas?.style.top
            });
        } catch (error) { this.diagnostics.failure("diagnostic_probe_error", request, error); }
    }
    private place(canvas: NativeCanvas, box: RankingViewport) {
        canvas.style.left = `${box.x}px`; canvas.style.top = `${box.y}px`;
        canvas.style.width = `${box.width}px`; canvas.style.height = `${box.height}px`;
    }
    private conceal(canvas: NativeCanvas) {
        canvas.style.width = RANKING_CANVAS.hiddenSize; canvas.style.height = RANKING_CANVAS.hiddenSize;
        canvas.style.left = RANKING_CANVAS.hiddenPosition; canvas.style.top = RANKING_CANVAS.hiddenPosition;
    }
}
