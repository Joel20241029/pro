import { featureUnlocked, TaskKind } from "../config/DailyTaskConfig";
import { drawDailyTaskPanel } from "./panels/DailyTaskPanel";
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
import { drawPersonDetailPanel } from "./panels/PersonDetailPanel";
import { drawFamilyPanel } from "./panels/FamilyPanel";
import { drawBuildingPanel } from "./panels/BuildingPanels";
import { drawWavePanel } from "./panels/WavePanel";
import { drawJournalPanel } from "./panels/JournalPanels";
import { drawMercyConfirm, drawTacticPanel } from "./panels/TacticPanels";
import { KING_MERCY_TACTIC } from "../config/TacticConfig";
import { equippedTactics } from "../game/Tactics";
import { PanelMotion } from "./PanelMotion";
import { drawPatrolPanel } from "./panels/PatrolPanels";
import { PATROL } from "../config/PatrolConfig";
import { attachPanelHelp } from "./PanelHelp";
/** 独立的设备提示记录，与五波指引及村庄进度无关。仅玩家主动跳过时写入。 */
const SLOT_GUIDE_KEY = "daidai_village.tactic_slot_guide_dismissed";
/** 面板状态与 CHOICE 暂停的唯一所有者。绘制模块不会各自缓存面板或注册刷新回调。 */
export class GamePanels implements PanelContext {
    current: Panel | null = null;
    private motion = new PanelMotion(this.overlay);
    private deferRankingCanvas = false;
    private slotGuideDismissed?: boolean;
    constructor(readonly game: GameSession, readonly art: SpriteFrames, readonly platform: WechatPlatform, readonly ui: UiWidgets, readonly overlay: Laya.Sprite, public layout: GameLayout, readonly refresh: () => void, readonly resources: ResourcePreparation, private onTacticListOpened?: () => void,
        private onDailyClaim?: (kind: TaskKind, date: string, icon: Laya.Sprite) => void) { }
    open(panel: Panel, preserve = false) {
        if (!this.resources.ready("village") || this.game.pauses.has("ASSETS")) return;
        if (panel.type === "mercyConfirm" && !this.game.canCast(KING_MERCY_TACTIC)) return;
        const bestNight = this.game.state?.legacy.bestNight ?? 0;
        if (panel.type === "dailyTasks" && (!featureUnlocked(bestNight, "dailyTasks") || this.game.state?.phase !== "DAY")) return;
        if (panel.type === "ranking" && !featureUnlocked(bestNight, "ranking")) return;
        if (["tactics", "tactic", "tacticSlotUnlock"].includes(panel.type) && !featureUnlocked(bestNight, "tactics")) return;
        if (panel.type.startsWith("patrol") && bestNight < PATROL.unlock) return;
        if (!preserve) panel.rowOrder = undefined;
        this.current = panel; this.game.pause("CHOICE"); this.refresh();
        if (panel.type === "start") void this.resources.ensure("night");
    }
    close() { this.current = null; this.game.resume("CHOICE"); this.refresh(); }
    get tacticSlotGuideDismissed() {
        if (this.slotGuideDismissed === undefined) {
            try { this.slotGuideDismissed = this.game.saves.port.read(SLOT_GUIDE_KEY) === "1"; }
            catch (error) {
                console.warn("[战技槽位引导] 无法读取跳过记录", error);
                this.slotGuideDismissed = false;
            }
        }
        return this.slotGuideDismissed;
    }
    dismissTacticSlotGuide() {
        this.slotGuideDismissed = true;
        try { this.game.saves.port.write(SLOT_GUIDE_KEY, "1"); }
        catch (error) { console.warn("[战技槽位引导] 无法保存跳过记录", error); }
        this.refresh();
    }
    redraw(draw: () => void) {
        if (this.current?.type === "mercyConfirm" && this.game.state?.night?.mercySpent) this.current = null;
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
        if (c.type === "PATROL_CAPTAIN" && this.current?.type === "patrolCandidates") this.current.id = c.id;
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
        // 取消珍藏可能让旧记录立即离开家谱范围，详情随列表更新返回家谱。
        if (p.type === "ancestor" && !s.history.some(person => person.id === p.id))
            this.current = p = { type: "history" };
        if (p.pendingSlotUnlock !== undefined && !this.game.saves.pending) {
            const slot = p.pendingSlotUnlock, list = p.back;
            delete p.pendingSlotUnlock;
            if (!this.game.error && list && equippedTactics(s).length > slot) {
                list.tacticSlot = slot;
                list.scroll = 0;
                this.current = p = list;
            }
        }
        if (p.pendingTactic && !this.game.saves.pending) {
            const accepted = !this.game.error && equippedTactics(s)[p.pendingTactic.slot] === p.pendingTactic.id;
            delete p.pendingTactic;
            if (accepted) {
                const list = p.type === "tactic" ? p.back! : p;
                p = list?.back?.type === "start" && equippedTactics(s).length === 1 ? list.back : list ?? p;
                this.current = p;
            }
        }
        if ((p.type === "patrolConfirm" || p.type === "patrolCandidates") && p.id && s.patrol?.captain === p.id) {
            const detail = p.type === "patrolConfirm" ? p.back?.back : p.back;
            this.current = p = detail ?? { type: "patrol" };
        }
        if (p.type.startsWith("patrol")) drawPatrolPanel(this, s, p);
        else if (p.type === "mercyConfirm") drawMercyConfirm(this, s);
        else if (p.type === "tactics" || p.type === "tactic" || p.type === "tacticSlotUnlock") drawTacticPanel(this, s, p);
        else if (p.type === "person" || p.type === "ancestor")
            drawPersonDetailPanel(this, s, p, this.layout.safeBottom - this.layout.safeTop);
        else if (["people", "history", "partners", "carers", "operators", "care", "workers"].includes(p.type))
            drawPeoplePanel(this, s, p);
        else if (p.type === "dailyTasks")
            drawDailyTaskPanel(this, s, (task, date, icon) => this.onDailyClaim?.(task.kind, date, icon));
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
