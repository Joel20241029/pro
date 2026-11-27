import { EXPEDITION, EXPEDITION_EVENTS, EXPEDITION_ROUTES, ExpeditionRoute } from "../../config/ExpeditionConfig";
import { Expedition, ExpeditionReport, expeditionClaimQuote, expeditionDeparturePreview, expeditionNightsLeft, expeditionUnavailableReason } from "../../game/Expedition";
import { ITEMS } from "../../config/ShopConfig";
import { GameState, isWorkingAdult } from "../../game/GameState";
import { JOB_NAMES } from "../../game/VillageRules";
import { actionHintsBlocked } from "../ActionHints";
import { ScrollList } from "../ScrollList";
import { C, UI } from "../UiTheme";
import { coloredName } from "../ViewText";
import type { Panel, PanelContext } from "./PanelContext";
import { residentCardText } from "./ResidentCards";

const ROUTES = Object.keys(EXPEDITION_ROUTES) as ExpeditionRoute[];
const HELP = "每守住一夜，就收到一份探索战报。探索期间暂停村务和寿命，村民回村后可领取路线道具。";
/** 路线和派遣人选共用单列滚动区，派遣按钮留在对应村民卡内。 */
const STYLE = { inset: 42, button: 80, dispatchHeight: 1040, dispatchTop: 157, dispatchRow: 168, rowGap: 14, report: 116, reportGap: 16 } as const;
const signed = (value: number) => value > 0 ? `+${value}` : value < 0 ? `−${-value}` : "0";

function centered(ctx: PanelContext, parent: Laya.Sprite, text: string, y: number, h: number, size: number, color = C.ink, bold = true) {
    const label = residentCardText(ctx, parent, text, 14, y, parent.width - 28, h, size, color, bold);
    label.align = "center";
    return label;
}

function reportCard(ctx: PanelContext, host: Laya.Sprite, report: ExpeditionReport, x: number, y: number, w: number, night?: number) {
    const event = EXPEDITION_EVENTS[report.event];
    const card = host.addChild(new Laya.Sprite()).pos(x, y).size(w, STYLE.report);
    card.name = "ExpeditionReport";
    ctx.art.panel(card, "panel_card", w, STYLE.report);
    card.graphics.drawLine(5, 22, 5, STYLE.report - 22, C.status, 7);
    residentCardText(ctx, card, event.area, 25, 15, w - 155, 40, 30, C.ink, true);
    if (night !== undefined)
        residentCardText(ctx, card, `第 ${night} 夜`, w - 130, 15, 103, 40, 23, C.muted).align = "right";
    const copy = ctx.ui.label(card, event.text, 25, 58, w - 50, 25, C.ink, false, 44);
    copy.overflow = Laya.Text.SHRINK;
}

function explorer(ctx: PanelContext, box: Laya.Sprite, s: GameState, trip: Expedition, subtitle: string) {
    const size = 130, x = STYLE.inset, y = 124;
    box.graphics.drawCircle(x + size / 2, y + size / 2, size / 2, C.petalCenter);
    const member = s.people.find(p => p.id === trip.personId)!;
    ctx.ui.image(box, ctx.art.portraitId(member), x + 9, y + 9, size - 18);
    residentCardText(ctx, box, trip.name, x + size + 26, y + 19, box.width - x - size - 55, 52, 41, C.ink, true);
    residentCardText(ctx, box, subtitle, x + size + 26, y + 79, box.width - x - size - 55, 40, 26, C.muted);
}

export function drawExpeditionReportPopup(ctx: PanelContext, s: GameState, trip: Expedition) {
    const count = trip.reports.length, left = expeditionNightsLeft(trip), top = 284;
    const buttonY = top + STYLE.report + 70;
    const box = ctx.modal("521探索战报", "", false, { width: UI.panelWidth, height: buttonY + STYLE.button + UI.action.bottom });
    explorer(ctx, box, s, trip, `第 ${count} 夜 · ${EXPEDITION_ROUTES[trip.route].name}`);
    reportCard(ctx, box, trip.reports[count - 1], STYLE.inset, top, box.width - 2 * STYLE.inset);
    centered(ctx, box, left ? `再守住 ${left} 夜回村` : trip.rewardConverted ? "已回村 · 旧奖励已折算为尔币" : "已回村 · 可领取本趟收获", top + STYLE.report + 12, 40, 26, C.muted, false);
    ctx.ui.centerButton(box, left || trip.rewardConverted ? "继续" : "查看收获", buttonY, () => ctx.send({
        type: "ACK_EXPEDITION_REPORT", run: s.run, departedAfter: trip.departedAfter, reportCount: count
    }), C.gold, !actionHintsBlocked(ctx.game), box.width - 2 * STYLE.inset, STYLE.button);
}

export function drawExpeditionReturn(ctx: PanelContext, s: GameState, automatic: boolean) {
    const trip = s.expedition!, reward = expeditionClaimQuote(s);
    if (!reward) return;
    const top = automatic ? 354 : 268, width = UI.panelWidth - STYLE.inset * 2;
    const rewardHeight = 140;
    const buttonY = top + rewardHeight + 28;
    const box = ctx.modal(automatic ? "探索归来" : "探索行囊", "", !automatic, {
        width: UI.panelWidth, height: buttonY + STYLE.button + UI.action.bottom
    });
    const artY = 116, mid = box.width / 2;
    const member = s.people.find(p => p.id === trip.personId);
    const showMember = automatic && !!member;
    box.graphics.drawCircle(mid, artY + 73, 64, C.petalCenter);
    if (showMember) {
        ctx.ui.image(box, ctx.art.portraitId(member), mid - 75, artY, 150);
        box.graphics.drawCircle(mid + 63, artY + 121, 31, C.cream, C.trim, 2);
        ctx.ui.image(box, "icon_backpack", mid + 41, artY + 98, 45);
    } else ctx.ui.image(box, "icon_backpack", mid - 52, artY + 22, 104);
    if (automatic) {
        centered(ctx, box, `${trip.name}回村了`, 275, 41, 36);
        centered(ctx, box, `${EXPEDITION_ROUTES[trip.route].name} · ${trip.reports.length} 夜`, 317, 31, 24, C.muted, false);
    }
    const item = ITEMS[reward], card = box.addChild(new Laya.Sprite()).pos(STYLE.inset, top).size(width, rewardHeight);
    ctx.art.panel(card, "panel_card", width, rewardHeight);
    const icon = ctx.ui.image(card, item.icon, 32, 20, 100);
    residentCardText(ctx, card, `${item.name} ×1`, 162, 20, width - 186, 53, 35, C.ink, true);
    residentCardText(ctx, card, "领取后放入背包", 162, 75, width - 186, 45, 26, C.muted);
    const blocked = actionHintsBlocked(ctx.game);
    if (automatic) ctx.ui.button(box, "稍后领取", STYLE.inset, buttonY, 240,
        () => ctx.send({ type: "DISMISS_EXPEDITION" }), C.muted, STYLE.button, !blocked);
    ctx.ui.button(box, "收下", automatic ? STYLE.inset + 260 : STYLE.inset, buttonY, automatic ? width - 260 : width,
        () => ctx.claimExpedition(icon), C.gold, STYLE.button, !blocked);
}

export function drawExpeditionPanel(ctx: PanelContext, s: GameState, panel: Panel, available: number) {
    const trip = s.expedition;
    if (trip?.rewardConverted) { drawExpeditionReportPopup(ctx, s, trip); return; }
    if (trip?.remaining) { drawExpeditionReturn(ctx, s, false); return; }
    const inset = STYLE.inset, width = UI.panelWidth - 2 * inset, step = STYLE.report + STYLE.reportGap;
    if (trip) {
        const route = EXPEDITION_ROUTES[trip.route], count = trip.reports.length, left = expeditionNightsLeft(trip), listY = 425;
        const height = Math.min(available - UI.action.bottom, count ? listY + count * step + 30 : 405);
        const box = ctx.modal(EXPEDITION.name, "", true, { width: UI.panelWidth, height }, HELP);
        explorer(ctx, box, s, trip, `探索中 · ${route.name}`);
        const x = inset + 20, span = width - 40, y = 295;
        box.graphics.drawLine(x, y, x + span, y, C.trim, 5);
        for (let i = 0; i < route.nights; i++) {
            const done = i < count, at = x + i * span / (route.nights - 1);
            box.graphics.drawCircle(at, y, 16, done ? C.status : C.cream, done ? C.status : C.trim, 3);
            if (done) box.graphics.drawLines(0, 0, [at - 7, y, at - 2, y + 6, at + 8, y - 6], C.cream, 4);
        }
        residentCardText(ctx, box, `再守住 ${left} 夜回村`, inset, 323, 350, 48, 32, C.ink, true);
        residentCardText(ctx, box, "寿命暂停", box.width - inset - 158, 325, 158, 44, 24, C.muted).align = "right";
        if (count) {
            residentCardText(ctx, box, "探索战报", inset, 373, width, 43, 29, C.ink, true);
            const list = new ScrollList(width + UI.scrollGutter, height - listY - 30, count * step - STYLE.reportGap,
                panel.scroll, offset => panel.scroll = offset);
            list.pos(inset, listY); box.addChild(list);
            trip.reports.forEach((report, i) => reportCard(ctx, list.content, report, 0, i * step, width, i + 1));
        }
        return;
    }
    const height = Math.min(STYLE.dispatchHeight, available - UI.action.bottom);
    const box = ctx.modal(EXPEDITION.name, "", true, { width: UI.panelWidth, height }, HELP);
    const route = panel.expeditionRoute ?? ROUTES[0], blocked = actionHintsBlocked(ctx.game);
    const candidates = s.people.filter(isWorkingAdult).map(p => ({ p, reason: expeditionUnavailableReason(s, p.id) })).sort((a, b) =>
        Number(!!a.reason) - Number(!!b.reason) || Number(a.p.job !== "WAITING") - Number(b.p.job !== "WAITING"));
    const rowHeight = STYLE.dispatchRow, rowStep = rowHeight + STYLE.rowGap, count = ROUTES.length + Math.max(1, candidates.length);
    residentCardText(ctx, box, "选择路线，再派一名村民", inset, 112, width, 37, 26, C.ink, true);
    const list = new ScrollList(width + UI.scrollGutter, height - STYLE.dispatchTop - UI.action.bottom,
        count * rowStep - STYLE.rowGap, panel.scroll, offset => panel.scroll = offset);
    list.pos(inset, STYLE.dispatchTop); box.addChild(list);
    list.setVirtualRows(count, rowStep, (index, row) => {
        if (index < ROUTES.length) {
            const value = ROUTES[index], option = EXPEDITION_ROUTES[value], selected = value === route;
            const tile = ctx.ui.button(row, "", 0, 0, width, () => {
                if (value !== route && ctx.current === panel) { panel.expeditionRoute = value; ctx.refresh(); }
            }, C.muted, rowHeight, true, true);
            tile.name = `ExpeditionRoute:${value}`;
            const face = tile.getChildByName("buttonFace") as Laya.Sprite;
            ctx.ui.choiceState(tile, selected);
            face.graphics.drawCircle(75, rowHeight / 2, 56, C.petalCenter);
            ctx.ui.image(face, value === "lobby" ? "icon_backpack" : "icon_night_shield", 25, (rowHeight - 100) / 2, 100);
            residentCardText(ctx, face, option.name, 145, 19, width - 285, 42, 32, C.ink, true);
            residentCardText(ctx, face, `${option.nights} 夜回村`, 145, 65, width - 285, 37, 25, C.muted);
            residentCardText(ctx, face, selected ? "✓ 已选" : "选这条 ›", width - 132, 27, 110, 43, 25,
                selected ? C.green : C.status, true).align = "right";
            const item = ITEMS[option.reward];
            ctx.ui.iconValue(face, item.icon, `${item.name} ×1`, 145, 110, width - 173, 43, C.ink, 25, "left");
            return;
        }
        const member = candidates[index - ROUTES.length];
        if (!member) {
            residentCardText(ctx, row, "暂无可派的成年村民", 0, 14, width, 47, 27, C.muted).align = "center";
            return;
        }
        const { p, reason } = member;
        const candidate = row.addChild(new Laya.Sprite()).size(width, rowHeight);
        candidate.name = `ExpeditionPerson:${p.id}`;
        ctx.art.panel(candidate, reason ? "panel_card_disabled" : "panel_card", width, rowHeight);
        candidate.graphics.drawCircle(75, rowHeight / 2, 56, C.petalCenter);
        ctx.ui.image(candidate, ctx.art.portraitId(p), 22, (rowHeight - 106) / 2, 106);
        residentCardText(ctx, candidate, coloredName(p), 145, 15, width - 318, 42, 31, C.ink, true);
        if (reason) {
            residentCardText(ctx, candidate, reason, 145, 61, width - 168, 39, 25, C.muted);
            return;
        }
        const preview = expeditionDeparturePreview(s, p.id, route);
        const assignment = preview.replacements.length ? `${preview.replacements.map(v => v.name).join("、")}补岗` : JOB_NAMES[p.job];
        residentCardText(ctx, candidate, assignment, 145, 58, width - 318, 35, 24, C.muted);
        if (preview.coins) ctx.ui.iconValue(candidate, "icon_coin", `守夜缝纫 ${signed(preview.coins)}`,
            145, 110, width - 174, 38, C.muted, 24, "left");
        ctx.ui.button(candidate, "派出探索", width - 165, 42, 150, () => {
            if (ctx.current !== panel || actionHintsBlocked(ctx.game)) return;
            const destination = EXPEDITION_ROUTES[route];
            ctx.confirmSpend({ title: "确认派出", actionText: "确认派出", image: ctx.art.portraitId(p),
                detail: `${p.name}将前往「${destination.name}」${destination.nights} 夜\n探索期间暂停村务和寿命` },
                () => ctx.send({ type: "START_EXPEDITION", id: p.id, route }));
        }, C.gold, 60, !blocked);
    });
}
