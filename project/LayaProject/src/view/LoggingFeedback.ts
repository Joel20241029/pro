import { FEEDBACK } from './config/FeedbackConfig';
import { Clip } from './SpriteResourceValidation';
/** 从实际动作帧跨越检测落斧；每棵目标树单独回弹，切换目标不能继承上一棵的帧进度。 */
export class LoggingFeedback {
    private previous = new Map<string, { clip: string; frame: number; treeId: string }>();
    private remaining = new Map<string, number>();
    sample(id: string, clip: Readonly<Clip> | null, elapsed: number, treeId: string | null) {
        const before = this.previous.get(id);
        if (clip?.contactFrame === undefined || !treeId) { this.previous.delete(id); return; }
        const frame = Math.floor(elapsed * clip.fps);
        if (before?.clip === clip.id && before.treeId === treeId && frame > before.frame) {
            const oldHit = Math.floor((before.frame - clip.contactFrame) / clip.frameIds.length);
            const newHit = Math.floor((frame - clip.contactFrame) / clip.frameIds.length);
            if (newHit > oldHit) this.remaining.set(treeId, FEEDBACK.tree.seconds);
        }
        this.previous.set(id, { clip: clip.id, frame, treeId });
    }
    advance(delta: number) {
        for (const [tree, remaining] of this.remaining) {
            if (remaining <= delta) this.remaining.delete(tree);
            else this.remaining.set(tree, remaining - delta);
        }
    }
    rotation(treeId: string): number {
        const remaining = this.remaining.get(treeId);
        if (remaining === undefined) return 0;
        const progress = 1 - remaining / FEEDBACK.tree.seconds;
        return Math.sin(progress * Math.PI * 2 * FEEDBACK.tree.oscillations) * FEEDBACK.tree.degrees * (1 - progress);
    }
    retain(ids: Set<string>) { for (const id of this.previous.keys()) if (!ids.has(id)) this.previous.delete(id); }
}
