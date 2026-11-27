import { GameState } from "../../game/GameState";
import { C, UI } from "../UiTheme";
import { ScrollList } from "../ScrollList";
import { RankingView } from "../RankingView";
import { RankingCanvasUnsupported } from "../../platform/WechatRankingCanvas";
import { RANKING_CANVAS } from "../../config/RankingConfig";
import { tacticRevealed } from "../../game/Tactics";
import { GUIDE_CHAPTERS } from "../GameGuide";
import { Panel, PanelContext } from "./PanelContext";
import { replayButtonPress } from "../ButtonFeedback";
import { cardArt } from "./PanelCards";
export function drawJournalPanel(ctx: PanelContext, s: GameState, p: Panel, available: number, deferRankingCanvas = false) {
    if (p.type === "ranking") {
        const box = ctx.modal("好友守村榜", "");
        // 构造前分配请求ID；原生能力失败保留外框与关闭操作，并记录具体错误。
        const trace = ctx.platform.rankingDiagnostics, request = trace.begin();
        ctx.platform.inspectRankingAuthorization(request);
        let ranking: RankingView | null = null;
        const showError = (error: unknown) => {
            trace.failure("view_error", request, error);
            if (ranking) ranking.destroy(); else trace.end(request);
            const message = error instanceof RankingCanvasUnsupported ? error.message : RANKING_CANVAS.unavailableText;
            cardArt(ctx, box, "icon_trophy", 267, 298, 134);
            ctx.ui.label(box, message, 54, 446, 560, 30, C.ink, false, 112).align = "center";
        };
        try {
            trace.record("construct_start", request);
            ranking = new RankingView(ctx.platform, s.legacy.bestNight, request);
            ranking.pos(34, 132);
            box.addChild(ranking);
            trace.record("attached", request);
            ranking.refreshRanking(deferRankingCanvas ? showError : undefined);
        } catch (error) {
            showError(error);
        }
        return;
    }
    if (p.type === "restart") {
        const footerY = 384, footerHeight = 78;
        const box = ctx.modal("确认重新开村", "", false, { width: 620, height: footerY + footerHeight + UI.action.bottom });
        cardArt(ctx, box, "icon_house", 230, 118, 160);
        ctx.ui.label(box, "当前村庄的全部进度将清空", 38, 280, 544, 31, C.red, true, 42).align = "center";
        ctx.ui.label(box, "微信好友榜成绩保留", 38, 328, 544, 26, C.muted, false, 36).align = "center";
        ctx.ui.button(box, "取消", 70, footerY, 180, () => p.back ? ctx.open(p.back, true) : ctx.close(), C.muted, footerHeight);
        ctx.ui.button(box, "确认重新开村", 274, footerY, 268, () => ctx.game.newVillage(), C.red, footerHeight);
        return;
    }
    if (p.type === "guideTopic") {
        const section = GUIDE_CHAPTERS[p.tab ?? 0].sections[p.index!];
        const inset = 24, top = 118, bottom = UI.action.bottom;
        const card = new Laya.Sprite();
        const body = ctx.ui.label(card, section.body, inset, inset, UI.contentWidth - inset * 2, 29, C.ink, false, UI.panelHeight);
        body.height = Math.ceil(body.textHeight) + 8;
        const cardHeight = body.height + inset * 2;
        const reserved = top + bottom;
        const height = Math.min(available - bottom, reserved + cardHeight);
        const box = ctx.modal(section.title, "", true, { width: UI.panelWidth, height });
        ctx.art.panel(card, "panel_card", UI.contentWidth, cardHeight);
        if (p.back) ctx.ui.backButton(box, () => ctx.open(p.back!, true));
        if (height - reserved >= cardHeight) {
            card.pos(UI.inset, top); box.addChild(card);
        } else {
            const rows = new ScrollList(UI.contentWidth + UI.scrollGutter, height - reserved, cardHeight, p.scroll, offset => p.scroll = offset);
            rows.pos(UI.inset, top); rows.content.addChild(card); box.addChild(rows);
        }
        return;
    }
    if (p.type === "guide") {
        const active = p.tab ?? 0, chapter = GUIDE_CHAPTERS[active];
        const top = 210, rowHeight = 132, gap = 12, rowWidth = UI.contentWidth - UI.scrollGutter;
        const height = Math.min(UI.panelHeight, available - UI.action.bottom);
        const box = ctx.modal("玩法说明", "", true, { width: UI.panelWidth, height });
        if (p.back) ctx.ui.backButton(box, () => ctx.open(p.back!, true));
        GUIDE_CHAPTERS.forEach((entry, i) => {
            const button = ctx.ui.tabButton(box, entry.title, 34 + i * 122, 116, 112, 72, i === active, () => {
                if (p.tab === i) return;
                const scroll = p.guideScroll ??= [];
                scroll[active] = p.scroll;
                p.tab = i; p.scroll = scroll[i]; p.index = undefined; p.tabFeedback = true; ctx.refresh();
            });
            if (i === active && p.tabFeedback) { replayButtonPress(button); delete p.tabFeedback; }
        });
        const sections = chapter.sections.map((section, index) => ({ section, index }))
            .filter(({ section }) => !section.tactic || tacticRevealed(s, section.tactic));
        const icons = active === 0 ? ["icon_night_shield", "icon_house", "icon_coin", "icon_backpack", "icon_coin", "icon_build", "icon_house"] : [];
        const chapterIcons = ["icon_house", "icon_population", "icon_family", "icon_build", "icon_night_shield"];
        const detail = sections.find(row => row.index === p.index);
        const body = detail ? new Laya.Sprite().size(rowWidth, 0) : null;
        if (body && detail) {
            const copy = ctx.ui.label(body, detail.section.body, 24, 17, rowWidth - 48, 28, C.ink, false, UI.panelHeight);
            copy.height = Math.ceil(copy.textHeight) + 6;
            body.height = copy.height + 34;
            ctx.art.panel(body, "panel_card", rowWidth, body.height);
        }
        const list = new ScrollList(UI.contentWidth, height - top - UI.inset,
            sections.length * (rowHeight + gap) + (body ? body.height + gap : 0), p.scroll, offset => p.scroll = offset);
        list.pos(UI.inset, top); box.addChild(list);
        let y = 0;
        sections.forEach(({ section, index }, i) => {
            const current = index === p.index;
            const entry = ctx.ui.button(list.content, section.title, 0, y, rowWidth, () => {
                p.index = current ? undefined : index;
                if (!current) p.scroll = yAtEntry;
                ctx.refresh();
            }, C.muted, rowHeight, true, true);
            const yAtEntry = y;
            const face = entry.getChildByName("buttonFace") as Laya.Sprite;
            const text = face.getChildByName("buttonText") as Laya.Text;
            text.pos(194, 12); text.size(entry.width - 260, rowHeight - 24); text.fontSize = 31;
            text.align = "left"; text.wordWrap = false; text.overflow = Laya.Text.SHRINK;
            cardArt(ctx, face, icons[index] ?? chapterIcons[active], 19, 12, 147, 108);
            ctx.ui.label(face, current ? "⌃" : "⌄", entry.width - 50, 11, 36, 33, C.ink, true, rowHeight - 22).align = "center";
            y += rowHeight + gap;
            if (current && body) { body.pos(0, y); list.content.addChild(body); y += body.height + gap; }
        });
        return;
    }
    const top = 118, rowHeight = 135, gap = 13, panelWidth = 620, cardWidth = panelWidth - 64;
    const box = ctx.modal("设置", "", true, { width: panelWidth, height: top + rowHeight * 3 + gap * 2 + UI.action.bottom },
        "村落进度保存在本机。离开期间没有收益或损耗。好友榜同步最高守村纪录。");
    const settings = [
        { icon: "icon_settings", title: "游戏声音", button: s.settings.music ? "游戏声音 · 开" : "游戏声音 · 关",
            action: () => ctx.send({ type: "MUSIC", enabled: !s.settings.music }), color: s.settings.music ? C.gold : C.muted },
        { icon: "icon_view", title: "玩法说明", button: "玩法说明",
            action: () => ctx.open({ type: "guide", tab: 0, back: p }), color: C.muted },
        { icon: "icon_house", title: "从第一天开始", button: "重新开村…",
            action: () => ctx.open({ type: "restart", back: p }), color: C.red }
    ];
    settings.forEach(({ icon, title, button, action, color }, i) => {
        const row = box.addChild(new Laya.Sprite()).pos(32, top + i * (rowHeight + gap)).size(cardWidth, rowHeight);
        ctx.art.panel(row, "panel_card", cardWidth, rowHeight);
        cardArt(ctx, row, icon, 16, 10, 191, 115);
        ctx.ui.label(row, title, 226, 10, cardWidth - 242, 31, C.ink, true, 44);
        ctx.ui.button(row, button, 226, 59, cardWidth - 245, action, color, 57);
    });
}
