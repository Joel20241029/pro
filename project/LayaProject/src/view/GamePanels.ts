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
import { drawWavePanel } from "./panels/WavePanel";
import { drawJournalPanel } from "./panels/JournalPanels";
import { drawTacticPanel } from "./panels/TacticPanels";
import { equippedTactics } from "../game/Tactics";
import { PanelMotion } from "./PanelMotion";
import { attachPanelHelp } from "./PanelHelp";
/** 面板状态与 CHOICE 暂停的唯一所有者。绘制模块不会各自缓存面板或注册刷新回调。 */
export class GamePanels implements PanelContext {
    current: Panel | null = null;
    private motion = new PanelMotion(this.overlay);
    private deferRankingCanvas = false;
    constructor(readonly game: GameSession, readonly art: SpriteFrames, readonly platform: WechatPlatform, readonly ui: UiWidgets, readonly overlay: Laya.Sprite, public layout: GameLayout, readonly refresh: () => void, readonly resources: ResourcePreparation, private onTacticListOpened?: () => void) { }
    open(panel: Panel, preserve = false) {
        if (!this.resources.ready("village") || this.game.pauses.has("ASSETS")) return;
        if (!preserve) panel.rowOrder = undefined;
        this.current = panel; this.game.pause("CHOICE"); this.refresh();
        if (panel.type === "start") void this.resources.ensure("night");
    }
    close() { this.current = null; this.game.resume("CHOICE"); this.refresh(); }
    redraw(draw: () => void) {
        const animate = !this.game.pauses.has("BACKGROUND") && !this.game.pauses.has("DISABLED");
        this.motion.redraw(this.layout, animate, () => {
            this.deferRankingCanvas = animate;
            try { draw(); }
            finally { this.deferRankingCanvas = false; }
            return this.current;
        });
    }
    relayout(layout: GameLayout) {
        const previous = this.layout;
        this.layout = layout;
        this.motion.relayout(layout, previous.height !== layout.height || previous.safeTop !== layout.safeTop || previous.safeBottom !== layout.safeBottom);
    }
    advance(seconds: number) { return this.motion.advance(seconds, this.layout); }
    send(c: Command, keep = true) {
        if (this.game.pauses.has("ASSETS") || (c.type === "NIGHT" && !this.resources.ready("night"))) return;
        if (!keep) {
            this.current = null;
            this.game.resume("CHOICE");
        }
        this.game.command(c);
    }
    modal(title: string, subtitle: string, close = true, size?: {
        width: number;
        height: number;
    }, help?: string) {
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
        const headingInset = help ? 154 : 86;
        const heading = this.ui.label(box, title, headingInset, 28, width - headingInset * 2, title.replace(/<[^>]*>/g, "").length > 12 ? 32 : UI.title, C.ink, true, 60);
        heading.align = "center"; heading.wordWrap = false; heading.overflow = Laya.Text.SHRINK;
        if (subtitle) this.ui.label(box, subtitle, UI.inset, 108, width - UI.inset * 2, 27, C.muted, false, 100).align = "center";
        if (help) attachPanelHelp(box, heading, help, this.art, this.ui);
        // 用户移除左上麦穗，关闭按钮仍在右侧；底角装饰不参与九宫格拉伸。
        if (close)
            this.ui.button(box, "×", width - 82, 31, 54, () => this.close(), C.red, 54);
        return box;
    }
    draw(s: GameState, p: Panel) {
        if (p.pendingTactic && !this.game.saves.pending) {
            const accepted = !this.game.error && equippedTactics(s)[p.pendingTactic.slot] === p.pendingTactic.id;
            delete p.pendingTactic;
            if (accepted) {
                const list = p.type === "tactic" ? p.back! : p;
                p = list?.back?.type === "start" && equippedTactics(s).length === 1 ? list.back : list ?? p;
                this.current = p;
            }
        }
        if (p.type === "tactics" || p.type === "tactic") drawTacticPanel(this, s, p);
        else if (["people", "history", "partners", "carers", "operators", "care", "workers", "person", "ancestor"].includes(p.type))
            drawPeoplePanel(this, s, p);
        else if (p.type === "families")
            drawFamilyPanel(this, s, p);
        else if (p.type === "wave" || p.type === "start")
            drawWavePanel(this, s, p);
        else if (p.type === "build" || p.type === "tower")
            drawBuildingPanel(this, s, p);
        else
            drawJournalPanel(this, s, p, this.deferRankingCanvas);
        if (p.type === "tactics") this.onTacticListOpened?.();
    }
}
