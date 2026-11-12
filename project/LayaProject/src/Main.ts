import { GameSession } from "./game/GameSession";
import { SaveStore } from "./storage/SaveStore";
import { WechatPlatform } from "./platform/WechatPlatform";
import { SpriteFrames, VILLAGE_RESOURCE_PACKAGE } from "./view/SpriteFrames";
import { GameView } from "./view/GameView";
import { WechatMusic } from "./platform/WechatMusic";
const { regClass } = Laya;
@regClass()
export class Main extends Laya.Script {
    private platform: WechatPlatform | null = null;
    private session: GameSession | null = null;
    private view: GameView | null = null;
    private frames = new SpriteFrames();
    private loading: Laya.Text | null = null;
    private disposed = false;
    private music: WechatMusic | null = null;
    private hide = () => { this.music?.suspend(); this.session?.hide(); };
    private show = () => { this.resize(); this.session?.show(); };
    // 微信适配器已把onWindowResize转为Stage.RESIZE，不再重复注册原生事件。
    private resize = () => {
        if (this.loading) this.loading.pos(40, (Laya.stage.height - this.loading.height) / 2);
        this.view?.resize();
    };
    private interact = () => {
        const session = this.session;
        if (!session?.state || session.pauses.has("BACKGROUND") || session.pauses.has("WAIT_RESUME") || session.pauses.has("DAILY_RATION") || session.pauses.has("DISABLED")) return;
        this.music?.setEnabled(session.state.settings.music); this.music?.interact();
    };
    async onStart() {
        const loading = this.loading = new Laya.Text(); loading.text = "正在准备村庄资源…"; loading.fontSize = 28; loading.color = "#f7e7be"; loading.stroke = 2; loading.strokeColor = "#493420"; loading.size(640, 64); loading.align = "center"; loading.valign = "middle"; Laya.stage.addChild(loading);
        this.resize(); Laya.stage.on(Laya.Event.RESIZE, this, this.resize);
        Laya.stage.bgColor = "#354c3e";
        try {
            this.platform = new WechatPlatform();
            this.session = new GameSession(new SaveStore(this.platform));
            this.platform.bind(this.hide, this.show);
            // 原生下载及 fileconfig 注册成功后才能读取图集；Laya 3.4.2 用 false 表示加载失败。
            const packageLoaded = await Laya.loader.loadPackage(VILLAGE_RESOURCE_PACKAGE);
            if (this.disposed) return;
            if (!packageLoaded) throw new Error("村庄资源包加载失败");
            loading.text = "村里的灯火正在亮起…";
            await this.frames.load();
            if (this.disposed) { this.frames.destroy(); return; }
            this.view = new GameView(this.session, this.frames, this.platform, () => {
                if (!this.session?.state || this.session.saves.pending || this.session.pauses.has("BACKGROUND") || this.session.pauses.has("DISABLED")) return;
                this.music?.setEnabled(this.session.state.settings.music); this.music?.setBattle(this.session.state.phase === "NIGHT");
                this.music?.interact(); this.music?.click();
            });
            this.music = new WechatMusic(VILLAGE_RESOURCE_PACKAGE, () => this.view?.showMusicProblem());
            Laya.stage.on(Laya.Event.CLICK, this, this.interact);
            Laya.stage.addChild(this.view.root);
            loading.destroy(); this.loading = null; this.session.load(); this.session.enter(); console.log("[代代守村] 微信单机版已启动");
        } catch (e) {
            if (this.disposed) { this.frames.destroy(); return; }
            loading.text = "启动失败，请重新打开小游戏。\n" + (e instanceof Error ? e.message : String(e)); loading.size(640, 300); loading.wordWrap = true; this.resize(); console.error(e);
        }
    }
    onUpdate() {
        const delta = Laya.timer.unscaledDelta / 1000; this.session?.update(delta); this.view?.update(delta);
        if (this.session?.state) { this.music?.setEnabled(this.session.state.settings.music); this.music?.setBattle(this.session.state.phase === "NIGHT"); }
        // 只上报已确认存档；平台失败不能进入 GameSession 的提交异常路径。
        if (this.session?.state && !this.session.saves.pending) this.platform?.syncBestNight(this.session.state.legacy.bestNight);
    }
    onDisable() { this.music?.suspend(); this.session?.pause("DISABLED"); }
    onEnable() { this.session?.resume("DISABLED"); }
    onDestroy() { this.disposed = true; Laya.stage.off(Laya.Event.CLICK, this, this.interact); Laya.stage.off(Laya.Event.RESIZE, this, this.resize); this.music?.destroy(); this.music = null; this.loading?.destroy(); this.loading = null; if (this.platform) this.platform.unbind(this.hide, this.show); this.view?.destroy(); this.frames.destroy(); }
}
