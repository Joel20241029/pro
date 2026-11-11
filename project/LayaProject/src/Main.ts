import { GameSession } from "./game/GameSession";
import { SaveStore } from "./storage/SaveStore";
import { WechatPlatform } from "./platform/WechatPlatform";
import { SpriteFrames, VILLAGE_RESOURCE_PACKAGE } from "./view/SpriteFrames";
import { GameView } from "./view/GameView";
import { WechatMusic } from "./platform/WechatMusic";
import { MUSIC } from "./game/GameConfig";
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
    private show = () => { this.session?.show(); };
    private interact = () => {
        const session = this.session;
        if (!session?.state || session.pauses.has("BACKGROUND") || session.pauses.has("WAIT_RESUME") || session.pauses.has("DISABLED")) return;
        this.music?.setEnabled(session.state.settings.music); this.music?.interact();
    };
    async onStart() {
        const loading = this.loading = new Laya.Text(); loading.text = "正在准备村庄资源…"; loading.fontSize = 28; loading.color = "#f7e7be"; loading.stroke = 2; loading.strokeColor = "#493420"; loading.pos(40, 580); loading.size(640, 64); loading.align = "center"; loading.valign = "middle"; Laya.stage.addChild(loading);
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
            this.view = new GameView(this.session, this.frames, this.platform);
            this.music = new WechatMusic(VILLAGE_RESOURCE_PACKAGE + "/" + MUSIC.file, () => this.view?.showMusicProblem());
            Laya.stage.on(Laya.Event.CLICK, this, this.interact);
            Laya.stage.addChild(this.view.root);
            // fixedwidth 让舞台填满微信画布；在安全区内显式居中 720×1280 游戏区，不依赖 canvas CSS 位移。
            const w = this.platform.window, scale = w.windowWidth / 720;
            const top = w.safeArea.top / scale, bottom = (w.windowHeight - w.safeArea.bottom) / scale;
            const available = Laya.stage.height - top - bottom, ratio = Math.min(1, available / 1280);
            this.view.root.scale(ratio, ratio);
            this.view.root.pos((720 - 720 * ratio) / 2, top + (available - 1280 * ratio) / 2);
            loading.destroy(); this.loading = null; this.session.load(); console.log("[代代守村] 微信单机版已启动");
        } catch (e) {
            if (this.disposed) { this.frames.destroy(); return; }
            loading.text = "启动失败，请重新打开小游戏。\n" + (e instanceof Error ? e.message : String(e)); loading.pos(40, 480); loading.size(640, 300); loading.wordWrap = true; console.error(e);
        }
    }
    onUpdate() {
        const delta = Laya.timer.unscaledDelta / 1000; this.session?.update(delta); this.view?.update(delta);
        if (this.session?.state) this.music?.setEnabled(this.session.state.settings.music);
        // 只上报已确认存档；平台失败不能进入 GameSession 的提交异常路径。
        if (this.session?.state && !this.session.saves.pending) this.platform?.syncBestNight(this.session.state.legacy.bestNight);
    }
    onDisable() { this.music?.suspend(); this.session?.pause("DISABLED"); }
    onEnable() { this.session?.resume("DISABLED"); }
    onDestroy() { this.disposed = true; Laya.stage.off(Laya.Event.CLICK, this, this.interact); this.music?.destroy(); this.music = null; this.loading?.destroy(); this.loading = null; if (this.platform) this.platform.unbind(this.hide, this.show); this.view?.destroy(); this.frames.destroy(); }
}
