/** Fit this fixed-size art probe in standalone preview without changing the shared
 * Workshop resolution. Editor authoring and native evidence retain 1:1 coordinates.
 */
@Laya.regClass()
export class Hd2dProbeViewport extends Laya.Script {
    onEnable(): void {
        if (!Laya.LayaEnv.isPlaying) return;
        this.fitViewport();
        Laya.stage.on(Laya.Event.RESIZE, this, this.fitViewport);
    }

    onDisable(): void {
        Laya.stage.off(Laya.Event.RESIZE, this, this.fitViewport);
    }

    private fitViewport(): void {
        const scene = this.owner as Laya.Scene;
        if (scene.width <= 0 || scene.height <= 0) throw new Error("HD 小场景必须声明固定画布尺寸");
        const scale = Math.min(Laya.stage.width / scene.width, Laya.stage.height / scene.height);
        scene.scale(scale, scale).pos((Laya.stage.width - scene.width * scale) / 2,
            (Laya.stage.height - scene.height * scale) / 2);
        scene.scrollRect = new Laya.Rectangle(0, 0, scene.width, scene.height);
    }
}
