import { featureUnlocked, TaskKind } from "../config/DailyTaskConfig";
import { drawDailyTaskPanel } from "./panels/DailyTaskPanel";
import { drawExpeditionPanel } from "./panels/ExpeditionPanel";
import { ResourcePreparation } from "../platform/ResourcePreparation";
import { GameSession } from "../game/GameSession";
import { Command } from "../game/VillageRules";
import { GameState } from "../game/GameState";
import { SpriteFrames } from "./SpriteFrames";
import { WechatPlatform } from "../platform/WechatPlatform";
import { GameLayout } from "./GameLayout";
import { UiWidgets } from "./UiWidgets";
import { C, UI } from "./UiTheme";
import { Panel, PanelContext, SpendDetails } from "./panels/PanelContext";
import { actionHintsBlocked } from "./ActionHints";
import { drawSpendConfirm } from "./panels/PanelCards";
import { drawPeoplePanel } from "./panels/PeoplePanels";
import { drawPersonDetailPanel } from "./panels/PersonDetailPanel";
import { drawFamilyPanel } from "./panels/FamilyPanel";
import { drawBuildingPanel } from "./panels/BuildingPanels";
import { drawHeroCommittee } from "./panels/HeroCommitteePanel";
import { drawWavePanel } from "./panels/WavePanel";
import { drawJournalPanel } from "./panels/JournalPanels";
import { drawMercyConfirm, drawTacticPanel } from "./panels/TacticPanels";
import { KING_MERCY_TACTIC } from "../config/TacticConfig";
import { equippedTactics } from "../game/Tactics";
import { PanelMotion } from "./PanelMotion";
import { drawPatrolPanel } from "./panels/PatrolPanels";
import { attachPanelHelp } from "./PanelHelp";
import { drawItemPanel } from "./panels/ItemPanels";
import { drawNightExitConfirm } from "./panels/SessionPanels";
import type { GuideTrack } from "../storage/VillageGuides";
import type { TacticNotices } from "./TacticNotices";
/** 面板状态与 CHOICE 暂停的唯一所有者。绘制模块不会各自缓存面板或注册刷新回调。 */
export class GamePanels implements PanelContext {
    current: Panel | null = null;
    private motion = new PanelMotion(this.overlay);
    private deferRankingCanvas = false;
    private seenGuides = new Set<GuideTrack>();
    constructor(readonly game: GameSession, readonly art: SpriteFrames, readonly platform: WechatPlatform, readonly ui: UiWidgets, readonly overlay: Laya.Sprite, public layout: GameLayout, readonly refresh: () => void, readonly resources: ResourcePreparation, private tacticsNotices?: TacticNotices,
        private onDailyClaim?: (kind: TaskKind, date: string, icon: Laya.Sprite) => void,
        private onExpeditionClaim?: (food: Laya.Sprite, wood: Laya.Sprite) => void) { }
    open(panel: Panel, preserve = false) {
        if (!this.resources.ready("village") || this.game.pauses.has("ASSETS")) return;
        if (panel.type === "mercyConfirm" && !this.game.canCast(KING_MERCY_TACTIC)) return;
        if (panel.type === "nightExit" && (this.game.state?.phase !== "NIGHT" || !this.game.battle || this.game.battle.outcome || this.game.saves.pending)) return;
        if (panel.type === "heroCommittee" && this.game.state?.phase !== "DAY") return;
        if (panel.type === "expedition" && (this.game.state?.phase !== "DAY" || !featureUnlocked(this.game.state.completed, "expedition"))) return;
        const bestNight = this.game.state?.legacy.bestNight ?? 0;
        if (panel.type === "dailyTasks" && (!featureUnlocked(bestNight, "dailyTasks") || this.game.state?.phase !== "DAY")) return;
        const itemFeature = panel.type === "shop" || panel.type === "itemOffer" ? "shop" :
            ["backpack", "essenceConfirm", "rewardDice"].includes(panel.type) ? "backpack" : null;
        if (itemFeature && (this.game.state?.phase !== "DAY" || !featureUnlocked(bestNight, itemFeature))) return;
        if (panel.type === "ranking" && !featureUnlocked(bestNight, "ranking")) return;
        if ((panel.type === "tactics" || panel.type === "tacticSlotUnlock") && !featureUnlocked(bestNight, "tactics")) return;
        if (!preserve) panel.rowOrder = undefined;
        this.current = panel; this.game.pause("CHOICE"); this.refresh();
        if (panel.type === "start" || panel.type === "nightDetails") void this.resources.ensure("night");
    }
    close() { this.current = null; this.game.resume("CHOICE"); this.refresh(); }
    unreadTactic(id: string) { return this.tacticsNotices?.hasUnread(id) === true; }
    markTacticRead(id: string) { this.tacticsNotices?.markSeen(id); }
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
        if (this.current?.type === "nightExit" && this.game.state?.phase !== "NIGHT") this.current = null;
        const change = this.current?.towerChange;
        if (change?.submitted && !this.game.saves.pending) {
            const tower = this.game.state?.towers[this.current!.index!];
            if (tower?.kind === (change.to ?? change.from) &&
                tower?.level === (change.to ? Math.max(1, change.level) : change.level + 1)) {
                this.current = change.from && change.to ? { type: "tower", index: this.current!.index } : null;
                if (!this.current) this.game.resume("CHOICE");
            } else change.submitted = false;
        }
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
    claimExpedition(food: Laya.Sprite, wood: Laya.Sprite) {
        this.onExpeditionClaim?.(food, wood);
    }
    confirmSpend(details: SpendDetails, commit: () => void) {
        const origin = this.current;
        if (!origin || origin.spend || this.game.state?.phase !== "DAY" || actionHintsBlocked(this.game)) return;
        const revision = this.game.villageRevision;
        const prompt: Panel = { type: "spendConfirm", back: origin, spend: { ...details, commit: () => {
            if (this.current !== prompt || this.game.villageRevision !== revision || this.game.state?.phase !== "DAY" ||
                actionHintsBlocked(this.game)) return;
            // 先恢复原页对象，让既有成功回执、滚动和保存重试继续命中原调用方。
            this.current = origin;
            try { commit(); }
            finally { if (this.current === origin) this.refresh(); }
        } } };
        this.open(prompt, true);
    }
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
        const page = this.current?.type;
        const battleHeader = page === "start" || page === "nightDetails" || page === "nightPatrolHelp" ||
            page === "nightExit" || page === "mercyConfirm" || page === "tactics" || page === "tacticSlotUnlock" ||
            page === "ranking" || ["守夜成功", "守夜失败", "守夜资源", "恢复守夜", "新战技揭晓"].includes(title);
        const villageHeader = page === "build" || page === "tower" || page === "towerConfirm" || page === "towerAmmo" ||
            page === "ammoUpgrade" || page === "heroCommittee" || page?.startsWith("patrol") ||
            page === "spendConfirm" && this.current?.back?.type === "build";
        const headerSkin = battleHeader ? "panel_header_night" : villageHeader ? "panel_header_fern" : "panel_header";
        this.art.panel(header, headerSkin, width - 36, 82); box.addChild(header);
        this.overlay.addChild(box);
        const headingInset = help ? 154 : 86;
        const heading = this.ui.label(box, title, headingInset, 28, width - headingInset * 2, title.replace(/<[^>]*>/g, "").length > 12 ? 32 : UI.title, villageHeader && !battleHeader ? C.outline : C.lightEdge, true, 60);
        heading.align = "center"; heading.wordWrap = false; heading.overflow = Laya.Text.SHRINK;
        if (subtitle) {
            // 流程说明可占两行，常驻状态栏只占一行，给紧接的筛选或操作区留白。
            const multiline = subtitle.includes("\n") || !close && subtitle.length > 27;
            const detail = this.ui.label(box, subtitle, UI.inset, 108, width - UI.inset * 2, 27, C.muted, false, multiline ? 82 : 46);
            detail.align = "center"; detail.valign = "middle";
            detail.wordWrap = multiline; detail.overflow = Laya.Text.SHRINK;
        }
        if (help) attachPanelHelp(box, heading, help, this.art, this.ui);
        if (close)
            this.ui.button(box, "×", width - 82, 31, 54, () => this.close(), C.red, 54);
        return box;
    }
    draw(s: GameState, p: Panel) {
        if (p.pendingChoice && !this.game.saves.pending) {
            const choice = p.pendingChoice;
            delete p.pendingChoice;
            if (!this.game.error && choice.accepted(s)) this.current = p = choice.back;
        }
        // 取消珍藏可能让旧记录立即离开家谱范围，详情随列表更新返回家谱。
        if (p.type === "ancestor" && !s.history.some(person => person.id === p.id))
            this.current = p = { type: "history" };
        if (p.pendingSlotUnlock !== undefined && !this.game.saves.pending) {
            const slot = p.pendingSlotUnlock, list = p.back;
            delete p.pendingSlotUnlock;
            if (!this.game.error && list && equippedTactics(s).length > slot) {
                this.finishGuide("slot");
                list.index = slot;
                list.scroll = 0;
                this.current = p = list;
            }
        }
        if (p.pendingTactic && !this.game.saves.pending) {
            const { id, slot } = p.pendingTactic;
            const accepted = !this.game.error && equippedTactics(s)[slot] === id;
            delete p.pendingTactic;
            if (accepted && id) { this.finishGuide("tacticAction"); this.markTacticRead(id); }
        }
        if (((p.type === "patrolModes" && p.id) || (p.type === "patrolUpgrade" && p.pendingPatrolLevel !== undefined)) && !this.game.saves.pending) {
            const applied = p.type === "patrolModes" ? s.patrol.mode === p.id : s.patrol.level === p.pendingPatrolLevel;
            delete p.id;
            delete p.pendingPatrolLevel;
            if (applied) this.current = p = p.back ?? { type: "patrol" };
        }
        if ((p.type === "patrolConfirm" || p.type === "patrolCandidates") && p.id && !this.game.saves.pending) {
            if (!this.game.error && s.patrol.captain === p.id) {
                const detail = p.type === "patrolConfirm" ? p.back?.back : p.back;
                this.current = p = detail ?? { type: "patrol" };
            } else if (p.type === "patrolCandidates") delete p.id;
        }
        if (p.spend) drawSpendConfirm(this, s, p);
        else if (p.type.startsWith("patrol")) drawPatrolPanel(this, s, p, this.layout.safeBottom - this.layout.safeTop);
        else if (p.type === "mercyConfirm") drawMercyConfirm(this, s);
        else if (p.type === "nightExit") drawNightExitConfirm(this, s);
        else if (p.type === "heroCommittee") drawHeroCommittee(this, s, p, this.layout.safeBottom - this.layout.safeTop);
        else if (p.type === "tactics" || p.type === "tacticSlotUnlock")
            drawTacticPanel(this, s, p, this.layout.safeBottom - this.layout.safeTop);
        else if (p.type === "person" || p.type === "ancestor")
            drawPersonDetailPanel(this, s, p, this.layout.safeBottom - this.layout.safeTop);
        else if (["people", "history", "partners", "operators", "workers"].includes(p.type))
            drawPeoplePanel(this, s, p, this.layout.safeBottom - this.layout.safeTop);
        else if (p.type === "dailyTasks")
            drawDailyTaskPanel(this, s, (task, date, icon) => this.onDailyClaim?.(task.kind, date, icon), this.layout.safeBottom - this.layout.safeTop);
        else if (p.type === "expedition")
            drawExpeditionPanel(this, s, p, this.layout.safeBottom - this.layout.safeTop);
        else if (["backpack", "shop", "itemOffer", "essenceConfirm", "rewardDice"].includes(p.type))
            drawItemPanel(this, s, p, this.layout.safeBottom - this.layout.safeTop);
        else if (p.type === "families")
            drawFamilyPanel(this, s, p, this.layout.safeBottom - this.layout.safeTop);
        else if (p.type === "start" || p.type === "nightDetails" || p.type === "nightPatrolHelp")
            drawWavePanel(this, s, p, this.layout.safeBottom - this.layout.safeTop);
        else if (p.type === "build" || p.type === "tower" || p.type === "towerConfirm" || p.type === "towerAmmo" || p.type === "ammoUpgrade")
            drawBuildingPanel(this, s, p, this.layout.safeBottom - this.layout.safeTop);
        else
            drawJournalPanel(this, s, p, this.layout.safeBottom - this.layout.safeTop, this.deferRankingCanvas);
    }
}
