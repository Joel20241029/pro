import { capacity, person, canMarry, birthUnavailableReason } from "../../game/VillageRules";
import { GameState } from "../../game/GameState";
import { RULE } from "../../game/GameConfig";
import { C, UI } from "../UiTheme";
import { ScrollList } from "../ScrollList";
import { Panel, PanelContext } from "./PanelContext";
import { amount, coloredName } from "../ViewText";
import { orderPanelRows } from "./PanelListOrder";
export function drawFamilyPanel(ctx: PanelContext, s: GameState, p: Panel) {
    const day = s.phase === "DAY";
    if (p.type === "families") {
        // 家庭卡片保留全部原因和照料信息；两栏概要与独立操作区只改变阅读层级。
        const list = orderPanelRows(p, s.families, f => f.id, f => birthUnavailableReason(s, f.id) === null), rowHeight = 266, rowStep = 280;
        const height = Math.min(UI.panelHeight, 408 + Math.max(1, list.length) * rowStep);
        const box = ctx.modal("家庭与养育", "先让单身村民成家，再迎接下一代。", true, { width: UI.panelWidth, height });
        const home = new Laya.Sprite(); home.pos(34, 152); ctx.art.panel(home, "panel_card", 288, 70); box.addChild(home);
        ctx.ui.image(home, "icon_house", 12, 13, 44);
        ctx.ui.label(home, "空余住房", 66, 6, 208, 24, C.muted, false, 28);
        ctx.ui.label(home, `${capacity(s) - s.people.length} 人`, 66, 32, 208, 26, C.green, true, 32);
        const food = new Laya.Sprite(); food.pos(334, 152); ctx.art.panel(food, "panel_card", 300, 70); box.addChild(food);
        ctx.ui.image(food, "icon_food", 12, 13, 44);
        ctx.ui.label(food, `迎接需 ${RULE.birthCost} 粮`, 66, 6, 220, 24, C.muted, false, 28);
        ctx.ui.label(food, `现有 ${amount(s.food)} 粮`, 66, 32, 220, 26, s.food < RULE.birthCost ? C.red : C.timber, true, 32);
        const canFormFamily = s.people.some(a => s.people.some(b => canMarry(s, a, b)));
        ctx.ui.button(box, !day ? "白天可安排成家" : canFormFamily ? "安排村民成家" : "暂无可成家的单身男女", 34, 236, 600, () => ctx.open({ type: "partners" }), C.green, 72, day && canFormFamily);
        ctx.ui.label(box, "已有家庭", 36, 326, 260, 28, C.ink, true, 40);
        ctx.ui.button(box, "养育说明", 470, 320, 164, () => ctx.open({ type: "guide", tab: 2 }), C.muted, 50);
        if (list.length) {
            const rows = new ScrollList(UI.contentWidth, height - 408, list.length * rowStep - (rowStep - rowHeight), p.scroll, offset => p.scroll = offset);
            rows.pos(34, 382);
            box.addChild(rows);
            rows.setVirtualRows(list.length, rowStep, (i, row) => {
                const f = list[i];
                const reason = birthUnavailableReason(s, f.id), card = new Laya.Sprite();
                card.name = `family:${f.id}`;
                card.pos(0, 0);
                ctx.art.panel(card, "panel_card", 584, rowHeight);
                row.addChild(card);
                f.partners.forEach((id, partner) => {
                    // 姓名—头像—红心—头像—姓名镜像排布；头像中心232/352与红心中心292等距。
                    const parent = person(s, id), x = partner ? 318 : 198;
                    ctx.ui.image(card, ctx.art.portraitId(parent), x, 8, 68);
                    const name = ctx.ui.label(card, coloredName(parent), partner ? 392 : 16, 23, 176, 28, C.ink, true, 42);
                    name.align = partner ? "left" : "right";
                    name.wordWrap = false;
                    name.overflow = Laya.Text.ELLIPSIS;
                });
                ctx.ui.image(card, "icon_heart", 272, 24, 40);
                const child = s.people.find(q => !q.adult && q.parents.some(id => f.partners.includes(id)));
                ctx.ui.image(card, "icon_baby", 20, 78, 44);
                const carer = child ? s.people.find(q => q.careChild === child.id) : null;
                ctx.ui.label(card, child ? `${coloredName(child)} · 成长 ${child.growth}/${RULE.growNights}` : "本户暂无未成年孩子", 72, 78, 484, 26, C.muted, false, 40);
                const detail = child ? `${carer ? carer.name + "正在照料" : "无人照料，成长暂停"}。${reason || ""}` : reason || "选择照料者后，孩子就会来到村里。";
                ctx.ui.label(card, detail, 22, 120, 538, 24, reason ? C.muted : C.green, false, 72);
                ctx.ui.button(card, reason ? "暂不可迎接" : "迎接孩子", 334, 200, 228, () => ctx.open({ type: "carers", id: f.id }), C.green, 54, reason === null);
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
