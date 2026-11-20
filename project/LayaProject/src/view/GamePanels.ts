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
import { attachPanelHelp } from "./PanelHelp";
import { drawItemPanel } from "./panels/ItemPanels";
import type { GuideTrack } from "../storage/VillageGuides";
import type { TacticNotices } from "./TacticNotices";
/** 面板状态与 CHOICE 暂停的唯一所有者。绘制模块不会各自缓存面板或注册刷新回调。 */
export class GamePanels implements PanelContext {
    current: Panel | null = null;
    private motion = new PanelMotion(this.overlay);
    private deferRankingCanvas = false;
    private seenGuides = new Set<GuideTrack>();
    constructor(readonly game: GameSession, readonly art: SpriteFrames, readonly platform: WechatPlatform, readonly ui: UiWidgets, readonly overlay: Laya.Sprite, public layout: GameLayout, readonly refresh: () => void, readonly resources: ResourcePreparation, private tacticsNotices?: TacticNotices,
        private onDailyClaim?: (kind: TaskKind, date: string, icon: Laya.Sprite) => void) { }
    open(panel: Panel, preserve = false) {
        if (!this.resources.ready("village") || this.game.pauses.has("ASSETS")) return;
        if (panel.type === "mercyConfirm" && !this.game.canCast(KING_MERCY_TACTIC)) return;
        const bestNight = this.game.state?.legacy.bestNight ?? 0;
        if (panel.type === "dailyTasks" && (!featureUnlocked(bestNight, "dailyTasks") || this.game.state?.phase !== "DAY")) return;
        const itemFeature = panel.type === "shop" || panel.type === "itemOffer" ? "shop" :
            ["backpack", "essenceTargets", "essenceConfirm"].includes(panel.type) ? "backpack" : null;
        if (itemFeature && (this.game.state?.phase !== "DAY" || !featureUnlocked(bestNight, itemFeature))) return;
        if (panel.type === "ranking" && !featureUnlocked(bestNight, "ranking")) return;
        if (["tactics", "tactic", "tacticSwap", "tacticCatalog", "tacticSlotUnlock"].includes(panel.type) && !featureUnlocked(bestNight, "tactics")) return;
        if (panel.type === "tacticSwap" && this.game.state?.phase !== "DAY") return;
        if (panel.type === "tacticCatalog") this.tacticsNotices?.markSeen();
        if (panel.type === "tactic" && panel.id) this.tacticsNotices?.markSeen(panel.id);
        if (!preserve) panel.rowOrder = undefined;
        this.current = panel; this.game.pause("CHOICE"); this.refresh();
        if (panel.type === "start") void this.resources.ensure("night");
    }
    close() { this.current = null; this.game.resume("CHOICE"); this.refresh(); }
    get tacticUnread() { return this.tacticsNotices?.unread === true; }
    unreadTactic(id: string) { return this.tacticsNotices?.hasUnread(id) === true; }
    resetGuideProgress() { this.seenGuides.clear(); }
    guideSeen(track: GuideTrack) {
        if (this.seenGuides.has(track)) return true;
        try {
            if (this.game.guides.get(track) > 0) { this.seenGuides.add(track); return true; }
        } catch (error) { console.warn("[战技引导] 无法读取进度", error); }
        return false;
    }
    finishGuide(track: GuideTrack) {
        if (this.guideSeen(track)) return;
        this.seenGuides.add(track);
        try { this.game.guides.mark(track); }
        catch (error) { console.warn("[战技引导] 无法保存进度", error); }
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
        const heading = this.ui.label(box, title, headingInset, 28, width - headingInset * 2, title.replace(/<[^>]*>/g, "").length > 12 ? 32 : UI.title, C.lightEdge, true, 60);
        heading.align = "center"; heading.wordWrap = false; heading.overflow = Laya.Text.SHRINK;
        if (subtitle) {
            // 流程说明可占两行，常驻状态栏只占一行，给紧接的筛选或操作区留白。
            const multiline = subtitle.includes("\n") || !close && subtitle.length > 27;
            const detail = this.ui.label(box, subtitle, UI.inset, 108, width - UI.inset * 2, 27, C.muted, false, multiline ? 82 : 46);
            detail.align = "center"; detail.valign = "middle";
            detail.wordWrap = multiline; detail.overflow = Laya.Text.SHRINK;
        }
        if (help) attachPanelHelp(box, heading, help, this.art, this.ui);
        // 花瓣只占两角的边框留白，不与标题、关闭按钮或列表共享可点区域。
        const blossoms = new Laya.Sprite();
        blossoms.mouseEnabled = false;
        for (const [x, y] of [[24, 23], [width - 19, height - 20]]) {
            for (const [dx, dy] of [[-6, -4], [3, -7], [7, 2], [0, 7], [-7, 4]])
                blossoms.graphics.drawCircle(x + dx, y + dy, 5.2, C.petal, C.trim, 1);
            blossoms.graphics.drawCircle(x, y, 3.2, C.petalCenter);
        }
        box.addChild(blossoms);
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
                this.finishGuide("slot");
                this.current = p = { type: "tacticSwap", index: slot, back: list };
            }
        }
        if (p.pendingTactic && !this.game.saves.pending) {
            const { id, slot } = p.pendingTactic;
            const accepted = !this.game.error && equippedTactics(s)[slot] === id;
            delete p.pendingTactic;
            if (accepted) {
                if (id) { this.finishGuide("tacticAction"); this.tacticsNotices?.markSeen(id); }
                const overview = p.back;
                if (id && overview) p = overview.back?.type === "start" && equippedTactics(s).length === 1 ? overview.back : overview;
                this.current = p;
            }
        }
        if ((p.type === "patrolConfirm" || p.type === "patrolCandidates") && p.id && s.patrol.captain === p.id) {
            const detail = p.type === "patrolConfirm" ? p.back?.back : p.back;
            this.current = p = detail ?? { type: "patrol" };
        }
        if (p.type.startsWith("patrol")) drawPatrolPanel(this, s, p);
        else if (p.type === "mercyConfirm") drawMercyConfirm(this, s);
        else if (["tactics", "tactic", "tacticSwap", "tacticCatalog", "tacticSlotUnlock"].includes(p.type))
            drawTacticPanel(this, s, p, this.layout.safeBottom - this.layout.safeTop);
        else if (p.type === "person" || p.type === "ancestor")
            drawPersonDetailPanel(this, s, p, this.layout.safeBottom - this.layout.safeTop);
        else if (["people", "history", "partners", "carers", "operators", "care", "workers"].includes(p.type))
            drawPeoplePanel(this, s, p);
        else if (p.type === "dailyTasks")
            drawDailyTaskPanel(this, s, (task, date, icon) => this.onDailyClaim?.(task.kind, date, icon));
        else if (["backpack", "shop", "itemOffer", "essenceTargets", "essenceConfirm"].includes(p.type))
            drawItemPanel(this, s, p, this.layout.safeBottom - this.layout.safeTop);
        else if (p.type === "families")
            drawFamilyPanel(this, s, p);
        else if (p.type === "wave" || p.type === "start")
            drawWavePanel(this, s, p);
        else if (p.type === "build" || p.type === "tower")
            drawBuildingPanel(this, s, p);
        else
            drawJournalPanel(this, s, p, this.deferRankingCanvas);
    }
}
