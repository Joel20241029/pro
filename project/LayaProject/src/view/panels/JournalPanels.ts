import { GameState } from "../../game/GameState";
import { TRAITS } from "../../game/GameConfig";
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
            const message = error instanceof RankingCanvasUnsupported ? RANKING_CANVAS.unsupportedText : RANKING_CANVAS.unavailableText;
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
        const box = ctx.modal("重新开村", "两种方式都会结束当前村落", true, { width: 620, height: 490 });
        ctx.ui.button(box, "传承开村", 38, 160, 544, () => ctx.open({ type: "inherit" }), C.green, 76);
        ctx.ui.label(box, "保留家谱、累计与战技，选择一项天赋", 38, 242, 544, 26, C.green, false, 40).align = "center";
        ctx.ui.button(box, "纯净开始", 38, 304, 544, () => ctx.open({ type: "cleanStart" }), C.gold, 76);
        ctx.ui.label(box, "回到首次开村状态，只保留最高纪录", 38, 386, 544, 26, C.timber, false, 40).align = "center";
        return;
    }
    if (p.type === "cleanStart") {
        const box = ctx.modal("确认纯净开始", "当前村庄、天赋、家谱和累计进度将清空", true, { width: 620, height: 420 });
        ctx.ui.label(box, "只保留最高守夜纪录，战技回到初始。\n新村可重新领取一次口粮。", 38, 160, 544, 28, C.timber, false, 100).align = "center";
        ctx.ui.button(box, "取消", 38, 300, 254, () => ctx.open({ type: "restart" }), C.muted, 76);
        ctx.ui.button(box, "确认纯净开始", 310, 300, 272, () => ctx.game.cleanStart(), C.gold, 76);
        return;
    }
    if (p.type === "inherit") {
        const box = ctx.modal("传承开村", "放弃当前村落，保留累计传承。\n选择一项天赋，交给新村的首位开村人。");
        const rows = new ScrollList(UI.contentWidth, 590, Math.max(0, s.legacy.traits.length * UI.listStep - 8), p.scroll, offset => p.scroll = offset);
        rows.pos(UI.inset, UI.listTop);
        box.addChild(rows);
        s.legacy.traits.forEach((t, i) => ctx.ui.button(rows.content, `确认重开 · 传承${TRAITS[t][0]}`, 0, i * UI.listStep, UI.contentWidth - UI.scrollGutter, () => { ctx.current = null; ctx.game.resume("CHOICE"); ctx.game.resume("USER"); ctx.game.newVillage(t); }, C.green, UI.listHeight));
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
    const box = ctx.modal("设置", "", true, { width: 620, height: 450 }, "村落进度保存在本机。离开期间没有收益或损耗。好友榜同步最高守村纪录。");
    ctx.ui.button(box, s.settings.music ? "游戏声音 · 开" : "游戏声音 · 关", 40, 132, 540, () => ctx.send({ type: "MUSIC", enabled: !s.settings.music }), s.settings.music ? C.green : C.muted, 76);
    ctx.ui.button(box, "玩法说明", 40, 230, 540, () => ctx.open({ type: "guide", tab: 0 }), C.gold, 76);
    ctx.ui.button(box, "重新开村…", 40, 334, 540, () => ctx.open({ type: "restart" }), C.red, 76);
}
