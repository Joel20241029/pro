import { SEWING } from "../../config/RuleConfig";
import { GameState, isAvailableAdult, Person } from "../../game/GameState";
import { sewingDayCap, sewingSlots, sewingYield, upgradeCost, upgradeUnavailableReason } from "../../game/Growth";
import { actionHintsBlocked, jobVacancyHints } from "../ActionHints";
import { FACTORY_FRAME } from "../config/VillageSceneConfig";
import { recommendedPeople } from "../RoleRecommendations";
import { ScrollList } from "../ScrollList";
import { C, UI } from "../UiTheme";
import { amount, coloredName, growthPreview } from "../ViewText";
import { cardArt } from "./PanelCards";
import { Panel, PanelContext } from "./PanelContext";
import { dayJobChoice } from "./PeoplePanels";
import { RESIDENT_ROW_HEIGHT, residentCardText, residentListItem } from "./ResidentCards";

const FACTORY_VIEW = { top: 117, profile: 177, gap: 14, status: 114, workers: 83, footer: 90, rowGap: 12 } as const;

/** 同一份制衣进度用于首绘和前台读秒，完成一批后由会话刷新到账数字。 */
export function sewingProgressText(state: GameState, elapsedMs: number) {
    const { batches, earned } = state.factory, cap = sewingDayCap(state);
    if (earned >= cap || batches >= SEWING.maxBatches) return "已收工 · 守住下一波再开工";
    if (!state.people.some(p => p.job === "SEWING" && isAvailableAdult(state, p))) return "暂无村民制衣";
    return `下一批 ${Math.ceil(Math.max(0, SEWING.batchMs - elapsedMs) / 1000)} 秒 · 已完成 ${batches}/${SEWING.maxBatches} 批`;
}

export function drawFactoryPanel(ctx: PanelContext, state: GameState, page: Panel, available: number) {
    const { level, earned } = state.factory;
    const workers = state.people.filter(p => p.job === "SEWING" && isAvailableAdult(state, p));
    const v = FACTORY_VIEW, slots = sewingSlots(level);
    if (page.type === "factoryWorkers") {
        const waiting = state.people.filter(p => p.job === "WAITING" && isAvailableAdult(state, p));
        const recommended = recommendedPeople(waiting, "SEWING", []);
        const candidates = [...recommended, ...waiting.filter(person => !recommended.includes(person))];
        const box = ctx.modal("安排制衣", "", true, { width: UI.panelWidth, height: Math.min(UI.panelHeight, available - 40) });
        if (page.back) ctx.ui.backButton(box, () => ctx.open(page.back!, true));
        const step = RESIDENT_ROW_HEIGHT + v.rowGap, head = 54;
        const rows = new ScrollList(UI.contentWidth, box.height - v.top - UI.inset,
            head * 2 + step * (workers.length + candidates.length) + (workers.length ? 0 : head) + (candidates.length ? 0 : head),
            page.scroll, offset => page.scroll = offset);
        rows.pos(UI.inset, v.top);
        box.addChild(rows);
        const section = (people: Person[], y: number, name: string, empty: string, select = false) => {
            residentCardText(ctx, rows.content, name, 4, y, UI.contentWidth - 8, head, 28, C.ink, true);
            if (!people.length) {
                residentCardText(ctx, rows.content, empty, 8, y + head, UI.contentWidth - 16, head, 24, C.muted);
                return y + head * 2;
            }
            people.forEach((person, i) => {
                const row = new Laya.Sprite().pos(0, y + head + i * step);
                rows.content.addChild(row);
                const entry = residentListItem(ctx, row, coloredName(person), ctx.art.portraitId(person),
                    () => ctx.open({ type: "person", id: person.id, back: page }), person.job);
                ctx.ui.iconValue(row, "icon_coin", `每批 +${amount(sewingYield(state, person, "day"), true)}`,
                    178, 91, 206, 52, C.timber, 26, "left");
                if (select) {
                    if (recommended.includes(person)) ctx.ui.personRibbon(entry, "tag_recommended", true);
                    const choice = dayJobChoice(ctx, state, "SEWING", page);
                    ctx.ui.button(row, choice.full ? "换岗" : "安排", entry.width - 160, 92, 143, () => choice.select(person.id),
                        C.gold, 56, !actionHintsBlocked(ctx.game));
                }
            });
            return y + head + step * people.length;
        };
        const nextY = section(workers, 0, `在岗 ${workers.length}/${slots}`, "暂无在岗村民");
        section(candidates, nextY, "待安排", "暂无可加入的成年村民", true);
        return;
    }

    const cost = upgradeCost("FACTORY", level), reason = upgradeUnavailableReason(state, cost), blocked = actionHintsBlocked(ctx.game);
    const content = v.profile + v.status + v.workers + 2 * v.gap;
    const height = Math.min(available - 40, v.top + content + v.footer);
    const box = ctx.modal("曙光里制衣厂", "", true, { width: UI.panelWidth, height },
        "白天保持游戏在前台，制衣厂会自动发放批次收入。守住下一波可刷新批次与额度。制衣不占用夜间岗位。");
    if (page.back) ctx.ui.backButton(box, () => ctx.open(page.back!, true));
    const viewport = height - v.top - v.footer;
    const rows = new ScrollList(UI.contentWidth, viewport, content, page.scroll, offset => page.scroll = offset);
    rows.pos(UI.inset, v.top); box.addChild(rows);
    const width = UI.contentWidth - UI.scrollGutter;
    const card = (y: number, height: number, skin = "panel_card") => {
        const node = new Laya.Sprite().pos(0, y).size(width, height);
        ctx.art.panel(node, skin, width, height);
        rows.content.addChild(node);
        return node;
    };
    const profile = card(0, v.profile);
    cardArt(ctx, profile, FACTORY_FRAME, 15, 11, 154, 154, C.fernArt);
    residentCardText(ctx, profile, `${amount(level)} 级制衣厂`, 192, 21, width - 217, 51, 37, C.ink, true);
    residentCardText(ctx, profile, `制衣岗位  ${workers.length}/${slots}`, 192, 84, width - 217, 42, 29, C.muted, true);
    const operation = card(v.profile + v.gap, v.status, "panel_card_fern");
    residentCardText(ctx, operation, "今日收入", 22, 11, 235, 44, 27, C.ink, true);
    ctx.ui.iconValue(operation, "icon_coin", `${amount(earned, true)}/${amount(sewingDayCap(state), true)}`,
        292, 11, width - 313, 44, C.green, 30);
    const progress = residentCardText(ctx, operation, sewingProgressText(state, ctx.game.sewingProgressMs), 22, 62, width - 44, 38, 25, C.muted);
    progress.name = "SewingProgress";
    const staffing = card(v.profile + v.status + 2 * v.gap, v.workers);
    residentCardText(ctx, staffing, "制衣村民", 22, 14, 261, 52, 29, C.ink, true);
    const manage = ctx.ui.button(staffing, "查看安排", width - 205, 13, 183, () => ctx.open({ type: "factoryWorkers", back: page }), C.muted, 57);
    if (jobVacancyHints(state, blocked).SEWING) ctx.ui.actionBadge(manage, "SewingAssignmentHint");

    const footer = height - v.footer + 10;
    ctx.ui.coinCost(box, state, cost, UI.inset + 41, footer + 3, 195, 55);
    const upgrade = ctx.ui.button(box, "升级制衣厂", box.width - UI.inset - 272, footer, 272, () => {
        const nextSlots = sewingSlots(level + 1);
        const detail = nextSlots > slots ? `岗位 ${growthPreview(slots, nextSlots)} · 每人每批多赚 ${SEWING.dayPerUpgrade} 尔币`
            : `每人每批多赚 ${SEWING.dayPerUpgrade} 尔币`;
        ctx.confirmSpend({ title: "升级制衣厂", actionText: "确认升级", image: FACTORY_FRAME, detail,
            coins: cost.coins, showBadge: true }, () => ctx.send({ type: "BUILD", kind: "FACTORY" }));
    }, C.gold, 61, !blocked && reason === null);
    if (!blocked && !reason) ctx.ui.actionBadge(upgrade, "FactoryUpgradeHint");
    if (reason && state.coins >= cost.coins) ctx.ui.label(box, reason, UI.inset + 31, footer - 27, 228, 21, C.red, true, 35);
    return progress;
}
