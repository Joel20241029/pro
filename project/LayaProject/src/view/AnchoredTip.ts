import { SpriteFrames } from "./SpriteFrames";
import { C } from "./UiTheme";
import { ANCHORED_TIP as STYLE } from "./config/AnchoredTipConfig";

/** 目标提供自己的可见范围；组件不持有业务状态，后续可用于其他场景对象。 */
export interface TipTarget { node: Laya.Sprite; bounds: Laya.Rectangle; }

/** 单例文字气泡：尖端锚定目标顶部，只由GameView的视觉时钟推进，不创建Timer或Tween。 */
export class AnchoredTip extends Laya.Sprite {
    private message = new Laya.Text();
    private anchorPoint = new Laya.Point();
    private target: (() => TipTarget) | null = null;
    private elapsed = 0;
    constructor(art: SpriteFrames) {
        super();
        this.name = "AnchoredTip";
        this.mouseEnabled = false;
        this.visible = false;
        const height = STYLE.height + STYLE.tailHeight - STYLE.tailOverlap;
        this.size(STYLE.width, height).pivot(STYLE.width / 2, height);
        art.panel(this, STYLE.bodyFrame, STYLE.width, STYLE.height);
        const tail = new Laya.Sprite();
        tail.name = "Pointer";
        tail.mouseEnabled = false;
        tail.texture = art.get("panel_anchored_tip_tail");
        tail.size(STYLE.tailWidth, STYLE.tailHeight).pos((STYLE.width - STYLE.tailWidth) / 2, STYLE.height - STYLE.tailOverlap);
        this.addChild(tail);
        const t = this.message;
        t.name = "AnchoredTipText";
        t.mouseEnabled = false;
        t.font = "sans-serif";
        t.fontSize = STYLE.font;
        t.bold = true;
        t.color = C.tipInk;
        t.stroke = 1;
        t.strokeColor = C.lightEdge;
        t.align = "center";
        t.valign = "middle";
        t.wordWrap = false;
        t.size(STYLE.width - STYLE.inset * 2, STYLE.height - STYLE.inset * 2).pos(STYLE.inset, STYLE.inset);
        this.addChild(t);
    }
    show(text: string, target: () => TipTarget) {
        this.message.text = text;
        this.target = target;
        this.elapsed = 0;
        this.visible = true;
        this.advance(0);
    }
    hide() {
        this.visible = false;
        this.target = null;
        this.scale(0, 0);
    }
    advance(delta: number) {
        if (!this.visible || !this.target) return;
        this.elapsed += Math.max(0, delta);
        if (this.elapsed >= STYLE.seconds) { this.hide(); return; }
        const { node, bounds } = this.target();
        node.localToGlobal(this.anchorPoint.setTo(bounds.x + bounds.width / 2, bounds.y), false, this.parent as Laya.Sprite);
        this.pos(this.anchorPoint.x, this.anchorPoint.y - STYLE.roofGap);
        const grow = Math.min(1, this.elapsed / STYLE.growSeconds);
        const shrink = Math.min(1, (STYLE.seconds - this.elapsed) / STYLE.shrinkSeconds);
        // 展开减速、收起加速，无回弹；pivot固定在指角尖端，整个气泡不会围绕中心漂移。
        const scale = Math.min(1 - Math.pow(1 - grow, 3), 1 - Math.pow(1 - shrink, 3));
        this.scale(scale, scale);
    }
}
