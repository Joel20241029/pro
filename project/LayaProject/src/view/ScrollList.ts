import { C, UI } from "./UiTheme";

/** 小列表共用的手指拖动容器；只依赖核心 Sprite，不为最多 80 条家谱引入整个 laya.ui 模块。 */
export class ScrollList extends Laya.Sprite {
    readonly content = new Laya.Sprite();
    private clipRoot = new Laya.Sprite();
    private thumb = new Laya.Sprite();
    private offset = 0;
    private touch: number | null = null;
    private startX = 0; private startY = 0; private startOffset = 0;
    private dragging = false;
    private pressedTarget: Laya.Node | null = null;
    private readonly maximum: number;
    constructor(width: number, height: number, contentHeight: number, initialOffset = 0, private changed?: (offset: number) => void) {
        super(); this.name = "ScrollList"; this.size(width, height);
        this.content.name = "panelText";
        this.maximum = Math.max(0, contentHeight - height);
        this.clipRoot.size(width - UI.scrollGutter, height); this.clipRoot.mouseEnabled = true;
        this.clipRoot.scrollRect = new Laya.Rectangle(0, 0, width - UI.scrollGutter, height);
        this.content.size(width - UI.scrollGutter, Math.max(height, contentHeight)); this.clipRoot.addChild(this.content); this.addChild(this.clipRoot);
        this.thumb.mouseEnabled = false; this.thumb.visible = this.maximum > 0;
        if (this.maximum > 0) {
            const h = Math.max(UI.scrollThumbMin, height * height / contentHeight);
            this.graphics.drawRect(width - 6, 0, 4, height, C.paper);
            this.thumb.graphics.drawRect(0, 0, 4, h, C.timber); this.thumb.size(4, h); this.thumb.x = width - 6;
        }
        this.addChild(this.thumb); this.setOffset(initialOffset);
        this.clipRoot.on(Laya.Event.MOUSE_DOWN, this, this.beginDrag);
        this.clipRoot.on(Laya.Event.MOUSE_WHEEL, this, this.wheel);
        this.on(Laya.Event.UNDISPLAY, this, this.cancelDrag);
    }
    private setOffset(value: number) {
        this.offset = Math.max(0, Math.min(this.maximum, value)); this.content.y = -this.offset;
        this.thumb.y = this.maximum > 0 ? (this.height - this.thumb.height) * this.offset / this.maximum : 0;
        if (this.changed) this.changed(this.offset);
    }
    private beginDrag(e: Laya.Event) {
        if (this.touch !== null) return;
        this.touch = e.touchId;
        const p = Laya.InputManager.getTouchPos(this.touch), local = this.globalToLocal(new Laya.Point(p.x, p.y));
        this.startX = local.x; this.startY = local.y; this.startOffset = this.offset; this.dragging = false; this.pressedTarget = e.target;
        Laya.stage.on(Laya.Event.MOUSE_MOVE, this, this.moveDrag); Laya.stage.on(Laya.Event.MOUSE_UP, this, this.endDrag);
    }
    private moveDrag(e: Laya.Event) {
        if (this.touch === null || e.touchId !== this.touch) return;
        const p = Laya.InputManager.getTouchPos(this.touch), local = this.globalToLocal(new Laya.Point(p.x, p.y));
        if (!this.dragging && Math.hypot(local.x - this.startX, local.y - this.startY) >= UI.scrollDragThreshold) {
            this.dragging = true;
            // 在引擎生成 CLICK 前取消本手指点击；即便已到边界，拖动也不能误选条目。
            Laya.InputManager.cancelClick(this.touch);
            if (this.pressedTarget && !this.pressedTarget.destroyed) this.pressedTarget.event(Laya.Event.MOUSE_OUT);
        }
        if (this.dragging) this.setOffset(this.startOffset + this.startY - local.y);
    }
    private endDrag(e: Laya.Event) {
        if (this.touch === null || e.touchId !== this.touch) return;
        this.moveDrag(e); this.releaseDrag();
    }
    private cancelDrag() {
        if (this.touch !== null) Laya.InputManager.cancelClick(this.touch);
        this.releaseDrag();
    }
    private releaseDrag() {
        Laya.stage.off(Laya.Event.MOUSE_MOVE, this, this.moveDrag); Laya.stage.off(Laya.Event.MOUSE_UP, this, this.endDrag);
        this.touch = null; this.pressedTarget = null; this.dragging = false;
    }
    private wheel(e: Laya.Event) { if (this.maximum > 0) { this.setOffset(this.offset - e.delta * UI.scrollWheelStep); e.stopPropagation(); } }
    destroy(destroyChild = true) { this.cancelDrag(); super.destroy(destroyChild); }
}
