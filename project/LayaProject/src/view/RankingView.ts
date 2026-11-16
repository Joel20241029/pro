import { WechatPlatform } from "../platform/WechatPlatform";
import { RANKING_CANVAS } from "../config/RankingConfig";

/** 仅作面板内布局与销毁占位；榜单由微信 screenCanvas 直接上屏，不创建 Laya 纹理。 */
export class RankingView extends Laya.Sprite {
    private requestRevision = 0;
    constructor(private platform: WechatPlatform, private bestNight: number, private requestId: string) {
        super();
        this.name = "FriendRankingCanvas";
        this.size(RANKING_CANVAS.width, RANKING_CANVAS.height); this.mouseEnabled = false;
        // 在开始授权前检查原生能力；失败交给原外框显示提示，保持关闭入口可用。
        void platform.rankingCanvas.context;
        platform.rankingDiagnostics.record("constructed", requestId, { width: this.width, height: this.height });
    }
    private screenBounds() {
        const at = Laya.SpriteUtils.getTransformRelativeToWindow(this, 0, 0);
        return { x: at.x, y: at.y, width: this.width * at.scaleX, height: this.height * at.scaleY };
    }
    /** 原生 CSS 与官方 Layout 触摸坐标共用同一窗口矩形；不再乘 DPR 或重复加安全区。 */
    updateViewPort() {
        if (!this.parent || this.destroyed || !this.platform.rankingCanvas.owns(this.requestId)) return;
        const box = this.screenBounds();
        this.platform.rankingCanvas.move(this.requestId, box);
        this.platform.rankingDiagnostics.record("viewport", this.requestId, box);
        this.platform.postRanking({ type: "updateViewPort", box }, this.requestId);
    }
    private sampleRender() { if (!this.destroyed) this.platform.rankingCanvas.observe(this.requestId, this.displayedInStage); }
    refreshRanking() {
        if (!this.parent || this.destroyed) return;
        this.platform.rankingDiagnostics.record("refresh_start", this.requestId);
        const revision = ++this.requestRevision;
        this.platform.rankingCanvas.show(this.requestId, this.screenBounds());
        this.updateViewPort();
        this.platform.postRanking({ showRanking: true, bestNight: this.bestNight }, this.requestId);
        const isCurrent = () => !this.destroyed && revision === this.requestRevision && this.platform.rankingCanvas.owns(this.requestId);
        this.platform.authorizeRanking(isCurrent, error => {
            if (!isCurrent()) { this.platform.rankingDiagnostics.record("authorization_stale", this.requestId); return; }
            this.platform.postRanking(error ? { authorizationError: error } : { refreshRanking: true, bestNight: this.bestNight }, this.requestId);
        }, this.requestId);
        try { Laya.timer.once(RANKING_CANVAS.sampleDelay, this, this.sampleRender); }
        catch (error) { this.platform.rankingDiagnostics.failure("diagnostic_probe_error", this.requestId, error); }
    }
    destroy(destroyChild = true) {
        if (this.destroyed) return;
        ++this.requestRevision;
        // 原生画布不随 Laya 节点自动移除；仅当前拥有者可以隐藏、清空它。
        try {
            if (this.platform.rankingCanvas.hide(this.requestId)) this.platform.postRanking({ type: "close" }, this.requestId);
        } catch (error) { this.platform.rankingDiagnostics.failure("view_error", this.requestId, error); }
        this.platform.rankingDiagnostics.end(this.requestId);
        Laya.timer.clearAll(this);
        super.destroy(destroyChild);
    }
}
