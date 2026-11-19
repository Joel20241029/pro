import { HAND_SPEED } from "../config/TacticConfig";
import type { GameSession } from "../game/GameSession";
import type { GameLayout } from "./GameLayout";
import type { UiWidgets } from "./UiWidgets";
import { LAYOUT } from "./config/HudConfig";

/** 720 逻辑画布下的遮罩与点击回馈。短按沿用原判定，动画只使用连点自己的表现秒。 */
const V = {
    shade: "rgba(0,0,0,0.57)", maxPressMs: 300, maxSparks: 32, tapSeconds: .24,
    countHeight: 164, countFont: 144, textHeight: 48, promptOffset: -140, timerOffset: 90,
    countColor: "#ffde82", textColor: "#fff4d9"
} as const;

export class HandSpeedVisuals {
    readonly node = new Laya.Sprite();
    private readonly sparksLayer = new Laya.Sprite();
    private readonly pointer = new Laya.Point();
    private readonly down = new Map<number, number>();
    private sparks: { x: number; y: number; at: number }[] = [];
    private window: NonNullable<GameSession["battle"]>["handSpeed"] = null;
    private time = 0;
    private latestTap = -Infinity;
    private readonly count: Laya.Text;
    private readonly prompt: Laya.Text;
    private readonly timer: Laya.Text;
    get counting() { return this.window !== null; }

    constructor(private game: GameSession, ui: UiWidgets) {
        this.node.name = "HandSpeedOverlay";
        this.node.mouseThrough = false;
        this.node.visible = this.node.mouseEnabled = false;
        this.sparksLayer.mouseEnabled = false;
        this.node.addChild(this.sparksLayer);
        this.count = ui.label(this.node, "0", 0, 0, LAYOUT.width, V.countFont, V.countColor, true, V.countHeight);
        this.count.name = "HandSpeedCount";
        this.count.pivot(LAYOUT.width / 2, V.countHeight / 2);
        this.prompt = ui.label(this.node, "快速点击屏幕", 0, 0, LAYOUT.width, 38, V.textColor, true, V.textHeight);
        this.timer = ui.label(this.node, "", 0, 0, LAYOUT.width, 32, V.textColor, true, V.textHeight);
        for (const label of [this.count, this.prompt, this.timer]) {
            label.visible = false;
            label.align = "center";
            label.valign = "middle";
            label.wordWrap = false;
        }
        this.node.on(Laya.Event.MOUSE_DOWN, this, (event: Laya.Event) => {
            event.stopPropagation();
            if (this.window) this.down.set(event.touchId, Laya.Browser.now());
        });
        this.node.on(Laya.Event.MOUSE_UP, this, (event: Laya.Event) => event.stopPropagation());
        this.node.on(Laya.Event.MOUSE_OUT, this, (event: Laya.Event) => this.down.delete(event.touchId));
        this.node.on(Laya.Event.DOUBLE_CLICK, this, (event: Laya.Event) => event.stopPropagation());
        this.node.on(Laya.Event.CLICK, this, this.tap);
    }

    private tap(event: Laya.Event) {
        event.stopPropagation();
        const at = this.down.get(event.touchId);
        this.down.delete(event.touchId);
        const battle = this.game.battle, window = battle?.handSpeed;
        if (at === undefined || Laya.Browser.now() - at > V.maxPressMs || !window) return;
        const { x, y } = this.node.globalToLocal(this.pointer.setTo(event.stageX, event.stageY));
        if (x < 0 || y < 0 || x >= this.node.width || y >= this.node.height) return;
        // 达标会同步结束并刷新画面，后续连点反馈只属于仍在进行的同一轮。
        if (!this.game.tapHandSpeed() || battle.handSpeed !== window) return;
        this.count.text = String(window.taps);
        this.latestTap = this.time;
        if (this.sparks.length >= V.maxSparks) this.sparks.shift();
        this.sparks.push({ x, y, at: this.time });
        this.drawTaps();
    }

    update(layout: GameLayout, seconds: number, panelOpen: boolean, finalImpact: boolean) {
        const window = this.game.battle?.handSpeed ?? null;
        if (window !== this.window) {
            this.window = window;
            this.count.text = String(window?.taps ?? 0);
            this.latestTap = -Infinity;
            this.sparks = [];
        }
        const active = window !== null && !this.game.pauses.size;
        const shield = active || (finalImpact && !panelOpen && !this.game.pauses.size);
        const changed = shield !== this.node.visible || active !== this.count.visible;
        if (changed) {
            // Laya 会优先向按下时的节点发 CLICK。跨遮罩边界的旧手势不能触发按钮。
            for (const touch of Laya.InputManager.touches) Laya.InputManager.cancelClick(touch.touchId);
            this.down.clear();
        }
        this.node.visible = this.node.mouseEnabled = shield;
        this.count.visible = this.prompt.visible = this.timer.visible = this.sparksLayer.visible = active;
        if (changed || this.node.height !== layout.height) {
            this.node.size(LAYOUT.width, layout.height);
            this.node.graphics.clear();
            if (active) this.node.graphics.drawRect(0, 0, LAYOUT.width, layout.height, V.shade);
        }
        if (!active) return;
        this.time += seconds;
        const center = (layout.safeTop + layout.safeBottom) / 2;
        this.count.pos(LAYOUT.width / 2, center);
        this.prompt.y = center + V.promptOffset;
        this.timer.y = center + V.timerOffset;
        this.timer.text = `还剩 ${Math.ceil(window.remaining)} 秒 · 点满 ${HAND_SPEED.burstTaps} 次压至 ${HAND_SPEED.burstRemainingPercent}% 血量`;
        this.drawTaps();
    }

    private drawTaps() {
        const g = this.sparksLayer.graphics;
        g.clear();
        const scale = 1 + .17 * Math.max(0, 1 - (this.time - this.latestTap) / V.tapSeconds);
        this.count.scale(scale, scale);
        this.sparks = this.sparks.filter(spark => this.time - spark.at < V.tapSeconds);
        for (const { x, y, at } of this.sparks) {
            const progress = (this.time - at) / V.tapSeconds;
            g.save();
            g.alpha(1 - progress);
            g.drawCircle(x, y, 5 + progress * 21, null, "#ffdc76", 3);
            g.drawCircle(x, y, (1 - progress) * 7, "#fff4c4");
            g.restore();
        }
    }
}
