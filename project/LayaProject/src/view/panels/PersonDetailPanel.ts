import { PATROL } from "../../config/PatrolConfig";
import { VILLAGER_QUALITY } from "../../config/VillagerQuality";
import { RULE } from "../../game/GameConfig";
import { GameState, isElder, isExploring, isWorkingAdult } from "../../game/GameState";
import { expeditionNightsLeft } from "../../game/Expedition";
import { dayJobChoice } from "./PeoplePanels";
import { actionHintsBlocked, jobVacancyHints } from "../ActionHints";
import { JOB_NAMES, person } from "../../game/VillageRules";
import { recommendedPeople } from "../RoleRecommendations";
import { ScrollList } from "../ScrollList";
import { C, UI } from "../UiTheme";
import { cardArt } from "./PanelCards";
import { Panel, PanelContext } from "./PanelContext";
import { drawResidentTalent, drawResidentQuality, residentCardText } from "./ResidentCards";

/** 审稿版的卡片尺度，单位为逻辑像素。留白同时给短屏的面板回弹预留空间。 */
const DETAIL = { top: 118, bottom: 49, screenMargin: 24, gap: 19, profile: 246, talent: 170, bonus: 156,
    work: 177, closedWork: 144, status: 138, archive: 162 } as const;

export function drawPersonDetailPanel(ctx: PanelContext, s: GameState, p: Panel, safeHeight: number) {
    const ancestor = p.type === "ancestor";
    const q = ancestor ? s.history.find(person => person.id === p.id)! : person(s, p.id!);
    const quality = VILLAGER_QUALITY[q.quality], special = q.quality !== "COMMON";
    const elder = isElder(q), worker = isWorkingAdult(q), away = isExploring(s, q.id);
    const canAssign = worker && !away && s.phase === "DAY" && !ancestor;
    const favorite = s.favorites.includes(q.id), favoriteFull = s.favorites.length >= RULE.favoriteCap;
    const statusHeight = ancestor ? DETAIL.archive : worker ? canAssign ? DETAIL.work : DETAIL.closedWork : DETAIL.status;
    const talentHeight = DETAIL.talent + (q.traits.length - 2) * 44;
    const contentHeight = DETAIL.profile + talentHeight + statusHeight + DETAIL.gap * 2 + (special ? DETAIL.bonus + DETAIL.gap : 0);
    const preferredHeight = DETAIL.top + contentHeight + DETAIL.bottom;
    const height = Math.min(preferredHeight, Math.floor(safeHeight) - DETAIL.screenMargin * 2);
    const help = ancestor ? `珍藏最多 ${RULE.favoriteCap} 位，满了可先取消一位。普通家谱保留最近 ${RULE.historyCap} 位先辈。`
        : elder ? "养老的村民仍占一个住房名额。成功守夜推进晚年，寿终后记入家谱。"
            : !q.adult ? "每成功守夜一次，孩子成长一夜。"
                : `白天工作与夜间岗位互不占用。夜间可驻塔，或在${PATROL.building}担任${PATROL.role}。`;
    const box = ctx.modal(ancestor ? "先辈详情" : "村民详情", "", true, { width: UI.panelWidth, height }, help);
    if (p.back) ctx.ui.backButton(box, () => ctx.open(p.back!, true));
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
    if (special) text(bio, quality.label, 272, 35, 111, 40, 27, q.quality === "HERO" ? C.heroName : C.timber, true);
    text(bio, q.name, 272, special ? 80 : 55, 302, 63, 48, C.ink, true);
    const parents = q.parents.map(id => s.people.find(a => a.id === id)?.name ?? s.history.find(a => a.id === id)?.name ?? "更早的家族成员");
    const origin = q.origin === "TRAVELER" ? "路过村落的旅人" : "开村人";
    text(bio, `第 ${q.generation} 代${parents.length ? "" : ` · ${origin}`}`, 272, special ? 153 : 130, 302, 38, 25, C.muted);
    if (parents.length) text(bio, `双亲 ${parents.join("、")}`, 272, 198, 302, 30, 24, C.muted);
    cardArt(ctx, bio, ctx.art.portraitId(q, ancestor), 20, 13, 220);

    drawResidentTalent(ctx, card("talent", talentHeight), q);
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
        heading(status, elder ? "养老" : "成长");
        text(status, elder ? `养老还剩 ${q.elderNights} 夜` : `距成年还需守住 ${RULE.growNights - q.growth} 夜`, 28, 63, 516, 31, 27, C.ink, true);
        if (!elder) text(status, "每次成功守夜自动成长", 28, 98, 510, 30, 25, C.muted);
        return;
    }

    heading(status, "岗位");
    status.graphics.drawRoundRect(395, 17, 180, 40, 14, 14, 14, 14, C.fernArt);
    text(status, `距退休 ${q.nights} 夜`, 399, 17, 172, 40, 24, C.green, true).align = "center";
    if (away) {
        text(status, `探索中 · 还剩 ${expeditionNightsLeft(s.expedition!)} 夜`, 28, 63, 544, 32, 27, C.ink, true);
        text(status, "离村期间寿命暂停", 28, 101, 544, 32, 25, C.muted);
        return;
    }
    const towers = ctx.game.battle?.base.towers ?? s.towers, stationed = towers.findIndex(t => t.operator === q.id);
    const duty = q.id === s.patrol.captain ? PATROL.role : stationed < 0 ? "空闲" : `第 ${stationed + 1} 塔`;
    text(status, JOB_NAMES[q.job], 28, 66, 155, 44, 33, C.ink, true);
    text(status, `夜间 · ${duty}`, 28, 117, 181, 32, 24, C.muted);
    if (!canAssign || q.job === "SEWING") return;
    const vacancies = jobVacancyHints(s, actionHintsBlocked(ctx.game));
    const jobs = (["SEWING"] as const).filter(job => q.job !== job);
    const vacantJob = q.job === "WAITING" && jobs.find(job => vacancies[job]);
    jobs.forEach(job => {
        const choice = dayJobChoice(ctx, s, job, p), full = choice.full;
        const title = `${full ? "更换" : "安排"}${JOB_NAMES[job]}${full && jobs.length === 1 ? "村民" : ""}`;
        const button = ctx.ui.button(status, title, 315, 79,
            259, () => choice.select(q.id), C.green, 72);
        if (recommendedPeople(s.people.filter(p => !isExploring(s, p.id)), job, towers).includes(q)) ctx.ui.personRibbon(button, "tag_recommended");
    });
    if (vacantJob) ctx.ui.cellActionBadge(status, "JobAssignActionHint");
}
