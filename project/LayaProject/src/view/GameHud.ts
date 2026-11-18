import { HUD, LAYOUT } from "./config/HudConfig";
import { GameSession } from "../game/GameSession";
import { capacity, economy, person } from "../game/VillageRules";
import { GameState } from "../game/GameState";
import { RULE, SEASONS, TOWERS } from "../game/GameConfig";
import { season } from "../game/WaveGenerator";
import { gateCapacity, storageCapacity } from "../game/Growth";
import { SpriteFrames } from "./SpriteFrames";
import { layoutVillage } from "./VillageScene";
import { GameLayout } from "./GameLayout";
import { C } from "./UiTheme";
import { UiWidgets } from "./UiWidgets";
import { GamePanels } from "./GamePanels";
import { amount, coloredName } from "./ViewText";
import { drawHudSurface } from "./UiSurface";
import { actionHints, actionHintsBlocked } from "./ActionHints";
import { NightControls } from "./NightControls";
import { SIDE_FEATURES, TACTIC_UI } from "./config/TacticUiConfig";
import { SHIELD_VISUAL } from "./config/ShieldVisualConfig";
interface WorldHudAnchors { towerAnchor(index: number): { x: number; y: number }; gateAnchor(): { x: number; y: number }; }
/** 常驻信息与操作区。每次 refresh 重画 chrome；战斗帧只更新文字、血条，不重建按钮。 */
export class GameHud {
    readonly node = new Laya.Sprite();
    private hp!: Laya.Text;
    private gateGauge: Laya.Sprite | null = null;
    private gateShield: Laya.Sprite | null = null;
    private gateAnchorY = 0;
    private shieldCompact = false;
    private nightControls: NightControls | null = null;
    private nightStatus: Laya.Text | null = null;
    private buildHints: Laya.Sprite[] = [];
    private hintSeconds = 0;
    readonly materialIcons: Partial<Record<"food" | "wood", Laya.Sprite>> = {};
    readonly featureButtons: Laya.Sprite[] = [];
    startButton: Laya.Sprite | null = null;
    tacticBadge: Laya.Sprite | null = null;
    constructor(private game: GameSession, _art: SpriteFrames, private ui: UiWidgets, private panels: GamePanels, private refresh: () => void) { }
    clear() {
        this.gateGauge = this.gateShield = null;
        this.nightControls = null;
        this.nightStatus = null;
        this.buildHints.length = 0;
        this.startButton = this.tacticBadge = null;
        delete this.materialIcons.food; delete this.materialIcons.wood;
        this.featureButtons.length = 0;
        this.node.destroyChildren();
        this.node.graphics.clear();
    }
    drawHeader(layout: GameLayout) {
        const statusY = layout.mapTop - HUD.statusHeight;
        // 安全区与 HUD 共用底色，顶部胶囊周围保持完整背景。
        this.node.graphics.drawRect(0, 0, LAYOUT.width, statusY, C.cream);
        const header = new Laya.Sprite();
        header.pos(0, layout.safeTop);
        drawHudSurface(header, LAYOUT.width, statusY - layout.safeTop, false);
        this.node.addChild(header);
        this.ui.label(this.node, "代代守村", HUD.title.x, layout.dateY + HUD.title.top, HUD.title.width, HUD.title.font, C.ink, true, HUD.title.height).align = "center";
        const settings = this.ui.button(this.node, "设置", HUD.settings.x, layout.dateY + HUD.settings.top, HUD.settings.width, () => this.panels.open({ type: "settings" }), C.muted, HUD.settings.height);
        this.ui.buttonIcon(settings, "icon_settings", 30);
    }
    draw(s: GameState, layout: GameLayout, scene: ReturnType<typeof layoutVillage>, anchors: WorldHudAnchors, shownFeatures: number = SIDE_FEATURES.length, tacticUnread = false) {
        const battle = this.game.battle, statusY = layout.mapTop - HUD.statusHeight, bottomY = layout.footerTop;
        const blocked = actionHintsBlocked(this.game), hints = actionHints(s, blocked);
        this.ui.label(this.node, `第 ${Math.floor((s.day - 1) / 12) + 1} 年 · ${SEASONS[season(s.day)]}${((s.day - 1) % 3) + 1}日`, HUD.date.x, layout.dateY + HUD.date.top, HUD.date.width, HUD.date.font, C.green, true, HUD.date.height).align = "center";
        // 与人口统一为“现有/容量”；窄栏的千进制数值省略小数，始终单行显示。
        const [food, wood, storage] = [s.food, s.wood, storageCapacity(s)].map(value => amount(value, true).replace(/\.\d(?=[kmbtq]$)/, ""));
        [["icon_food", `${food}/${storage}`], ["icon_wood", `${wood}/${storage}`], ["icon_population", `人 ${s.people.length}/${capacity(s)}`]].forEach(([id, value], i) => {
            const spec = HUD.resource, full = i < 2 && (i === 0 ? s.food : s.wood) >= storageCapacity(s);
            const icon = this.ui.iconValue(this.node, id, value, spec.x + i * spec.step, layout.resourcesY + spec.textY,
                spec.width, spec.height, full ? C.timber : C.ink, spec.font);
            if (i < 2) this.materialIcons[i === 0 ? "food" : "wood"] = icon;
        });
        this.node.graphics.drawRect(0, statusY, LAYOUT.width, HUD.statusHeight, C.green);
        const count = s.wave?.entries.length || 0;
        this.nightStatus = this.ui.label(this.node, s.phase === "NIGHT" ? `守夜中 · 已守 ${amount(s.completed)} 波 · 齐心护家园` : `第 ${s.day} 天 · 今夜 ${count} 名来敌 · 已守 ${amount(s.completed)} 波`, 28, statusY, 664, 24, "#f4edce", true, 37);
        this.nightStatus.align = "center";
        this.nightStatus.wordWrap = false;
        this.nightStatus.overflow = Laya.Text.SHRINK;
        // 首次成功守住一波才解锁；沿用已提交的传承最高纪录，重新开村仍保持入口。
        if (s.legacy.bestNight > 0) {
            const side = TACTIC_UI.side;
            SIDE_FEATURES.forEach((entry, i) => {
                const b = this.ui.button(this.node, entry.title, side.x, layout.mapTop + side.top + i * (side.size + side.gap), side.size,
                    () => this.panels.open({ type: entry.panel }), C.muted, side.size);
                b.name = entry.name;
                b.visible = i < shownFeatures;
                this.featureButtons.push(b);
                const face = b.getChildByName("buttonFace") as Laya.Sprite;
                this.ui.image(face, entry.icon, (side.size - side.icon) / 2, side.iconY, side.icon).name = "buttonIcon";
                const text = face.getChildByName("buttonText") as Laya.Text;
                text.pos(12, side.textY); text.size(side.size - 24, 32); text.fontSize = side.font;
                if (entry.panel === "tactics" && !blocked && tacticUnread)
                    this.tacticBadge = this.ui.actionBadge(b, "TacticActionHint");
            });
        }
        const gate = battle?.gate ?? s.gate, gateAnchor = anchors.gateAnchor();
        this.gateAnchorY = gateAnchor.y;
        this.shieldCompact = layout.gateY - layout.mapTop < SHIELD_VISUAL.compactBattleHeight;
        // 血量与血条对齐二维城门上沿，窗口重排时使用同一布局挂点。
        // 沿用资源栏的整数千进制显示，避免高等级数值变长挤到右侧塔身；血条仍按真实耐久比例绘制。
        this.hp = this.ui.label(this.node, `${amount(gate, true)}/${amount(gateCapacity(s), true)}`.replace(/\.\d(?=[kmbtq])/g, ""), gateAnchor.x - HUD.gate.width / 2, gateAnchor.y - HUD.gate.height - HUD.gate.barHeight - 5, HUD.gate.width, HUD.gate.font, C.cream, true, HUD.gate.height);
        this.hp.fontSize = HUD.gate.font;
        this.hp.stroke = HUD.gate.stroke;
        this.hp.align = "center";
        this.hp.wordWrap = false;
        this.hp.overflow = Laya.Text.SHRINK;
        this.gateGauge = new Laya.Sprite();
        this.gateGauge.pos(gateAnchor.x - HUD.gate.barWidth / 2, gateAnchor.y - HUD.gate.barHeight);
        this.gateGauge.mouseEnabled = false;
        this.node.addChild(this.gateGauge);
        const shield = SHIELD_VISUAL.hud;
        this.gateShield = this.ui.image(this.node, "icon_tactic_shield",
            gateAnchor.x + HUD.gate.width / 2 + shield.iconGap,
            gateAnchor.y - HUD.gate.height - HUD.gate.barHeight - 5, shield.iconSize);
        this.gateShield.name = "GateShieldBadge"; this.gateShield.visible = !!battle?.gateProtected;
        for (let i = 0; i < scene.pads.length; i++) {
            const t = battle?.base.towers[i] || s.towers[i], pos = anchors.towerAnchor(i);
            const b = new Laya.Sprite();
            b.pos(scene.pads[i].x + HUD.tower.hitX, scene.pads[i].y + HUD.tower.hitY);
            b.size(HUD.tower.hitWidth, t.kind ? HUD.tower.hitHeight : HUD.towerBuildHint.hitHeight);
            // 塔面板只使用 open/close 配对管理的 CHOICE 暂停，不把临时调任变成手动暂停。
            this.ui.bindClick(b, () => this.panels.open({ type: "tower", index: i }));
            this.node.addChild(b);
            if (!t.kind) {
                const hint = HUD.towerBuildHint, icon = this.ui.image(this.node, "icon_build_plus", pos.x, scene.pads[i].y - hint.centerAbovePad, hint.size);
                icon.name = `BuildTowerHint:${i}`;
                icon.pivot(hint.size / 2, hint.size / 2);
                icon.alpha = s.phase === "DAY" ? 1 : .55;
                if (s.phase === "DAY") this.buildHints.push(icon);
                continue;
            }
            const op = t.operator ? coloredName(person(s, t.operator)) : "成年村民不足";
            // 沿用城门文字的独立字号做法，避开通用地图文字24号下限；所有塔名与姓名都对齐塔中心。
            const label = this.ui.label(this.node, `${TOWERS[t.kind].name} ${amount(t.level)}阶\n${op}`, pos.x - HUD.tower.labelWidth / 2, pos.y, HUD.tower.labelWidth, HUD.tower.font, t.operator ? C.cream : "#fff0b2", true, HUD.tower.occupiedHeight);
            label.fontSize = HUD.tower.font;
            label.leading = HUD.tower.leading;
            label.stroke = HUD.tower.stroke;
            label.align = "center";
            label.valign = "top";
            label.wordWrap = false;
            label.overflow = Laya.Text.SHRINK;
        }
        this.node.graphics.drawRect(0, bottomY, 720, layout.height - bottomY, C.cream);
        const bottom = new Laya.Sprite();
        bottom.pos(0, bottomY);
        drawHudSurface(bottom, LAYOUT.width, LAYOUT.footerHeight, true);
        this.node.addChild(bottom);
        const footer = HUD.footer;
        if (s.phase === "DAY") {
            const e = economy(s), info = footer.info, wave = footer.wave, start = footer.start;
            const width = info.width / 3, y = bottomY + info.y;
            this.ui.iconValue(this.node, "icon_food", `产出 +${amount(e.food, true)}`, info.x, y, width, info.height, C.ink, 22);
            this.ui.iconValue(this.node, "icon_food", `口粮 −${amount(e.rations, true)}`, info.x + width, y, width, info.height, e.hungry ? C.red : C.timber, 22);
            this.ui.iconValue(this.node, "icon_wood", `产出 +${amount(e.wood, true)}`, info.x + width * 2, y, width, info.height, C.ink, 22);
            // 来敌入口退为信息行文字，仍复用原按钮的点击、音效和按压取消逻辑。
            const preview = this.ui.button(this.node, `来敌 ${amount(count, true)} ›`, wave.x, bottomY + wave.y, wave.width, () => this.panels.open({ type: "wave" }), C.muted, wave.height);
            preview.name = "button:今夜来敌";
            const previewFace = preview.getChildByName("buttonFace") as Laya.Sprite;
            previewFace.graphics.clear();
            const previewText = previewFace.getChildByName("buttonText") as Laya.Text;
            previewText.pos(0, info.y); previewText.size(wave.width, info.height);
            previewText.fontSize = wave.font; previewText.color = C.timber; previewText.underline = true;
            previewText.wordWrap = false; previewText.overflow = Laya.Text.SHRINK;
            const primary = this.ui.button(this.node, "", start.x, bottomY + start.y, start.size, () => this.panels.open({ type: "start" }), C.green, start.size);
            this.startButton = primary;
            primary.name = "button:开始守夜";
            const face = primary.getChildByName("buttonFace") as Laya.Sprite;
            face.graphics.clear();
            // 圆钮使用完整方形母画布，不能套九宫格或按可见框分别拉伸宽高。
            this.ui.image(face, "button_night_round", 0, 0, start.size, start.size, false).name = "buttonSkin";
            this.ui.image(face, "icon_night_shield", (start.size - start.icon) / 2, start.iconY, start.icon).name = "buttonIcon";
            const caption = this.ui.label(face, "开始守夜", start.textX, start.textY, start.textWidth, start.font, C.lightEdge, true, start.textHeight);
            caption.name = "buttonText"; caption.align = "center"; caption.wordWrap = false; caption.overflow = Laya.Text.SHRINK;
            caption.stroke = start.stroke; caption.strokeColor = C.green;
        }
        else if (s.phase === "NIGHT") {
            this.nightControls = new NightControls(this.game, s, this.ui, this.panels, this.refresh);
            this.nightControls.node.y = bottomY;
            this.node.addChild(this.nightControls.node);
        }
        else
            this.ui.label(this.node, s.summary, 28, bottomY + 16, 664, 23, C.green, true, 110);
        if (s.phase !== "NIGHT") HUD.navigation.forEach(({ title, panel, icon }, i) => {
            const nav = footer.navigation, daytime = s.phase === "DAY";
            const button = this.ui.button(this.node, title, daytime ? nav.xs[i] : 28 + 168 * i, bottomY + (daytime ? nav.y : 150), daytime ? nav.width : 160, () => this.panels.open({ type: panel }), C.muted, daytime ? nav.height : 78);
            const face = button.getChildByName("buttonFace") as Laya.Sprite;
            const text = face.getChildByName("buttonText") as Laya.Text;
            text.fontSize = nav.font; text.color = C.ink; text.stroke = 0;
            if (daytime) {
                this.ui.image(face, icon, (nav.width - nav.icon) / 2, nav.iconY, nav.icon).name = "buttonIcon";
                text.pos(nav.textX, nav.textY); text.size(nav.width - nav.textX * 2, nav.textHeight);
                text.wordWrap = false; text.overflow = Laya.Text.SHRINK;
            } else this.ui.buttonIcon(button, icon, 40);
            if (hints[panel]) this.ui.actionBadge(button, `ActionHint:${panel}`);
        });
    }
    update() {
        const s = this.game.state, battle = this.game.battle;
        if (!s)
            return;
        this.nightControls?.update();
        if (battle) {
            const ringing = !battle.outcome && battle.bellTicks > 0, seconds = Math.ceil(battle.bellTicks * RULE.step / s.settings.speed);
            if (this.nightStatus) {
                const tactic = battle.tactic;
                const effect = tactic.effect === "GATE_INVULNERABLE" ? "城门无敌" :
                    tactic.effect === "MULTI_TARGET" ? `同时攻击 ${tactic.targets} 目标` :
                    tactic.effect === "SUMMON_CHARGE" ? (battle.summonCharge?.gathered === 1 ? "分身冲锋中" : "分身集结中") :
                    `${tactic.effect === "ATTACK_DAMAGE" ? "伤害" : "攻速"} +${Math.round((tactic.multiplier - 1) * 100)}%`;
                const duration = tactic.effect === "SUMMON_CHARGE" ? "" : ` · 还剩 ${seconds}秒`;
                this.nightStatus.text = ringing ? `${tactic.name} · ${effect}${duration}` : `守夜中 · 已守 ${amount(s.completed)} 波 · 齐心护家园`;
            }
            if (this.hp)
                this.hp.text = `${amount(battle.gate, true)}/${amount(gateCapacity(s), true)}`.replace(/\.\d(?=[kmbtq])/g, "");
        }
        if (this.gateGauge) {
            const ratio = (battle ? battle.gate : s.gate) / gateCapacity(s);
            const protectedGate = !!battle?.gateProtected, shield = SHIELD_VISUAL.hud;
            const y = this.gateAnchorY - (protectedGate && !this.shieldCompact ? shield.raise : 0);
            this.hp.fontSize = protectedGate && this.shieldCompact ? shield.compactFont : HUD.gate.font;
            this.hp.y = y - HUD.gate.height - HUD.gate.barHeight - 5;
            this.gateGauge.y = y - HUD.gate.barHeight;
            if (this.gateShield) { this.gateShield.visible = protectedGate; this.gateShield.y = this.hp.y; }
            this.gateGauge.graphics.clear();
            this.gateGauge.graphics.drawRect(0, 0, HUD.gate.barWidth, HUD.gate.barHeight, protectedGate ? shield.outline : C.outline);
            this.gateGauge.graphics.drawRect(HUD.gate.barInset, HUD.gate.barInset, HUD.gate.fillWidth * ratio, HUD.gate.fillHeight, protectedGate ? shield.fill : ratio < HUD.gate.dangerRatio ? C.red : C.gold);
        }
    }
    /** 与游戏共用暂停后的视觉时间，刷新HUD只重建节点，不重置呼吸相位。 */
    advance(delta: number) {
        const hint = HUD.towerBuildHint;
        this.hintSeconds = (this.hintSeconds + delta) % hint.seconds;
        const scale = 1 + Math.sin(this.hintSeconds / hint.seconds * Math.PI * 2) * hint.amplitude;
        for (const icon of this.buildHints) icon.scale(scale, scale);
    }
}
