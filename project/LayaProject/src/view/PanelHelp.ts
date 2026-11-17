import { C } from "./UiTheme";
import { SpriteFrames } from "./SpriteFrames";
import { UiWidgets } from "./UiWidgets";

/** 问号只解释当前面板。遮罩留在面板内，关闭后保留原滚动和操作状态。 */
export function attachPanelHelp(box: Laya.Sprite, heading: Laya.Text, body: string, art: SpriteFrames, ui: UiWidgets) {
    const size = 48;
    const x = Math.min(box.width - 145, box.width / 2 + Math.min(heading.width, heading.textWidth) / 2 + 12);
    const toggle = ui.button(box, "?", x, 34, size, () => {
        const shield = new Laya.Sprite();
        shield.name = "PanelHelp";
        shield.size(box.width, box.height);
        shield.mouseEnabled = true; shield.mouseThrough = false;
        shield.graphics.drawRect(18, 17, box.width - 36, box.height - 34, "rgba(28,36,25,.66)");
        box.addChild(shield);
        const card = new Laya.Sprite(), width = Math.min(548, box.width - 70);
        shield.addChild(card);
        const text = ui.label(card, body, 27, 82, width - 54, 28, C.ink, false, 300);
        text.height = Math.ceil(text.textHeight) + 4;
        const height = Math.max(188, text.height + 112);
        art.panel(card, "panel_card", width, height);
        card.pos((box.width - width) / 2, (box.height - height) / 2);
        ui.label(card, "说明", 74, 18, width - 148, 33, C.ink, true, 56).align = "center";
        ui.button(card, "×", width - 70, 18, size, () => shield.destroy(true), C.red, size);
    }, C.gold, size);
    toggle.name = "PanelHelpButton";
}
