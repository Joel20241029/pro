import { GameSession } from "./game/GameSession";
import { SaveStore } from "./storage/SaveStore";
import { WechatPlatform } from "./platform/WechatPlatform";
import { SpriteFrames } from "./view/SpriteFrames";
import { GameView } from "./view/GameView";
const { regClass } = Laya;
@regClass()
export class Main extends Laya.Script {
    private platform: WechatPlatform | null = null;
    private session: GameSession | null = null;
    private view: GameView | null = null;
    private frames = new SpriteFrames();
    private disposed = false;
    async onStart() {
        const loading = new Laya.Text(); loading.text = "村里的灯火正在亮起…"; loading.fontSize = 28; loading.color = "#f7e7be"; loading.pos(150, 580); Laya.stage.addChild(loading);
        Laya.stage.bgColor = "#354c3e";
        try {
            this.platform = new WechatPlatform();
            this.session = new GameSession(new SaveStore(this.platform));
            this.platform.bind(this.session.hide, this.session.show);
            await this.frames.load();
            if (this.disposed) return;
            this.view = new GameView(this.session, this.frames);
            Laya.stage.addChild(this.view.root);
            // fixedwidth 让舞台填满微信画布；在安全区内显式居中 720×1280 游戏区，不依赖 canvas CSS 位移。
            const w = this.platform.window, scale = w.windowWidth / 720;
            const top = w.safeArea.top / scale, bottom = (w.windowHeight - w.safeArea.bottom) / scale;
            const available = Laya.stage.height - top - bottom, ratio = Math.min(1, available / 1280);
            this.view.root.scale(ratio, ratio);
            this.view.root.pos((720 - 720 * ratio) / 2, top + (available - 1280 * ratio) / 2);
            loading.destroy(); this.session.load(); console.log("[代代守村] 微信单机版已启动");
        } catch (e) {
            loading.text = "启动失败，请重新打开小游戏。\n" + (e instanceof Error ? e.message : String(e)); loading.pos(40, 480); loading.size(640, 300); loading.wordWrap = true; console.error(e);
        }
    }
    onUpdate() { const delta = Laya.timer.unscaledDelta / 1000; this.session?.update(delta); this.view?.update(delta); }
    onDisable() { this.session?.pause("DISABLED"); }
    onEnable() { this.session?.resume("DISABLED"); }
    onDestroy() { this.disposed = true; if (this.platform && this.session) this.platform.unbind(this.session.hide, this.session.show); this.view?.destroy(); this.frames.destroy(); }
}
