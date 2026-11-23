import { ResourcePreparation } from "../platform/ResourcePreparation";
import { drawNightResourcePanel } from "./panels/ResourcePanel";
import { GameSession } from "../game/GameSession";
import { RULE } from "../game/GameConfig";
import { SpriteFrames } from "./SpriteFrames";
import { GameLayout } from "./GameLayout";
import { Tip } from "./Tip";
import { AnchoredTip } from "./AnchoredTip";
import { WechatPlatform } from "../platform/WechatPlatform";
import { UiWidgets } from "./UiWidgets";
import { VillageWorld } from "./VillageWorld";
import { GameHud } from "./GameHud";
import { HandSpeedVisuals } from "./HandSpeedVisuals";
import { GamePanels } from "./GamePanels";
import { NightResultPresentation } from "./NightResultPresentation";
import { StartNightReminder } from "./StartNightReminder";
import { StarterGuide } from "./StarterGuide";
import { PATROL_PROP } from "./config/VillageSceneConfig";
import { BACKPACK_LESSON, PATROL_LESSONS, SHOP_LESSON, STARTER_LESSONS } from "./config/StarterGuideConfig";
import { SIDE_FEATURES } from "./config/TacticUiConfig";
import { TacticNotices } from "./TacticNotices";
import { nextTacticSlotReady } from "../game/Tactics";
import { drawBoot, drawSessionPanel } from "./panels/SessionPanels";
import { TRAVELER_TITLE } from "./panels/TravelerPanel";
/** 会话到表现的唯一刷新入口；各表现模块不自行订阅 changed，避免同步命令导致重复刷新。 */
export class GameView {
    readonly root = new Laya.Sprite();
    private overlay = new Laya.Sprite();
    private layout = new GameLayout(this.platform.window, this.platform.menu);
    private ui = new UiWidgets(this.art, this.playClick);
    private handSpeed = new HandSpeedVisuals(this.game, this.ui);
    private anchoredTip = new AnchoredTip(this.art);
    private reminder = new StartNightReminder(this.art);
    private starterGuide = new StarterGuide(this.game.guides.track("starter"), this.art, this.ui);
    private patrolGuide = new StarterGuide(this.game.guides.track("patrol"), this.art, this.ui, PATROL_LESSONS);
    private itemGuides = {
        backpack: new StarterGuide(this.game.guides.track("backpack"), this.art, this.ui, BACKPACK_LESSON),
        shop: new StarterGuide(this.game.guides.track("shop"), this.art, this.ui, SHOP_LESSON)
    };
    private tacticNotices = new TacticNotices(this.platform, () => this.game.saves.villageId);
    private village = new VillageWorld(this.game, this.art, this.ui, this.layout, (name, visual) => {
        const phase = this.game.state?.phase;
        if (!this.overlay.numChildren && (phase === "DAY" || phase === "NIGHT")) {
            this.village.hideSpeech();
            this.anchoredTip.show(name, () => visual.bodyRegion());
        }
    }, id => {
        const state = this.game.state;
        if (state && !this.overlay.numChildren && (state.phase === "DAY" || state.phase === "NIGHT") && state.people.some(p => p.id === id))
            this.panels.open({ type: "person", id });
    }, this.playDefeat, () => {
        if (!this.overlay.numChildren && this.game.state) this.panels.open({ type: "patrol" });
    });
    private panels = new GamePanels(this.game, this.art, this.platform, this.ui, this.overlay, this.layout, () => this.refresh(), this.resources,
        this.tacticNotices, (kind, date, icon) => this.results.claimDaily(this.game, kind, date, icon));
    private hud = new GameHud(this.game, this.art, this.ui, this.panels, () => this.refresh());
    private results = new NightResultPresentation(this.ui, this.hud, () => this.refresh());
    private tip: Tip;
    private shownErrorRevision = 0;
    private observedVillageRevision = 0;
    showMusicProblem() { this.tip.show("声音暂时无法播放，可在设置中重新开启"); }
    constructor(private game: GameSession, private art: SpriteFrames, private platform: WechatPlatform, private playClick: () => void,
        private resources: ResourcePreparation, private playDefeat?: () => void) {
        this.root.name = "VillageGame";
        this.root.size(720, this.layout.height);
        this.root.stackingRoot = true;
        [this.village.scenery, this.village.world, this.village.shots, this.hud.node, this.anchoredTip, this.overlay].forEach((layer, i) => { layer.stackingRoot = true; layer.zIndex = i; this.root.addChild(layer); });
        this.village.bellAura.name = "BellAura";
        this.village.bellAura.zIndex = 2;
        this.village.bellAura.mouseEnabled = false;
        this.village.bellAura.visible = false;
        this.root.addChild(this.village.bellAura);
        this.village.blast.node.stackingRoot = true;
        this.village.blast.node.zIndex = 2;
        this.root.addChild(this.village.blast.node);
        this.village.speechTip.name = "VillagerThought";
        this.village.speechTip.zIndex = 3;
        this.root.addChild(this.village.speechTip);
        for (const node of [this.village.essenceArrow, this.village.essenceTip]) {
            node.mouseEnabled = false; node.visible = false; node.zIndex = 3;
            this.root.addChild(node);
        }
        this.village.essenceArrow.name = "EssenceArrow";
        this.village.essenceTip.name = "EssenceSpeech";
        this.village.cryIcon.name = "NewbornCry";
        this.village.cryIcon.mouseEnabled = false;
        this.village.cryIcon.visible = false;
        this.village.cryIcon.zIndex = 3;
        this.root.addChild(this.village.cryIcon);
        this.reminder.zIndex = 4;
        this.reminder.stackingRoot = true;
        this.root.addChild(this.reminder);
        this.ui.bindClick(this.reminder, () => this.panels.open({ type: "start" }));
        this.starterGuide.node.zIndex = this.reminder.zIndex;
        this.starterGuide.node.stackingRoot = true;
        this.starterGuide.spotlight.zIndex = this.reminder.zIndex;
        this.starterGuide.spotlight.stackingRoot = true;
        this.root.addChild(this.starterGuide.spotlight);
        this.root.addChild(this.starterGuide.node);
        this.patrolGuide.spotlight.name = "PatrolGuideSpotlight";
        this.patrolGuide.node.name = "PatrolGuide";
        for (const layer of [this.patrolGuide.spotlight, this.patrolGuide.node]) {
            layer.stackingRoot = true;
            layer.zIndex = 6;
            this.root.addChild(layer);
        }
        for (const [feature, guide] of Object.entries(this.itemGuides)) {
            guide.spotlight.name = `ItemGuideSpotlight:${feature}`;
            guide.node.name = `ItemGuide:${feature}`;
            for (const layer of [guide.spotlight, guide.node]) {
                layer.stackingRoot = true;
                layer.zIndex = 6;
                this.root.addChild(layer);
            }
        }
        this.tip = new Tip(art);
        this.tip.stackingRoot = true;
        this.tip.zIndex = 6;
        this.tip.pos(360, (this.layout.safeTop + this.layout.safeBottom) / 2);
        this.root.addChild(this.tip);
        this.results.layer.stackingRoot = true;
        this.results.layer.zIndex = 7;
        this.root.addChild(this.results.layer);
        this.handSpeed.node.stackingRoot = true;
        this.handSpeed.node.zIndex = this.results.layer.zIndex + 1;
        this.root.addChild(this.handSpeed.node);
        this.overlay.size(720, this.layout.height);
        this.overlay.mouseEnabled = true;
        this.overlay.mouseThrough = true;
        game.changed = () => this.refresh();
        this.refresh();
    }
    /** 保留原面板/开放域实例与人物日程，不执行命令、读档或重复请求授权。 */
    resize() {
        const next = new GameLayout(this.platform.window, this.platform.menu), previous = this.layout;
        if (next.height === previous.height && next.safeTop === previous.safeTop && next.safeBottom === previous.safeBottom && next.dateY === previous.dateY) {
            // 等比例窗口缩放可能不改变逻辑布局；原生榜单仍需更新 CSS 像素与触摸区域。
            this.panels.relayout(next);
            return;
        }
        this.village.relayout(next);
        this.layout = next;
        this.root.size(720, next.height);
        this.tip.pos(360, (next.safeTop + next.safeBottom) / 2);
        this.panels.relayout(next);
        const panel = this.panels.current?.type;
        const travelerOpen = this.overlay.numChildren > 0 && this.overlay.getChildAt(0).name === `panel:${TRAVELER_TITLE}`;
        this.refresh(panel !== "person" && panel !== "ancestor" && !travelerOpen);
    }
    refresh(preserveOverlay = false) {
        const s = this.game.state;
        // 纯净开局的run会回到1，用成功提交版本识别新村，避免继承旧路线、婚礼和表情。
        const newVillage = this.observedVillageRevision !== this.game.villageRevision;
        if (newVillage) {
            this.observedVillageRevision = this.game.villageRevision;
            this.village.reset();
            this.results.reset();
            this.panels.current = null;
            this.panels.resetGuideProgress();
            this.tip.visible = false;
            this.anchoredTip.hide();
            this.reminder.reset();
            this.starterGuide.resetProgress();
            this.patrolGuide.resetProgress();
            for (const guide of Object.values(this.itemGuides)) guide.resetProgress();
        }
        const essence = this.game.takeEssenceFeedback();
        if (this.game.takePurchaseFeedback() && this.panels.current?.type === "itemOffer") {
            this.panels.current = this.panels.current.back ?? null;
            if (!this.panels.current) this.game.resume("CHOICE");
            this.tip.show("购买成功");
        }
        if (essence) {
            this.panels.current = null;
            this.game.resume("CHOICE");
            this.anchoredTip.hide();
            this.village.showEssence(essence);
        }
        if (this.shownErrorRevision !== this.game.errorRevision) {
            this.shownErrorRevision = this.game.errorRevision;
            if (s && this.game.error && !this.game.saves.pending)
                this.tip.show(this.game.error);
        }
        this.results.observe(this.game, s, this.village.hasPatrolImpact);
        if (s) this.tacticNotices.observe(s, newVillage);
        if (this.panels.current?.type === "start") this.reminder.reset();
        if (this.game.saves.pending)
            this.tip.visible = false;
        this.hud.clear();
        this.village.drawScenery(s?.phase === "NIGHT" || this.results.playingFinalImpact);
        this.hud.drawHeader(this.layout);
        const restoringNight = s?.phase === "NIGHT" && !this.resources.ready("night");
        if (s) {
            this.village.sync(s, preserveOverlay);
            this.hud.draw(s, this.layout, this.village.scene, this.village, this.results.shownFeatures, this.tacticNotices.unread);
            if (this.hud.tacticBadge && this.results.revealingTactic && !nextTacticSlotReady(s)) this.hud.tacticBadge.visible = false;
        }
        if (!preserveOverlay) this.panels.redraw(() => {
            if (restoringNight) drawNightResourcePanel(this.panels);
            else if (!s) drawBoot(this.panels);
            else drawSessionPanel(this.panels, s, this.layout.safeBottom - this.layout.safeTop, () => this.results.draw(this.panels));
        });
        if (s && this.hud.tacticBadge && !this.tacticNotices.unread && !nextTacticSlotReady(s)) this.hud.tacticBadge.visible = false;
        this.updateActors();
        this.handSpeed.update(this.layout, 0, this.overlay.numChildren > 0, this.results.playingFinalImpact);
    }
    update(delta: number) {
        const active = !this.game.pauses.has("BACKGROUND") && !this.game.pauses.has("DISABLED");
        const visualDelta = Math.min(RULE.frameCap, Math.max(0, delta));
        const counting = !!this.game.battle?.handSpeed;
        const wasCounting = this.handSpeed.counting;
        const worldFrozen = counting || wasCounting;
        const panelClosed = active && this.panels.advance(visualDelta);
        const deathsAtFrameStart = this.village.hasEnemyDeaths;
        if (active && !worldFrozen) this.tip.advance(visualDelta);
        this.hud.advance(this.game.pauses.size || worldFrozen ? 0 : visualDelta);
        if (this.village.advance(delta, worldFrozen) || panelClosed || counting !== wasCounting)
            this.updateActors();
        if (active && !this.game.pauses.has("WAIT_RESUME") && !this.game.pauses.has("DAILY_RATION") && !this.game.pauses.has("ASSETS") && !this.game.pauses.has("SAVE_PENDING"))
            this.results.advance(visualDelta, this.village.hasPatrolImpact, deathsAtFrameStart || this.village.hasEnemyDeaths);
        else this.results.hideFlights();
        this.handSpeed.update(this.layout, visualDelta, this.overlay.numChildren > 0, this.results.playingFinalImpact);
        if (active && !worldFrozen) this.anchoredTip.advance(visualDelta);
        const day = this.game.state;
        const canPrompt = active && !this.game.pauses.size && !this.overlay.numChildren && !this.anchoredTip.visible && day?.phase === "DAY";
        let patrolStep: number | null = null, patrolTarget: Laya.Sprite | undefined;
        if (canPrompt && !this.results.active && !this.game.saves.pending) {
            const house = this.village.world.getChildByName(PATROL_PROP) as Laya.Sprite | undefined;
            if (house?.visible) { patrolStep = 1; patrolTarget = house; }
        }
        this.patrolGuide.tick(patrolStep, this.layout, visualDelta, patrolTarget);
        const wave = canPrompt && !this.results.active && !this.patrolGuide.node.visible ? this.starterGuide.nextEligible(day!.completed + 1) : null;
        const lesson = wave === null ? undefined : STARTER_LESSONS[wave - 1];
        const target = lesson && this.hud.guideTargets[lesson.target];
        this.starterGuide.tick(target?.visible && target.mouseEnabled ? wave : null, this.layout, visualDelta, target);
        let showGuide = canPrompt && !this.results.active && !this.starterGuide.node.visible && !this.patrolGuide.node.visible;
        for (const feature of SIDE_FEATURES) {
            if (feature.panel !== "backpack" && feature.panel !== "shop") continue;
            const guide = this.itemGuides[feature.panel];
            if (this.panels.current?.type === feature.panel) guide.finish();
            else {
                const target = this.hud.featureButtons.find(button => button.name === feature.name);
                guide.tick(showGuide && target?.visible ? 1 : null, this.layout, visualDelta, target);
            }
            if (guide.node.visible) showGuide = false;
        }
        this.reminder.tick(day?.day ?? 0, showGuide ? this.hud.startButton : null, visualDelta);
    }
    private updateActors() {
        if (this.village.render(this.overlay.numChildren > 0, this.anchoredTip.visible)) this.tip.show("大王怜悯你");
        this.hud.update();
        // 每日口粮/欢迎回来等自动面板也通过overlay显示，不仅检查主动打开的panels.current。
        if (this.overlay.numChildren) { this.anchoredTip.hide(); this.reminder.hide(); }
        else this.anchoredTip.advance(0);
    }
    destroy() { this.game.changed = () => { }; this.anchoredTip.hide(); this.hud.clear(); this.village.destroy(); this.root.destroy(true); }
}
