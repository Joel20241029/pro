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
export function drawJournalPanel(ctx: PanelContext, s: GameState, p: Panel, deferRankingCanvas = false) {
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
            ctx.ui.label(box, message, 34, 360, 600, 30, C.ink, false, 140).align = "center";
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
        const footerY = 282, footerHeight = 78;
        const box = ctx.modal("确认重新开村", "", false, { width: 620, height: footerY + footerHeight + UI.action.bottom });
        ctx.ui.label(box, "当前村庄的全部进度将清空。", 38, 123, 544, 31, C.cream, true, 48).align = "center";
        ctx.ui.label(box, "确认后从第一天开始。\n已同步的微信好友榜成绩会保留。", 38, 188, 544, 27, C.cream, false, 82).align = "center";
        ctx.ui.button(box, "取消", 70, footerY, 180, () => p.back ? ctx.open(p.back) : ctx.close(), C.muted, footerHeight);
        ctx.ui.button(box, "确认重新开村", 274, footerY, 268, () => ctx.game.newVillage(), C.gold, footerHeight);
        return;
    }
    if (p.type === "guide") {
        const active = p.tab === undefined ? 0 : p.tab, chapter = GUIDE_CHAPTERS[active];
        const box = ctx.modal("玩法说明", "", true, undefined, "点标签切换章节，正文可上下滑动。灰色按钮旁会标出当前限制。");
        GUIDE_CHAPTERS.forEach((entry, i) => {
            const button = ctx.ui.button(box, entry.title, 34 + i * 122, 122, 112, () => {
                if (p.tab === i) return;
                p.tab = i; p.scroll = 0; p.tabFeedback = true; ctx.refresh();
            }, i === active ? C.gold : C.green, 72);
            if (i === active && p.tabFeedback) { replayButtonPress(button); delete p.tabFeedback; }
        });
        const content = new Laya.Sprite();
        content.name = `guide:${chapter.title}`;
        let y = 0;
        for (const section of chapter.sections) {
            if (section.tactic && !tacticRevealed(s, section.tactic)) continue;
            ctx.ui.label(content, section.title, 8, y, 568, 32, C.green, true, 48);
            const body = ctx.ui.label(content, section.body, 8, y + 56, 568, 29, C.ink, false, 1000);
            // 沿用 Tip 对真实排版高度的测量，避免以字数估行造成末尾裁切。
            body.height = Math.ceil(body.textHeight) + 8;
            y += 56 + body.height + 28;
        }
        content.size(UI.contentWidth - UI.scrollGutter, y);
        const rows = new ScrollList(UI.contentWidth, 606, y, p.scroll, offset => p.scroll = offset);
        rows.pos(34, 218);
        rows.content.addChild(content);
        box.addChild(rows);
        return;
    }
    const actionWidth = 312, actionHeight = 86, restartY = 336;
    const box = ctx.modal("设置", "", true, { width: 620, height: restartY + actionHeight + UI.action.bottom },
        "村落进度保存在本机。离开期间没有收益或损耗。好友榜同步最高守村纪录。");
    ctx.ui.centerButton(box, s.settings.music ? "游戏声音 · 开" : "游戏声音 · 关", 128, () => ctx.send({ type: "MUSIC", enabled: !s.settings.music }),
        s.settings.music ? C.green : C.muted, true, actionWidth, actionHeight);
    ctx.ui.centerButton(box, "玩法说明", 232, () => ctx.open({ type: "guide", tab: 0 }), C.gold, true, actionWidth, actionHeight);
    ctx.ui.centerButton(box, "重新开村…", restartY, () => ctx.open({ type: "restart", back: p }), C.red, true, actionWidth, actionHeight);
}
