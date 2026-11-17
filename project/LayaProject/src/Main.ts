import { GameSession } from "./game/GameSession";
import { BattleSimulation } from "./game/BattleSimulation";
import { SaveStore } from "./storage/SaveStore";
import { WechatPlatform } from "./platform/WechatPlatform";
import { SpriteFrames } from "./view/SpriteFrames";
import { GameView } from "./view/GameView";
import { StartupView } from "./view/StartupView";
import { GameLayout } from "./view/GameLayout";
import { WechatMusic } from "./platform/WechatMusic";
import { ResourcePreparation } from "./platform/ResourcePreparation";
import { WechatRemoteResources } from "./platform/WechatRemoteResources";
import { GAMEPLAY_ROOT } from "./config/ResourceConfig";
const { regClass } = Laya;
@regClass()
export class Main extends Laya.Script {
    private platform: WechatPlatform | null = null;
    private session: GameSession | null = null;
    private view: GameView | null = null;
    private remoteAssets = Laya.Browser?.onWXMiniGame && !Laya.LayaEnv.isPreview ? new WechatRemoteResources() : null;
    private filePath = (file: string) => this.remoteAssets ? this.remoteAssets.path(file) : GAMEPLAY_ROOT + "/" + file;
    private frames = new SpriteFrames((file, options) =>
        this.remoteAssets ? this.remoteAssets.load(this.filePath(file), options) : Laya.loader.load(this.filePath(file), options)
    );
    private resources = new ResourcePreparation({
        download: this.remoteAssets ? (stage, progress) => this.remoteAssets!.prepare(stage, progress) : undefined,
        decode: stage => this.frames.loadStage(stage)
    });
    private loading: StartupView | null = null;
    private disposed = false;
    private starting = false;
    private saveRead = false;
    private music: WechatMusic | null = null;
    private soundBattle: BattleSimulation | null = null;
    private heardVolleys = 0;
    private hide = () => { this.music?.suspend(); this.session?.hide(); };
    private show = () => { this.resize(); this.session?.show(); };
    // 微信适配器已把onWindowResize转为Stage.RESIZE，不重复注册原生事件。
    private resize = () => { this.loading?.resize(); this.view?.resize(); };
    private interact = () => {
        const session = this.session;
        if (!session?.state || ["BACKGROUND", "WAIT_RESUME", "DAILY_RATION", "DISABLED", "ASSETS"].some(p => session.pauses.has(p as any))) return;
        this.music?.setEnabled(session.state.settings.music); this.music?.interact();
    };
    async onStart() {
        Laya.stage.bgColor = "#162c20";
        const platform = this.platform = new WechatPlatform();
        this.loading = new StartupView(() => { void this.startVillage(); }, () => new GameLayout(platform.window, platform.menu));
        Laya.stage.addChild(this.loading);
        Laya.stage.on(Laya.Event.RESIZE, this, this.resize);
        this.session = new GameSession(new SaveStore(platform));
        this.session.pause("ASSETS"); platform.bind(this.hide, this.show);
        this.resources.changed = () => { this.syncResourcePause(); this.updateLoadingStatus(); this.view?.refresh(); };
        await this.startVillage();
    }
    private async startVillage() {
        if (this.starting || this.view || this.disposed) return;
        this.starting = true;
        try {
            if (!await this.loading!.loadArtwork() || this.disposed) return;
            if (!await this.resources.ensure("village") || this.disposed) return;
            const session = this.session!;
            // 读档可能自动补写双槽恢复。素材重试保留接受过的存档，等待期间始终暂停。
            if (!this.saveRead) {
                this.saveRead = true;
                session.load();
                session.enter();
            }
            if (session.state?.phase === "NIGHT" && (!await this.resources.ensure("night") || this.disposed)) return;
            this.view = new GameView(session, this.frames, this.platform!, () => {
                if (!session.state || session.saves.pending || session.pauses.has("BACKGROUND") || session.pauses.has("DISABLED") || session.pauses.has("ASSETS")) return;
                this.music?.setEnabled(session.state.settings.music);
                this.music?.setBattle(session.state.phase === "NIGHT" && this.resources.ready("night"));
                this.music?.interact(); this.music?.click();
            }, this.resources, () => {
                if (session.state?.settings.music && this.resources.ready("night")) this.music?.enemyDefeat();
            });
            this.music = new WechatMusic(() => this.view?.showMusicProblem());
            Laya.stage.on(Laya.Event.CLICK, this, this.interact);
            Laya.stage.addChild(this.view.root);
            this.loading!.destroy(); this.loading = null;
            this.syncResourcePause();
            this.remoteAssets?.rememberRelease();
        } finally {
            this.starting = false;
            this.updateLoadingStatus();
        }
    }
    private updateLoadingStatus() {
        if (!this.loading) return;
        const restoring = this.resources.ready("village") && this.session?.state?.phase === "NIGHT";
        this.loading.showPreparation(restoring ? "正在恢复守夜" : "正在准备村庄", this.resources.states[restoring ? "night" : "village"]);
    }
    private syncResourcePause() {
        const session = this.session; if (!session) return;
        const night = session.state?.phase === "NIGHT";
        if (!this.view || !this.resources.ready("village") || (night && !this.resources.ready("night"))) session.pause("ASSETS");
        else if (session.pauses.has("ASSETS")) session.resume("ASSETS");
        // 村庄内手动接受可恢复的夜间存档时，从同一入口准备守夜素材。
        if (this.view && night && this.resources.states.night.phase === "IDLE") void this.resources.ensure("night");
    }
    onUpdate() {
        const delta = Laya.timer.unscaledDelta / 1000;
        this.resources.advance(delta, !!this.session && !this.session.pauses.has("BACKGROUND") && !this.session.pauses.has("DISABLED"));
        this.updateLoadingStatus();
        this.syncResourcePause();
        // update可能在最后一轮发射后完成结算并清空battle；保留该对象消费真实发射事件。
        const finishingBattle = this.session?.battle;
        this.session?.update(delta); this.view?.update(delta);
        if (this.session?.state) {
            this.music?.setEnabled(this.session.state.settings.music);
            const battle = this.session.battle || finishingBattle;
            if (battle !== this.soundBattle) { this.soundBattle = battle; this.heardVolleys = 0; }
            if (battle && battle.volleys > this.heardVolleys) {
                this.heardVolleys = battle.volleys;
                // 完成结算可能打开日出面板；当帧已发生的发射仍应播放，原音频生命周期负责静音/后台。
                if (!this.session.pauses.size || battle === finishingBattle && battle.outcome !== null) this.music?.towerShot();
            }
            this.music?.setBattle(this.session.state.phase === "NIGHT" && this.resources.ready("night"));
        }
        if (this.session?.state && !this.session.saves.pending) this.platform?.syncBestNight(this.session.state.legacy.bestNight);
    }
    onDisable() { this.music?.suspend(); this.session?.pause("DISABLED"); }
    onEnable() { this.session?.resume("DISABLED"); }
    onDestroy() {
        this.disposed = true; this.resources.destroy();
        Laya.stage.off(Laya.Event.CLICK, this, this.interact); Laya.stage.off(Laya.Event.RESIZE, this, this.resize);
        this.music?.destroy(); this.music = null; this.loading?.destroy(); this.loading = null;
        this.platform?.unbind(this.hide, this.show); this.view?.destroy(); this.frames.destroy();
        this.platform?.rankingDiagnostics.dispose();
    }
}
