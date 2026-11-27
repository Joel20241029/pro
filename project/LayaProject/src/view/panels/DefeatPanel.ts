import type { GameState } from "../../game/GameState";
import { C, UI } from "../UiTheme";
import type { PanelContext } from "./PanelContext";
import { residentCardText } from "./ResidentCards";
import { cardArt } from "./PanelCards";

/** 审稿图的 720 逻辑画布规格。固定卡片行距，底部沿用通用操作区留白。 */
const DEFEAT = { height: 658, buttonWidth: 448, buttonHeight: 82 } as const;

export function drawGameOver(ctx: PanelContext, state: GameState) {
    if (ctx.current?.type === "restart") {
        ctx.draw(state, ctx.current);
        return;
    }
    const box = ctx.modal("守夜失败", "", false, { width: UI.panelWidth, height: DEFEAT.height });
    const card = (name: string, y: number, height: number) => {
        const node = new Laya.Sprite();
        node.name = name;
        node.pos(UI.inset, y).size(UI.contentWidth, height);
        ctx.art.panel(node, "panel_card", node.width, node.height);
        box.addChild(node);
        return node;
    };
    const text = residentCardText.bind(null, ctx);
    const score = card("DefeatScore", 118, 174);
    cardArt(ctx, score, "motion_gate_body", 18, 12, 231, 149, C.paper);
    text(score, "城门失守", 270, 30, 237, 50, 34, C.red, true);
    text(score, "本局守住", 270, 89, 138, 42, 27, C.muted);
    text(score, String(state.completed), 399, 70, 113, 80, 64, C.green, true).align = "right";
    text(score, "夜", 524, 53, 43, 47, 32, C.green, true);

    const stat = (node: Laya.Sprite, x: number, width: number, name: string, value: number, unit: string) => {
        text(node, name, x, 61, width, 33, 26, C.muted).align = "center";
        text(node, `${value} ${unit}`, x, 95, width, 51, 37, C.ink, true).align = "center";
    };
    const village = card("DefeatVillage", 307, 152);
    text(village, "本局村庄", 26, 12, 300, 44, 33, C.ink, true);
    village.graphics.drawLine(204, 65, 204, 136, "#e3c88c", 2);
    village.graphics.drawLine(396, 65, 396, 136, "#e3c88c", 2);
    stat(village, 20, 184, "传承", state.stats.generation, "代");
    stat(village, 208, 184, "迎来孩子", state.stats.births, "人");
    stat(village, 396, 184, "荣休村民", state.stats.retirees, "位");
    const history = card("DefeatHistory", 474, 54);
    text(history, `最长坚守 ${state.legacy.bestNight} 夜`, 22, 5, 260, 44, 25, C.muted).align = "center";
    text(history, `累计出生 ${state.legacy.births} 人`, 310, 5, 263, 44, 25, C.muted).align = "center";

    const buttonY = box.height - DEFEAT.buttonHeight - UI.action.bottom;
    ctx.ui.centerButton(box, "重新开村", buttonY, () => ctx.open({ type: "restart" }),
        C.gold, true, DEFEAT.buttonWidth, DEFEAT.buttonHeight);
}
