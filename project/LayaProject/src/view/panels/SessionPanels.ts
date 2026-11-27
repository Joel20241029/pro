import { GameState } from "../../game/GameState";
import { RULE } from "../../game/GameConfig";
import { C, UI } from "../UiTheme";
import { dailyRationAmount } from "../../game/DailyRation";
import { PanelContext } from "./PanelContext";
import { drawTravelerPanel } from "./TravelerPanel";
import { drawGameOver } from "./DefeatPanel";
import { drawExpeditionReportPopup, drawExpeditionReturn } from "./ExpeditionPanel";
import { cardArt } from "./PanelCards";

/** 启动、恢复和离开守夜都使用插图与独立操作区。 */
const STATUS = { artY: 119, art: 130, copyY: 263, copyHeight: 76, footer: 359 } as const;
function statusBox(ctx: PanelContext, title: string, copy: string, image: string, width: number,
    footer: number = STATUS.footer, buttonHeight: number = UI.action.height) {
    const box = ctx.modal(title, "", false, { width, height: footer + buttonHeight + UI.action.bottom });
    cardArt(ctx, box, image, (width - STATUS.art) / 2, STATUS.artY, STATUS.art);
    if (copy) {
        const label = ctx.ui.label(box, copy, 36, STATUS.copyY, width - 72, 28, C.ink, false, STATUS.copyHeight);
        label.align = "center"; label.valign = "middle";
    }
    return box;
}
export function drawBoot(ctx: PanelContext) {
    const b = ctx.game.boot;
    if (ctx.game.saves.pending) {
        drawPending(ctx);
        return;
    }
    if (b?.kind === "recover") {
        const buttonY = STATUS.footer;
        const box = statusBox(ctx, "发现一份可恢复进度", "另一份存档损坏。可从有效进度继续。", "icon_journal", 620);
        ctx.ui.centerButton(box, `恢复第 ${b.state.day} 天的村落`, buttonY, () => ctx.game.recover(), C.gold, true, 370);
        return;
    }
    if (b?.kind === "incompatible") {
        const buttonY = STATUS.footer + 48;
        const box = statusBox(ctx, "存档版本已变化", b.reason, "icon_journal", 620, buttonY);
        ctx.ui.label(box, "重新开村将从第一天开始", 34, 343, box.width - 68, 27, C.red, true, 45).align = "center";
        ctx.ui.centerButton(box, "重新开村", buttonY, () => ctx.game.newVillage(true), C.red);
        return;
    }
    if (b?.kind === "blocked") {
        const retryY = STATUS.footer, resetY = retryY + UI.action.height + 16;
        const box = statusBox(ctx, "进度需要核对", b.reason, "icon_journal", 620, b.canReset ? resetY : retryY);
        ctx.ui.centerButton(box, "重新读取", retryY, () => ctx.game.retry(), C.gold);
        if (b.canReset)
            ctx.ui.centerButton(box, "放弃进度并开村", resetY, () => ctx.game.newVillage(true), C.red);
        return;
    }
    const buttonY = 547;
    const box = ctx.modal("一处村落，代代相守", "", false, { width: UI.panelWidth, height: buttonY + 122 },
        "可安排村民耕作、驻塔、成家与迎接孩子。孩子优先继承父母的天赋，成年后自动补岗。");
    cardArt(ctx, box, "icon_house", 151, 122, 366, 350, C.paper);
    ctx.ui.label(box, "白天经营，夜晚守村", 42, 475, 584, 35, C.ink, true, 58).align = "center";
    ctx.ui.centerButton(box, "开始开村", buttonY, () => ctx.game.newVillage(), C.gold);
}
export function drawPending(ctx: PanelContext) {
    const buttonY = STATUS.footer + 50, width = 620;
    const box = statusBox(ctx, "正在核对保存结果", "重试会核对同一笔操作。", "icon_journal", width, buttonY);
    ctx.ui.label(box, ctx.game.error || "正在保存…", 40, 339, width - 80, 26, C.red, false, 62).align = "center";
    ctx.ui.centerButton(box, "重试保存", buttonY, () => ctx.game.retry(), C.gold);
}
export function drawNightExitConfirm(ctx: PanelContext, s: GameState) {
    const width = 560, y = STATUS.footer;
    const available = !!s.night?.returnPoint;
    const text = available ? "回到开战前。\n本夜不结算，也不会进入下一夜。" : "这场旧夜战缺少战前记录。\n下一次守夜即可使用退出。";
    const box = statusBox(ctx, available ? "放弃本次守夜？" : "本夜暂不可退出", text, "icon_night_shield", width, y, UI.action.pairHeight);
    if (!available) {
        ctx.ui.centerButton(box, "继续守夜", y, () => ctx.close(), C.muted, true, 240, UI.action.pairHeight);
        return;
    }
    const buttonWidth = 224;
    ctx.ui.button(box, "继续守夜", UI.inset, y, buttonWidth, () => ctx.close(), C.muted, UI.action.pairHeight);
    ctx.ui.button(box, "确认退出", width - UI.inset - buttonWidth, y, buttonWidth,
        () => ctx.game.abandonNight(), C.red, UI.action.pairHeight);
}
/** 保存、口粮和回前台先处理，随后是结算，再接失败、清晨或普通界面。 */
export function drawSessionPanel(ctx: PanelContext, s: GameState, safeHeight: number, drawResult?: () => boolean) {
    if (ctx.game.saves.pending)
        drawPending(ctx);
    else if (ctx.game.dailyRationDate !== null) {
        const amount = dailyRationAmount(s, ctx.game.dailyRationDate)!;
        const buttonY = 415, buttonHeight = 82;
        const box = ctx.modal("每日口粮", "", false, { width: 540, height: buttonY + buttonHeight + UI.action.bottom }, `本村每天可领一次。每日补给 ${RULE.dailyFood} 粮，放不下时按剩余仓储发放。`);
        cardArt(ctx, box, "icon_food", 191, 109, 158);
        ctx.ui.label(box, "本次到账", 34, 274, 472, 28, C.cream, true, 36).align = "center";
        ctx.ui.iconValue(box, "icon_food", `+${amount}`, 34, 311, 472, 51, amount ? C.ink : C.muted, 39);
        const detail = amount === 0 ? "仓储已满，确认后计为已领" : amount < RULE.dailyFood ? "按剩余仓储发放，今天只领一次" : "确认后入库，本村今日仅领一次";
        const note = ctx.ui.label(box, detail, 34, 363, 472, 26, C.muted, false, 43);
        note.align = "center";
        note.valign = "middle";
        ctx.ui.centerButton(box, ctx.game.pauses.has("WAIT_RESUME") ? "确认并继续" : "确认领取", buttonY, () => ctx.game.claimDailyRation(), C.gold, true, 292, buttonHeight);
    }
    else if (ctx.game.pauses.has("WAIT_RESUME")) {
        const buttonY = STATUS.footer, buttonHeight = 82;
        const box = statusBox(ctx, "欢迎回来", "村庄已暂停。点继续回到离开前的进度。", "icon_house", 540, buttonY, buttonHeight);
        ctx.ui.centerButton(box, "继续游戏", buttonY, () => { ctx.game.resume("WAIT_RESUME"); ctx.refresh(); }, C.gold, true, 286, buttonHeight);
    }
    else if (!ctx.game.pauses.has("BACKGROUND") && drawResult?.()) return;
    else if (!ctx.game.pauses.has("BACKGROUND") && s.expedition?.reportPending)
        drawExpeditionReportPopup(ctx, s, s.expedition);
    else if (!ctx.game.pauses.has("BACKGROUND") && (s.phase === "DAWN" || s.phase === "DAY") &&
        s.expedition?.remaining && !s.expedition.noticed)
        drawExpeditionReturn(ctx, s, true);
    else if (s.phase === "GAME_OVER")
        drawGameOver(ctx, s);
    else if (s.phase === "DAWN") {
        const traveler = s.choices[0]?.person;
        if (traveler) drawTravelerPanel(ctx, s, traveler, safeHeight);
    }
    // 切后台只释放已打开的开放域；回前台点“继续游戏”后再请求授权与绘制。
    else if (ctx.current && !ctx.game.pauses.has("BACKGROUND"))
        ctx.draw(s, ctx.current);
}
