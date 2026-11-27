import { KING_MERCY_TACTIC, TACTIC_SLOTS, tacticDefinition } from "../../config/TacticConfig";
import { GameState } from "../../game/GameState";
import { mercyOffering, slotUnavailableReason } from "../../game/Tactics";
import { actionHintsBlocked } from "../ActionHints";
import { C, UI } from "../UiTheme";
import { TACTIC_UI as V } from "../config/TacticUiConfig";
import { drawTacticOverview } from "./TacticLoadoutPanels";
import { Panel, PanelContext } from "./PanelContext";

export function drawMercyConfirm(ctx: PanelContext, s: GameState) {
    const v = V.mercy, contentWidth = v.width - 2 * v.inset, cost = mercyOffering(s);
    const tactic = tacticDefinition(KING_MERCY_TACTIC), iconSize = 104, portraitSpace = iconSize + 15, footerY = v.footerY + portraitSpace;
    const height = footerY + UI.action.pairHeight + UI.action.bottom;
    const box = ctx.modal(tactic.name, "", false, { width: v.width, height });
    const portrait = new Laya.Sprite(); portrait.pos((v.width - iconSize) / 2, v.questionY); box.addChild(portrait);
    ctx.art.panel(portrait, "panel_portrait_frame", iconSize, iconSize);
    ctx.ui.image(portrait, tactic.icon, 7, 7, iconSize - 14);
    ctx.ui.label(box, "愿奉旭勇为文明里村的外卖大王？", v.inset, v.questionY + portraitSpace, contentWidth, 28, C.cream, true, 40).align = "center";
    ctx.ui.label(box, "献出当前一半尔币。\n大王接下急单，清敌并修满城门。", v.inset, v.effectY + portraitSpace, contentWidth, 26, C.cream, false, v.effectH).align = "center";
    const materials = new Laya.Sprite(), cell = contentWidth, readoutY = (v.costH - v.readoutH) / 2;
    materials.pos(v.inset, v.costY + portraitSpace); box.addChild(materials);
    ctx.art.panel(materials, "panel_card", contentWidth, v.costH);
    ctx.ui.iconValue(materials, "icon_coin", cost.coins ? `−${cost.coins}` : "0", 0, readoutY, cell, v.readoutH,
        cost.reason ? C.red : C.ink, 29);
    if (cost.reason) ctx.ui.label(box, cost.reason, v.inset, v.reasonY + portraitSpace, contentWidth, 24, C.red, true, 32).align = "center";
    ctx.ui.button(box, "暂缓", v.cancelX, footerY, v.cancelW, () => ctx.close(), C.muted, UI.action.pairHeight);
    ctx.ui.button(box, "确认奉王", v.confirmX, footerY, v.confirmW,
        () => ctx.game.confirmMercy(), C.gold, UI.action.pairHeight, cost.reason === null);
}

export function drawTacticPanel(ctx: PanelContext, s: GameState, p: Panel, available: number) {
    if (p.type === "tactics") return drawTacticOverview(ctx, s, p, available);
    if (p.type === "tacticSlotUnlock") {
        const index = p.index!, cost = TACTIC_SLOTS[index - 1], reason = slotUnavailableReason(s, index);
        const v = V.unlock, contentWidth = v.width - 2 * UI.inset, iconSize = 84, portraitSpace = iconSize + 14;
        const footerY = v.footerY + portraitSpace;
        const box = ctx.modal(`解锁第 ${index + 1} 槽`, "", false,
            { width: v.width, height: footerY + UI.action.pairHeight + UI.action.bottom });
        const portrait = new Laya.Sprite(); portrait.pos((v.width - iconSize) / 2, v.conditionY); box.addChild(portrait);
        ctx.art.panel(portrait, "panel_portrait_frame", iconSize, iconSize);
        ctx.ui.image(portrait, "icon_slot_lock", 12, 12, iconSize - 24);
        const benefit = "守夜可多带一个战技";
        ctx.ui.label(box, benefit, UI.inset, v.conditionY + portraitSpace, contentWidth, 27, C.cream, true, 42).align = "center";
        ctx.ui.label(box, `守住 ${cost.unlockWaves} 波后可解锁`, UI.inset, v.conditionY + portraitSpace + 42, contentWidth, 24, C.cream, false, 36).align = "center";
        const materials = new Laya.Sprite();
        materials.pos(UI.inset, v.costY + portraitSpace); box.addChild(materials);
        ctx.art.panel(materials, "panel_card", contentWidth, 46);
        ctx.ui.coinCost(materials, s, cost, 90, 1, 310, 44);
        if (reason) ctx.ui.label(box, reason, UI.inset, v.reasonY + portraitSpace, contentWidth, 24, C.red, false, 30).align = "center";
        ctx.ui.button(box, "取消", v.cancelX, footerY, v.cancelW, () => ctx.open(p.back!, true), C.muted, UI.action.pairHeight);
        const canUnlock = !actionHintsBlocked(ctx.game) && !reason;
        const confirm = ctx.ui.button(box, "确认解锁", v.confirmX, footerY, v.confirmW, () => {
            if (ctx.current !== p) return;
            p.pendingSlotUnlock = index;
            ctx.send({ type: "TACTIC_UNLOCK_SLOT", slot: index });
        }, C.gold, UI.action.pairHeight, canUnlock);
        if (canUnlock) ctx.ui.actionBadge(confirm, "TacticSlotUnlockHint");
        return;
    }
}
