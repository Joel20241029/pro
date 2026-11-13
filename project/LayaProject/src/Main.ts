import { GameSession } from "./game/GameSession";
import { SaveStore } from "./storage/SaveStore";
import { WechatPlatform } from "./platform/WechatPlatform";
import { SpriteFrames } from "./view/SpriteFrames";
import { GameView } from "./view/GameView";
import { StartupView } from "./view/StartupView";
import { WechatMusic } from "./platform/WechatMusic";
import { ResourcePreparation } from "./platform/ResourcePreparation";
const { regClass } = Laya;
@regClass()
export class Main extends Laya.Script {
    private platform: WechatPlatform | null = null;
    private session: GameSession | null = null;
    private view: GameView | null = null;
    private frames = new SpriteFrames();
    private resources = new ResourcePreparation({
        // 本机微信适配器回调为0..100；协调器统一使用0..1，仅用于判断是否有实际进展。
        download: (root, progress) => Laya.loader.loadPackage(root, percent => progress(percent / 100)),
        decode: bundle => this.frames.loadBundle(bundle)
    });
    private loading: StartupView | null = null;
    private disposed = false;
    private starting = false;
    private music: WechatMusic | null = null;
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
        Laya.stage.bgColor = "#f5e7c6";
        this.loading = new StartupView(() => { void this.startVillage(); }); Laya.stage.addChild(this.loading);
        Laya.stage.on(Laya.Event.RESIZE, this, this.resize);
        this.platform = new WechatPlatform(); this.session = new GameSession(new SaveStore(this.platform));
        this.session.pause("ASSETS"); this.platform.bind(this.hide, this.show);
        this.resources.changed = () => { this.syncResourcePause(); this.view?.refresh(); };
        await this.startVillage();
    }
    private async startVillage() {
        if (this.starting || this.view || this.disposed) return;
        this.starting = true; this.loading!.showStatus(false);
        const ready = await this.resources.ensure("base");
        this.starting = false;
        if (this.disposed) return;
        if (!ready) { this.loading!.showStatus(true); console.error("[村庄资源]", this.resources.states.base.error); return; }
        const session = this.session!;
        this.view = new GameView(session, this.frames, this.platform!, () => {
            if (!session.state || session.saves.pending || session.pauses.has("BACKGROUND") || session.pauses.has("DISABLED") || session.pauses.has("ASSETS")) return;
            this.music?.setEnabled(session.state.settings.music);
            this.music?.setBattle(session.state.phase === "NIGHT" && this.resources.ready("battle"));
            this.music?.interact(); this.music?.click();
        }, this.resources);
        this.music = new WechatMusic(() => this.view?.showMusicProblem());
        Laya.stage.on(Laya.Event.CLICK, this, this.interact); Laya.stage.addChild(this.view.root);
        this.loading!.destroy(); this.loading = null;
        // 先有地图再加载人物；ASSETS 已在读档前添加，夜晚重演从第一步开始等待。
        session.load(); session.enter(); this.syncResourcePause();
        void this.resources.ensure("characters");
        console.log("[代代守村] 主场景已显示，分阶段准备资源");
    }
    private syncResourcePause() {
        const session = this.session; if (!session) return;
        const night = session.state?.phase === "NIGHT";
        if (!this.resources.ready("characters") || (night && !this.resources.ready("battle"))) session.pause("ASSETS");
        else if (session.pauses.has("ASSETS")) session.resume("ASSETS");
        // 夜晚读档自动准备一次；失败保留现场，由面板按钮重试，绝不逐帧重发。
        if (night && this.resources.states.battle.phase === "IDLE") void this.resources.ensure("battle");
    }
    onUpdate() {
        const delta = Laya.timer.unscaledDelta / 1000;
        this.resources.advance(delta, !!this.session && !this.session.pauses.has("BACKGROUND") && !this.session.pauses.has("DISABLED"));
        this.syncResourcePause(); this.session?.update(delta); this.view?.update(delta);
        if (this.session?.state) {
            this.music?.setEnabled(this.session.state.settings.music);
            this.music?.setBattle(this.session.state.phase === "NIGHT" && this.resources.ready("battle"));
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
    }
}
