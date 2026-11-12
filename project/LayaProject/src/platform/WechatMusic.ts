import { MUSIC } from "../game/GameConfig";

/** 仅列本游戏用到的微信官方 InnerAudioContext API；依据 minigame-api-typings。 */
interface InnerAudio {
    src: string; loop: boolean; autoplay: boolean; volume: number;
    play(): void; pause(): void; stop(): void; destroy(): void;
    onError(callback: (error: { errMsg: string; errCode?: number }) => void): void;
}
declare const wx: {
    createInnerAudioContext(): InnerAudio;
    onAudioInterruptionBegin(fn: () => void): void; offAudioInterruptionBegin(fn: () => void): void;
    onAudioInterruptionEnd(fn: () => void): void; offAudioInterruptionEnd(fn: () => void): void;
};

/** 一个村庄实例各持有一个 BGM 和点击音上下文。只由用户手势启动；后台/音频中断结束后不抢播，也不逐帧重试。
 * 失败隔离是已确认规则：保留游戏进程，提示一次，玩家关闭再打开音乐才重试。
 */
export class WechatMusic {
    private audio: InnerAudio | null = null;
    private clickAudio: InnerAudio | null = null;
    private battle = false;
    private enabled = false;
    private active = false;
    private failed = false;
    private interrupted = false;
    private disposed = false;
    constructor(private resourceRoot: string, private problem: () => void) {
        wx.onAudioInterruptionBegin(this.begin);
        wx.onAudioInterruptionEnd(this.end);
    }
    private begin = () => { this.interrupted = true; this.suspend(); };
    private end = () => { this.interrupted = false; };
    private fail(error: unknown) {
        if (this.disposed || !this.enabled || this.failed) return;
        this.failed = true;
        if (this.active) this.suspend();
        console.error("[村庄音乐]", error); this.problem();
    }
    setEnabled(enabled: boolean) {
        if (this.enabled === enabled || this.disposed) return;
        this.enabled = enabled;
        if (!enabled) this.suspend();
        else if (this.failed) {
            this.releaseAudio(); this.failed = false;
        }
    }
    setBattle(battle: boolean) {
        if (this.battle === battle || this.disposed) return;
        this.battle = battle;
        const audio = this.audio;
        if (!audio || this.failed) return;
        try {
            if (this.active) audio.stop();
            this.setMusicSource(audio);
            if (this.active) audio.play();
        } catch (error) { this.fail(error); }
    }
    private setMusicSource(audio: InnerAudio) {
        audio.volume = this.battle ? MUSIC.battleVolume : MUSIC.volume;
        audio.src = `${this.resourceRoot}/${this.battle ? MUSIC.battleFile : MUSIC.file}`;
    }
    interact() {
        if (!this.enabled || this.active || this.failed || this.interrupted || this.disposed) return;
        this.active = true;
        try {
            if (!this.audio) {
                const audio = this.audio = wx.createInnerAudioContext();
                // 微信默认遵循系统静音；本项目不更改全局音频选项。
                // 不把 DevTools 不支持的 setInnerAudioOption 作为播放前置条件。
                audio.loop = true; audio.autoplay = false;
                audio.onError(error => { if (this.audio === audio) this.fail(error); });
                this.setMusicSource(audio);
            }
            if (this.active) this.audio.play();
        } catch (error) { this.fail(error); }
    }
    click() {
        if (!this.active || this.disposed) return;
        try {
            if (this.clickAudio) this.clickAudio.stop();
            else {
                const audio = this.clickAudio = wx.createInnerAudioContext();
                audio.loop = false; audio.autoplay = false; audio.volume = MUSIC.clickVolume;
                audio.onError(error => { if (this.clickAudio === audio) this.fail(error); });
                audio.src = `${this.resourceRoot}/${MUSIC.clickFile}`;
            }
            if (this.active) this.clickAudio.play();
        } catch (error) { this.fail(error); }
    }
    suspend() {
        this.active = false;
        try { this.audio?.pause(); } catch (error) { this.fail(error); }
        try { this.clickAudio?.stop(); } catch (error) { this.fail(error); }
    }
    private releaseAudio() {
        const music = this.audio, click = this.clickAudio;
        // 先解除引用，销毁过程中及之后的错误都不能影响当前状态。
        this.audio = this.clickAudio = null;
        try { music?.destroy(); } finally { click?.destroy(); }
    }
    destroy() {
        if (this.disposed) return;
        this.disposed = true;
        wx.offAudioInterruptionBegin(this.begin); wx.offAudioInterruptionEnd(this.end);
        this.releaseAudio();
    }
}
