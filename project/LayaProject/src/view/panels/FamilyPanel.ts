import { capacity, person, birthUnavailableReason } from "../../game/VillageRules";
import { Family, GameState } from "../../game/GameState";
import { RULE } from "../../game/GameConfig";
import { C, UI } from "../UiTheme";
import { actionHintsBlocked, familyActionHints } from "../ActionHints";
import { ScrollList } from "../ScrollList";
import { Panel, PanelContext } from "./PanelContext";
import { amount, coloredName } from "../ViewText";
import { orderPanelRows } from "./PanelListOrder";
import { replayButtonPress } from "../ButtonFeedback";
import { reasonBesideCost } from "../ViewText";

/** 旧版奶油卡片与绿色面板上的双页布局。列表独立留出滚动槽，较大的双亲头像共用一条中心线。 */
const FAMILY_UI = {
    tabs: { top: 115, height: 68, gap: 16 },
    rowsTop: { marriage: 385, unavailable: 402, nurture: 368 },
    rowGap: 14,
    marriageHeight: 194,
    nurtureHeight: 446,
    portrait: 120
} as const;

function drawPartners(ctx: PanelContext, card: Laya.Sprite, s: GameState, family: Family, cardWidth: number) {
    const portrait = FAMILY_UI.portrait, heart = 48, center = cardWidth / 2;
    family.partners.forEach((id, i) => {
        const parent = person(s, id), x = cardWidth * (i ? .75 : .25);
        ctx.ui.image(card, ctx.art.portraitId(parent), x - portrait / 2, 8, portrait);
        const name = ctx.ui.label(card, coloredName(parent), x - 128, 130, 256, 29, C.ink, true, 42);
        name.align = "center"; name.wordWrap = false; name.overflow = Laya.Text.ELLIPSIS;
    });
    ctx.ui.image(card, "icon_heart", center - heart / 2, 8 + (portrait - heart) / 2, heart);
}

export function drawFamilyPanel(ctx: PanelContext, s: GameState, p: Panel) {
    const tab = p.tab === 1 ? 1 : 0, nurture = tab === 1, blocked = actionHintsBlocked(ctx.game);
    const hints = familyActionHints(s, blocked);
    const help = nurture ? `双亲需未退休，村中有空床位。同一家庭两次迎接孩子须间隔 ${RULE.birthCooldown} 次守夜胜利。孩子随村成长，守住 ${RULE.growNights} 夜可让孩子成年。`
        : "成家需要成年、未退休、没有配偶的一男一女。直系亲属和兄弟姐妹不能成家。";
    const box = ctx.modal("家庭与养育", "", true, undefined, help), tabs = FAMILY_UI.tabs, tabWidth = (UI.contentWidth - tabs.gap) / 2;
    ([["成家", "icon_heart", hints.marriage], ["养育", "icon_baby", hints.nurture]] as const).forEach(([title, icon, ready], i) => {
        const button = ctx.ui.button(box, title, UI.inset + i * (tabWidth + tabs.gap), tabs.top, tabWidth, () => {
            if (tab === i) return;
            p.tab = i;
            p.tabFeedback = true;
            ctx.refresh();
        }, tab === i ? C.gold : C.green, tabs.height);
        ctx.ui.buttonIcon(button, icon, 40);
        if (tab === i && p.tabFeedback) { replayButtonPress(button); delete p.tabFeedback; }
        if (ready && i !== tab) ctx.ui.actionBadge(button, "FamilyTabActionHint");
    });

    const subtitle = nurture ? "已成家的村民可以迎接孩子。" : hints.marriage ? "为成年、未退休的单身男女安排成家。"
        : s.phase !== "DAY" ? "白天可安排成家" : !Number.isSafeInteger(s.nextFamily + 1) ? "家庭编号已达安全范围" : "暂无可成家的单身男女";
    ctx.ui.label(box, subtitle, UI.inset, !nurture && !hints.marriage ? 214 : 195, UI.contentWidth, 27, C.muted, false, 40).align = "center";
    if (nurture) {
        const home = new Laya.Sprite(); home.pos(UI.inset, 241); ctx.art.panel(home, "panel_card", tabWidth, 70); box.addChild(home);
        ctx.ui.iconValue(home, "icon_house", `空余住房 ${capacity(s) - s.people.length} 人`, 10, 7, tabWidth - 20, 56, C.ink, 26);
        const food = new Laya.Sprite(); food.pos(UI.inset + tabWidth + tabs.gap, 241); ctx.art.panel(food, "panel_card", tabWidth, 70); box.addChild(food);
        ctx.ui.label(food, "现有／所需", 14, 8, 128, 24, C.muted, false, 54);
        ctx.ui.iconValue(food, "icon_food", `${amount(s.food, true)}/${RULE.birthCost}`, 142, 9, tabWidth - 152, 52,
            s.food < RULE.birthCost ? C.red : C.timber, 26);
    } else {
        const button = ctx.ui.centerButton(box, "安排村民成家", hints.marriage ? 240 : 256, () => ctx.open({ type: "partners" }), C.green, hints.marriage);
        if (hints.marriage) ctx.ui.actionBadge(button, "MarriageActionHint");
    }
    const rowsTop = FAMILY_UI.rowsTop[nurture ? "nurture" : hints.marriage ? "marriage" : "unavailable"];
    ctx.ui.label(box, nurture ? "家庭养育" : "已有家庭", UI.inset + 2, rowsTop - 42, 320, 28, C.ink, true, 40);

    const viewport = UI.panelHeight - rowsTop - UI.inset;
    if (!s.families.length) {
        const text = nurture ? "还没有可以养育的家庭\n先到「成家」安排村民"
            : hints.marriage ? "还没有家庭\n点击上方按钮，为村民牵线吧" : "还没有家庭\n可以等孩子成年或旅人加入";
        const emptyIcon = 108;
        ctx.ui.image(box, nurture ? "icon_baby" : "icon_family", (box.width - emptyIcon) / 2, rowsTop + viewport / 2 - 109, emptyIcon);
        const empty = ctx.ui.label(box, text,
            UI.inset, rowsTop + viewport / 2 + 7, UI.contentWidth, 28, C.muted, false, 90);
        empty.name = "emptyState";
        empty.align = "center"; empty.valign = "middle";
        return;
    }
    const cardWidth = UI.contentWidth - UI.scrollGutter;
    const rowHeight = nurture ? FAMILY_UI.nurtureHeight : FAMILY_UI.marriageHeight, step = rowHeight + FAMILY_UI.rowGap;
    const list = nurture ? orderPanelRows(p, s.families, f => f.id, f => birthUnavailableReason(s, f.id) === null) : s.families;
    const scroll = p.familyScroll ??= [];
    const rows = new ScrollList(UI.contentWidth, viewport, list.length * step - FAMILY_UI.rowGap, scroll[tab], value => scroll[tab] = value);
    rows.pos(UI.inset, rowsTop);
    box.addChild(rows);
    rows.setVirtualRows(list.length, step, (i, row) => {
        const family = list[i], card = new Laya.Sprite();
        card.name = `family:${family.id}`;
        ctx.art.panel(card, "panel_card", cardWidth, rowHeight);
        row.addChild(card);
        drawPartners(ctx, card, s, family, cardWidth);
        if (!nurture) return;
        const child = s.people.find(q => !q.adult && q.parents.some(id => family.partners.includes(id)));
        const childPortrait = 70;
        ctx.ui.image(card, child ? ctx.art.portraitId(child) : "icon_baby", (cardWidth - childPortrait) / 2, 174, childPortrait);
        const childText = ctx.ui.label(card, child ? `${coloredName(child)} · 成长 ${child.growth}/${RULE.growNights}` : "本户暂无未成年孩子",
            24, 246, cardWidth - 48, 26, C.ink, true, 37);
        childText.align = "center"; childText.wordWrap = false; childText.overflow = Laya.Text.SHRINK;
        if (child) {
            const caregiver = ctx.ui.label(card, "每守住一夜，成长一步", 24, 283, cardWidth - 48, 26, C.muted, false, 37);
            caregiver.align = "center"; caregiver.wordWrap = false; caregiver.overflow = Laya.Text.SHRINK;
        }
        const reason = birthUnavailableReason(s, family.id) ?? (Number.isSafeInteger(s.nextPerson + 1) ? null : "人口编号已达安全范围");
        const available = reason === null && !blocked;
        const note = ctx.ui.label(card, reason ? reasonBesideCost(reason) ?? "费用不足，缺口见上方" : "孩子将在守夜后自然成长", 24, 320, cardWidth - 48, 25, reason ? C.muted : C.green, false, 40);
        note.align = "center"; note.wordWrap = false; note.overflow = Laya.Text.SHRINK;
        ctx.ui.button(card, available ? "迎接孩子" : "暂不可迎接", (cardWidth - 238) / 2, 368, 238, () => ctx.send({ type: "BIRTH", family: family.id }), C.green, 56, available);
    });
}
