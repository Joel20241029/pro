import { C, UI } from "../UiTheme";
import { ResourceProgress } from "../ResourceProgress";
import { PanelContext } from "./PanelContext";
import { cardArt } from "./PanelCards";

/** 村庄已经显示后，玩家在存档面板接受了可恢复的夜晚。 */
export function drawNightResourcePanel(ctx: PanelContext) {
    const state = ctx.resources.states.night, failed = state.phase === "FAILED";
    const buttonY = 373, buttonHeight = 80;
    const box = ctx.modal("恢复守夜", "", false, { width: 540, height: buttonY + buttonHeight + UI.action.bottom });
    cardArt(ctx, box, "icon_night_shield", 195, 119, 150);
    const progress = new ResourceProgress("panel");
    progress.setWidth(460);
    progress.pos(40, 287);
    box.addChild(progress);
    progress.watch("正在恢复守夜", state);
    ctx.ui.centerButton(box, failed ? "重新下载" : "正在准备…", buttonY, () => { void ctx.resources.ensure("night"); }, C.gold, failed, 292, buttonHeight);
}
