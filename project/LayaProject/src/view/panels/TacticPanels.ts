import { KING_MERCY_TACTIC, TACTIC_NIGHT_USES, TACTIC_SLOTS, TACTIC_USE, tacticDefinition } from "../../config/TacticConfig";
import { RULE } from "../../config/RuleConfig";
import { GameState } from "../../game/GameState";
import { mercyOffering, slotUnavailableReason, tacticRevealed } from "../../game/Tactics";
import { actionHintsBlocked } from "../ActionHints";
import { ScrollList } from "../ScrollList";
import { C, UI } from "../UiTheme";
import { TACTIC_UI as V } from "../config/TacticUiConfig";
import { drawTacticCatalog, drawTacticOverview, drawTacticSwap } from "./TacticLoadoutPanels";
import { Panel, PanelContext } from "./PanelContext";

export function drawMercyConfirm(ctx: PanelContext, s: GameState) {
    const v = V.mercy, contentWidth = v.width - 2 * v.inset, cost = mercyOffering(s);
    const height = v.footerY + UI.action.pairHeight + UI.action.bottom;
    const box = ctx.modal(tacticDefinition(KING_MERCY_TACTIC).name, "", false, { width: v.width, height });
    ctx.ui.label(box, "你可愿奉旭勇为文明里村的大王？", v.inset, v.questionY, contentWidth, 29, C.cream, true, 40).align = "center";
    ctx.ui.label(box, "献出当前一半粮木。\n大王将击败在场敌军，修满城门。", v.inset, v.effectY, contentWidth, 26, C.cream, false, v.effectH).align = "center";
    const materials = new Laya.Sprite(), cell = contentWidth / 2, readoutY = (v.costH - v.readoutH) / 2;
    materials.pos(v.inset, v.costY); box.addChild(materials);
    ctx.art.panel(materials, "panel_card", contentWidth, v.costH);
    ctx.ui.iconValue(materials, "icon_wood", cost.wood ? `−${cost.wood}` : "0", 0, readoutY, cell, v.readoutH, cost.wood ? C.ink : C.red, 29);
    ctx.ui.iconValue(materials, "icon_food", cost.food ? `−${cost.food}` : "0", cell, readoutY, cell, v.readoutH, cost.food ? C.ink : C.red, 29);
    if (cost.reason) ctx.ui.label(box, cost.reason, v.inset, v.reasonY, contentWidth, 24, C.red, true, 32).align = "center";
    ctx.ui.button(box, "暂缓", v.cancelX, v.footerY, v.cancelW, () => ctx.close(), C.muted, UI.action.pairHeight);
    ctx.ui.button(box, "确认奉王", v.confirmX, v.footerY, v.confirmW,
        () => ctx.game.confirmMercy(), C.gold, UI.action.pairHeight, cost.reason === null);
}

export function drawTacticPanel(ctx: PanelContext, s: GameState, p: Panel, available: number) {
    if (p.type === "tactics") return drawTacticOverview(ctx, s, p, available);
    if (p.type === "tacticSwap") return drawTacticSwap(ctx, s, p, available);
    if (p.type === "tacticCatalog") return drawTacticCatalog(ctx, s, p, available);
    if (p.type === "tacticSlotUnlock") {
        const index = p.index!, cost = TACTIC_SLOTS[index - 1], reason = slotUnavailableReason(s, index);
        const v = V.unlock, contentWidth = v.width - 2 * UI.inset;
        const box = ctx.modal(`解锁第 ${index + 1} 槽`, "", false,
            { width: v.width, height: v.footerY + UI.action.pairHeight + UI.action.bottom });
        const casts = TACTIC_NIGHT_USES[index];
        const benefit = casts > TACTIC_NIGHT_USES[index - 1] ? `可多带一个战技 · 每夜共 ${casts} 次` : "守夜可多带一个战技";
        ctx.ui.label(box, benefit, UI.inset, v.conditionY, contentWidth, 27, C.cream, true, 42).align = "center";
        ctx.ui.label(box, `守住 ${cost.unlockWaves} 波后可解锁`, UI.inset, v.conditionY + 42, contentWidth, 24, C.cream, false, 36).align = "center";
        const materials = new Laya.Sprite();
        materials.pos(UI.inset, v.costY); box.addChild(materials);
        ctx.art.panel(materials, "panel_card", contentWidth, 46);
        ctx.ui.materialCosts(materials, s, cost, 90, 1, 310, 44);
        if (reason) ctx.ui.label(box, reason, UI.inset, v.reasonY, contentWidth, 24, C.red, false, 30).align = "center";
        ctx.ui.button(box, "取消", v.cancelX, v.footerY, v.cancelW, () => ctx.open(p.back!, true), C.muted, UI.action.pairHeight);
        ctx.ui.button(box, "确认解锁", v.confirmX, v.footerY, v.confirmW, () => {
            if (ctx.current !== p) return;
            p.pendingSlotUnlock = index;
            ctx.send({ type: "TACTIC_UNLOCK_SLOT", slot: index });
        }, C.gold, UI.action.pairHeight, !actionHintsBlocked(ctx.game) && !reason);
        return;
    }
    const t = tacticDefinition(p.id!), revealed = tacticRevealed(s, t.id), learned = s.tactics.learned.includes(t.id);
    const loreTitle = t.effect === "ZHOU_LOVE" || t.effect === "DRAGON_POISON" ? "村中密闻" : "村中传闻";
    const { top, width, inset, icon, loreTop, gap } = V.detail;
    const paper = new Laya.Sprite(); paper.pos(UI.inset, top);
    const textWidth = width - 2 * inset;
    if (revealed) {
        const textX = inset + icon + gap, effectWidth = width - textX - inset;
        ctx.ui.image(paper, t.icon, inset, inset, icon);
        ctx.ui.label(paper, t.name, textX, 16, effectWidth, 34, C.ink, true, 44);
        const summary = ctx.ui.label(paper, t.summary, textX, 57, effectWidth, 25, C.green, false, 62);
        if (t.effect === "ZHOU_LOVE" || t.effect === "DRAGON_POISON") summary.leading = 0;
        const cooldown = t.usesPerNight > 1 ? ` · 冷却 ${TACTIC_USE.cooldownTicks * RULE.step} 秒` : "";
        const waves = s.tactics.mercyCooldown?.wavesLeft ?? 0;
        const timing = t.effect === "KING_MERCY" ? (waves ? `冷却中 · 再守 ${waves} 波` : "按守住波数冷却") : `每夜 ${t.usesPerNight} 次${cooldown}`;
        ctx.ui.label(paper, timing, textX, 117, effectWidth, 24, C.muted, false, 36);
        ctx.ui.label(paper, loreTitle, inset, loreTop - 8, textWidth, 27, C.timber, true, 40);
    }
    const lore = ctx.ui.label(paper, t.lore, inset, revealed ? loreTop + 39 : inset, textWidth, 28, C.ink, false, UI.panelHeight);
    lore.name = "TacticLore";
    if (t.effect === "ZHOU_LOVE") lore.align = "center";
    lore.height = Math.ceil(lore.textHeight) + 4;
    let paperHeight = lore.y + lore.height + inset;
    if (revealed && !learned) {
        const costTop = paperHeight - inset + gap;
        ctx.ui.label(paper, "学习费用", inset, costTop, 140, 26, C.timber, true, 40);
        ctx.ui.materialCosts(paper, s, t, inset + 152, costTop, textWidth - 152, 40);
        paperHeight = costTop + 40 + inset;
    }
    ctx.art.panel(paper, "panel_card", width, paperHeight);
    const height = Math.min(top + paperHeight + UI.action.bottom, available - UI.action.bottom);
    const box = ctx.modal(revealed ? "战技详情" : loreTitle, "", true, { width: UI.panelWidth, height });
    if (p.back) ctx.ui.button(box, "‹", 30, 32, 54, () => ctx.open(p.back!, true), C.muted, 54);
    if (top + paperHeight + UI.action.bottom <= height) box.addChild(paper);
    else {
        const list = new ScrollList(UI.contentWidth, height - top - UI.action.bottom, paperHeight, p.scroll, y => p.scroll = y);
        list.pos(UI.inset, top); box.addChild(list);
        list.content.addChild(paper.pos(0, 0));
    }
}
