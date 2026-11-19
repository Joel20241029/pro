import { KING_MERCY_TACTIC, SUMMON_TACTIC, TACTICS, TACTIC_NIGHT_USES, TACTIC_SLOTS, TACTIC_USE, tacticDefinition } from "../../config/TacticConfig";
import { RULE } from "../../config/RuleConfig";
import { GameState } from "../../game/GameState";
import { equippedTactics, mercyOffering, slotUnavailableReason, tacticRevealed, tacticUnavailableReason } from "../../game/Tactics";
import { actionHintsBlocked } from "../ActionHints";
import { ScrollList } from "../ScrollList";
import { C, UI } from "../UiTheme";
import { reasonBesideCost } from "../ViewText";
import { TACTIC_UI as V } from "../config/TacticUiConfig";
import { SLOT_GUIDE_TEXT } from "../config/StarterGuideConfig";
import { drawGuideSpotlight } from "../StarterGuide";
import { Panel, PanelContext } from "./PanelContext";

/** 提交仍由会话统一保存；导航目标记在当前面板上，保存失败重试后也只在成功时返回。 */
function selectTactic(ctx: PanelContext, p: Panel, id: string, learned: boolean, slot: number) {
    p.pendingTactic = { id, slot };
    ctx.send({ type: learned ? "TACTIC_EQUIP" : "TACTIC_LEARN", id, slot });
}

export function drawMercyConfirm(ctx: PanelContext, s: GameState) {
    const v = V.mercy, contentWidth = v.width - 2 * v.inset, cost = mercyOffering(s);
    const box = ctx.modal(tacticDefinition(KING_MERCY_TACTIC).name, "", false, { width: v.width, height: v.height });
    ctx.ui.label(box, "你可愿奉旭勇为文明里村的大王？", v.inset, v.questionY, contentWidth, 29, C.cream, true, 40).align = "center";
    ctx.ui.label(box, "献出当前一半粮木。\n大王将击败在场敌军，修满城门。", v.inset, v.effectY, contentWidth, 26, C.cream, false, v.effectH).align = "center";
    const materials = new Laya.Sprite(), cell = contentWidth / 2, readoutY = (v.costH - v.readoutH) / 2;
    materials.pos(v.inset, v.costY); box.addChild(materials);
    ctx.art.panel(materials, "panel_card", contentWidth, v.costH);
    ctx.ui.iconValue(materials, "icon_wood", cost.wood ? `−${cost.wood}` : "0", 0, readoutY, cell, v.readoutH, cost.wood ? C.ink : C.red, 29);
    ctx.ui.iconValue(materials, "icon_food", cost.food ? `−${cost.food}` : "0", cell, readoutY, cell, v.readoutH, cost.food ? C.ink : C.red, 29);
    if (cost.reason) ctx.ui.label(box, cost.reason, v.inset, v.reasonY, contentWidth, 24, C.red, true, 32).align = "center";
    ctx.ui.button(box, "暂缓", v.inset, v.footerY, v.cancelW, () => ctx.close(), C.muted, v.buttonH);
    ctx.ui.button(box, "确认奉王", v.width - v.inset - v.confirmW, v.footerY, v.confirmW,
        () => ctx.game.confirmMercy(), C.gold, v.buttonH, cost.reason === null);
}

export function drawTacticPanel(ctx: PanelContext, s: GameState, p: Panel) {
    const blocked = actionHintsBlocked(ctx.game);
    const loadout = equippedTactics(s), slot = (p.type === "tactics" ? p : p.back)?.tacticSlot ?? 0;
    if (p.type === "tacticSlotUnlock") {
        const index = p.index!, cost = TACTIC_SLOTS[index - 1], reason = slotUnavailableReason(s, index);
        const v = V.unlock, contentWidth = v.width - 2 * UI.inset;
        const box = ctx.modal(`解锁第 ${index + 1} 槽`, "", false, { width: v.width, height: v.height });
        const casts = TACTIC_NIGHT_USES[index];
        const benefit = casts > TACTIC_NIGHT_USES[index - 1] ? `可多带一个战技 · 每夜共 ${casts} 次` : "守夜可多带一个战技";
        ctx.ui.label(box, benefit, UI.inset, v.conditionY, contentWidth, 27, C.cream, true, 42).align = "center";
        ctx.ui.label(box, `守住 ${cost.unlockWaves} 波后可解锁`, UI.inset, v.conditionY + 42, contentWidth, 24, C.cream, false, 36).align = "center";
        const materials = new Laya.Sprite();
        materials.pos(UI.inset, v.costY); box.addChild(materials);
        ctx.art.panel(materials, "panel_card", contentWidth, 46);
        ctx.ui.materialCosts(materials, s, cost, 90, 1, 310, 44);
        if (reason) ctx.ui.label(box, reason, UI.inset, v.reasonY, contentWidth, 24, C.red, false, 30).align = "center";
        ctx.ui.button(box, "取消", UI.inset, v.footerY, 152, () => ctx.open(p.back!, true), C.muted, v.buttonH);
        ctx.ui.button(box, "确认解锁", 202, v.footerY, v.width - 202 - UI.inset, () => {
            p.pendingSlotUnlock = index;
            ctx.send({ type: "TACTIC_UNLOCK_SLOT", slot: index });
        }, C.gold, v.buttonH, !blocked && !reason);
        return;
    }
    if (p.type === "tactics") {
        const count = TACTICS.length;
        const { slots, slotGuide } = V, actionY = slots.top + slots.actionY;
        const nextSlot = loadout.length, cost = TACTIC_SLOTS[nextSlot - 1];
        const showGuide = !!cost && !blocked && s.phase === "DAY" && s.completed >= cost.unlockWaves && !ctx.tacticSlotGuideDismissed;
        const guideY = actionY + slots.actionH + slotGuide.gap;
        const listTop = guideY + (showGuide ? slotGuide.height + slotGuide.gap : 0);
        const height = Math.min(UI.panelHeight, listTop + count * V.rowStep - 12 + V.footer);
        const box = ctx.modal("守村战技", "", true, { width: UI.panelWidth, height },
            `先选槽位，再携带战技。每夜共可施放 ${TACTIC_NIGHT_USES[loadout.length - 1]} 次。一次生效一个，结束后间隔 ${TACTIC_USE.recoveryTicks * RULE.step} 个战斗秒。`);
        for (let i = 0; i <= TACTIC_SLOTS.length; i++) {
            const id = loadout[i], x = slots.x + i * (slots.width + slots.gap);
            const tactic = id ? tacticDefinition(id) : null, opened = i < loadout.length, selected = i === slot;
            const button = ctx.ui.button(box, "", x, slots.top, slots.width, () => {
                if (!opened) { ctx.open({ type: "tacticSlotUnlock", index: i, back: p }); return; }
                p.tacticSlot = i; ctx.refresh();
            }, C.green, slots.size + slots.captionH);
            button.name = `TacticSlot:${i + 1}`;
            const face = button.getChildByName("buttonFace") as Laya.Sprite, center = slots.size / 2, midX = slots.width / 2;
            face.graphics.clear();
            face.graphics.drawCircle(midX, center, center - 2, opened ? "#567832" : "#45583a", selected ? "#ffd26a" : "#9c8647", selected ? 5 : 3);
            face.graphics.drawCircle(midX, center, center - 8, null, opened ? "#87a655" : "#647254", 2);
            const icon = ctx.ui.image(face, tactic?.icon ?? (opened ? "icon_build_plus" : "icon_slot_lock"),
                midX - slots.icon / 2, center - slots.icon / 2, slots.icon);
            icon.name = "TacticSlotIcon";
            const label = opened ? `槽 ${i + 1} · ${tactic?.buttonName ?? tactic?.name ?? "待装配"}` : `解锁第 ${i + 1} 槽`;
            const caption = ctx.ui.label(face, label, 0, slots.size, slots.width, 24, !opened || selected ? "#ffe4a2" : C.cream, selected || !opened, slots.captionH);
            caption.align = "center"; caption.wordWrap = false; caption.overflow = Laya.Text.SHRINK;
        }
        ctx.ui.label(box, `已开 ${loadout.length} 槽 · 每夜共 ${TACTIC_NIGHT_USES[loadout.length - 1]} 次`, slots.x, actionY, 395, 26, C.cream, true, slots.actionH);
        if (slot > 0 && loadout[slot]) ctx.ui.button(box, "卸下", 498, actionY, 136,
            () => ctx.send({ type: "TACTIC_CLEAR_SLOT", slot }), C.green, slots.actionH, !blocked && s.phase === "DAY");
        const rows = new ScrollList(UI.contentWidth, height - listTop - V.footer, count * V.rowStep - 12, p.scroll, y => p.scroll = y);
        rows.pos(34, listTop); box.addChild(rows);
        TACTICS.forEach((t, index) => {
            const id = t.id, card = new Laya.Sprite();
            card.pos(0, index * V.rowStep); card.size(584, V.rowHeight); rows.content.addChild(card);
            if (!tacticRevealed(s, id)) {
                card.name = "UnknownTactic";
                ctx.art.panel(card, "panel_card_disabled", 584, V.rowHeight);
                const mark = ctx.ui.label(card, "?", 16, 0, 116, 106, C.timber, true, V.rowHeight);
                mark.align = "center"; mark.valign = "middle"; mark.wordWrap = false;
                ctx.ui.label(card, "未知战技", 146, 32, 410, 32, C.ink, true, 48);
                ctx.ui.label(card, `守住 ${t.unlockWaves} 波后解锁`, 146, 77, 410, 27, C.muted, false, 38);
                ctx.ui.button(card, "查看传闻", V.actionX, V.actionY, V.actionWidth,
                    () => ctx.open({ type: "tactic", id, back: p }), C.green, V.actionHeight);
                return;
            }
            const learned = s.tactics.learned.includes(id), equipped = loadout.indexOf(id);
            const reason = tacticUnavailableReason(s, id, learned ? "EQUIP" : "LEARN", slot);
            card.name = `TacticCard:${id}`;
            ctx.art.panel(card, !learned && reason ? "panel_card_disabled" : "panel_card", 584, V.rowHeight);
            // 正文与操作按钮是同级命中节点，点学习不会冒泡成打开详情；拖动由ScrollList取消点击。
            const body = new Laya.Sprite(); body.size(584, V.rowHeight); card.addChild(body);
            ctx.ui.bindClick(body, () => ctx.open({ type: "tactic", id, back: p }));
            ctx.ui.image(card, t.icon, 20, 31, V.icon).alpha = !learned && reason ? .6 : 1;
            const title = ctx.ui.label(card, t.name, V.rowTextX, 12, V.rowTextWidth, 31, C.ink, true, 42);
            title.wordWrap = false; title.overflow = Laya.Text.SHRINK;
            const twoLines = t.effect === "ZHOU_LOVE" || t.effect === "DRAGON_POISON";
            const summary = ctx.ui.label(card, t.effect === "SUMMON_CHARGE" ? "分身沿路冲锋 · 可伤首领" : t.summary,
                V.rowTextX, 52, V.rowTextWidth, 25, C.green, false, twoLines ? 62 : 58);
            if (twoLines) summary.leading = 0;
            if (!learned) ctx.ui.materialCosts(card, s, t, V.rowTextX, V.actionY + 6, V.actionX - V.rowTextX - 12, 36);
            const action = ctx.ui.button(card, equipped >= 0 ? `已装槽 ${equipped + 1}` : learned ? "携带" : "学习并携带", V.actionX, V.actionY, V.actionWidth,
                () => selectTactic(ctx, p, id, learned, slot), equipped >= 0 ? C.gold : C.green, V.actionHeight, !blocked && !reason);
            if (equipped >= 0) {
                const face = action.getChildByName("buttonFace") as Laya.Sprite;
                face.graphics.clear(); ctx.art.panel(face, "panel_button_gold", V.actionWidth, V.actionHeight);
                (face.getChildByName("buttonText") as Laya.Text).color = C.ink;
            }
        });
        if (s.phase === "NIGHT") ctx.ui.label(box, "守夜期间仅可查看", 34, height - V.footer + 2, 600, 24, C.cream, false, 34).align = "center";
        if (p.back) ctx.ui.button(box, "‹", 30, 32, 54, () => ctx.open(p.back!, true), C.green, 54);
        if (showGuide) {
            const shade = new Laya.Sprite(), inset = slotGuide.spotlightInset;
            shade.name = "TacticSlotSpotlight"; shade.mouseEnabled = false;
            const targetX = slots.x + nextSlot * (slots.width + slots.gap);
            drawGuideSpotlight(shade.graphics, UI.panelWidth, height, targetX - inset, slots.top - inset,
                targetX + slots.width + inset, slots.top + slots.size + slots.captionH + inset);
            box.addChild(shade);
            const guide = new Laya.Sprite(), guideX = (UI.panelWidth - slotGuide.width) / 2;
            guide.name = "TacticSlotGuide"; guide.pos(guideX, guideY).size(slotGuide.width, slotGuide.height);
            guide.mouseEnabled = false;
            box.addChild(guide);
            guide.graphics.drawRoundRect(2, 8, slotGuide.width, slotGuide.height, 12, 12, 12, 12, "rgba(23,28,13,0.55)");
            ctx.art.panel(guide, "panel_card", slotGuide.width, slotGuide.height);
            ctx.ui.image(guide, tacticDefinition(SUMMON_TACTIC).icon, 16, (slotGuide.height - slotGuide.portrait) / 2, slotGuide.portrait);
            ctx.ui.label(guide, "智卓", 96, 12, 324, 26, C.timber, true, 34);
            ctx.ui.label(guide, SLOT_GUIDE_TEXT, 96, 50, 334, 23, C.ink, false, 52);
            ctx.ui.button(box, "跳过", guideX + slotGuide.width - slotGuide.skipW - 16, guideY + (slotGuide.height - 46) / 2, slotGuide.skipW,
                () => ctx.dismissTacticSlotGuide(), C.muted, 46);
        }
        return;
    }
    const t = tacticDefinition(p.id!), revealed = tacticRevealed(s, t.id), learned = s.tactics.learned.includes(t.id);
    const loreTitle = t.effect === "ZHOU_LOVE" || t.effect === "DRAGON_POISON" ? "村中密闻" : "村中传闻";
    const { top, width, inset, icon, loreTop, actionHeight, gap } = V.detail;
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
    const actionTop = top + paperHeight + gap;
    const height = actionTop + (revealed ? actionHeight + gap : 0);
    const box = ctx.modal(revealed ? "战技详情" : loreTitle, "", true, { width: UI.panelWidth, height });
    if (p.back) ctx.ui.button(box, "‹", 30, 32, 54, () => ctx.open(p.back!, true), C.green, 54);
    box.addChild(paper);
    if (!revealed) return;
    const equipped = loadout.indexOf(t.id), reason = tacticUnavailableReason(s, t.id, learned ? "EQUIP" : "LEARN", slot);
    const caption = equipped >= 0 ? `已装槽 ${equipped + 1}` : reasonBesideCost(reason) ?? (reason ?? (learned ? "携带" : "学习并携带"));
    const action = ctx.ui.button(box, caption, 54, actionTop, 560, () => selectTactic(ctx, p, t.id, learned, slot), C.green, actionHeight, !blocked && !reason);
    const actionText = (action.getChildByName("buttonFace") as Laya.Sprite).getChildByName("buttonText") as Laya.Text;
    actionText.wordWrap = false; actionText.overflow = Laya.Text.SHRINK;
}
