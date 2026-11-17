import { GameLayout } from "./GameLayout";
import { LAYOUT } from "./config/HudConfig";
import { Panel } from "./panels/PanelContext";
import { RankingView } from "./RankingView";

/** 面板缩放取短弹簧的幅度，退场比入场短。秒数只影响表现，和守夜倍速、存档无关。 */
const MOTION = {
    enter: { seconds: .24, start: .82, peak: 1.035, reboundEnd: .7, alpha: .55 },
    exit: { seconds: .18, end: .81, rebound: 1.02, reboundEnd: .24 },
    shade: "rgba(28,36,25,0.56)"
} as const;
type Transition = { direction: "enter" | "exit"; elapsed: number; scale: number; alpha: number };

function mix(from: number, to: number, progress: number) { return from + (to - from) * progress; }
function smooth(t: number) { return t * t * (3 - 2 * t); }

/** overlay 始终只有一个面板。同步重绘保留同一面板的进度，退场只保留已解除触控的画面。 */
export class PanelMotion {
    private panel: Panel | null = null;
    private transition: Transition | null = null;

    constructor(private overlay: Laya.Sprite) { }

    redraw(layout: GameLayout, animate: boolean, draw: () => Panel | null) {
        const previous = this.box;
        if (previous) {
            // 独立的原生画布立即结束请求。离开显示树也会取消列表拖动、按钮按压。
            this.ranking(previous)?.destroy();
            previous.removeSelf();
        }
        const panel = draw(), next = this.box;
        if (next) {
            const same = previous?.name === next.name && panel === this.panel && this.transition?.direction !== "exit";
            this.panel = panel;
            if (!animate) this.transition = null;
            else if (!same) this.transition = { direction: "enter", elapsed: 0, scale: MOTION.enter.start, alpha: MOTION.enter.alpha };
            previous?.destroy(true);
        } else if (previous && animate) {
            this.panel = null;
            if (this.transition?.direction !== "exit")
                this.transition = { direction: "exit", elapsed: 0, scale: previous.scaleX, alpha: this.overlay.alpha };
            this.overlay.addChild(previous);
        } else {
            previous?.destroy(true);
            this.panel = null;
            this.transition = null;
        }
        this.fit(layout);
        if (next && !this.transition) this.ranking(next)?.reveal();
    }

    relayout(layout: GameLayout, changed: boolean) {
        if (changed) this.fit(layout);
        const box = this.box;
        if (box) this.ranking(box)?.updateViewPort();
    }

    private fit(layout: GameLayout) {
        this.overlay.size(LAYOUT.width, layout.height);
        this.overlay.graphics.clear();
        if (this.box) this.overlay.graphics.drawRect(0, 0, LAYOUT.width, layout.height, MOTION.shade);
        this.pose(layout);
    }

    /** 返回退场是否完成，供地图恢复即时点选。仅由前台真实帧时间推进。 */
    advance(seconds: number, layout: GameLayout) {
        const transition = this.transition;
        if (!transition) return false;
        transition.elapsed += seconds;
        if (transition.elapsed >= MOTION[transition.direction].seconds) {
            this.transition = null;
            if (transition.direction === "exit") {
                this.box?.destroy(true);
                this.fit(layout);
                return true;
            }
            this.pose(layout);
            const box = this.box;
            if (box) this.ranking(box)?.reveal();
            return false;
        }
        this.pose(layout);
        return false;
    }

    private get box() { return this.overlay.numChildren ? this.overlay.getChildAt(0) as Laya.Sprite : null; }
    private ranking(box: Laya.Sprite) { return box.getChildByName("FriendRankingCanvas") as RankingView | undefined; }

    private pose(layout: GameLayout) {
        const box = this.box, transition = this.transition;
        this.overlay.mouseThrough = !box;
        this.overlay.alpha = 1;
        if (!box) return;
        let scale = 1;
        if (transition?.direction === "enter") {
            const enter = MOTION.enter, t = transition.elapsed / enter.seconds;
            scale = t < enter.reboundEnd ? mix(enter.start, enter.peak, 1 - (1 - t / enter.reboundEnd) ** 3)
                : mix(enter.peak, 1, smooth((t - enter.reboundEnd) / (1 - enter.reboundEnd)));
            this.overlay.alpha = mix(enter.alpha, 1, Math.min(1, t / enter.reboundEnd));
        } else if (transition?.direction === "exit") {
            const exit = MOTION.exit, t = transition.elapsed / exit.seconds, peak = transition.scale * exit.rebound;
            if (t < exit.reboundEnd) {
                scale = mix(transition.scale, peak, smooth(t / exit.reboundEnd));
                this.overlay.alpha = transition.alpha;
            } else {
                const collapse = smooth((t - exit.reboundEnd) / (1 - exit.reboundEnd));
                scale = mix(peak, transition.scale * exit.end, collapse);
                this.overlay.alpha = transition.alpha * (1 - collapse);
            }
        }
        // mouseEnabled=false 让 Laya 跳过整棵面板子树，仍由全屏 overlay 吞下输入。
        box.mouseEnabled = !transition;
        box.scale(scale, scale);
        box.pos((LAYOUT.width - box.width * scale) / 2, (layout.safeTop + layout.safeBottom - box.height * scale) / 2);
    }
}
