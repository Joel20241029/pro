import { RANKING_CANVAS, supportsNativeRankingSdk } from "../config/RankingConfig";
import type { RankingDiagnostics } from "./RankingDiagnostics";

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
/** Stable log codes for the checks that share the same player-facing upgrade message. */
export type RankingCanvasFailure = "sdk_version_missing" | "sdk_version_rejected" | "sdk_below_minimum" |
    "open_data_api_missing" | "canvas_missing" | "canvas_style_missing" | "canvas_is_main" |
    "startup_hook_unavailable" | "startup_capture_error";
/** 微信启动入口捕获的原生对象或固定失败原因，主域不会读取好友数据。 */
export type RankingStartup = { context: OpenData; canvas: NativeCanvas; style: NativeCanvas["style"]; styleRetainedAfterAdapter: boolean } |
    { reason: RankingCanvasFailure };
declare const GameGlobal: { daidaiNativeRanking?: RankingStartup };
export class RankingCanvasUnsupported extends Error {
    constructor(readonly reason: RankingCanvasFailure) {
        super(reason === "sdk_below_minimum" ? RANKING_CANVAS.unsupportedText : RANKING_CANVAS.unavailableText);
    }
}
/** 微信单例画布的唯一持有者。好友内容留在开放域；主域只控制 CSS 位置，不接触像素。 */
export class WechatRankingCanvas {
    private opened: OpenData | null = null;
    private canvas: NativeCanvas | null = null;
    private style: NativeCanvas["style"] | null = null;
    private prepared = false;
    private owner: string | null = null;
    constructor(private api: RankingCanvasApi, private diagnostics: RankingDiagnostics,
        private startup = typeof GameGlobal === "undefined" ? undefined : GameGlobal.daidaiNativeRanking) { }
    get context(): OpenData {
        if (this.prepared) return this.opened!;
        let styleRetainedAfterAdapter: boolean | undefined;
        if (this.startup) {
            if ("reason" in this.startup) throw new RankingCanvasUnsupported(this.startup.reason);
            this.opened = this.startup.context;
            this.canvas = this.startup.canvas;
            this.style = this.startup.style;
            styleRetainedAfterAdapter = this.startup.styleRetainedAfterAdapter;
        } else {
            // 未经过微信发布入口的开发环境仍可用同一套微信原生接口验收。
            if (!this.opened) {
                const version = this.api.getAppBaseInfo?.().SDKVersion;
                if (!supportsNativeRankingSdk(version, RANKING_CANVAS.minimumSdk)) {
                    throw new RankingCanvasUnsupported(!version ? "sdk_version_missing" :
                        /^\d+\.\d+\.\d+$/.test(version) ? "sdk_below_minimum" : "sdk_version_rejected");
                }
                if (typeof this.api.getOpenDataContext !== "function") throw new RankingCanvasUnsupported("open_data_api_missing");
                this.opened = this.api.getOpenDataContext({ sharedCanvasMode: RANKING_CANVAS.mode });
            }
            const canvas = this.opened?.canvas;
            if (!canvas?.style) throw new RankingCanvasUnsupported(canvas ? "canvas_style_missing" : "canvas_missing");
            this.canvas = canvas;
            this.style = canvas.style;
            this.conceal(this.style);
            canvas.width = RANKING_CANVAS.width; canvas.height = RANKING_CANVAS.height;
        }
        this.prepared = true;
        this.diagnostics.record("native_canvas_ready", null, { canvasPresent: true, styleRetainedAfterAdapter });
        return this.opened;
    }
    owns(request: string) { return this.owner === request; }
    show(request: string, box: RankingViewport | null) {
        void this.context;
        // 先取得拥有权；原生 style 部分写入失败时，面板销毁仍能将已露出的画布隐藏。
        this.owner = request;
        if (box) {
            this.place(this.style!, box);
            this.diagnostics.record("native_show", request, box);
        } else this.conceal(this.style!);
    }
    move(request: string, box: RankingViewport) {
        if (!this.owns(request)) return;
        this.place(this.style!, box);
    }
    hide(request: string): boolean {
        if (!this.owns(request)) return false;
        this.conceal(this.style!);
        this.owner = null;
        this.diagnostics.record("native_hide", request);
        return true;
    }
    observe(request: string, onStage: boolean) {
        try {
            const canvas = this.canvas, style = this.style;
            this.diagnostics.record("render_sample", request, {
                canvasPresent: !!canvas, canvasWidth: canvas?.width, canvasHeight: canvas?.height,
                visible: this.owns(request), onStage,
                styleWidth: style?.width, styleHeight: style?.height,
                styleLeft: style?.left, styleTop: style?.top
            });
        } catch (error) { this.diagnostics.failure("diagnostic_probe_error", request, error); }
    }
    private place(style: NativeCanvas["style"], box: RankingViewport) {
        style.left = `${box.x}px`; style.top = `${box.y}px`;
        style.width = `${box.width}px`; style.height = `${box.height}px`;
    }
    private conceal(style: NativeCanvas["style"]) {
        style.width = RANKING_CANVAS.hiddenSize; style.height = RANKING_CANVAS.hiddenSize;
        style.left = RANKING_CANVAS.hiddenPosition; style.top = RANKING_CANVAS.hiddenPosition;
    }
}
