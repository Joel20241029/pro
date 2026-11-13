import { ResourceBundle, RESOURCE_BUNDLES } from "../../config/ResourceConfig";
import { PreparationState } from "../../platform/ResourcePreparation";
import { C } from "../UiTheme";
import { PanelContext } from "./PanelContext";
export function preparationText(state: PreparationState) {
    if (state.phase === "FAILED") return "资源准备未完成，点击重试即可继续。";
    if (state.slow) return "网络较慢，仍在准备中…\n请检查网络，正在继续等待。";
    if (state.phase === "DECODE") return "下载完成，正在整理素材…";
    return "正在下载资源，请稍候…";
}
/** 主地图已显示后的轻量加载面板；仅在角色未齐或恢复夜战时拦截操作。 */
export function drawResourcePanel(ctx: PanelContext, bundle: ResourceBundle) {
    const state = ctx.resources.states[bundle], failed = state.phase === "FAILED";
    const box = ctx.modal(failed ? "准备尚未完成" : `${RESOURCE_BUNDLES[bundle].title}正在准备`, "村庄已就绪，稍等片刻", false, { width: 540, height: 390 });
    ctx.ui.label(box, preparationText(state), 40, 174, 460, 29, failed ? C.red : C.timber, true, 94).align = "center";
    ctx.ui.button(box, failed ? "重新下载" : "正在准备…", 130, 292, 280, () => { void ctx.resources.ensure(bundle); }, C.gold, 72, failed);
}
