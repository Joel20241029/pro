import { LAUNCHER_IMAGE } from "../config/ResourceConfig";
import { PreparationState } from "../platform/ResourcePreparation";
import { bindButtonClick } from "./ButtonFeedback";
import { ResourceProgress } from "./ResourceProgress";
import { GameLayout } from "./GameLayout";
import { UI } from "./UiTheme";

/** 左右最多各裁约 9%，限定到启动图标题以外的出血。长屏伸展底部低对比草地。 */
const STRETCH_START = .77;
const SAFE_ART_WIDTH = .82;
/** 主包尚未有村庄图集，启动卡沿用审稿的绿金配色和底部操作留白。 */
const PREPARATION_LAYOUT = { plateWidth: 556, progressInset: 28, progressWidth: 436, retryTop: 133, retryWidth: 294, retryHeight: 84, safeGap: 46 };

export class StartupView extends Laya.Sprite {
    private readonly progress = new ResourceProgress("launcher");
    private readonly retryButton = new Laya.Sprite();
    private readonly retryFace = new Laya.Sprite();
    private readonly retryText = new Laya.Text();
    private top: Laya.Texture | null = null;
    private bottom: Laya.Texture | null = null;
    private artworkFailed = false;

    constructor(retry: () => void, private readonly layout: () => GameLayout) {
        super();
        this.name = "StartupView";
        this.addChild(this.progress);
        this.addChild(this.retryButton);
        this.retryButton.name = "LauncherRetry";
        const { retryWidth, retryHeight } = PREPARATION_LAYOUT;
        this.retryButton.size(retryWidth, retryHeight);
        this.retryButton.addChild(this.retryFace);
        this.retryFace.addChild(this.retryText);
        this.retryFace.mouseEnabled = this.retryText.mouseEnabled = false;
        this.retryFace.graphics.drawRoundRect(0, 0, retryWidth, retryHeight, 14, 14, 14, 14, "#eac17b", "#ad7a3c", 3);
        this.retryText.text = "重新下载";
        this.retryText.fontSize = 30;
        this.retryText.color = "#533720";
        this.retryText.bold = true;
        this.retryText.align = "center";
        this.retryText.valign = "middle";
        this.retryText.size(retryWidth, retryHeight);
        this.retryButton.visible = false;
        bindButtonClick(this.retryButton, retry, this.retryFace);
        this.resize();
    }

    async loadArtwork() {
        if (this.top) return true;
        try {
            const texture: Laya.Texture = await Laya.loader.load(LAUNCHER_IMAGE, { type: Laya.Loader.IMAGE, ignoreCache: this.artworkFailed });
            if (this.destroyed) return false;
            if (!texture) throw new Error("主包启动图读取失败");
            const split = Math.round(texture.height * STRETCH_START);
            this.top = Laya.Texture.create(texture, 0, 0, texture.width, split);
            this.bottom = Laya.Texture.create(texture, 0, split, texture.width, texture.height - split);
            this.artworkFailed = false;
            this.resize();
            return true;
        } catch (error) {
            this.artworkFailed = true;
            console.error("[启动图]", error);
            return false;
        }
    }

    showPreparation(title: string, state: PreparationState) {
        const retry = this.artworkFailed || state.phase === "FAILED";
        if (this.retryButton.visible !== retry) {
            this.retryButton.visible = retry;
            this.resize();
        }
        if (this.artworkFailed) this.progress.render("启动图载入", { phase: "FAILED", progress: 0, slow: false, error: "" });
        else this.progress.render(title, state);
    }

    resize() {
        const width = Laya.stage.width, height = Laya.stage.height;
        const safeBottom = Math.min(height, this.layout().safeBottom);
        this.size(width, height);
        this.graphics.clear();
        this.graphics.drawRect(0, 0, width, height, "#162c20");
        if (this.top && this.bottom) {
            const artWidth = Math.min(width / SAFE_ART_WIDTH, Math.max(width, height * this.top.width / (this.top.height + this.bottom.height)));
            const x = (width - artWidth) / 2;
            const topHeight = Math.min(this.top.height * artWidth / this.top.width, height * .83);
            this.graphics.drawImage(this.top, x, 0, artWidth, topHeight);
            this.graphics.drawImage(this.bottom, x, topHeight, artWidth, height - topHeight);
        }
        const p = PREPARATION_LAYOUT;
        const plateWidth = Math.min(p.plateWidth, width * .85), progressWidth = Math.min(p.progressWidth, plateWidth - 48);
        const plateHeight = this.retryButton.visible ? p.retryTop + p.retryHeight + UI.action.bottom : 174;
        const plateX = (width - plateWidth) / 2, plateY = safeBottom - plateHeight - p.safeGap;
        this.graphics.drawRoundRect(plateX, plateY, plateWidth, plateHeight, 17, 17, 17, 17, "#496627", "#bb8236", 7);
        this.graphics.drawRoundRect(plateX + 7, plateY + 7, plateWidth - 14, plateHeight - 14, 11, 11, 11, 11, null, "#efcf79", 2);
        this.progress.setWidth(progressWidth);
        this.progress.pos((width - progressWidth) / 2, plateY + p.progressInset);
        this.retryButton.pos((width - p.retryWidth) / 2, plateY + p.retryTop);
    }

    destroy(destroyChild = true) {
        const top = this.top, bottom = this.bottom;
        super.destroy(destroyChild);
        top?.destroy();
        bottom?.destroy();
    }
}
