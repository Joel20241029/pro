import { SpriteFrames } from "./SpriteFrames";
import { C, UI, PANEL_TEXT } from "./UiTheme";
import { drawUiGlyph } from "./UiGlyphs";
/** 同一套按钮/图文节点与触控约定；只绘制控件，不持有面板、存档或暂停状态。 */
export class UiWidgets {
    constructor(private art: SpriteFrames, private playClick: () => void) { }
    label(parent: Laya.Sprite, text: string, x: number, y: number, w: number, size: number = UI.body, color = C.ink, bold = false, h = 48): Laya.Text {
        const t = new Laya.Text();
        const onPanel = parent.name.startsWith("panel:") || parent.name.startsWith("guide:") || parent.name === "panelText";
        if (onPanel) {
            color = PANEL_TEXT[color] || color;
            for (const [ink, light] of Object.entries(PANEL_TEXT)) text = text.split(`color="${ink}"`).join(`color="${light}"`);
            text = text.split(`strokecolor="${C.lightEdge}"`).join('strokecolor="#334f1c"');
        }
        t.html = text.includes("<font ");
        t.text = text;
        t.font = "sans-serif";
        t.fontSize = Math.max(parent.name.startsWith("panel:") ? UI.body : UI.mapLabel, size);
        t.color = color;
        t.bold = bold;
        t.wordWrap = true;
        t.leading = 7;
        t.size(w, h);
        t.pos(x, y);
        const rgb = parseInt(color.slice(1), 16), light = ((rgb >> 16) * .299 + ((rgb >> 8) & 255) * .587 + (rgb & 255) * .114) > 165;
        // 高清纸面正文不描边；浅色按钮字仅留轻边，地图标签在各自调用处保留独立描边。
        t.stroke = onPanel ? 1 : light ? .6 : 0;
        t.strokeColor = onPanel ? "#334f1c" : light ? C.outline : C.lightEdge;
        t.valign = h <= 60 ? "middle" : "top";
        t.mouseEnabled = false;
        parent.addChild(t);
        return t;
    }
    image(parent: Laya.Sprite, id: string, x: number, y: number, w: number, h = w, fitContent = true) {
        const s = new Laya.Sprite();
        // 播放等通用符号用原生矢量；题材图标、头像、建筑统一读取高清图集。
        if (!drawUiGlyph(s, id, w, h)) {
            // 世界的软影/树冠点缀按原母画布配置，不能套用图标的可见框铺满规则。
            if (!fitContent) s.texture = this.art.get(id);
            else {
            const f = this.art.contentBounds(id), fit = Math.min(w / f.rect.w, h / f.rect.h);
            const content = new Laya.Sprite();
            content.texture = this.art.get(id);
            content.size(f.sourceSize.w * fit, f.sourceSize.h * fit);
            content.pos((w - f.rect.w * fit) / 2 - f.trimOffset.x * fit, (h - f.rect.h * fit) / 2 - f.trimOffset.y * fit);
            content.mouseEnabled = false; s.addChild(content);
            }
        }
        s.pos(x, y); s.size(w, h); s.mouseEnabled = false; parent.addChild(s); return s;
    }
    /** 图标与文案共享按压面层；内容变化时仍以实际字宽居中，不依赖固定文字位置。 */
    buttonIcon(button: Laya.Sprite, id: string, size = 40) {
        const face = button.getChildByName("buttonFace") as Laya.Sprite;
        const icon = this.image(face, id, 0, (button.height - size) / 2, size);
        icon.name = "buttonIcon";
        this.alignButtonIcon(face);
    }
    alignButtonIcon(face: Laya.Sprite) {
        const text = face.getChildByName("buttonText") as Laya.Text;
        const icon = face.getChildByName("buttonIcon") as Laya.Sprite;
        if (!text || !icon) return;
        const width = (face.parent as Laya.Sprite).width, gap = 7;
        const textWidth = Math.min(Math.ceil(text.textWidth) + 4, width - icon.width - gap - 24);
        const left = (width - icon.width - gap - textWidth) / 2;
        icon.x = left;
        text.x = left + icon.width + gap; text.width = textWidth;
        text.wordWrap = false; text.overflow = Laya.Text.SHRINK;
    }
    /** 建设条目共用图标、效果和材料布局；整个条目可点，原因直接可见，不再靠点击后弹Tip解释。 */
    buildRow(parent: Laya.Sprite, y: number, icon: string, title: string, effect: string, cost: string, reason: string | null, action: () => void, caption = "升级") {
        const row = this.button(parent, "", 0, y, 584, action, C.muted, 208, !reason);
        const face = row.getChildAt(0) as Laya.Sprite;
        const frame = new Laya.Sprite(); frame.pos(20, 22);
        this.art.panel(frame, reason ? "panel_card_disabled" : "panel_portrait_frame", 102, 102);
        frame.mouseEnabled = false; face.addChild(frame);
        this.image(frame, icon, 8, 8, 86).alpha = reason ? .55 : 1;
        const titleText = this.label(face, title, 140, 16, 420, 30, C.ink, true, 42);
        titleText.wordWrap = false; titleText.overflow = Laya.Text.SHRINK;
        const effectText = this.label(face, effect, 140, 58, 420, 26, C.green, false, 36);
        effectText.wordWrap = false; effectText.overflow = Laya.Text.SHRINK;
        // 费用与原因独立显示，不根据“缺/不足”等文案反推状态。
        this.label(face, cost, 140, 96, 420, 24, C.timber, false, 34);
        const note = this.label(face, reason || "材料齐备，可以操作", 24, 138, 416, 24, reason ? C.red : C.green, false, 58);
        note.valign = "middle";
        const badge = new Laya.Sprite(); badge.pos(452, 148); badge.mouseEnabled = false;
        this.art.panel(badge, reason ? "panel_button_disabled" : "panel_button_green", 110, 44); face.addChild(badge);
        this.label(badge, reason ? "未满足" : caption, 9, 5, 92, 24, C.cream, true, 34).align = "center";
        return row;
    }
    /** 村民与家庭共用图文条目：头像留独立区域，文字不挤进边框，滚动仍由ScrollList取消误触。 */
    listItem(parent: Laya.Sprite, title: string, icon: string, y: number, action: () => void, enabled: boolean, height: number = UI.listHeight) {
        const row = this.button(parent, title, 0, y, UI.contentWidth - UI.scrollGutter, action, C.muted, height, enabled);
        const face = row.getChildAt(0) as Laya.Sprite;
        const text = face.getChildByName("buttonText") as Laya.Text;
        text.pos(116, 14);
        text.size(446, height - 28);
        text.align = "left";
        text.fontSize = 28;
        text.leading = 6;
        const frame = new Laya.Sprite();
        frame.pos(20, 15);
        this.art.panel(frame, "panel_portrait_frame", 88, 88);
        frame.mouseEnabled = false;
        face.addChild(frame);
        this.image(frame, icon, 4, 4, 80).alpha = enabled ? 1 : .5;
        return row;
    }
    /** 有效点击保留原事件坐标，供民房交叠区域选择前景目标；取消点击和音效仍走同一入口。 */
    bindClick(target: Laya.Sprite, action: (event: Laya.Event) => void, face?: Laya.Sprite) {
        const pressed = new Set<number>();
        target.mouseEnabled = true;
        target.on(Laya.Event.MOUSE_DOWN, this, (e: Laya.Event) => {
            pressed.add(e.touchId);
            if (face)
                face.y = UI.pressedOffset;
        });
        const release = () => {
            if (face && !pressed.size)
                face.y = 0;
        };
        target.on(Laya.Event.MOUSE_UP, this, (e: Laya.Event) => { pressed.delete(e.touchId); release(); });
        target.on(Laya.Event.MOUSE_OUT, this, (e?: Laya.Event) => {
            // ScrollList 手动发送无事件参数的 MOUSE_OUT 前已取消其拖动手指。
            if (!e) {
                if (face)
                    face.y = 0;
                return;
            }
            // 引擎短距离移出仍可能以按下目标生成 CLICK。只取消曾在此按下的手指。
            if (pressed.delete(e.touchId)) {
                Laya.InputManager.cancelClick(e.touchId);
                release();
            }
        });
        target.on(Laya.Event.UNDISPLAY, this, () => { pressed.clear(); release(); });
        target.on(Laya.Event.CLICK, this, (event: Laya.Event) => { this.playClick(); action(event); });
    }
    button(parent: Laya.Sprite, title: string, x: number, y: number, w: number, action: () => void, color = C.green, h = 72, enabled = true) {
        const b = new Laya.Sprite();
        b.name = `button:${title}`;
        b.size(w, h);
        b.pos(x, y);
        const skin = color === C.muted ? (enabled ? "panel_card" : "panel_card_disabled") : !enabled ? "panel_button_disabled" : color === C.gold ? "panel_button_gold" : color === C.red ? "panel_button_red" : "panel_button_green";
        // 底板、文字及调用方附加的图标共用面层，整体按压；外层点击区域始终固定。
        const face = new Laya.Sprite();
        face.name = "buttonFace";
        face.mouseEnabled = false;
        this.art.panel(face, skin, w, h);
        b.addChild(face);
        if (title) {
            // 家庭说明/迎接按钮只有50～54高，不能继续扣掉普通按钮的28px纵向留白。
            const insetY = h <= 60 ? 8 : 14;
            const textColor = !enabled ? color === C.muted ? C.muted : C.cream : color === C.gold || color === C.muted ? C.ink : C.cream;
            const t = this.label(face, title, 16, insetY, w - 32, h <= 60 ? 26 : UI.button, textColor, true, h - insetY * 2);
            t.name = "buttonText";
            t.align = "center";
            t.valign = "middle";
            t.leading = 3;
            // 小尺寸关闭按钮只有一个符号，按实际边框留白；其余按钮正文不进入固定14px边缘。
            if (w < 80) {
                t.fontSize = 24;
                t.pos(10, 8);
                t.size(w - 20, h - 16);
            }
        }
        if (enabled)
            this.bindClick(b, action, face);
        parent.addChild(b);
        return b;
    }
}
