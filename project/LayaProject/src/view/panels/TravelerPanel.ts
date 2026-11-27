import { VILLAGER_QUALITY } from "../../config/VillagerQuality";
import { RULE, TRAITS } from "../../game/GameConfig";
import type { GameState, Person } from "../../game/GameState";
import { capacity } from "../../game/VillageRules";
import { actionHintsBlocked } from "../ActionHints";
import { ScrollList } from "../ScrollList";
import { C, UI } from "../UiTheme";
import { cardArt } from "./PanelCards";
import type { PanelContext } from "./PanelContext";
import { drawResidentTalent, drawResidentQuality, residentCardText } from "./ResidentCards";

export const TRAVELER_TITLE = "旅人来访";
/** 固定底部接纳/谢绝，长详情只在本次来访的内容区内滑动。 */
const LAYOUT = { top: 118, gap: 14, profile: 284, tags: 64, talent: 156, quality: 132,
    home: 63, fullNote: 42, screenMargin: 24 } as const;
type TravelerView = PanelContext & { travelerDetails?: { key: string; scroll: number } };

export function drawTravelerPanel(ctx: TravelerView, state: GameState, traveler: Person, safeHeight: number) {
    const quality = VILLAGER_QUALITY[traveler.quality], special = traveler.quality !== "COMMON";
    const count = state.people.length, slots = capacity(state), full = count >= slots;
    const key = `${ctx.game.villageRevision}:${state.run}:${state.day}:${traveler.id}`;
    if (ctx.travelerDetails?.key !== key) delete ctx.travelerDetails;
    const details = ctx.travelerDetails, profileHeight = LAYOUT.profile + LAYOUT.tags;
    const talentHeight = LAYOUT.talent + (traveler.traits.length - 2) * 44;
    const contentHeight = profileHeight + (details ? LAYOUT.gap + talentHeight + (special ? LAYOUT.gap + LAYOUT.quality : 0) : 0);
    const footerHeight = LAYOUT.home + (full ? LAYOUT.fullNote : 0) + UI.action.pairHeight + UI.action.bottom;
    const height = Math.min(LAYOUT.top + contentHeight + LAYOUT.gap + footerHeight, Math.floor(safeHeight) - 2 * LAYOUT.screenMargin);
    const help = "有空余住房就能接纳旅人。谢绝后可在白天扩建民居，等待下一位旅人。";
    const box = ctx.modal(TRAVELER_TITLE, "", false, { width: UI.panelWidth, height }, state.summary ? `${state.summary}\n\n${help}` : help);
    const footerTop = height - footerHeight, available = footerTop - LAYOUT.top;
    let parent = box, x: number = UI.inset, y: number = LAYOUT.top;
    const width = available < contentHeight ? UI.contentWidth - UI.scrollGutter : UI.contentWidth;
    if (available < contentHeight) {
        const list = new ScrollList(UI.contentWidth, available, contentHeight, details?.scroll, offset => {
            if (details) details.scroll = offset;
        });
        list.pos(UI.inset, LAYOUT.top); box.addChild(list);
        parent = list.content; x = y = 0;
    }
    const profile = parent.addChild(new Laya.Sprite());
    profile.name = "Traveler:profile";
    profile.pos(x, y).size(width, profileHeight);
    ctx.art.panel(profile, "panel_card", width, profileHeight);
    cardArt(ctx, profile, ctx.art.portraitId(traveler), (width - 198) / 2, 16, 198);
    const text = residentCardText.bind(null, ctx, profile);
    text(traveler.name, 18, 219, width - 36, 50, 42, C.ink, true).align = "center";
    text([quality.label, ...traveler.traits.map(trait => TRAITS[trait][0])].join(" · "),
        26, 279, width - 52, 40, 27, special ? C.timber : C.muted, true).align = "center";
    if (details) {
        const section = parent.addChild(new Laya.Sprite()).pos(x, y + profileHeight + LAYOUT.gap).size(width, talentHeight);
        section.name = "Traveler:details";
        ctx.art.panel(section, "panel_card", width, talentHeight);
        drawResidentTalent(ctx, section, traveler, true);
        if (special) {
            const bonus = parent.addChild(new Laya.Sprite()).pos(x, section.y + talentHeight + LAYOUT.gap).size(width, LAYOUT.quality);
            ctx.art.panel(bonus, "panel_card", width, LAYOUT.quality);
            drawResidentQuality(ctx, bonus, quality, true);
        }
    }
    ctx.ui.iconValue(box, "icon_house", `住房 ${count}/${slots}`, 77, footerTop + 5, 236, 49, C.ink, 29, "left");
    ctx.ui.button(box, details ? "收起详情" : "能力详情", 384, footerTop + 3, 186, () => {
        if (details) delete ctx.travelerDetails;
        else ctx.travelerDetails = { key, scroll: Math.max(0, profileHeight + LAYOUT.gap - available / 3) };
        ctx.refresh();
    }, C.muted, 52);
    if (full) residentCardText(ctx, box, count >= RULE.populationCap ? "村民已满" : "住房已满，白天可增建民居",
        UI.inset, footerTop + LAYOUT.home - 2, UI.contentWidth, LAYOUT.fullNote, 26, C.red, true).align = "center";
    const buttonY = footerTop + LAYOUT.home + (full ? LAYOUT.fullNote : 0);
    const choose = (value: "accept" | "decline") => {
        delete ctx.travelerDetails;
        ctx.send({ type: "CHOOSE", value });
    };
    const blocked = actionHintsBlocked(ctx.game);
    ctx.ui.button(box, "礼貌谢绝", 101, buttonY, 191, () => choose("decline"), C.muted, UI.action.pairHeight, !blocked);
    const accept = !full && !blocked;
    const welcome = ctx.ui.button(box, "欢迎加入", 317, buttonY, 250, () => choose("accept"), C.gold, UI.action.pairHeight, accept);
    if (accept) ctx.ui.actionBadge(welcome, "TravelerAcceptHint");
}
