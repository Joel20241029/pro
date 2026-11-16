import { WechatPlatform } from "../platform/WechatPlatform";
import { SharedCanvasTexture } from "./SharedCanvasTexture";

/** Laya 内置 sharedCanvas 组件；只接收主域指令，不读取任何好友身份数据。 */
export class RankingView extends Laya.OpenDataContextView {
    private requestRevision = 0;
    constructor(private platform: WechatPlatform, private bestNight: number, private requestId: string) {
        super(); this.name = "FriendRankingCanvas"; this.fps = 20;
        // Laya 3.4 的首次 sharedCanvas resize 会直接调用 _graphics.repaint；用公开 getter 先初始化。
        this.graphics.clear();
        this.size(600, 680); this.mouseEnabled = false;
        // 模板只换 bitmap，不更新 Texture 的 200×200 缓存，会每帧重新分配。
        // 固定画布在加入舞台前一次性 setTo，宽高/源尺寸/引用一起更新，之后仅上传像素。
        const original = this.texture.bitmap;
        const bitmap = new SharedCanvasTexture(this.width, this.height, Laya.TextureFormat.R8G8B8A8, false, false, true, true);
        bitmap.trace = { diagnostics: platform.rankingDiagnostics, request: requestId };
        bitmap.lock = true; this.texture.setTo(bitmap); original.lock = false; original.destroy();
        platform.rankingDiagnostics.record("constructed", requestId, { width: this.width, height: this.height });
    }
    /** 模板 viewport 使用屏幕触摸坐标；父面板、安全区和根缩放必须一起换算。 */
    updateViewPort() {
        if (!this.parent || this.destroyed) return;
        const at = Laya.SpriteUtils.getTransformRelativeToWindow(this, 0, 0);
        this.platform.rankingDiagnostics.record("viewport", this.requestId, { x: at.x, y: at.y, width: this.width * at.scaleX, height: this.height * at.scaleY });
        this.postMsg({ type: "updateViewPort", box: { x: at.x, y: at.y, width: this.width * at.scaleX, height: this.height * at.scaleY } });
    }
    postMsg(message: object) { this.platform.postRanking(message, this.requestId); }
    refreshRanking() {
        const revision = ++this.requestRevision;
        this.updateViewPort();
        this.postMsg({ showRanking: true, bestNight: this.bestNight });
        this.platform.authorizeRanking(() => !this.destroyed && revision === this.requestRevision, error => {
            if (this.destroyed || revision !== this.requestRevision) { this.platform.rankingDiagnostics.record("authorization_stale", this.requestId); return; }
            if (error) this.postMsg({ authorizationError: error });
            else this.postMsg({ refreshRanking: true, bestNight: this.bestNight });
        }, this.requestId);
    }
    destroy(destroyChild = true) {
        if (this.destroyed) return;
        ++this.requestRevision;
        const texture = this.texture;
        this.platform.rankingDiagnostics.end(this.requestId, (texture.bitmap as SharedCanvasTexture).uploads);
        super.destroy(destroyChild);
        Laya.timer.clearAll(this);
        // OpenDataContextView 私有创建且锁定的纹理，不是共享图集；面板关闭后释放 GPU 与引用。
        if (texture && !texture.destroyed) { const bitmap = texture.bitmap; bitmap.lock = false; texture.destroy(); bitmap.destroy(); }
    }
}
