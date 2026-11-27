import { capacity, person, birthUnavailableReason, canMarry } from "../../game/VillageRules";
import { GameState, Person } from "../../game/GameState";
import { RULE, TRAITS } from "../../game/GameConfig";
import { C, UI } from "../UiTheme";
import { actionHintsBlocked, familyActionHints } from "../ActionHints";
import { ScrollList } from "../ScrollList";
import { Panel, PanelContext } from "./PanelContext";
import { coloredName, reasonBesideCost } from "../ViewText";
import { orderPanelRows } from "./PanelListOrder";
import { replayButtonPress } from "../ButtonFeedback";
import { cardArt as drawResidentAvatar } from "./PanelCards";
import { residentCardText } from "./ResidentCards";

/** 720 逻辑宽的家庭页单列。头像、状态和操作分开放，只有名单滚动。 */
const FAMILY_UI = {
    tabs: { top: 115, height: 68, gap: 16 },
    rowsTop: { marriage: 365, unavailable: 312, nurture: 254 },
    rowGap: 14,
    marriageHeight: 194, nurtureHeight: 244, portrait: 138, candidate: 154
} as const;
type FamilyView = Panel & { pairing?: boolean; partner?: string; pairingScroll?: number };

function drawPartners(ctx: PanelContext, card: Laya.Sprite, partners: Person[], cardWidth: number, showTraits = false) {
    const portrait = FAMILY_UI.portrait, heart = 48, center = cardWidth / 2;
    partners.forEach((parent, i) => {
        const x = cardWidth * (i ? .75 : .25);
        drawResidentAvatar(ctx, card, ctx.art.portraitId(parent), x - portrait / 2, 10, portrait);
        const name = ctx.ui.label(card, coloredName(parent), x - 128, 146, 256, 29, C.ink, true, 42);
        name.align = "center"; name.wordWrap = false; name.overflow = Laya.Text.ELLIPSIS;
        if (showTraits) {
            const traits = ctx.ui.label(card, parent.traits.map(t => TRAITS[t][0]).join(" · "), x - 133, 185, 266, 24, C.muted, false, 32);
            traits.align = "center"; traits.wordWrap = false; traits.overflow = Laya.Text.SHRINK;
        }
    });
    ctx.ui.image(card, "icon_heart", center - heart / 2, 8 + (portrait - heart) / 2, heart);
}

export function drawFamilyPanel(ctx: PanelContext, s: GameState, p: FamilyView, safeHeight: number) {
    const blocked = actionHintsBlocked(ctx.game);
    const hints = familyActionHints(s, blocked, p.tab !== 1);
    const tab = p.tab ??= hints.nurture && !hints.marriage ? 1 : 0;
    const nurture = tab === 1;
    const pair = hints.onlyPair;
    const help = nurture ? `双亲需未退休，村中有空床位。同一家庭两次迎接孩子须间隔 ${RULE.birthCooldown} 次守夜胜利。孩子随村成长，守住 ${RULE.growNights} 夜可让孩子成年。`
        : "成家需要成年、未退休、没有配偶的一男一女。直系亲属和兄弟姐妹不能成家。";
    const height = Math.min(UI.panelHeight, safeHeight - 48);
    const box = ctx.modal("家庭与养育", "", true, { width: UI.panelWidth, height }, help), tabs = FAMILY_UI.tabs, tabWidth = (UI.contentWidth - tabs.gap) / 2;
    ([["成家", "icon_heart", hints.marriage], ["养育", "icon_baby", hints.nurture]] as const).forEach(([title, icon, ready], i) => {
        const button = ctx.ui.tabButton(box, title, UI.inset + i * (tabWidth + tabs.gap), tabs.top, tabWidth, tabs.height, tab === i, () => {
            if (tab === i) return;
            p.tab = i;
            p.tabFeedback = true;
            ctx.refresh();
        });
        ctx.ui.buttonIcon(button, icon, 40);
        if (tab === i && p.tabFeedback) { replayButtonPress(button); delete p.tabFeedback; }
        if (ready && i !== tab) ctx.ui.actionBadge(button, "FamilyTabActionHint");
    });

    if (!nurture && p.pairing) {
        const first = s.people.find(q => q.id === p.partner);
        const candidates = first ? [first, ...s.people.filter(q => canMarry(s, first, q))]
            : s.people.filter(q => s.people.some(other => canMarry(s, q, other)));
        const top = 257, step = FAMILY_UI.candidate + FAMILY_UI.rowGap;
        residentCardText(ctx, box, first ? `为 ${first.name} 选择另一半` : "选择成家村民",
            UI.inset + 3, 194, 330, 50, 28, C.ink, true);
        ctx.ui.button(box, "返回家庭", UI.inset + 416, 194, 178, () => {
            delete p.pairing; delete p.partner; delete p.pairingScroll; ctx.refresh();
        }, C.muted, 50);
        const rows = new ScrollList(UI.contentWidth, height - top - UI.inset, candidates.length * step,
            p.pairingScroll, offset => p.pairingScroll = offset);
        rows.pos(UI.inset, top); box.addChild(rows);
        rows.setVirtualRows(candidates.length, step, (index, row) => {
            const q = candidates[index], selected = q === first, width = UI.contentWidth - UI.scrollGutter;
            row.name = `FamilyCandidate:${q.id}`;
            row.size(width, FAMILY_UI.candidate);
            ctx.art.panel(row, "panel_card", width, FAMILY_UI.candidate);
            drawResidentAvatar(ctx, row, ctx.art.portraitId(q), 13, 13, 124);
            residentCardText(ctx, row, coloredName(q), 155, 20, width - 155 - UI.cellActionDot.clearRight, 49, 31, C.ink, true);
            residentCardText(ctx, row, selected ? "已选" : q.traits.map(t => TRAITS[t][0]).join(" · "),
                155, 79, 199, 45, 24, selected ? C.green : C.muted);
            if (selected) {
                ctx.ui.button(row, "重选", width - 139, 77, 123, () => {
                    delete p.partner; p.pairingScroll = 0; ctx.refresh();
                }, C.muted, 51);
                return;
            }
            const available = !blocked && Number.isSafeInteger(s.nextFamily + 1);
            ctx.ui.button(row, first ? "确认成家" : "选为第一位", width - 181, 77, 165, () => {
                if (!first) {
                    p.partner = q.id; p.pairingScroll = 0; ctx.refresh();
                } else {
                    const back: FamilyView = { ...p, pairing: undefined, partner: undefined, pairingScroll: undefined };
                    p.pendingChoice = { accepted: next => next.families.some(f => f.partners.includes(first.id) && f.partners.includes(q.id)), back };
                    ctx.send({ type: "FAMILY", a: first.id, b: q.id });
                }
            }, C.gold, 51, available);
            if (available) ctx.ui.cellActionBadge(row, "MarriagePartnerHint");
        });
        if (!candidates.length) residentCardText(ctx, box, "暂无可成家的村民", UI.inset, top + 40, UI.contentWidth, 60, 29, C.muted).align = "center";
        return;
    }

    if (!nurture) {
        const subtitle = pair ? "可以成家的一对" : hints.marriage ? "为成年、未退休的单身男女安排成家。"
            : s.phase !== "DAY" ? "白天可安排成家" : !Number.isSafeInteger(s.nextFamily + 1) ? "家庭编号已达安全范围" : "暂无可成家的单身男女";
        ctx.ui.label(box, subtitle, UI.inset, hints.marriage ? 195 : 214, UI.contentWidth, 27, C.muted, false, 40).align = "center";
    }
    if (nurture) {
        const stock = new Laya.Sprite(); stock.pos(UI.inset, 198); box.addChild(stock);
        ctx.art.panel(stock, "panel_card", UI.contentWidth, 62);
        ctx.ui.iconValue(stock, "icon_house", `空床 ${capacity(s) - s.people.length}`, 15, 4, 185, 54);
        ctx.ui.coinCost(stock, s, { coins: RULE.birthCost }, 301, 4, UI.contentWidth - 319, 54);
    } else if (pair) {
        const card = new Laya.Sprite(); card.pos(UI.inset, 242).size(UI.contentWidth, 298); box.addChild(card);
        ctx.art.panel(card, "panel_card", UI.contentWidth, 298);
        drawPartners(ctx, card, pair, UI.contentWidth, true);
        ctx.ui.button(card, "确认成家", (UI.contentWidth - 224) / 2, 222, 224,
            () => ctx.send({ type: "FAMILY", a: pair[0].id, b: pair[1].id }), C.gold, 60);
        ctx.ui.cellActionBadge(card, "MarriageActionHint");
    } else {
        const button = ctx.ui.centerButton(box, "安排村民成家", 238, () => {
            p.pairing = true; ctx.refresh();
        }, C.green, hints.marriage);
        if (hints.marriage) ctx.ui.actionBadge(button, "MarriageActionHint");
    }
    const rowsTop = pair ? 602 : FAMILY_UI.rowsTop[nurture ? "nurture" : hints.marriage ? "marriage" : "unavailable"];
    if (!nurture) ctx.ui.label(box, "已有家庭", UI.inset + 2, rowsTop - 42, 320, 28, C.ink, true, 40);

    const viewport = height - rowsTop - UI.inset;
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
        card.name = `family:${family.id}`; card.size(cardWidth, rowHeight);
        ctx.art.panel(card, "panel_card", cardWidth, rowHeight);
        row.addChild(card);
        const partners = family.partners.map(id => person(s, id));
        if (!nurture) {
            drawPartners(ctx, card, partners, cardWidth);
            return;
        }
        const center = cardWidth / 2;
        drawResidentAvatar(ctx, card, ctx.art.portraitId(partners[0]), center - 148, 12, 112);
        ctx.ui.image(card, "icon_heart", center - 19, 48, 38);
        drawResidentAvatar(ctx, card, ctx.art.portraitId(partners[1]), center + 36, 12, 112);
        const names = ctx.ui.label(card, partners.map(q => coloredName(q)).join(" 与 "), 20, 126, cardWidth - 40, 29, C.ink, true, 39);
        names.align = "center"; names.wordWrap = false; names.overflow = Laya.Text.SHRINK;
        card.graphics.drawLine(20, 166, cardWidth - 20, 166, C.paper, 2);

        const child = s.people.find(q => !q.adult && q.parents.some(id => family.partners.includes(id)));
        if (child) ctx.ui.image(card, ctx.art.portraitId(child), 19, 178, 50);
        const childX = child ? 71 : 18;
        const childText = ctx.ui.label(card, child ? `${coloredName(child)}\n成长 ${child.growth}/${RULE.growNights}` : "暂无未成年孩子",
            childX, 167, center - childX + 16, 25, C.muted, false, 74);
        childText.valign = "middle"; childText.overflow = Laya.Text.SHRINK;

        const reason = birthUnavailableReason(s, family.id) ?? (Number.isSafeInteger(s.nextPerson + 1) ? null : "人口编号已达安全范围");
        if (!reason && !blocked) {
            ctx.ui.button(card, "迎接孩子", cardWidth - 220, 176, 194, () => {
                ctx.confirmSpend({ title: "迎接孩子", actionText: "确认迎接", image: "icon_baby",
                    detail: `${partners.map(q => q.name).join("与")}迎来一位新成员`, coins: RULE.birthCost, showBadge: true },
                    () => ctx.send({ type: "BIRTH", family: family.id }));
            }, C.gold, 55);
            ctx.ui.cellActionBadge(card, "BirthActionHint");
        } else {
            const status = reason ? reasonBesideCost(reason) ?? "尔币不足" : "暂不可迎接";
            const note = ctx.ui.label(card, status, center + 25, 167, center - 43, 25, C.muted, true, 74);
            note.align = "center"; note.valign = "middle"; note.overflow = Laya.Text.SHRINK;
        }
    });
}
