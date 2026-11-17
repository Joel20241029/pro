import { DEFAULT_TACTIC, TACTIC_USE, TACTICS, tacticDefinition } from "../../config/TacticConfig";
import { GameState } from "../../game/GameState";
import { tacticRevealed, tacticUnavailableReason } from "../../game/Tactics";
import { actionHintsBlocked } from "../ActionHints";
import { ScrollList } from "../ScrollList";
import { C, UI } from "../UiTheme";
import { amount, reasonBesideCost } from "../ViewText";
import { TACTIC_UI as V } from "../config/TacticUiConfig";
import { Panel, PanelContext } from "./PanelContext";

/** 提交仍由会话统一保存；导航目标记在当前面板上，保存失败重试后也只在成功时返回。 */
function selectTactic(ctx: PanelContext, p: Panel, id: string, learned: boolean) {
    p.pendingTactic = id;
    ctx.send({ type: learned ? "TACTIC_EQUIP" : "TACTIC_LEARN", id });
}

export function drawTacticPanel(ctx: PanelContext, s: GameState, p: Panel) {
    const blocked = actionHintsBlocked(ctx.game);
    const revealed = TACTICS.filter(t => tacticRevealed(s, t.id));
    const next = TACTICS.filter(t => !tacticRevealed(s, t.id)).sort((a, b) => a.unlockWaves - b.unlockWaves)[0];
    // 详情入口也遵循揭晓规则；旧导航快照不能越过未知卡直接展示技能名称和效果。
    if (p.type === "tactic" && !tacticRevealed(s, p.id!)) {
        const box = ctx.modal("未知战技", "", true, { width: UI.panelWidth, height: 340 });
        ctx.ui.label(box, `守住 ${tacticDefinition(p.id!).unlockWaves} 波后揭晓`, 34, 152, 600, 30, C.cream, true, 72).align = "center";
        return;
    }
    if (p.type === "tactics") {
        const count = revealed.length + (next ? 1 : 0);
        const height = Math.min(UI.panelHeight, V.listTop + count * V.rowStep - 12 + V.footer);
        const box = ctx.modal("守村战技", "", true, { width: UI.panelWidth, height },
            `每夜携带一个战技，最多用 ${TACTIC_USE.perNight} 次。冷却结束可再次使用。点卡片看效果和学习条件，学会后可在白天免费换用。`);
        const resources = new Laya.Sprite(); resources.pos(34, 112);
        ctx.art.panel(resources, "panel_card", 600, 62); box.addChild(resources);
        const waves = ctx.ui.label(resources, `已守 ${amount(s.completed)} 波`, 16, 10, 200, 26, C.ink, true, 42);
        waves.wordWrap = false; waves.overflow = Laya.Text.SHRINK;
        ctx.ui.iconValue(resources, "icon_wood", amount(s.wood, true), 220, 8, 175, 46, C.timber, 26);
        ctx.ui.iconValue(resources, "icon_food", amount(s.food, true), 407, 8, 174, 46, C.green, 26);
        if (!p.rowOrder) {
            const rank = (id: string) => s.tactics.equipped === id ? 0 :
                s.tactics.learned.includes(id) ? 2 : !tacticUnavailableReason(s, id, "LEARN") ? 1 :
                    s.completed >= tacticDefinition(id).unlockWaves ? 3 : 4;
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
            ctx.ui.image(card, t.icon, 20, 24, V.icon).alpha = !learned && reason ? .6 : 1;
            const title = ctx.ui.label(card, t.name, V.rowTextX, 16, V.rowTextWidth, 31, C.ink, true, 42);
            title.wordWrap = false; title.overflow = Laya.Text.SHRINK;
            ctx.ui.label(card, t.summary, V.rowTextX, 62, V.rowTextWidth, 25, C.green, false, 58);
            if (learned) ctx.ui.label(card, id === DEFAULT_TACTIC ? "开局自带" : "已学会", V.rowTextX, 122, V.rowTextWidth, 24, C.timber, false, 32);
            else ctx.ui.materialCosts(card, s, t, V.rowTextX, 121, V.rowTextWidth, 33);
            const note = learned ? s.phase === "DAY" ? "" : "天亮后可更换" :
                reasonBesideCost(reason) ?? (reason ? "材料不足" : `已守 ${amount(s.completed)}/${t.unlockWaves} 波`);
            const label = ctx.ui.label(card, note, 20, 158, 340, 24, reason && !learned ? C.red : C.green, false, 48);
            label.wordWrap = false; label.overflow = Laya.Text.SHRINK;
            const action = ctx.ui.button(card, equipped ? "已携带" : learned ? "携带" : "学习并携带", V.actionX, V.actionY, V.actionWidth,
                () => selectTactic(ctx, p, id, learned), equipped ? C.gold : C.green, V.actionHeight, !blocked && !reason);
            if (equipped) {
                const face = action.getChildByName("buttonFace") as Laya.Sprite;
                face.graphics.clear(); ctx.art.panel(face, "panel_button_gold", V.actionWidth, V.actionHeight);
                (face.getChildByName("buttonText") as Laya.Text).color = C.ink;
            }
        });
        if (next) {
            const card = new Laya.Sprite(); card.name = "UnknownTactic"; card.pos(0, revealed.length * V.rowStep);
            ctx.art.panel(card, "panel_card_disabled", 584, V.rowHeight); rows.content.addChild(card);
            const mark = ctx.ui.label(card, "?", 16, 0, 116, 106, C.timber, true, V.rowHeight);
            mark.align = "center"; mark.valign = "middle"; mark.wordWrap = false;
            ctx.ui.label(card, "未知战技", 146, 55, 410, 32, C.ink, true, 48);
            ctx.ui.label(card, `守住 ${next.unlockWaves} 波后揭晓`, 146, 109, 410, 27, C.muted, false, 54);
        }
        if (s.phase === "NIGHT") ctx.ui.label(box, "守夜期间仅可查看", 34, height - V.footer + 2, 600, 24, C.cream, false, 34).align = "center";
        if (p.back) ctx.ui.button(box, "‹", 30, 32, 54, () => ctx.open(p.back!, true), C.green, 54);
        return;
    }
    const t = tacticDefinition(p.id!), learned = s.tactics.learned.includes(t.id), equipped = s.tactics.equipped === t.id;
    const reason = tacticUnavailableReason(s, t.id, learned ? "EQUIP" : "LEARN");
    const height = learned ? V.detailOwnedHeight : V.detailLearnHeight;
    const box = ctx.modal("战技详情", "", true, { width: UI.panelWidth, height },
        "满足守夜波数和材料要求后可学习并携带。已学会的战技可在白天免费更换。");
    if (p.back) ctx.ui.button(box, "‹", 30, 32, 54, () => ctx.open(p.back!, true), C.green, 54);
    const paper = new Laya.Sprite(); paper.pos(34, 112);
    ctx.art.panel(paper, "panel_card", 600, height - 228); box.addChild(paper);
    ctx.ui.image(paper, t.icon, (600 - V.detailIcon) / 2, 22, V.detailIcon);
    ctx.ui.label(paper, t.name, 24, 170, 552, 34, C.ink, true, 46).align = "center";
    const desc = ctx.ui.label(paper, t.description, 0, 0, 536, 26, C.ink, false, 122);
    desc.align = "center"; desc.height = Math.max(122, desc.textHeight);
    const description = new ScrollList(552, 122, desc.height); description.content.name = "TacticDescription";
    description.pos(24, 222); description.content.addChild(desc); paper.addChild(description);
    if (learned) ctx.ui.label(paper, t.id === DEFAULT_TACTIC ? "初始战技 · 已学会" : "已学会 · 更换免费", 24, 366, 552, 27, C.green, true, 44).align = "center";
    else {
        ctx.ui.label(paper, `学习条件   已守 ${amount(s.completed)}/${t.unlockWaves} 波`, 24, 358, 552, 28,
            s.completed < t.unlockWaves ? C.red : C.green, true, 48);
        ctx.ui.label(paper, "学习费用", 24, 418, 144, 27, C.ink, true, 43);
        ctx.ui.materialCosts(paper, s, t, 178, 419, 390, 43);
        ctx.ui.label(paper, "当前库存", 24, 474, 144, 27, C.ink, true, 43);
        ctx.ui.iconValue(paper, "icon_wood", amount(s.wood, true), 178, 474, 193, 42, C.timber, 26, "left");
        ctx.ui.iconValue(paper, "icon_food", amount(s.food, true), 373, 474, 193, 42, C.green, 26, "left");
    }
    const caption = equipped ? "已携带" : reasonBesideCost(reason) ?? (reason ? "材料不足" : learned ? "携带" : "学习并携带");
    const action = ctx.ui.button(box, caption, 54, height - 96, 560, () => selectTactic(ctx, p, t.id, learned), C.green, 66, !blocked && !reason);
    const actionText = (action.getChildByName("buttonFace") as Laya.Sprite).getChildByName("buttonText") as Laya.Text;
    actionText.wordWrap = false; actionText.overflow = Laya.Text.SHRINK;
}
