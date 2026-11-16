import { DEFAULT_TACTIC, TACTICS, tacticDefinition } from "../../config/TacticConfig";
import { GameState } from "../../game/GameState";
import { tacticRevealed, tacticUnavailableReason } from "../../game/Tactics";
import { actionHintsBlocked } from "../ActionHints";
import { ScrollList } from "../ScrollList";
import { C, UI } from "../UiTheme";
import { amount, resourceCost } from "../ViewText";
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
        const box = ctx.modal("守村战技", "", true, { width: UI.panelWidth, height });
        const resources = new Laya.Sprite(); resources.pos(34, 112);
        ctx.art.panel(resources, "panel_card", 600, 62); box.addChild(resources);
        const waves = ctx.ui.label(resources, `已守 ${amount(s.completed)} 波`, 16, 10, 200, 26, C.ink, true, 42);
        ctx.ui.image(resources, "icon_wood", 240, 17, 30);
        const wood = ctx.ui.label(resources, `木 ${amount(s.wood)}`, 278, 10, 136, 26, C.ink, true, 42);
        ctx.ui.image(resources, "icon_food", 422, 17, 30);
        const food = ctx.ui.label(resources, `粮 ${amount(s.food)}`, 460, 10, 128, 26, C.ink, true, 42);
        for (const text of [waves, wood, food]) { text.wordWrap = false; text.overflow = Laya.Text.SHRINK; }
        ctx.ui.label(box, "每夜携带 1 个 · 使用 1 次", 34, 182, 600, 26, C.cream, true, 40).align = "center";
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
            ctx.ui.label(card, learned ? id === DEFAULT_TACTIC ? "开局自带 · 免费使用" : "已学会 · 更换免费" :
                `木 ${resourceCost(s.wood, t.wood)}  粮 ${resourceCost(s.food, t.food)}`, V.rowTextX, 122, V.rowTextWidth, 24, C.timber, false, 32);
            const note = learned ? s.phase === "DAY" ? "点击卡片查看详情" : "天亮后可更换" :
                reason || `已守 ${amount(s.completed)}/${t.unlockWaves} 波`;
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
            ctx.ui.label(card, "?", 22, 24, 100, 68, C.gold, true, 108).align = "center";
            ctx.ui.label(card, "未知战技", 146, 40, 410, 32, C.ink, true, 48);
            ctx.ui.label(card, `守住 ${next.unlockWaves} 波后揭晓`, 146, 100, 410, 27, C.muted, false, 54);
        }
        ctx.ui.label(box, s.phase === "DAY" ? "学会后免费更换 · 守夜前选好战技" : "守夜期间仅可查看", 34, height - V.footer + 6, 600, 24, C.cream, false, 36).align = "center";
        if (p.back) ctx.ui.button(box, "‹", 30, 32, 54, () => ctx.open(p.back!, true), C.green, 54);
        return;
    }
    const t = tacticDefinition(p.id!), learned = s.tactics.learned.includes(t.id), equipped = s.tactics.equipped === t.id;
    const reason = tacticUnavailableReason(s, t.id, learned ? "EQUIP" : "LEARN");
    const height = learned ? V.detailOwnedHeight : V.detailLearnHeight;
    const box = ctx.modal("战技详情", "", true, { width: UI.panelWidth, height });
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
        const enough = s.wood >= t.wood && s.food >= t.food;
        const lines = [
            ["学习条件", `已守 ${amount(s.completed)}/${t.unlockWaves} 波`],
            ["学习消耗", `木 ${t.wood} · 粮 ${t.food}`],
            ["当前拥有", `木 ${resourceCost(s.wood, t.wood)} · 粮 ${resourceCost(s.food, t.food)}`],
            ["学习后剩余", enough ? `木 ${amount(s.wood - t.wood)} · 粮 ${amount(s.food - t.food)}` : "材料不足"]
        ];
        lines.forEach(([title, value], i) => {
            ctx.ui.label(paper, title, 24, 350 + i * 48, 176, 26, C.ink, true, 40);
            const text = ctx.ui.label(paper, value, 206, 350 + i * 48, 370, 26, i === 0 && s.completed < t.unlockWaves || i === 3 && !enough ? C.red : C.green, false, 40);
            text.wordWrap = false; text.overflow = Laya.Text.SHRINK;
        });
    }
    const caption = equipped ? "已携带" : reason || (learned ? "携带" : "学习并携带");
    const action = ctx.ui.button(box, caption, 54, height - 96, 560, () => selectTactic(ctx, p, t.id, learned), C.green, 66, !blocked && !reason);
    const actionText = (action.getChildByName("buttonFace") as Laya.Sprite).getChildByName("buttonText") as Laya.Text;
    actionText.wordWrap = false; actionText.overflow = Laya.Text.SHRINK;
}
