import { SpriteFrames } from "./SpriteFrames";
import { C, UI, PANEL_TEXT } from "./UiTheme";
import { drawUiGlyph } from "./UiGlyphs";
import { bindButtonClick } from "./ButtonFeedback";
import { amount, reasonBesideCost } from "./ViewText";
import { HUD } from "./config/HudConfig";

type Materials = { wood: number; food: number };
export type MaterialCost = Partial<Materials>;
const MATERIALS = ["wood", "food"] as const;
/** 同一套按钮/图文节点与触控约定；只绘制控件，不持有面板、存档或暂停状态。 */
export class UiWidgets {
    constructor(private art: SpriteFrames, private playClick: () => void) { }
    label(parent: Laya.Sprite, text: string, x: number, y: number, w: number, size: number = UI.body, color = C.ink, bold = false, h = 48): Laya.Text {
        const t = new Laya.Text();
        const onPanel = parent.name.startsWith("panel:") || parent.name.startsWith("guide:") || parent.name === "panelText";
        if (onPanel) {
            color = PANEL_TEXT[color] || color;
            for (const [ink, light] of Object.entries(PANEL_TEXT)) text = text.split(`color="${ink}"`).join(`color="${light}"`);
        }
        t.html = text.includes("<font ");
        t.text = text;
        t.font = "sans-serif";
        t.fontSize = Math.max(parent.name.startsWith("panel:") ? UI.body : UI.mapLabel, size);
        t.color = color;
        t.bold = bold;
        t.wordWrap = true;
        t.leading = 7;
        // 面板正文使用调用方的固定区或滚动区，避免长值穿过下一行。
        if (onPanel) t.overflow = Laya.Text.SHRINK;
        t.size(w, h);
        t.pos(x, y);
        const rgb = parseInt(color.slice(1), 16), light = ((rgb >> 16) * .299 + ((rgb >> 8) & 255) * .587 + (rgb & 255) * .114) > 165;
        // 高清纸面正文不描边；浅色按钮字仅留轻边，地图标签在各自调用处保留独立描边。
        t.stroke = light ? .6 : 0;
        t.strokeColor = light ? C.outline : C.lightEdge;
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
    /** 有效图形用图集 alpha 裁框，文字取当前字体的实际字形上下沿。旧 Canvas 没提供字形边界时采用其排版行中心。 */
    private glyphInk(text: Laya.Text) {
        const ctx = Laya.Browser?.context;
        if (!ctx) return { offset: 0, height: text.fontSize };
        ctx.save();
        ctx.font = `${text.bold ? "bold " : ""}${text.fontSize}px ${text.font}`;
        ctx.textBaseline = "middle";
        const ink = ctx.measureText(text.text.replace(/<[^>]+>/g, "")), line = ctx.measureText("g有");
        ctx.restore();
        if (!(ink.actualBoundingBoxAscent + ink.actualBoundingBoxDescent > 0))
            return { offset: 0, height: text.fontSize };
        const offset = (ink.actualBoundingBoxDescent - ink.actualBoundingBoxAscent - line.actualBoundingBoxDescent + line.actualBoundingBoxAscent) / 2;
        return { offset, height: ink.actualBoundingBoxAscent + ink.actualBoundingBoxDescent };
    }
    iconValue(parent: Laya.Sprite, id: string, value: string, x: number, y: number, width: number, height: number, color = C.ink, font = 28, align: "left" | "center" = "center") {
        const group = new Laya.Sprite(); group.name = `readout:${id}`; group.pos(x, y).size(width, height); parent.addChild(group);
        const text = this.label(group, value, 0, 0, width, font, color, true, height);
        text.name = "readoutText"; text.wordWrap = false; text.valign = "middle"; text.overflow = Laya.Text.SHRINK;
        text.fontSize = font;
        const gap = 8, ink = this.glyphInk(text), size = Math.max(24, Math.min(height - 6, ink.height + 4));
        const frame = this.art.contentBounds(id).rect;
        const iconWidth = Math.min(size * 1.35, size * frame.w / frame.h);
        const textWidth = Math.min(width - iconWidth - gap, Math.ceil(text.textWidth) + 4);
        const left = align === "left" ? 0 : (width - iconWidth - gap - textWidth) / 2;
        const icon = this.image(group, id, left, (height - size) / 2 + ink.offset, iconWidth, size);
        icon.name = "readoutIcon";
        text.x = left + iconWidth + gap; text.width = textWidth;
        return icon;
    }
    materialCosts(parent: Laya.Sprite, owned: Materials, cost: MaterialCost, x: number, y: number, width: number, height: number) {
        const active = MATERIALS.filter(key => cost[key] !== undefined);
        for (const [i, key] of active.entries()) {
            const required = cost[key]!, short = owned[key] < required, cell = width / active.length;
            this.iconValue(parent, `icon_${key}`, short ? `${amount(owned[key], true)}/${required}` : String(required),
                x + i * cell, y, cell, height, short ? C.red : C.timber, 25, "left");
        }
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
        icon.y = text.y + (text.height - icon.height) / 2 + this.glyphInk(text).offset;
        text.x = left + icon.width + gap; text.width = textWidth;
        text.wordWrap = false; text.overflow = Laya.Text.SHRINK;
    }
    /** 操作提醒放在图文层上，按压时跟随按钮，尺寸由 HUD 和面板共用。 */
    actionBadge(button: Laya.Sprite, name: string) {
        const face = button.getChildByName("buttonFace") as Laya.Sprite, { size, inset } = HUD.actionDot;
        const badge = this.image(face, "icon_action_dot", button.width - inset - size / 2, inset - size / 2, size);
        badge.name = name;
        return badge;
    }
    /** 图片含字，统一挂在按钮右上角；名单条目同时给文本预留标签宽度。 */
    personRibbon(button: Laya.Sprite, frame: "tag_recommended" | "tag_favorite", listRow = false) {
        const face = button.getChildByName("buttonFace") as Laya.Sprite, width = listRow ? 110 : 94;
        const ribbon = this.image(face, frame, button.width - width - 10, listRow ? 7 : -10, width, 34);
        ribbon.name = frame;
        if (listRow) {
            const copy = face.getChildByName("buttonText") as Laya.Text;
            copy.width = ribbon.x - copy.x - 6;
            copy.wordWrap = false; copy.overflow = Laya.Text.SHRINK;
        }
    }
    /** 建设条目共用图标、效果和材料布局；整个条目可点，原因直接可见，不再靠点击后弹Tip解释。 */
    buildRow(parent: Laya.Sprite, y: number, icon: string, title: string, effect: string, owned: Materials, cost: MaterialCost | null, reason: string | null, action: () => void, caption = "升级") {
        const row = this.button(parent, "", 0, y, UI.contentWidth - UI.scrollGutter, action, C.muted, UI.buildRowHeight, !reason, true);
        const face = row.getChildAt(0) as Laya.Sprite;
        const frame = new Laya.Sprite(); frame.pos(12, (UI.buildRowHeight - 150) / 2);
        this.art.panel(frame, reason ? "panel_card_disabled" : "panel_portrait_frame", 150, 150);
        frame.mouseEnabled = false; face.addChild(frame);
        this.image(frame, icon, 5, 5, 140).alpha = reason ? .55 : 1;
        const copyWidth = 254, badgeWidth = 132, badgeHeight = 62;
        const titleText = this.label(face, title, 171, 14, copyWidth, 28, C.ink, true, 40);
        titleText.wordWrap = false; titleText.overflow = Laya.Text.SHRINK;
        const effectText = this.label(face, effect, 171, 56, copyWidth, 25, C.green, false, 36);
        effectText.wordWrap = false; effectText.overflow = Laya.Text.SHRINK;
        if (cost) this.materialCosts(face, owned, cost, 171, 96, copyWidth, 38);
        const note = reasonBesideCost(reason);
        if (note) {
            const label = this.label(face, note, 171, 138, copyWidth, 24, C.red, false, 34);
            label.wordWrap = false; label.overflow = Laya.Text.SHRINK;
        }
        const badge = new Laya.Sprite(); badge.pos(row.width - badgeWidth - 16, (row.height - badgeHeight) / 2); badge.mouseEnabled = false;
        badge.name = "BuildAction";
        this.art.panel(badge, reason ? "panel_button_disabled" : "panel_button_gold", badgeWidth, badgeHeight); face.addChild(badge);
        this.label(badge, reason ? "未满足" : caption, 8, 8, badgeWidth - 16, 28, reason ? C.muted : C.ink, true, badgeHeight - 16).align = "center";
        return row;
    }
    /** 村民与家庭共用图文条目：头像留独立区域，文字不挤进边框，滚动仍由ScrollList取消误触。 */
    listItem(parent: Laya.Sprite, title: string, icon: string, y: number, action: () => void, enabled: boolean, height: number = UI.listHeight) {
        const row = this.button(parent, title, 0, y, UI.contentWidth - UI.scrollGutter, action, C.muted, height, enabled, true);
        const face = row.getChildAt(0) as Laya.Sprite;
        const text = face.getChildByName("buttonText") as Laya.Text;
        text.pos(134, 14);
        text.size(enabled ? 390 : 428, height - 28);
        text.align = "left";
        text.fontSize = 28;
        text.leading = 6;
        text.wordWrap = false;
        text.overflow = Laya.Text.SHRINK;
        const frame = new Laya.Sprite();
        frame.pos(14, (height - 104) / 2);
        this.art.panel(frame, "panel_portrait_frame", 104, 104);
        frame.mouseEnabled = false;
        face.addChild(frame);
        this.image(frame, icon, 2, 2, 100).alpha = enabled ? 1 : .5;
        if (enabled) this.label(face, "›", row.width - 60, height - 60, 48, 40, C.ink, true, 45).align = "center";
        return row;
    }
    /** 面板独立操作沿用原按钮的皮肤、红点与按压层。较长文案在可用宽度内自适应字号。 */
    centerButton(parent: Laya.Sprite, title: string, y: number, action: () => void, color = C.green, enabled = true,
        width: number = UI.action.width, height: number = UI.action.height) {
        const button = this.button(parent, title, (parent.width - width) / 2, y, width, action, color, height, enabled);
        const text = button.getChildByName("buttonFace").getChildByName("buttonText") as Laya.Text;
        text.wordWrap = false;
        text.overflow = Laya.Text.SHRINK;
        return button;
    }
    /** 有效点击保留原事件坐标，供民房交叠区域选择前景目标；取消点击和音效仍走同一入口。 */
    bindClick(target: Laya.Sprite, action: (event: Laya.Event) => void, face?: Laya.Sprite) {
        bindButtonClick(target, event => { this.playClick(); action(event); }, face);
    }
    button(parent: Laya.Sprite, title: string, x: number, y: number, w: number, action: () => void, color = C.green, h = 72, enabled = true, card = false) {
        const b = new Laya.Sprite();
        b.name = `button:${title}`;
        b.size(w, h);
        b.pos(x, y);
        const skin = !enabled ? "panel_button_disabled" : color === C.gold ? "panel_button_gold" : color === C.red ? "panel_button_red" : "panel_button_green";
        // 底板、文字及调用方附加的图标共用面层，整体按压；外层点击区域始终固定。
        const face = new Laya.Sprite();
        face.name = "buttonFace";
        face.mouseEnabled = false;
        if (card) this.art.panel(face, enabled ? "panel_card" : "panel_card_disabled", w, h);
        else this.art.panel(face, skin, w, h);
        b.addChild(face);
        if (title) {
            // 家庭说明/迎接按钮只有50～54高，不能继续扣掉普通按钮的28px纵向留白。
            const insetY = h < 48 ? 4 : h <= 60 ? 8 : 14;
            const textColor = !enabled ? C.muted : C.ink;
            const t = this.label(face, title, 16, insetY, w - 32, h <= 60 ? 26 : UI.button, textColor, true, h - insetY * 2);
            t.name = "buttonText";
            t.align = "center";
            t.valign = "middle";
            t.leading = 3;
            // 显式换行仍用于名单的两行内容，普通按钮文案按内框适配。
            t.wordWrap = false;
            t.overflow = Laya.Text.SHRINK;
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
