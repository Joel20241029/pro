import { SpriteFrames } from "./SpriteFrames";
import { C, UI } from "./UiTheme";

/** 可复用的屏中短提示；只有一条时间轴，不创建 Timer，不拦截地图或面板点击。 */
export class Tip extends Laya.Sprite {
    private message = new Laya.Text();
    private elapsed: number = UI.tipSeconds;
    constructor(private art: SpriteFrames) {
        super(); this.name = "Tip"; this.mouseEnabled = false; this.visible = false;
        const t = this.message; t.name = "TipText"; t.font = "sans-serif"; t.fontSize = UI.tipFont;
        t.bold = false; t.color = C.timber; t.stroke = 1; t.strokeColor = C.lightEdge;
        t.align = "center"; t.valign = "middle"; t.wordWrap = true; t.leading = 8;
        t.mouseEnabled = false; t.size(UI.tipWidth - 64, UI.tipMaxHeight - 56); t.pos(32, 28); this.addChild(t);
    }
    show(text: string) {
        const t = this.message; t.overflow = Laya.Text.VISIBLE; t.height = UI.tipMaxHeight - 56; t.text = text;
        // 大段异常信息也限制在安全显示区；业务原始错误仍由 GameSession 保留。
        const height = Math.min(UI.tipMaxHeight, Math.max(112, t.textHeight + 56));
        t.height = height - 56; t.overflow = Laya.Text.ELLIPSIS;
        this.size(UI.tipWidth, height).pivot(UI.tipWidth / 2, height / 2);
        this.graphics.clear(); this.art.panel(this, "panel_anchored_tip", UI.tipWidth, height);
        this.elapsed = 0; this.alpha = 0; this.visible = true;
    }
    advance(delta: number) {
        if (!this.visible) return;
        this.elapsed += Math.max(0, delta);
        if (this.elapsed >= UI.tipSeconds) { this.alpha = 0; this.visible = false; return; }
        this.alpha = Math.min(1, this.elapsed / UI.tipFadeIn, (UI.tipSeconds - this.elapsed) / UI.tipFadeOut);
    }
}
