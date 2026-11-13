import { ResourcePreparation } from "../platform/ResourcePreparation";
import { drawResourcePanel } from "./panels/ResourcePanel";
import { GameSession } from "../game/GameSession";
import { RULE } from "../game/GameConfig";
import { SpriteFrames } from "./SpriteFrames";
import { GameLayout } from "./GameLayout";
import { Tip } from "./Tip";
import { AnchoredTip } from "./AnchoredTip";
import { RankingView } from "./RankingView";
import { WechatPlatform } from "../platform/WechatPlatform";
import { UiWidgets } from "./UiWidgets";
import { VillageWorld } from "./VillageWorld";
import { GameHud } from "./GameHud";
import { GamePanels } from "./GamePanels";
import { drawBoot, drawSessionPanel } from "./panels/SessionPanels";
/** 会话到表现的唯一刷新入口；各表现模块不自行订阅 changed，避免同步命令导致重复刷新。 */
export class GameView {
    readonly root = new Laya.Sprite();
    private overlay = new Laya.Sprite();
    private layout = new GameLayout(this.platform.window, this.platform.menu);
    private ui = new UiWidgets(this.art, this.playClick);
    private anchoredTip = new AnchoredTip(this.art);
    private village = new VillageWorld(this.game, this.art, this.ui, this.layout, (name, visual) => {
        const phase = this.game.state?.phase;
        if (!this.overlay.numChildren && (phase === "DAY" || phase === "NIGHT"))
            this.anchoredTip.show(name, () => visual.bodyRegion());
    }, id => {
        const state = this.game.state;
        if (state && !this.overlay.numChildren && (state.phase === "DAY" || state.phase === "NIGHT") && state.people.some(p => p.id === id))
            this.panels.open({ type: "person", id });
    });
    private panels = new GamePanels(this.game, this.art, this.platform, this.ui, this.overlay, this.layout, () => this.refresh(), this.resources);
    private hud = new GameHud(this.game, this.art, this.ui, this.panels, () => this.refresh());
    private tip: Tip;
    private shownErrorRevision = 0;
    private observedRun = 0;
    private observedDawn = 0;
    private observedVillageRevision = 0;
    showMusicProblem() { this.tip.show("声音暂时无法播放，可在小记中重新开启"); }
    constructor(private game: GameSession, private art: SpriteFrames, private platform: WechatPlatform, private playClick: () => void, private resources: ResourcePreparation) {
        this.root.name = "VillageGame";
        this.root.size(720, this.layout.height);
        this.root.stackingRoot = true;
        [this.village.scenery, this.village.world, this.village.shots, this.hud.node, this.anchoredTip, this.overlay].forEach((layer, i) => { layer.stackingRoot = true; layer.zIndex = i; this.root.addChild(layer); });
        this.village.bellAura.name = "BellAura";
        this.village.bellAura.zIndex = 2;
        this.village.bellAura.mouseEnabled = false;
        this.village.bellAura.visible = false;
        this.root.addChild(this.village.bellAura);
        this.village.emote.name = "VillagerEmote";
        this.village.emote.zIndex = 2;
        this.village.emote.mouseEnabled = false;
        this.village.emote.visible = false;
        this.root.addChild(this.village.emote);
        this.tip = new Tip(art);
        this.tip.stackingRoot = true;
        this.tip.zIndex = 6;
        this.tip.pos(360, (this.layout.safeTop + this.layout.safeBottom) / 2);
        this.root.addChild(this.tip);
        this.overlay.size(720, this.layout.height);
        this.overlay.mouseEnabled = true;
        this.overlay.mouseThrough = true;
        game.changed = () => this.refresh();
        this.refresh();
    }
    /** 保留原面板/开放域实例与人物日程，不执行命令、读档或重复请求授权。 */
    resize() {
        const next = new GameLayout(this.platform.window, this.platform.menu), previous = this.layout;
        if (next.height === previous.height && next.safeTop === previous.safeTop && next.safeBottom === previous.safeBottom && next.dateY === previous.dateY)
            return;
        this.village.relayout(next);
        this.layout = next;
        this.panels.layout = next;
        this.root.size(720, next.height);
        this.overlay.size(720, next.height);
        this.tip.pos(360, (next.safeTop + next.safeBottom) / 2);
        this.overlay.graphics.clear();
        if (this.overlay.numChildren)
            this.overlay.graphics.drawRect(0, 0, 720, next.height, "rgba(25,31,22,0.68)");
        for (let i = 0; i < this.overlay.numChildren; i++) {
            const box = this.overlay.getChildAt(i) as Laya.Sprite;
            box.y = next.safeTop + (next.safeBottom - next.safeTop - box.height) / 2;
            (box.getChildByName("FriendRankingCanvas") as RankingView)?.updateViewPort();
        }
        this.refresh(true);
    }
    refresh(preserveOverlay = false) {
        const s = this.game.state;
        // 纯净开局的run会回到1，用成功提交版本识别新村，避免继承旧路线、婚礼和表情。
        if (this.observedVillageRevision !== this.game.villageRevision) {
            this.observedVillageRevision = this.game.villageRevision;
            this.village.reset();
            this.observedRun = 0;
            this.observedDawn = 0;
            this.panels.current = null;
            this.tip.visible = false;
            this.anchoredTip.hide();
        }
        if (this.shownErrorRevision !== this.game.errorRevision) {
            this.shownErrorRevision = this.game.errorRevision;
            if (s && this.game.error && !this.game.saves.pending)
                this.tip.show(this.game.error);
        }
        // 无清晨选择时会直接回到白天，用原 Tip 呈现当次结算；读档只记基线，不补播旧通知。
        if (s) {
            if (this.observedRun === s.run && s.completed > this.observedDawn && s.phase === "DAY" && !this.game.error)
                this.tip.show(s.summary);
            this.observedRun = s.run;
            this.observedDawn = s.completed;
        }
        if (this.game.saves.pending)
            this.tip.visible = false;
        this.hud.clear();
        if (!preserveOverlay) {
            this.overlay.destroyChildren();
            this.overlay.graphics.clear();
            this.overlay.mouseThrough = true;
        }
        this.village.drawScenery(s?.phase === "NIGHT");
        this.hud.drawHeader(this.layout);
        const waiting = !this.resources.ready("characters") ? "characters" : s?.phase === "NIGHT" && !this.resources.ready("battle") ? "battle" : null;
        if (waiting) {
            if (s) { this.village.sync(s, preserveOverlay); this.hud.draw(s, this.layout, this.village.scene, this.village); }
            if (!preserveOverlay) drawResourcePanel(this.panels, waiting);
            this.updateActors(); return;
        }
        if (!s) {
            if (!preserveOverlay)
                drawBoot(this.panels);
            this.updateActors();
            return;
        }
        this.village.sync(s, preserveOverlay);
        this.hud.draw(s, this.layout, this.village.scene, this.village);
        if (preserveOverlay) {
            this.updateActors();
            return;
        }
        drawSessionPanel(this.panels, s);
        this.updateActors();
    }
    update(delta: number) {
        const active = !this.game.pauses.has("BACKGROUND") && !this.game.pauses.has("DISABLED");
        const visualDelta = Math.min(RULE.frameCap, Math.max(0, delta));
        if (active) this.tip.advance(visualDelta);
        if (this.village.advance(delta))
            this.updateActors();
        if (active) this.anchoredTip.advance(visualDelta);
        this.hud.advance(visualDelta);
    }
    private updateActors() {
        this.village.render(this.overlay.numChildren > 0);
        this.hud.update();
        // 每日口粮/欢迎回来等自动面板也通过overlay显示，不仅检查主动打开的panels.current。
        if (this.overlay.numChildren) this.anchoredTip.hide();
        else this.anchoredTip.advance(0);
    }
    destroy() { this.game.changed = () => { }; this.anchoredTip.hide(); this.hud.clear(); this.village.destroy(); this.root.destroy(true); }
}
