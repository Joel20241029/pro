import { GameSession } from "../game/GameSession";
import { GameState } from "../game/GameState";
import { RULE } from "../game/GameConfig";
import { GamePanels } from "./GamePanels";
import { HUD, LAYOUT } from "./config/HudConfig";
import { C } from "./UiTheme";
import { UiWidgets } from "./UiWidgets";
import { amount } from "./ViewText";

/** 守夜底栏的纯表现组件。随HUD销毁，不注册计时器；所有操作和倒计时读取既有会话。 */
export class NightControls {
    readonly node = new Laya.Sprite();
    private readonly status: Laya.Text;
    private readonly heart: Laya.Sprite;
    private readonly skin: Laya.Sprite;
    private readonly icon: Laya.Sprite;
    private readonly note: Laya.Text;
    private readonly ring = new Laya.Sprite();
    private muted = false;
    private shownTicks = -1;

    constructor(private game: GameSession, state: GameState, ui: UiWidgets, panels: GamePanels, refresh: () => void) {
        this.node.name = "NightControls";
        this.node.size(LAYOUT.width, LAYOUT.footerHeight);
        const cfg = HUD.night, main = HUD.footer.start, side = cfg.side;
        this.status = ui.label(this.node, "", cfg.status.x, cfg.status.y, cfg.status.width, cfg.status.font, C.ink, true, cfg.status.height);
        this.status.name = "NightStatus";
        this.status.align = "center"; this.status.wordWrap = false; this.status.overflow = Laya.Text.SHRINK;
        const paused = game.pauses.has("USER");
        const controls = [
            { title: paused ? "继续守夜" : "暂停", icon: paused ? "icon_play_dark" : "icon_pause_dark", action: () => {
                if (game.pauses.has("USER")) game.resume("USER"); else game.pause("USER");
                refresh();
            } },
            { title: `速度 ×${state.settings.speed === RULE.minSpeed ? 1 : 2}`, icon: "icon_speed", action: () => panels.send({ type: "SPEED", value: state.settings.speed === RULE.minSpeed ? RULE.maxSpeed : RULE.minSpeed }) }
        ];
        controls.forEach((control, i) => {
            const button = ui.button(this.node, control.title, side.xs[i], side.y, side.width, control.action, C.muted, side.height);
            const face = button.getChildByName("buttonFace") as Laya.Sprite;
            ui.image(face, control.icon, (side.width - side.icon) / 2, side.iconY, side.icon).name = "buttonIcon";
            const text = face.getChildByName("buttonText") as Laya.Text;
            text.pos(main.textX, side.textY); text.size(side.width - main.textX * 2, side.textHeight);
            text.fontSize = side.font; text.color = C.ink; text.stroke = 0;
            text.wordWrap = false; text.overflow = Laya.Text.SHRINK;
        });
        // 始终只绑定一次点击；update按实时canRingBell控制命中，bell()保留原有二次预检。
        this.heart = ui.button(this.node, "", main.x, main.y, main.size, () => game.bell(), C.gold, main.size);
        const tactic = game.battle!.tactic;
        this.heart.name = `button:${tactic.name}`;
        const face = this.heart.getChildByName("buttonFace") as Laya.Sprite;
        face.graphics.clear();
        this.skin = ui.image(face, "button_heart_round", 0, 0, main.size, main.size, false);
        this.skin.name = "buttonSkin";
        this.icon = ui.image(face, tactic.icon, (main.size - cfg.heart.icon) / 2, cfg.heart.iconY, cfg.heart.icon);
        this.icon.name = "buttonIcon";
        const title = ui.label(face, tactic.name, main.textX, cfg.heart.textY, main.textWidth, main.font, C.lightEdge, true, cfg.heart.textHeight);
        title.name = "buttonText"; title.align = "center"; title.wordWrap = false; title.overflow = Laya.Text.SHRINK;
        title.stroke = cfg.heart.stroke; title.strokeColor = C.outline;
        this.note = ui.label(face, "", main.textX, cfg.heart.noteY, main.textWidth, cfg.heart.noteFont, C.lightEdge, true, cfg.heart.noteHeight);
        this.note.name = "HeartState"; this.note.fontSize = cfg.heart.noteFont; this.note.align = "center";
        this.note.wordWrap = false; this.note.overflow = Laya.Text.SHRINK;
        this.ring.name = "HeartCountdownRing"; this.ring.mouseEnabled = false;
        face.addChild(this.ring);
        this.update();
    }

    update() {
        const battle = this.game.battle;
        if (!battle) return;
        const ringing = !battle.outcome && battle.bellTicks > 0;
        const seconds = Math.ceil(battle.bellTicks * RULE.step), enabled = this.game.canRingBell;
        this.heart.mouseEnabled = enabled;
        // 生效中的暂停保持金色与原剩余量；已用或尚未使用但暂停才置灰，文字不跟随滤镜。
        const muted = !ringing && !enabled;
        if (muted !== this.muted) {
            // Laya会给effect绑定所属Sprite，清除filters时销毁它；不能跨节点共享或解除后重用。
            this.skin.filters = muted ? [new Laya.ColorFilter().gray()] : null;
            this.icon.filters = muted ? [new Laya.ColorFilter().gray()] : null;
            this.muted = muted;
        }
        this.status.text = `${this.game.pauses.size ? "已暂停" : "守夜中"} · 场上 ${amount(battle.enemies.length, true)} · 待来 ${amount(battle.pendingCount, true)}${battle.base.night!.hungry ? " · 缺粮" : ""}`;
        this.note.text = ringing ? `${seconds}秒` : battle.bellUsed ? "本夜已用" : this.game.pauses.size ? "暂停中" : "";
        const ticks = ringing ? battle.bellTicks : 0;
        if (this.shownTicks === ticks) return;
        this.shownTicks = ticks;
        this.ring.graphics.clear();
        if (!ringing) return;
        const cfg = HUD.night.ring, center = HUD.footer.start.size / 2;
        this.ring.graphics.drawCircle(center, center, cfg.radius, null, cfg.track, cfg.width);
        const points: number[] = [], end = Math.PI * 2 * ticks / battle.tactic.ticks;
        for (let i = 0; i <= cfg.segments; i++) {
            const angle = -Math.PI / 2 + end * i / cfg.segments;
            points.push(center + Math.cos(angle) * cfg.radius, center + Math.sin(angle) * cfg.radius);
        }
        this.ring.graphics.drawLines(0, 0, points, cfg.color, cfg.width);
    }
}
