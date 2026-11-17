import { C, UI } from "../UiTheme";
import { amount } from "../ViewText";
import { SIDE_FEATURES } from "../config/TacticUiConfig";
import { PanelContext } from "./PanelContext";
import { TacticDefinition } from "../../config/TacticConfig";

export type NightResult = {
    night: number;
    food: number;
    wood: number;
    rations: number;
    stock: { food: number; wood: number };
    recap: string;
};

export function drawNightResult(ctx: PanelContext, result: NightResult, flying: boolean, collect: () => void) {
    const height = result.recap ? 632 : 494;
    const box = ctx.modal("守夜成功", `第 ${result.night} 夜结算`, false, { width: UI.panelWidth, height },
        flying ? undefined : "开战时先结算今日生产和本夜口粮，再按仓储保留库存。「收下」后可继续。");
    const card = new Laya.Sprite(); card.pos(34, 168); ctx.art.panel(card, "panel_card", 600, 180); box.addChild(card);
    ctx.ui.label(card, "本日产出", 22, 20, 182, 27, C.ink, true, 43);
    const food = ctx.ui.iconValue(card, "icon_food", `+${amount(result.food, true)}`, 216, 20, 150, 43, C.green, 30, "left");
    const wood = ctx.ui.iconValue(card, "icon_wood", `+${amount(result.wood, true)}`, 401, 20, 175, 43, C.green, 30, "left");
    ctx.ui.label(card, "本夜口粮", 22, 70, 182, 26, C.ink, false, 43);
    ctx.ui.iconValue(card, "icon_food", `−${amount(result.rations, true)}`, 216, 70, 150, 43, C.timber, 27, "left");
    ctx.ui.label(card, "当前库存", 22, 120, 184, 26, C.ink, false, 43);
    ctx.ui.iconValue(card, "icon_food", amount(result.stock.food, true), 216, 120, 150, 43, C.ink, 27, "left");
    ctx.ui.iconValue(card, "icon_wood", amount(result.stock.wood, true), 401, 120, 175, 43, C.ink, 27, "left");
    if (result.recap) {
        const text = ctx.ui.label(box, result.recap, 44, 372, 580, 28, C.cream, false, 131);
        text.align = "center"; text.valign = "middle"; text.overflow = Laya.Text.SHRINK;
    }
    ctx.ui.button(box, flying ? "正在收下…" : "收下", 168, height - 108, 332, collect, C.gold, 76, !flying);
    return { box, sources: [food, wood] };
}

export function drawFirstUnlock(ctx: PanelContext) {
    const box = ctx.modal("功能解锁", "首次守住一波", false, { width: 570, height: 340 });
    const sources = SIDE_FEATURES.map((entry, i) => {
        const column = 570 / SIDE_FEATURES.length, left = i * column;
        const icon = ctx.ui.image(box, entry.icon, left + (column - 92) / 2, 166, 92);
        ctx.ui.label(box, entry.unlock, left, 270, column, 28, C.cream, true, 40).align = "center";
        return icon;
    });
    return { box, sources };
}

export function drawTacticUnlock(ctx: PanelContext, tactic: TacticDefinition) {
    // 居中展示的 403 逻辑像素动态图标由 NightFlights 渲染。标题和名称留在其上下。
    const width = 528, height = 614, size = 122;
    const box = ctx.modal("新战技揭晓", "", false, { width, height });
    const icon = ctx.ui.image(box, tactic.icon, (width - size) / 2, (height - size) / 2, size);
    ctx.ui.label(box, tactic.name, 34, 527, width - 68, 36, C.cream, true, 52).align = "center";
    return { box, sources: [icon] };
}
