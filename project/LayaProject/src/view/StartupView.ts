import { SpriteFrames } from "./SpriteFrames";
import { PreparationState } from "../platform/ResourcePreparation";
import { C } from "./UiTheme";
/** 主包读取前用原生绘制；主包完成后复用高清草地与纸面，建筑分包等待期间始终有完整加载画面。 */
export class StartupView extends Laya.Sprite {
    private title = new Laya.Text();
    private status = new Laya.Text();
    private retryButton = new Laya.Sprite();
    private retryText = new Laya.Text();
    private sheet = new Laya.Sprite();
    private art: SpriteFrames | null = null;
    constructor(retry: () => void) {
        super(); this.name = "StartupView";
        this.title.text = "代代守村"; this.title.fontSize = 50; this.title.bold = true; this.title.color = "#563d27";
        this.status.fontSize = 28; this.status.color = "#876342"; this.status.wordWrap = true;
        this.retryText.text = "重新准备"; this.retryText.fontSize = 30; this.retryText.color = "#533720"; this.retryText.bold = true;
        [this.title, this.status, this.retryText].forEach(t => { t.align = "center"; t.valign = "middle"; });
        this.sheet.mouseEnabled = false; this.addChild(this.sheet);
        this.addChild(this.title); this.addChild(this.status); this.addChild(this.retryButton); this.retryButton.addChild(this.retryText);
        this.retryButton.size(280, 72); this.retryButton.mouseEnabled = true; this.retryButton.on(Laya.Event.CLICK, this, retry);
        this.retryButton.graphics.drawRect(0, 0, 280, 72, "#eac17b", "#ad7a3c", 3);
        this.retryText.size(280, 72); this.resize(); this.showStatus(false);
    }
    showStatus(failed: boolean) { this.status.text = failed ? "村庄素材暂未准备好\n点击下方继续" : "林间灯火，等你归来…"; this.retryButton.visible = failed; }
    decorate(art: SpriteFrames) { this.art = art; this.resize(); }
    showPreparation(title: string, state: PreparationState) {
        this.retryButton.visible = state.phase === "FAILED";
        const text = state.phase === "FAILED" ? `${title}暂未准备好\n点击下方重试即可继续`
            : state.slow ? `${title}仍在准备中…\n网络较慢，请稍候`
            : state.phase === "DOWNLOAD" ? `正在准备${title} · ${Math.floor(state.progress * 100)}%\n林间灯火，等你归来…`
            : state.phase === "DECODE" ? `正在整理${title}素材…` : "林间灯火，等你归来…";
        if (this.status.text !== text) this.status.text = text;
    }
    resize() {
        const width = Laya.stage.width, height = Laya.stage.height;
        this.size(width, height); this.graphics.clear(); this.graphics.drawRect(0, 0, width, height, "#f5e7c6");
        this.graphics.drawRect(22, 22, width - 44, height - 44, null, "#cda46a", 3);
        this.sheet.graphics.clear();
        if (this.art) {
            this.graphics.clear();
            for (let y = 0; y < height; y += 512) for (let x = 0; x < width; x += 512)
                this.graphics.drawImage(this.art.get("tile_ground_grass"), x, y, 512, 512);
            this.sheet.pos(24, height * .4 - 40);
            this.art.panel(this.sheet, "panel_parchment", width - 48, 410);
            this.title.color = this.status.color = C.cream;
            this.title.stroke = this.status.stroke = 1;
            this.title.strokeColor = this.status.strokeColor = "#334f1c";
            this.graphics.drawImage(this.art.get("deco_tree_oak"), 30, height * .4 - 180, 172, 172);
            this.graphics.drawImage(this.art.get("deco_tree_pine"), width - 166, height * .4 - 154, 136, 136);
            this.retryButton.graphics.clear(); this.art.panel(this.retryButton, "panel_button_gold", 280, 72);
        }
        this.title.size(width - 80, 90).pos(40, height * .4);
        this.status.size(width - 100, 110).pos(50, height * .4 + 110);
        this.retryButton.pos((width - 280) / 2, height * .4 + 250);
    }
}
