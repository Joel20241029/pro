/** Shared-canvas sprite animation for the art probe, excluded from the game build.
 * Frames keep identical size and foot origin. Direction never mirrors the art.
 */
@Laya.regClass()
@Laya.runInEditor
export class Hd2dProbeMotion extends Laya.Script {
    @Laya.property({ type: [Laya.Texture] })
    frames: Laya.Texture[] = [];

    /** Six displayed key poses per second is the probe's existing 2–4-frame cadence. */
    @Laya.property(Number)
    fps = 6;

    @Laya.property(Boolean)
    autoPlay = true;

    private elapsed = 0;

    /** Deterministic visual sampling; invalid assets stop the check visibly. */
    seekFrame(index: number): void {
        if (!Number.isInteger(index) || index < 0 || index >= this.frames.length) throw new Error("HD 动作帧缺失: " + index);
        (this.owner as Laya.Sprite).texture = this.frames[index];
    }

    onUpdate(): void {
        if (!this.autoPlay) return;
        if (this.frames.length === 0 || this.fps <= 0) throw new Error("HD 动作未配置");
        this.elapsed += this.owner.timer.delta / 1000;
        this.seekFrame(Math.floor(this.elapsed * this.fps) % this.frames.length);
    }
}
