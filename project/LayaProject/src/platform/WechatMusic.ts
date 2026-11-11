import { MUSIC } from "../game/GameConfig";

/** 仅列本游戏用到的微信官方 InnerAudioContext API；依据 minigame-api-typings。 */
interface InnerAudio {
    src: string; loop: boolean; autoplay: boolean; volume: number;
    play(): void; pause(): void; destroy(): void;
    onError(callback: (error: { errMsg: string; errCode?: number }) => void): void;
}
declare const wx: {
    createInnerAudioContext(): InnerAudio;
    onAudioInterruptionBegin(fn: () => void): void; offAudioInterruptionBegin(fn: () => void): void;
    onAudioInterruptionEnd(fn: () => void): void; offAudioInterruptionEnd(fn: () => void): void;
};

/** 一个村庄实例持有一个音轨。只由用户手势启动；后台/音频中断结束后不抢播，也不逐帧重试。
 * 失败隔离是已确认规则：保留游戏进程，提示一次，玩家关闭再打开音乐才重试。
 */
export class WechatMusic {
    private audio: InnerAudio | null = null;
    private enabled = false;
    private active = false;
    private failed = false;
    private interrupted = false;
    private disposed = false;
    constructor(private src: string, private problem: () => void) {
        wx.onAudioInterruptionBegin(this.begin);
        wx.onAudioInterruptionEnd(this.end);
    }
    private begin = () => { this.interrupted = true; this.suspend(); };
    private end = () => { this.interrupted = false; };
    private fail(error: unknown) {
        if (this.disposed || !this.enabled || this.failed) return;
        this.failed = true; this.active = false;
        console.error("[村庄音乐]", error); this.problem();
    }
    setEnabled(enabled: boolean) {
        if (this.enabled === enabled || this.disposed) return;
        this.enabled = enabled;
        if (!enabled) this.suspend();
        else if (this.failed) {
            // 主动重开后才重新创建失败的音轨；旧对象的异步错误不能影响新音轨。
            const previous = this.audio; this.audio = null;
            previous?.destroy(); this.failed = false;
        }
    }
    interact() {
        if (!this.enabled || this.active || this.failed || this.interrupted || this.disposed) return;
        this.active = true;
        try {
            if (!this.audio) {
                const audio = this.audio = wx.createInnerAudioContext();
                // 微信默认遵循系统静音；本项目不更改全局音频选项。
                // 不把 DevTools 不支持的 setInnerAudioOption 作为播放前置条件。
                audio.loop = true; audio.autoplay = false; audio.volume = MUSIC.volume;
                audio.onError(error => { if (this.audio === audio) this.fail(error); });
                audio.src = this.src;
            }
            this.audio.play();
        } catch (error) { this.fail(error); }
    }
    suspend() {
        this.active = false;
        try { this.audio?.pause(); } catch (error) { this.fail(error); }
    }
    destroy() {
        if (this.disposed) return;
        this.disposed = true;
        wx.offAudioInterruptionBegin(this.begin); wx.offAudioInterruptionEnd(this.end);
        this.audio?.destroy(); this.audio = null;
    }
}
