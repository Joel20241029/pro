import { PATROL } from "../../config/PatrolConfig";
import { ECONOMY } from "../../config/RuleConfig";
import { VILLAGER_QUALITY } from "../../config/VillagerQuality";
import { RULE } from "../../game/GameConfig";
import { GameState, isElder, isWorkingAdult } from "../../game/GameState";
import { laborSlots } from "../../game/Growth";
import { JOB_NAMES, person } from "../../game/VillageRules";
import { recommendedPeople } from "../RoleRecommendations";
import { ScrollList } from "../ScrollList";
import { C, UI } from "../UiTheme";
import { Panel, PanelContext } from "./PanelContext";
import { drawResidentTalent, drawResidentQuality, residentCardText } from "./ResidentCards";

/** 审稿版的卡片尺度，单位为逻辑像素。留白同时给短屏的面板回弹预留空间。 */
const DETAIL = { top: 118, bottom: 49, screenMargin: 24, gap: 19, profile: 206, talent: 170, bonus: 156,
    work: 251, closedWork: 144, status: 138, archive: 162 } as const;

export function drawPersonDetailPanel(ctx: PanelContext, s: GameState, p: Panel, safeHeight: number) {
    const ancestor = p.type === "ancestor";
    const q = ancestor ? s.history.find(person => person.id === p.id)! : person(s, p.id!);
    const quality = VILLAGER_QUALITY[q.quality], special = q.quality !== "COMMON";
    const elder = isElder(q), worker = isWorkingAdult(q), canAssign = worker && s.phase === "DAY" && !ancestor;
    const favorite = s.favorites.includes(q.id), favoriteFull = s.favorites.length >= RULE.favoriteCap;
    const statusHeight = ancestor ? DETAIL.archive : worker ? canAssign ? DETAIL.work : DETAIL.closedWork : DETAIL.status;
    const contentHeight = DETAIL.profile + DETAIL.talent + statusHeight + DETAIL.gap * 2 + (special ? DETAIL.bonus + DETAIL.gap : 0);
    const preferredHeight = DETAIL.top + contentHeight + DETAIL.bottom;
    const height = Math.min(preferredHeight, Math.floor(safeHeight) - DETAIL.screenMargin * 2);
    const help = ancestor ? `珍藏最多 ${RULE.favoriteCap} 位，满了可先取消一位。普通家谱保留最近 ${RULE.historyCap} 位先辈。`
        : elder ? "养老的人仍占一个住房名额，口粮计入全村。成功守夜推进晚年，寿终后记入家谱。"
            : !q.adult ? "孩子由成年村民照料，成功守夜才能成长。在成人详情中安排照料。"
                : `白天工作与夜间岗位互不占用。夜间可驻塔，或在${PATROL.building}担任${PATROL.role}。`;
    const box = ctx.modal(ancestor ? "先辈详情" : "村民详情", "", true, { width: UI.panelWidth, height }, help);
    let parent = box, x: number = UI.inset, y: number = DETAIL.top;
    if (height < preferredHeight) {
        const list = new ScrollList(UI.contentWidth + UI.scrollGutter, height - DETAIL.top - DETAIL.bottom,
            contentHeight, p.scroll, offset => p.scroll = offset);
        list.pos(UI.inset, DETAIL.top); box.addChild(list);
        parent = list.content; x = 0; y = 0;
    }
    const card = (name: string, height: number) => {
        const node = new Laya.Sprite(); node.name = `ResidentDetail:${name}`;
        node.pos(x, y).size(UI.contentWidth, height); ctx.art.panel(node, "panel_card", node.width, node.height);
        parent.addChild(node); y += height + DETAIL.gap;
        return node;
    };
    const text = residentCardText.bind(null, ctx);
    const heading = (node: Laya.Sprite, value: string) => text(node, value, 26, 14, 300, 43, 33, C.ink, true);
    const bio = card("profile", DETAIL.profile);
    if (special) text(bio, quality.label, 28, 20, 111, 40, 27, q.quality === "HERO" ? C.heroName : C.timber, true);
    text(bio, q.name, 28, special ? 62 : 37, 334, 60, 51, C.ink, true);
    const parents = q.parents.map(id => s.people.find(a => a.id === id)?.name ?? s.history.find(a => a.id === id)?.name ?? "更早的家族成员");
    const origin = q.origin === "TRAVELER" ? "路过村落的旅人" : "开村人";
    text(bio, `第 ${q.generation} 代${parents.length ? "" : ` · ${origin}`}`, 28, special ? 129 : 107, 338, 38, 25, C.muted);
    if (parents.length) text(bio, `双亲：${parents.join("、")}`, 28, 163, 338, 30, 24, C.muted);
    // 审稿版的麦色圆框和图集有效像素头像。圆框仅作底衬，不影响头像缩放。
    bio.graphics.drawEllipse(487, 99, 75, 75, "#f1d7a4", null, 0);
    bio.graphics.drawEllipse(487, 99, 70, 70, "#f7e4b9", null, 0);
    ctx.ui.image(bio, ctx.art.portraitId(q, ancestor), 415, 29, 144, 146);

    drawResidentTalent(ctx, card("talent", DETAIL.talent), q);
    if (special) drawResidentQuality(ctx, card("bonus", DETAIL.bonus), quality);

    const status = card(worker && !ancestor ? "jobs" : "status", statusHeight);
    if (ancestor) {
        heading(status, "家谱珍藏");
        const record = `来自第 ${q.id.split(":")[0]} 个村落`;
        text(status, `${!favorite && favoriteFull ? `珍藏已满 ${RULE.favoriteCap} 位 · ` : ""}${record}`, 26, 54, 548, 34, 25, C.muted);
        const button = ctx.ui.centerButton(status, favorite ? "取消珍藏" : "珍藏这位先辈", 91,
            () => ctx.send({ type: "FAVORITE", id: q.id }), C.gold, favorite || !favoriteFull, 300, 58);
        if (favorite) ctx.ui.personRibbon(button, "tag_favorite");
        return;
    }
    if (!worker) {
        heading(status, elder ? "养老" : "成长与照料");
        const carer = s.people.find(a => a.careChild === q.id);
        text(status, elder ? `养老还剩 ${q.elderNights} 夜` : `还需照料并守住 ${RULE.growNights - q.growth} 夜`, 28, 63, 516, 31, 27, C.ink, true);
        if (elder) {
            text(status, "基础口粮", 28, 98, 111, 30, 25, C.muted);
            ctx.ui.iconValue(status, "icon_food", `${q.trait === "trait_frugal" ? ECONOMY.frugalRation : RULE.adultRation}/夜`, 146, 95, 130, 36, C.timber, 25, "left");
        } else text(status, carer ? `${carer.name} 正在照料` : "无人照料，成长暂停", 28, 98, 510, 30, 25, C.muted);
        return;
    }

    heading(status, "工作与照料");
    status.graphics.drawRoundRect(395, 17, 180, 40, 14, 14, 14, 14, "#e9eed3");
    text(status, `距退休 ${q.nights} 夜`, 399, 17, 172, 40, 24, C.green, true).align = "center";
    const captain = q.id === s.patrol.captain;
    text(status, "白天岗位", 27, 69, 145, 31, 25, C.muted);
    text(status, JOB_NAMES[q.job], 28, 101, 152, 40, 33, C.ink, true);
    if (captain) text(status, `夜间 · ${PATROL.role}`, canAssign ? 28 : 315, canAssign ? 143 : 100, canAssign ? 272 : 255, 24, 24, C.muted);
    if (!canAssign) return;
    const towers = ctx.game.battle?.base.towers ?? s.towers;
    const jobs = (["FARM", "LOGGING"] as const).filter(job => q.job !== job);
    jobs.forEach((job, i) => {
        const full = s.people.filter(a => a.job === job).length >= laborSlots(job, job === "FARM" ? s.farm : s.logging);
        const title = `${full ? "更换" : "安排"}${JOB_NAMES[job]}${full && jobs.length === 1 ? "村民" : ""}`;
        const button = ctx.ui.button(status, title, jobs.length === 1 ? 315 : 207 + 185 * i, 79,
            jobs.length === 1 ? 259 : 182, () => {
                if (full) ctx.open({ type: "workers", id: q.id, job });
                else ctx.send({ type: "JOB", id: q.id, job });
            }, C.green, 72);
        if (recommendedPeople(s.people, job, towers).includes(q)) ctx.ui.personRibbon(button, "tag_recommended");
    });
    status.graphics.drawRect(24, 169, status.width - 48, 1, "#e1c28a");
    const needsCare = s.people.some(child => !child.adult && !s.people.some(a => a.careChild === child.id));
    const caredChild = s.people.find(child => child.id === q.careChild);
    text(status, caredChild ? `照料 · ${caredChild.name}` : "照料孩子", 28, 184, 294, 44, 28, C.ink, true);
    if (needsCare) {
        const button = ctx.ui.button(status, "选择孩子", 383, 180, 190, () => ctx.open({ type: "care", id: q.id }), C.green, 57);
        if (recommendedPeople(s.people, "CARE", towers).includes(q)) ctx.ui.personRibbon(button, "tag_recommended");
    } else if (!caredChild) text(status, "暂无待照料的孩子", 215, 184, 357, 44, 27, C.muted).align = "right";
}
