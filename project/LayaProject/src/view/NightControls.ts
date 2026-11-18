import { TACTIC_USE } from "../config/TacticConfig";
import type { TacticDefinition } from "../config/TacticConfig";
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
    private readonly buttons: { tactic: TacticDefinition; heart: Laya.Sprite; skin: Laya.Sprite; icon: Laya.Sprite; note: Laya.Text;
        ring: Laya.Sprite; ratio: number; muted: boolean; shownTicks: number; shownClock: string | null }[];

    constructor(private game: GameSession, state: GameState, ui: UiWidgets, panels: GamePanels, refresh: () => void) {
        this.node.name = "NightControls";
        this.node.size(LAYOUT.width, LAYOUT.footerHeight);
        const cfg = HUD.night, main = HUD.footer.start, side = cfg.side, multi = cfg.multi;
        const tactics = game.battle!.tactics, compact = tactics.length > 1;
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
            const width = compact ? multi.sideWidth : side.width;
            const button = ui.button(this.node, control.title, compact ? multi.sideXs[i] : side.xs[i], side.y, width, control.action, C.muted, side.height);
            const face = button.getChildByName("buttonFace") as Laya.Sprite;
            ui.image(face, control.icon, (width - side.icon) / 2, side.iconY, side.icon).name = "buttonIcon";
            const text = face.getChildByName("buttonText") as Laya.Text;
            text.pos(main.textX, side.textY); text.size(width - main.textX * 2, side.textHeight);
            text.fontSize = side.font; text.color = C.ink; text.stroke = 0;
            text.wordWrap = false; text.overflow = Laya.Text.SHRINK;
        });
        this.buttons = tactics.map((tactic, i) => {
            const size = compact ? multi.size : main.size, ratio = size / main.size;
            const x = compact ? multi.center + (i - (tactics.length - 1) / 2) * multi.pitch - size / 2 : main.x;
            const heart = ui.button(this.node, "", x, compact ? multi.y : main.y, size, () => game.bell(tactic.id), C.gold, size);
            heart.name = `button:${tactic.name}`;
            const face = heart.getChildByName("buttonFace") as Laya.Sprite;
            face.graphics.clear();
            const skin = ui.image(face, "button_heart_round", 0, 0, size, size, false);
            skin.name = "buttonSkin";
            const iconSize = cfg.heart.icon * ratio;
            const icon = ui.image(face, tactic.icon, (size - iconSize) / 2, cfg.heart.iconY * ratio, iconSize);
            icon.name = "buttonIcon";
            const title = ui.label(face, tactic.name, main.textX * ratio, cfg.heart.textY * ratio, main.textWidth * ratio, Math.round(main.font * ratio), C.lightEdge, true, cfg.heart.textHeight * ratio);
            title.name = "buttonText"; title.align = "center"; title.wordWrap = false; title.overflow = Laya.Text.SHRINK;
            title.stroke = cfg.heart.stroke; title.strokeColor = C.outline;
            const note = ui.label(face, "", main.textX * ratio, cfg.heart.noteY * ratio, main.textWidth * ratio, Math.round(cfg.heart.noteFont * ratio), C.lightEdge, true, cfg.heart.noteHeight * ratio);
            note.name = "HeartState"; note.align = "center"; note.wordWrap = false; note.overflow = Laya.Text.SHRINK;
            const ring = new Laya.Sprite(); ring.name = "HeartCountdownRing"; ring.mouseEnabled = false;
            ring.scale(ratio, ratio); face.addChild(ring);
            return { tactic, heart, skin, icon, note, ring, ratio, muted: false, shownTicks: -1, shownClock: null };
        });
        this.update();
    }

    update() {
        const battle = this.game.battle;
        if (!battle) return;
        const active = !battle.outcome && battle.bellTicks > 0;
        this.status.text = `${this.game.pauses.size ? "已暂停" : "守夜中"} · 场上 ${amount(battle.enemies.length, true)} · 待来 ${amount(battle.pendingCount, true)}${battle.base.night!.hungry ? " · 缺粮" : ""}` +
            (this.buttons.length > 1 || battle.tacticBudget > TACTIC_USE.perNight ? ` · 战技剩余 ${battle.tacticUsesLeft} 次` : "");
        for (const button of this.buttons) {
            const { tactic, heart, skin, icon, note, ring } = button;
            const ringing = active && battle.tactic.id === tactic.id;
            const left = Math.min(battle.tacticUsesLeft, battle.usesLeftFor(tactic));
            const cooling = !active && left > 0 && battle.cooldownFor(tactic.id) > 0;
            const clock = ringing ? "active" : cooling ? "cooldown" : null;
            const ticks = ringing ? battle.bellTicks : cooling ? battle.cooldownFor(tactic.id) : 0;
            const seconds = Math.ceil(ticks * RULE.step / this.game.state!.settings.speed);
            const enabled = this.game.canCast(tactic.id);
            heart.mouseEnabled = enabled;
            const muted = !ringing && !enabled;
            if (muted !== button.muted) {
                // Laya会绑定滤镜到所属节点，清除后不可重用。
                skin.filters = muted ? [new Laya.ColorFilter().gray()] : null;
                icon.filters = muted ? [new Laya.ColorFilter().gray()] : null;
                button.muted = muted;
            }
            note.text = ringing ? `生效 ${seconds}秒` : cooling ? `冷却 ${seconds}秒` : !left ? "已用完" :
                active ? "待机" : this.game.pauses.size ? "暂停中" : `可用 ${left} 次`;
            if (button.shownTicks === ticks && button.shownClock === clock) continue;
            button.shownTicks = ticks; button.shownClock = clock;
            ring.graphics.clear();
            if (!clock) continue;
            const cfg = HUD.night.ring, center = HUD.footer.start.size / 2;
            ring.graphics.drawCircle(center, center, cfg.radius, null, cooling ? cfg.cooldownTrack : cfg.track, cfg.width);
            const span = cooling ? Math.max(TACTIC_USE.recoveryTicks, TACTIC_USE.cooldownTicks - tactic.ticks) : tactic.ticks;
            const points: number[] = [], end = Math.PI * 2 * Math.min(1, ticks / span);
            for (let i = 0; i <= cfg.segments; i++) {
                const angle = -Math.PI / 2 + end * i / cfg.segments;
                points.push(center + Math.cos(angle) * cfg.radius, center + Math.sin(angle) * cfg.radius);
            }
            ring.graphics.drawLines(0, 0, points, cooling ? cfg.cooldownColor : cfg.color, cfg.width);
        }
    }
}
