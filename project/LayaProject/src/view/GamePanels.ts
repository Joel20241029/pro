import { ResourcePreparation } from "../platform/ResourcePreparation";
import { GameSession } from "../game/GameSession";
import { Command } from "../game/VillageRules";
import { GameState } from "../game/GameState";
import { SpriteFrames } from "./SpriteFrames";
import { WechatPlatform } from "../platform/WechatPlatform";
import { GameLayout } from "./GameLayout";
import { UiWidgets } from "./UiWidgets";
import { C, UI } from "./UiTheme";
import { Panel, PanelContext } from "./panels/PanelContext";
import { drawPeoplePanel } from "./panels/PeoplePanels";
import { drawFamilyPanel } from "./panels/FamilyPanel";
import { drawBuildingPanel } from "./panels/BuildingPanels";
import { drawJournalPanel } from "./panels/JournalPanels";
import { drawTacticPanel } from "./panels/TacticPanels";
/** 面板状态与 CHOICE 暂停的唯一所有者。绘制模块不会各自缓存面板或注册刷新回调。 */
export class GamePanels implements PanelContext {
    current: Panel | null = null;
    constructor(readonly game: GameSession, readonly art: SpriteFrames, readonly platform: WechatPlatform, readonly ui: UiWidgets, readonly overlay: Laya.Sprite, public layout: GameLayout, readonly refresh: () => void, readonly resources: ResourcePreparation) { }
    open(panel: Panel, preserve = false) {
        if (!this.resources.ready("characters") || this.game.pauses.has("ASSETS")) return;
        if (!preserve) panel.rowOrder = undefined;
        this.current = panel; this.game.pause("CHOICE"); this.refresh();
        if (panel.type === "start") void this.resources.ensure("battle");
    }
    close() { this.current = null; this.game.resume("CHOICE"); this.refresh(); }
    send(c: Command, keep = true) {
        if (this.game.pauses.has("ASSETS") || (c.type === "NIGHT" && !this.resources.ready("battle"))) return;
        if (!keep) {
            this.current = null;
            this.game.resume("CHOICE");
        }
        this.game.command(c);
    }
    modal(title: string, subtitle: string, close = true, size?: {
        width: number;
        height: number;
    }) {
        this.overlay.mouseThrough = false;
        this.overlay.graphics.drawRect(0, 0, 720, this.layout.height, "rgba(28,36,25,0.56)");
        const width = size ? size.width : UI.panelWidth, height = size ? size.height : UI.panelHeight;
        const box = new Laya.Sprite();
        box.name = `panel:${title}`;
        box.pos((720 - width) / 2, this.layout.safeTop + (this.layout.safeBottom - this.layout.safeTop - height) / 2);
        box.size(width, height);
        box.mouseEnabled = true;
        this.art.panel(box, "panel_parchment", width, height);
        const header = new Laya.Sprite(); header.pos(18, 17); header.mouseEnabled = false;
        this.art.panel(header, "panel_header", width - 36, 82); box.addChild(header);
        this.overlay.addChild(box);
        this.ui.label(box, title, 86, 28, width - 172, title.replace(/<[^>]*>/g, "").length > 12 ? 32 : UI.title, C.ink, true, 60).align = "center";
        this.ui.label(box, subtitle, UI.inset, 108, width - UI.inset * 2, 27, C.muted, false, 100).align = "center";
        // 用户移除左上麦穗，关闭按钮仍在右侧；底角装饰不参与九宫格拉伸。
        if (close)
            this.ui.button(box, "×", width - 82, 31, 54, () => this.close(), C.red, 54);
        return box;
    }
    draw(s: GameState, p: Panel) {
        if (p.pendingTactic && !this.game.saves.pending) {
            const accepted = !this.game.error && s.tactics.equipped === p.pendingTactic;
            delete p.pendingTactic;
            if (accepted) {
                const list = p.type === "tactic" ? p.back! : p;
                p = list.back?.type === "start" ? list.back : list;
                this.current = p;
            }
        }
        if (p.type === "tactics" || p.type === "tactic") drawTacticPanel(this, s, p);
        else if (["people", "history", "partners", "carers", "operators", "care", "workers", "person", "ancestor"].includes(p.type))
            drawPeoplePanel(this, s, p);
        else if (p.type === "families")
            drawFamilyPanel(this, s, p);
        else if (["build", "tower", "wave", "start"].includes(p.type))
            drawBuildingPanel(this, s, p);
        else
            drawJournalPanel(this, s, p);
    }
}
