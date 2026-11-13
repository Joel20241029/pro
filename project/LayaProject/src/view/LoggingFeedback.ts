import { FEEDBACK } from './config/FeedbackConfig';
/** 从实际动作帧跨越检测落斧，不按岗位猜测；多人同砍合并为一次有限回弹。 */
export class LoggingFeedback {
    private previous = new Map<string, { clip: string; frame: number }>();
    private remaining = 0;
    sample(id: string, clip: string, elapsed: number, animated: boolean) {
        const config = FEEDBACK.chop[clip], before = this.previous.get(id);
        if (!config || !animated) { this.previous.delete(id); return; }
        const frame = Math.floor(elapsed * config.fps);
        if (before?.clip === clip && frame > before.frame) {
            const oldHit = Math.floor((before.frame - config.impact) / config.frames);
            const newHit = Math.floor((frame - config.impact) / config.frames);
            if (newHit > oldHit) this.remaining = FEEDBACK.tree.seconds;
        }
        this.previous.set(id, { clip, frame });
    }
    advance(delta: number): number {
        this.remaining = Math.max(0, this.remaining - delta);
        if (!this.remaining) return 0;
        const progress = 1 - this.remaining / FEEDBACK.tree.seconds;
        return Math.sin(progress * Math.PI * 2 * FEEDBACK.tree.oscillations) * FEEDBACK.tree.degrees * (1 - progress);
    }
    retain(ids: Set<string>) { for (const id of this.previous.keys()) if (!ids.has(id)) this.previous.delete(id); }
}
