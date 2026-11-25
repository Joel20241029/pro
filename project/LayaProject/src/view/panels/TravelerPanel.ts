import { VILLAGER_QUALITY } from "../../config/VillagerQuality";
import { RULE } from "../../game/GameConfig";
import type { GameState, Person } from "../../game/GameState";
import { capacity } from "../../game/VillageRules";
import { ScrollList } from "../ScrollList";
import { C, UI } from "../UiTheme";
import type { PanelContext } from "./PanelContext";
import { drawResidentTalent, drawResidentQuality, residentCardText } from "./ResidentCards";

export const TRAVELER_TITLE = "旅人来访";
/** 审稿布局的逻辑像素。短屏仅压缩卡片区，住房和按钮固定在底部。 */
const LAYOUT = { top: 118, screenMargin: 24, profile: 186, talent: 158, bonus: 142, gap: 17, actionTop: 71, fullNote: 38 } as const;

export function drawTravelerPanel(ctx: PanelContext, state: GameState, traveler: Person, safeHeight: number) {
    const quality = VILLAGER_QUALITY[traveler.quality], special = traveler.quality !== "COMMON";
    const count = state.people.length, slots = capacity(state), full = count >= slots;
    const talentHeight = LAYOUT.talent + (traveler.traits.length - 2) * 44;
    const contentHeight = LAYOUT.profile + LAYOUT.gap + talentHeight + (special ? LAYOUT.gap + LAYOUT.bonus : 0);
    const footerHeight = LAYOUT.actionTop + (full ? LAYOUT.fullNote : 0) + UI.action.pairHeight + UI.action.bottom;
    const height = Math.min(LAYOUT.top + contentHeight + footerHeight, Math.floor(safeHeight) - 2 * LAYOUT.screenMargin);
    const help = "有空余住房就能接纳旅人。谢绝后可在白天扩建民居，等待下一位旅人。";
    const box = ctx.modal(TRAVELER_TITLE, "", false, { width: UI.panelWidth, height }, state.summary ? `${state.summary}\n\n${help}` : help);
    const footerTop = height - footerHeight, available = footerTop - LAYOUT.top;
    let parent = box, x: number = UI.inset, y: number = LAYOUT.top;
    if (available < contentHeight) {
        const list = new ScrollList(UI.contentWidth + UI.scrollGutter, available, contentHeight);
        list.pos(UI.inset, LAYOUT.top);
        box.addChild(list);
        parent = list.content; x = y = 0;
    }
    const card = (name: string, height: number) => {
        const node = new Laya.Sprite();
        node.name = `Traveler:${name}`;
        node.pos(x, y).size(UI.contentWidth, height);
        ctx.art.panel(node, "panel_card", node.width, height);
        parent.addChild(node);
        y += height + LAYOUT.gap;
        return node;
    };

    const profile = card("profile", LAYOUT.profile), text = residentCardText.bind(null, ctx, profile);
    if (special) text(quality.label, 228, 16, 100, 39, 28, traveler.quality === "HERO" ? C.heroName : C.timber, true);
    text(traveler.name, 228, special ? 55 : 36, 340, 58, 49, C.ink, true);
    text("希望加入村落", 228, special ? 124 : 106, 338, 36, 27, C.muted);
    profile.graphics.drawEllipse(112, 93, 84, 84, "#f1d7a4", null, 0);
    profile.graphics.drawEllipse(112, 93, 80, 80, "#f7e4b9", null, 0);
    ctx.ui.image(profile, ctx.art.portraitId(traveler), 22, 5, 180, 176);

    drawResidentTalent(ctx, card("talent", talentHeight), traveler, true);
    if (special) drawResidentQuality(ctx, card("bonus", LAYOUT.bonus), quality, true);

    ctx.ui.iconValue(box, "icon_house", `住房 ${count}/${slots}`, 224, footerTop + 17, 220, 44, C.ink, 29);
    if (full) residentCardText(ctx, box, count >= RULE.populationCap ? "村民已满，可等待空出名额" : "住房已满，白天可增建民居",
        UI.inset, footerTop + 61, UI.contentWidth, LAYOUT.fullNote, 27, C.red, true).align = "center";
    const buttonY = footerTop + LAYOUT.actionTop + (full ? LAYOUT.fullNote : 0);
    ctx.ui.button(box, "欢迎加入", 101, buttonY, 250, () => ctx.send({ type: "CHOOSE", value: "accept" }), C.gold, UI.action.pairHeight, !full);
    ctx.ui.button(box, "礼貌谢绝", 376, buttonY, 191, () => ctx.send({ type: "CHOOSE", value: "decline" }), C.muted, UI.action.pairHeight);
}
