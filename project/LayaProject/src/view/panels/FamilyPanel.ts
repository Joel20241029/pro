import { capacity, person, canMarry, birthUnavailableReason } from "../../game/VillageRules";
import { GameState, isElder } from "../../game/GameState";
import { RULE } from "../../game/GameConfig";
import { C, UI } from "../UiTheme";
import { ScrollList } from "../ScrollList";
import { Panel, PanelContext } from "./PanelContext";
import { amount, coloredName } from "../ViewText";
export function drawFamilyPanel(ctx: PanelContext, s: GameState, p: Panel) {
    const day = s.phase === "DAY";
    if (p.type === "families") {
        const list = s.families, rowHeight = 272, rowStep = 286;
        const height = Math.min(UI.panelHeight, 392 + Math.max(1, list.length) * rowStep);
        const box = ctx.modal("家庭与养育", "先让单身村民成家，再迎接下一代。", true, { width: UI.panelWidth, height });
        ctx.ui.label(box, `空余住房 ${capacity(s) - s.people.length} 人`, 34, 158, 260, 28, C.green, true, 40);
        ctx.ui.label(box, `迎接需 ${RULE.birthCost} 粮 · 现有 ${amount(s.food)}`, 294, 158, 340, 28, s.food < RULE.birthCost ? C.red : C.timber, true, 40).align = "right";
        const canFormFamily = s.people.some(a => s.people.some(b => canMarry(s, a, b)));
        ctx.ui.button(box, !day ? "白天可安排成家" : canFormFamily ? "安排村民成家" : "暂无可成家的单身男女", 34, 210, 600, () => ctx.open({ type: "partners" }), C.gold, 76, day && canFormFamily);
        ctx.ui.label(box, "已有家庭", 36, 300, 260, 28, C.ink, true, 40);
        ctx.ui.button(box, "养育说明", 470, 298, 164, () => ctx.open({ type: "guide", tab: 2 }), C.muted, 60);
        if (list.length) {
            const rows = new ScrollList(UI.contentWidth, height - 392, list.length * rowStep - (rowStep - rowHeight), p.scroll, offset => p.scroll = offset);
            rows.pos(34, 362);
            box.addChild(rows);
            list.forEach((f, i) => {
                const reason = birthUnavailableReason(s, f.id), card = new Laya.Sprite();
                card.name = `family:${f.id}`;
                card.pos(0, i * rowStep);
                ctx.art.panel(card, "panel_card", 584, rowHeight);
                rows.content.addChild(card);
                f.partners.forEach((id, partner) => {
                    const parent = person(s, id), x = partner ? 306 : 18;
                    const clip = isElder(parent) ? `villager_elder_${parent.sex === "MALE" ? "male" : "female"}_idle` : `villager_${parent.appearance}_walk`;
                    ctx.ui.image(card, ctx.art.frameId(clip, 0, false), x, 8, 68);
                    const name = ctx.ui.label(card, coloredName(parent), x + 74, 23, 176, 28, C.ink, true, 42);
                    name.wordWrap = false;
                    name.overflow = Laya.Text.ELLIPSIS;
                });
                ctx.ui.image(card, "icon_heart", 267, 24, 40);
                const child = s.people.find(q => !q.adult && q.parents.some(id => f.partners.includes(id)));
                ctx.ui.image(card, "icon_baby", 20, 78, 44);
                const carer = child ? s.people.find(q => q.careChild === child.id) : null;
                ctx.ui.label(card, child ? `${coloredName(child)} · 成长 ${child.growth}/${RULE.growNights}` : "本户暂无未成年孩子", 72, 78, 484, 26, C.muted, false, 40);
                const detail = child ? `${carer ? carer.name + "正在照料" : "无人照料，成长暂停"}。${reason || ""}` : reason || "选择照料者后，孩子就会来到村里。";
                ctx.ui.label(card, detail, 22, 120, 538, 24, reason ? C.muted : C.green, false, 72);
                ctx.ui.button(card, reason ? "暂不可迎接" : "迎接孩子", 334, 202, 228, () => ctx.open({ type: "carers", id: f.id }), C.green, 60, reason === null);
            });
        }
        else {
            const empty = ctx.ui.label(box, "还没有家庭\n点击上方按钮，为村民牵线吧", UI.inset, 404, UI.contentWidth, 32, C.muted, false, 130);
            empty.name = "emptyState";
            empty.align = "center";
            empty.valign = "middle";
            empty.wordWrap = false;
        }
        return;
    }
}
