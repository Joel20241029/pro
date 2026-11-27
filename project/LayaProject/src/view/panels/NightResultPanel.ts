import { FEATURE_WINS } from "../../config/DailyTaskConfig";
import { nightRewardMultiplier } from "../../config/ShopConfig";
import { ScrollList } from "../ScrollList";
import { C, UI } from "../UiTheme";
import { amount } from "../ViewText";
import { SIDE_FEATURES } from "../config/TacticUiConfig";
import { PanelContext } from "./PanelContext";
import { TacticDefinition } from "../../config/TacticConfig";
import { cardArt } from "./PanelCards";

export type NightResult = {
    night: number;
    base: number;
    sewing: number;
    boss: number;
    total: number;
    rewardDie?: number;
    recap: string;
    patrol?: { deployments: number; kills: number };
};

export function drawNightResult(ctx: PanelContext, result: NightResult, flying: boolean, collect: () => void, safeHeight: number) {
    const patrol = result.patrol && (result.patrol.deployments || result.patrol.kills) ? result.patrol : undefined;
    const rows: [string, number][] = [
        [result.rewardDie === undefined ? "守夜基础奖励" : `基础奖励（骰子 ×${nightRewardMultiplier(result.rewardDie)}）`, result.base]
    ];
    if (result.sewing) rows.push(["制衣追加", result.sewing]);
    if (result.boss) rows.push(["击败首领", result.boss]);
    const top = 149, cardY = 142, cardH = 82 + rows.length * 42;
    const recapY = cardY + cardH + 18, patrolY = recapY + (result.recap ? 149 : 0);
    const content = patrolY + (patrol ? 60 : 0), collectHeight = 74, footerGap = 13;
    const fixed = top + footerGap + collectHeight + UI.action.bottom;
    const viewport = Math.min(content, safeHeight - 32 - fixed), height = fixed + viewport;
    const box = ctx.modal("守夜成功", `第 ${result.night} 夜结算`, false, { width: UI.panelWidth, height },
        flying ? undefined : "守夜胜利后结算尔币。「收下」后继续。");
    let body = box, x: number = UI.inset, y = top, width = UI.contentWidth;
    if (viewport < content) {
        const scroll = new ScrollList(UI.contentWidth, viewport, content);
        scroll.pos(UI.inset, top); box.addChild(scroll);
        body = scroll.content; x = y = 0; width -= UI.scrollGutter;
    }
    cardArt(ctx, body, "icon_night_shield", x + (width - 120) / 2, y + 10, 120, 114);
    const card = new Laya.Sprite().pos(x, y + cardY).size(width, cardH);
    ctx.art.panel(card, "panel_card", width, cardH); body.addChild(card);
    ctx.ui.label(card, "本夜获得", 24, 14, 280, 34, C.ink, true, 47);
    const coins = ctx.ui.iconValue(card, "icon_coin", `+${amount(result.total, true)}`, 333, 14, width - 357, 47, C.green, 34);
    card.graphics.drawLine(24, 70, width - 24, 70, C.trim, 1);
    rows.forEach(([label, amountEarned], i) => {
        const y = 77 + i * 42;
        ctx.ui.label(card, label, 24, y, 274, 25, C.ink, false, 37);
        ctx.ui.iconValue(card, "icon_coin", `+${amount(amountEarned, true)}`, 333, y, width - 357, 37, C.timber, 27);
    });

    if (result.recap) {
        const update = new Laya.Sprite(); update.pos(x, y + recapY); body.addChild(update);
        ctx.art.panel(update, "panel_card_blue", width, 133);
        ctx.ui.label(update, "村中变化", 24, 10, width - 48, 29, C.ink, true, 42);
        const text = ctx.ui.label(update, result.recap, 24, 54, width - 48, 27, C.ink, false, 65);
        text.valign = "middle"; text.overflow = Laya.Text.SHRINK;
    }
    if (patrol) ctx.ui.label(body, `淡紫儿出征 ${patrol.deployments} 人次 · 击败 ${patrol.kills} 名来敌`,
        x + 10, y + patrolY, width - 20, 29, C.cream, true, 42).align = "center";
    ctx.ui.centerButton(box, flying ? "正在收下…" : "收下", top + viewport + footerGap, collect, C.gold, !flying, UI.action.width, collectHeight);
    return { box, sources: [coins] };
}

export function drawFeatureUnlock(ctx: PanelContext, index: number) {
    const entry = SIDE_FEATURES[index], width = 570, iconSize = 92;
    const box = ctx.modal("功能解锁", `首次守住 ${FEATURE_WINS[entry.panel]} 波`, false, { width, height: 340 });
    const icon = ctx.ui.image(box, entry.icon, (width - iconSize) / 2, 166, iconSize);
    ctx.ui.label(box, entry.unlock, 0, 270, width, 28, C.cream, true, 40).align = "center";
    return { box, sources: [icon] };
}

export function drawTacticUnlock(ctx: PanelContext, tactic: TacticDefinition) {
    // 居中展示的 403 逻辑像素动态图标由 NightFlights 渲染。标题和名称留在其上下。
    const width = 528, height = 614, size = 122;
    const box = ctx.modal("新战技揭晓", "", false, { width, height });
    const icon = ctx.ui.image(box, tactic.icon, (width - size) / 2, (height - size) / 2, size);
    ctx.ui.label(box, tactic.name, 34, 527, width - 68, 36, C.cream, true, 52).align = "center";
    return { box, sources: [icon] };
}
