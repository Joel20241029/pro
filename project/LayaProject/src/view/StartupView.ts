/** 主包图集读取前的轻量启动画面；仅用原生绘制，不依赖尚未加载的图片或分包。 */
export class StartupView extends Laya.Sprite {
    private title = new Laya.Text();
    private status = new Laya.Text();
    private retryButton = new Laya.Sprite();
    private retryText = new Laya.Text();
    constructor(retry: () => void) {
        super(); this.name = "StartupView";
        this.title.text = "代代守村"; this.title.fontSize = 50; this.title.bold = true; this.title.color = "#563d27";
        this.status.fontSize = 28; this.status.color = "#876342"; this.status.wordWrap = true;
        this.retryText.text = "重新准备"; this.retryText.fontSize = 30; this.retryText.color = "#533720"; this.retryText.bold = true;
        [this.title, this.status, this.retryText].forEach(t => { t.align = "center"; t.valign = "middle"; });
        this.addChild(this.title); this.addChild(this.status); this.addChild(this.retryButton); this.retryButton.addChild(this.retryText);
        this.retryButton.size(280, 72); this.retryButton.mouseEnabled = true; this.retryButton.on(Laya.Event.CLICK, this, retry);
        this.retryButton.graphics.drawRect(0, 0, 280, 72, "#eac17b", "#ad7a3c", 3);
        this.retryText.size(280, 72); this.resize(); this.showStatus(false);
    }
    showStatus(failed: boolean) { this.status.text = failed ? "村庄素材暂未准备好\n点击下方继续" : "林间灯火，等你归来…"; this.retryButton.visible = failed; }
    resize() {
        const width = Laya.stage.width, height = Laya.stage.height;
        this.size(width, height); this.graphics.clear(); this.graphics.drawRect(0, 0, width, height, "#f5e7c6");
        this.graphics.drawRect(22, 22, width - 44, height - 44, null, "#cda46a", 3);
        this.title.size(width - 80, 90).pos(40, height * .4);
        this.status.size(width - 100, 110).pos(50, height * .4 + 110);
        this.retryButton.pos((width - 280) / 2, height * .4 + 250);
    }
}
