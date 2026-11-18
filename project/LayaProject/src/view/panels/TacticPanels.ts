import { TACTICS, TACTIC_USE, tacticDefinition } from "../../config/TacticConfig";
import { RULE } from "../../config/RuleConfig";
import { GameState } from "../../game/GameState";
import { tacticRevealed, tacticUnavailableReason } from "../../game/Tactics";
import { actionHintsBlocked } from "../ActionHints";
import { ScrollList } from "../ScrollList";
import { C, UI } from "../UiTheme";
import { reasonBesideCost } from "../ViewText";
import { TACTIC_UI as V } from "../config/TacticUiConfig";
import { Panel, PanelContext } from "./PanelContext";

/** 提交仍由会话统一保存；导航目标记在当前面板上，保存失败重试后也只在成功时返回。 */
function selectTactic(ctx: PanelContext, p: Panel, id: string, learned: boolean) {
    p.pendingTactic = id;
    ctx.send({ type: learned ? "TACTIC_EQUIP" : "TACTIC_LEARN", id });
}

export function drawTacticPanel(ctx: PanelContext, s: GameState, p: Panel) {
    const blocked = actionHintsBlocked(ctx.game);
    if (p.type === "tactics") {
        const revealed = TACTICS.filter(t => tacticRevealed(s, t.id));
        const locked = TACTICS.filter(t => !tacticRevealed(s, t.id)).sort((a, b) => a.unlockWaves - b.unlockWaves);
        const count = TACTICS.length;
        const height = Math.min(UI.panelHeight, V.listTop + count * V.rowStep - 12 + V.footer);
        const box = ctx.modal("守村战技", "", true, { width: UI.panelWidth, height },
            "点击卡片查看详情。");
        if (!p.rowOrder) {
            const rank = (id: string) => s.tactics.equipped === id ? 0 :
                s.tactics.learned.includes(id) ? 2 : !tacticUnavailableReason(s, id, "LEARN") ? 1 : 3;
            p.rowOrder = revealed.slice().sort((a, b) => rank(a.id) - rank(b.id) || a.order - b.order).map(t => t.id);
        }
        const rows = new ScrollList(UI.contentWidth, height - V.listTop - V.footer, count * V.rowStep - 12, p.scroll, y => p.scroll = y);
        rows.pos(34, V.listTop); box.addChild(rows);
        p.rowOrder.forEach((id, index) => {
            const t = tacticDefinition(id), learned = s.tactics.learned.includes(id), equipped = s.tactics.equipped === id;
            const reason = tacticUnavailableReason(s, id, learned ? "EQUIP" : "LEARN");
            const card = new Laya.Sprite(); card.name = `TacticCard:${id}`;
            card.pos(0, index * V.rowStep); card.size(584, V.rowHeight); rows.content.addChild(card);
            ctx.art.panel(card, !learned && reason ? "panel_card_disabled" : "panel_card", 584, V.rowHeight);
            // 正文与操作按钮是同级命中节点，点学习不会冒泡成打开详情；拖动由ScrollList取消点击。
            const body = new Laya.Sprite(); body.size(584, V.rowHeight); card.addChild(body);
            ctx.ui.bindClick(body, () => ctx.open({ type: "tactic", id, back: p }));
            ctx.ui.image(card, t.icon, 20, 31, V.icon).alpha = !learned && reason ? .6 : 1;
            const title = ctx.ui.label(card, t.name, V.rowTextX, 12, V.rowTextWidth, 31, C.ink, true, 42);
            title.wordWrap = false; title.overflow = Laya.Text.SHRINK;
            ctx.ui.label(card, t.summary, V.rowTextX, 52, V.rowTextWidth, 25, C.green, false, 58);
            if (!learned) ctx.ui.materialCosts(card, s, t, V.rowTextX, V.actionY + 6, V.actionX - V.rowTextX - 12, 36);
            const action = ctx.ui.button(card, equipped ? "已携带" : learned ? "携带" : "学习并携带", V.actionX, V.actionY, V.actionWidth,
                () => selectTactic(ctx, p, id, learned), equipped ? C.gold : C.green, V.actionHeight, !blocked && !reason);
            if (equipped) {
                const face = action.getChildByName("buttonFace") as Laya.Sprite;
                face.graphics.clear(); ctx.art.panel(face, "panel_button_gold", V.actionWidth, V.actionHeight);
                (face.getChildByName("buttonText") as Laya.Text).color = C.ink;
            }
        });
        locked.forEach((t, index) => {
            const card = new Laya.Sprite(); card.name = "UnknownTactic"; card.pos(0, (revealed.length + index) * V.rowStep);
            ctx.art.panel(card, "panel_card_disabled", 584, V.rowHeight); rows.content.addChild(card);
            const mark = ctx.ui.label(card, "?", 16, 0, 116, 106, C.timber, true, V.rowHeight);
            mark.align = "center"; mark.valign = "middle"; mark.wordWrap = false;
            ctx.ui.label(card, "未知战技", 146, 32, 410, 32, C.ink, true, 48);
            ctx.ui.label(card, `守住 ${t.unlockWaves} 波后解锁`, 146, 77, 410, 27, C.muted, false, 38);
            ctx.ui.button(card, "查看传闻", V.actionX, V.actionY, V.actionWidth,
                () => ctx.open({ type: "tactic", id: t.id, back: p }), C.green, V.actionHeight);
        });
        if (s.phase === "NIGHT") ctx.ui.label(box, "守夜期间仅可查看", 34, height - V.footer + 2, 600, 24, C.cream, false, 34).align = "center";
        if (p.back) ctx.ui.button(box, "‹", 30, 32, 54, () => ctx.open(p.back!, true), C.green, 54);
        return;
    }
    const t = tacticDefinition(p.id!), revealed = tacticRevealed(s, t.id), learned = s.tactics.learned.includes(t.id);
    const { top, width, inset, icon, loreTop, actionHeight, gap } = V.detail;
    const paper = new Laya.Sprite(); paper.pos(UI.inset, top);
    const textWidth = width - 2 * inset;
    if (revealed) {
        const textX = inset + icon + gap, effectWidth = width - textX - inset;
        ctx.ui.image(paper, t.icon, inset, inset, icon);
        ctx.ui.label(paper, t.name, textX, 16, effectWidth, 34, C.ink, true, 44);
        ctx.ui.label(paper, t.effect === "SUMMON_CHARGE" ? `${t.summary}（含首领）` : t.summary, textX, 57, effectWidth, 25, C.green, false, 62);
        const cooldown = t.usesPerNight > 1 ? ` · 冷却 ${TACTIC_USE.cooldownTicks * RULE.step} 秒` : "";
        ctx.ui.label(paper, `每夜 ${t.usesPerNight} 次${cooldown}`, textX, 117, effectWidth, 24, C.muted, false, 36);
        ctx.ui.label(paper, "村中传闻", inset, loreTop - 8, textWidth, 27, C.timber, true, 40);
    }
    const lore = ctx.ui.label(paper, t.lore, inset, revealed ? loreTop + 39 : inset, textWidth, 28, C.ink, false, UI.panelHeight);
    lore.name = "TacticLore";
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
    const box = ctx.modal(revealed ? "战技详情" : "村中传闻", "", true, { width: UI.panelWidth, height });
    if (p.back) ctx.ui.button(box, "‹", 30, 32, 54, () => ctx.open(p.back!, true), C.green, 54);
    box.addChild(paper);
    if (!revealed) return;
    const equipped = s.tactics.equipped === t.id, reason = tacticUnavailableReason(s, t.id, learned ? "EQUIP" : "LEARN");
    const caption = equipped ? "已携带" : reasonBesideCost(reason) ?? (reason ? "材料不足" : learned ? "携带" : "学习并携带");
    const action = ctx.ui.button(box, caption, 54, actionTop, 560, () => selectTactic(ctx, p, t.id, learned), C.green, actionHeight, !blocked && !reason);
    const actionText = (action.getChildByName("buttonFace") as Laya.Sprite).getChildByName("buttonText") as Laya.Text;
    actionText.wordWrap = false; actionText.overflow = Laya.Text.SHRINK;
}
