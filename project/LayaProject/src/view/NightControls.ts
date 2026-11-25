import { TACTIC_USE } from "../config/TacticConfig";
import type { TacticDefinition } from "../config/TacticConfig";
import { GameSession } from "../game/GameSession";
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
        ring: Laya.Sprite; muted: boolean; shownTicks: number; shownClock: string | null }[];

    constructor(private game: GameSession, ui: UiWidgets, panels: GamePanels, refresh: () => void) {
        this.node.name = "NightControls";
        this.node.size(LAYOUT.width, LAYOUT.footerHeight);
        const cfg = HUD.night, main = HUD.footer.start;
        const tactics = game.battle!.tactics;
        this.status = ui.label(this.node, "", cfg.status.x, cfg.status.y, cfg.status.width, cfg.status.font, C.ink, true, cfg.status.height);
        this.status.name = "NightStatus";
        this.status.align = "left"; this.status.wordWrap = false; this.status.overflow = Laya.Text.SHRINK;
        const paused = game.pauses.has("USER");
        const pause = cfg.pause;
        const control = ui.button(this.node, paused ? "继续" : "暂停", pause.x, 0, pause.width, () => {
            if (game.pauses.has("USER")) game.resume("USER"); else game.pause("USER");
            refresh();
        }, C.muted, pause.height);
        control.size(pause.width, pause.hitHeight);
        const controlFace = control.getChildByName("buttonFace") as Laya.Sprite;
        controlFace.y += pause.y;
        ui.image(controlFace, paused ? "icon_play_dark" : "icon_pause_dark", pause.iconX,
            (pause.height - pause.icon) / 2, pause.icon).name = "buttonIcon";
        const controlText = controlFace.getChildByName("buttonText") as Laya.Text;
        controlText.pos(pause.textX, 0); controlText.size(pause.textWidth, pause.height);
        controlText.fontSize = pause.font; controlText.color = C.ink; controlText.stroke = 0;
        const row = cfg.rows[tactics.length - 1];
        this.buttons = tactics.map((tactic, i) => {
            const size = row.size, ratio = size / main.size;
            const x = row.centers[i] - size / 2;
            const act = tactic.effect === "KING_MERCY" ? () => panels.open({ type: "mercyConfirm" }) : () => game.bell(tactic.id);
            const heart = ui.button(this.node, "", x, row.y, size, act, C.gold, size);
            heart.name = `button:${tactic.name}`;
            const face = heart.getChildByName("buttonFace") as Laya.Sprite;
            face.graphics.clear();
            const skin = ui.image(face, "button_heart_round", 0, 0, size, size, false);
            skin.name = "buttonSkin";
            const iconSize = cfg.heart.icon * ratio;
            const icon = ui.image(face, tactic.icon, (size - iconSize) / 2, cfg.heart.iconY * ratio, iconSize);
            icon.name = "buttonIcon";
            const textWidth = cfg.heart.textWidth * ratio, noteWidth = cfg.heart.noteWidth * ratio;
            const title = ui.label(face, tactic.buttonName ?? tactic.name, (size - textWidth) / 2, cfg.heart.textY * ratio, textWidth, cfg.heart.textFont, C.ink, true, cfg.heart.textHeight * ratio);
            title.name = "buttonText"; title.align = "center"; title.wordWrap = false; title.overflow = Laya.Text.SHRINK;
            title.fontSize = Math.round(cfg.heart.textFont * ratio); title.stroke = 0; title.strokeColor = C.outline;
            const note = ui.label(face, "", (size - noteWidth) / 2, cfg.heart.noteY * ratio, noteWidth, cfg.heart.noteFont, C.ink, true, cfg.heart.noteHeight * ratio);
            note.fontSize = Math.round(cfg.heart.noteFont * ratio);
            note.name = "HeartState"; note.align = "center"; note.wordWrap = false; note.overflow = Laya.Text.SHRINK;
            const ring = new Laya.Sprite(); ring.name = "HeartCountdownRing"; ring.mouseEnabled = false;
            ring.scale(ratio, ratio); face.addChild(ring);
            return { tactic, heart, skin, icon, note, ring, muted: false, shownTicks: -1, shownClock: null as string | null };
        });
        this.update();
    }

    update() {
        const battle = this.game.battle;
        if (!battle) return;
        const hand = battle.handSpeed;
        const active = !battle.outcome && (battle.bellTicks > 0 || hand !== null);
        const stateText = this.game.pauses.size ? "已暂停 · " : this.game.patrolAiming ? "瞄准中 · " : "";
        this.status.text = `${stateText}场上 ${amount(battle.enemies.length, true)} · 待来 ${amount(battle.pendingCount, true)}${battle.base.night!.hungry ? " · 缺粮" : ""}` +
            (this.buttons.length > 1 || battle.tacticBudget > TACTIC_USE.perNight ? ` · 战技剩余 ${battle.tacticUsesLeft} 次` : "");
        for (const button of this.buttons) {
            const { tactic, heart, skin, icon, note, ring } = button;
            const ringing = active && battle.tactic.id === tactic.id;
            const left = Math.min(battle.tacticUsesLeft, battle.usesLeftFor(tactic));
            const mercy = tactic.effect === "KING_MERCY";
            const waves = mercy ? this.game.state!.tactics.mercyCooldown?.wavesLeft ?? 0 : 0;
            const cooling = !mercy && !active && left > 0 && battle.cooldownFor(tactic.id) > 0;
            const tapping = ringing ? hand : null;
            const clock = ringing && !tapping ? "active" : cooling ? "cooldown" : null;
            const ticks = ringing ? battle.bellTicks : cooling ? battle.cooldownFor(tactic.id) : 0;
            const seconds = Math.ceil(ticks * RULE.step / this.game.battleSpeed);
            const enabled = this.game.canCast(tactic.id);
            heart.mouseEnabled = enabled;
            const muted = !ringing && !enabled;
            if (muted !== button.muted) {
                // Laya会绑定滤镜到所属节点，清除后不可重用。
                skin.filters = muted ? [new Laya.ColorFilter().gray()] : null;
                icon.filters = muted ? [new Laya.ColorFilter().gray()] : null;
                button.muted = muted;
            }
            const blast = tactic.effect === "TIMED_BLAST";
            note.text = mercy && this.game.state!.night?.mercySpent ? "本夜已用" : waves ? `再守 ${waves} 波` : tapping ? "连点中" :
                blast && this.game.blastAiming ? "点路面" : ringing ? `${blast ? "引爆" : "生效"} ${seconds}秒` :
                    cooling ? `冷却 ${seconds}秒` : !left ? "已用完" :
                        active || mercy && battle.cooldownFor(tactic.id) > 0 ? "待机" : this.game.pauses.size ? "暂停中" : mercy ? "可祈求" : `可用 ${left} 次`;
            if (button.shownTicks === ticks && button.shownClock === clock) continue;
            button.shownTicks = ticks; button.shownClock = clock;
            ring.graphics.clear();
            if (!clock) continue;
            const cfg = HUD.night.ring, center = HUD.footer.start.size / 2;
            ring.graphics.drawCircle(center, center, cfg.radius, null, cooling ? cfg.cooldownTrack : cfg.track, cfg.width);
            const span = cooling ? TACTIC_USE.cooldownTicks : tactic.ticks;
            const points: number[] = [], end = Math.PI * 2 * Math.min(1, ticks / span);
            for (let i = 0; i <= cfg.segments; i++) {
                const angle = -Math.PI / 2 + end * i / cfg.segments;
                points.push(center + Math.cos(angle) * cfg.radius, center + Math.sin(angle) * cfg.radius);
            }
            ring.graphics.drawLines(0, 0, points, cooling ? cfg.cooldownColor : cfg.color, cfg.width);
        }
    }
}
