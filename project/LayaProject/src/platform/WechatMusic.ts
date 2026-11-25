import { MUSIC_ROOT } from "../config/ResourceConfig";
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

interface SoundCue {
    spec: { file: string; volume: number };
    context: InnerAudio | null;
}
interface CombatAudio extends SoundCue {
    spec: SoundCue["spec"] & { intervalMs: number };
    lastAt: number;
}

/** 每类音效共用一个上下文。只由用户手势启动；后台/音频中断结束后不抢播，也不逐帧重试。
 * 失败隔离是已确认规则：保留游戏进程，提示一次，玩家关闭再打开音乐才重试。
 */
export class WechatMusic {
    private audio: InnerAudio | null = null;
    private clickAudio: InnerAudio | null = null;
    private tower: CombatAudio = { spec: MUSIC.tower, context: null, lastAt: -Infinity };
    private defeat: CombatAudio = { spec: MUSIC.defeat, context: null, lastAt: -Infinity };
    private flight: SoundCue = { spec: MUSIC.patrolFlight, context: null };
    private landing: CombatAudio = { spec: MUSIC.patrolLanding, context: null, lastAt: -Infinity };
    private rapidFire: CombatAudio = { spec: MUSIC.rapidFire, context: null, lastAt: -Infinity };
    private flightPlaying = false;
    private battle = false;
    private enabled = false;
    private active = false;
    private failed = false;
    private interrupted = false;
    private disposed = false;
    constructor(private problem: () => void) {
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
        if (!battle) this.setPatrolFlight(false);
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
        audio.src = MUSIC_ROOT + "/" + (this.battle ? MUSIC.battleFile : MUSIC.file);
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
                audio.src = MUSIC_ROOT + "/" + MUSIC.clickFile;
            }
            if (this.active) this.clickAudio.play();
        } catch (error) { this.fail(error); }
    }
    suspend() {
        this.active = false;
        try { this.audio?.pause(); } catch (error) { this.fail(error); }
        try { this.clickAudio?.stop(); } catch (error) { this.fail(error); }
        try { this.tower.context?.stop(); } catch (error) { this.fail(error); }
        try { this.defeat.context?.stop(); } catch (error) { this.fail(error); }
        this.setPatrolFlight(false);
        for (const cue of [this.landing, this.rapidFire]) {
            try { cue.context?.stop(); } catch (error) { this.fail(error); }
        }
    }
    towerShot() { if (this.battle) this.playCombatSound(this.tower); }
    /** 最后一发可以在 BGM 切回白天后才命中，仍随实际死亡开始播放。 */
    enemyDefeat() { this.playCombatSound(this.defeat); }
    setPatrolFlight(flying: boolean) {
        const play = flying && this.battle && this.active && !this.failed && !this.interrupted && !this.disposed;
        if (play === this.flightPlaying) return;
        this.flightPlaying = play;
        try {
            if (play) {
                const audio = this.soundContext(this.flight, true);
                if (this.flightPlaying) audio.play();
            } else this.flight.context?.stop();
        } catch (error) { this.fail(error); }
    }
    patrolRapidFire() {
        this.playCombatSound(this.rapidFire);
    }
    patrolLanding() {
        this.setPatrolFlight(false);
        this.playCombatSound(this.landing);
    }
    private soundContext(cue: SoundCue, loop: boolean) {
        if (cue.context) return cue.context;
        const audio = cue.context = wx.createInnerAudioContext();
        audio.loop = loop; audio.autoplay = false; audio.volume = cue.spec.volume;
        audio.onError(error => { if (cue.context === audio) this.fail(error); });
        audio.src = MUSIC_ROOT + "/" + cue.spec.file;
        return audio;
    }
    private playCombatSound(cue: CombatAudio) {
        const now = Date.now();
        if (!this.active || this.failed || this.interrupted || this.disposed || now - cue.lastAt < cue.spec.intervalMs) return;
        cue.lastAt = now;
        try {
            if (cue.context) cue.context.stop();
            const audio = this.soundContext(cue, false);
            if (this.active) audio.play();
        } catch (error) { this.fail(error); }
    }
    private releaseAudio() {
        const contexts = [this.audio, this.clickAudio, this.tower.context, this.defeat.context, this.flight.context, this.landing.context, this.rapidFire.context];
        // 先解除引用，销毁过程中及之后的错误都不能影响当前状态。
        this.audio = this.clickAudio = this.tower.context = this.defeat.context = this.flight.context = this.landing.context = this.rapidFire.context = null;
        this.flightPlaying = false;
        let failure: { error: unknown } | null = null;
        for (const audio of contexts) {
            try { audio?.destroy(); } catch (error) { failure = { error }; }
        }
        if (failure) throw failure.error;
    }
    destroy() {
        if (this.disposed) return;
        this.disposed = true;
        wx.offAudioInterruptionBegin(this.begin); wx.offAudioInterruptionEnd(this.end);
        this.releaseAudio();
    }
}
