import type { GameState } from "../../game/GameState";
import { actionHintsBlocked } from "../ActionHints";
import { C, UI } from "../UiTheme";
import { amount } from "../ViewText";
import type { Panel, PanelContext } from "./PanelContext";

/** 纯色卡片中的插画衬底，尺寸用逻辑像素。留足描边，不改变图片或交互热区。 */
export function cardArt(ctx: PanelContext, parent: Laya.Sprite, image: string, x: number, y: number, width: number, height = width, tint = C.petal) {
    const radius = Math.min(33, width * .24, height * .24);
    parent.graphics.drawRoundRect(x + 3, y + 3, width - 6, height - 6, radius, radius, radius, radius, tint, C.trim, 1.5);
    return ctx.ui.image(parent, image, x + 5, y + 5, width - 10, height - 10);
}

export function drawSpendConfirm(ctx: PanelContext, s: GameState, p: Panel) {
    const spend = p.spend!, width = 586, keys = (["wood", "food"] as const).filter(key => !!spend[key]);
    const artY = 118, artSize = 150, wordsY = 278, materialY = spend.detail ? 357 : wordsY;
    const materialHeight = keys.length ? 112 : 0;
    const quantityY = materialY + materialHeight;
    const footer = quantityY + (spend.quantity ? 63 : 25);
    const box = ctx.modal(spend.title, "", false, { width, height: footer + UI.action.pairHeight + UI.action.bottom });
    cardArt(ctx, box, spend.image, (width - artSize) / 2, artY, artSize);
    if (spend.detail) {
        const text = ctx.ui.label(box, spend.detail, 34, wordsY, width - 68, 28, C.ink, true, 67);
        text.align = "center"; text.valign = "middle";
    }
    const gap = 14, tileWidth = keys.length === 1 ? 320 : 246;
    const origin = (width - keys.length * tileWidth - gap * (keys.length - 1)) / 2;
    keys.forEach((key, i) => {
        const tile = box.addChild(new Laya.Sprite()).pos(origin + i * (tileWidth + gap), materialY).size(tileWidth, 106);
        ctx.art.panel(tile, "panel_card", tileWidth, 106);
        ctx.ui.image(tile, `icon_${key}`, (tileWidth - 43) / 2, 10, 43);
        const required = spend[key]!, short = s[key] < required;
        const value = ctx.ui.label(tile, amount(required, true),
            12, 54, tileWidth - 24, 35, short ? C.red : C.ink, true, 43);
        value.align = "center"; value.wordWrap = false; value.overflow = Laya.Text.SHRINK;
    });
    if (spend.quantity)
        ctx.ui.label(box, spend.quantity, 34, quantityY + 3, width - 68, 26, C.muted, true, 44).align = "center";
    ctx.ui.button(box, "取消", 61, footer, 180, () => ctx.open(p.back!, true), C.muted, UI.action.pairHeight);
    const ready = s.phase === "DAY" && !actionHintsBlocked(ctx.game) && keys.every(key => s[key] >= spend[key]!);
    const confirm = ctx.ui.button(box, spend.actionText, 263, footer, 262, spend.commit, C.gold, UI.action.pairHeight, ready);
    if (ready && spend.showBadge) ctx.ui.actionBadge(confirm, "SpendConfirmActionHint");
}
