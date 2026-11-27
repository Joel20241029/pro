import { TOWER_AMMO } from "../config/DefenseConfig";
import { FEATURE_WINS, featureUnlocked } from "../config/DailyTaskConfig";
import { ITEMS, LIANG_INDULGENCE, nightRewardMultiplier, PATROL_RATION } from "../config/ShopConfig";
import { DRAGON_POISON } from "../config/TacticConfig";
import { dailyTasksClaimable } from "../game/DailyTaskState";
import { HUD, LAYOUT } from "./config/HudConfig";
import { GameSession } from "../game/GameSession";
import { capacity, economy, person } from "../game/VillageRules";
import { GameState } from "../game/GameState";
import { RULE, TOWERS } from "../game/GameConfig";
import { gateCapacity } from "../game/Growth";
import { SpriteFrames } from "./SpriteFrames";
import { layoutVillage } from "./VillageScene";
import { GameLayout } from "./GameLayout";
import { C, UI } from "./UiTheme";
import { ScrollList } from "./ScrollList";
import { UiWidgets } from "./UiWidgets";
import { GamePanels } from "./GamePanels";
import { amount, coloredName } from "./ViewText";
import { actionHints, actionHintsBlocked } from "./ActionHints";
import { itemActionHints } from "./panels/ItemPanels";
import { tacticActionReady } from "./panels/TacticLoadoutPanels";
import { NightControls } from "./NightControls";
import { SIDE_FEATURES, TACTIC_UI } from "./config/TacticUiConfig";
import { SHIELD_VISUAL } from "./config/ShieldVisualConfig";
import type { StarterTarget } from "./config/StarterGuideConfig";
interface WorldHudAnchors { towerAnchor(index: number): { x: number; y: number }; gateAnchor(): { x: number; y: number }; }
/** 图标只占右侧炮塔外的窄空地，效果多时向下增加行。 */
const NIGHT_EFFECTS = { width: 122, margin: 8, titleHeight: 28, cell: 38, rowHeight: 48, columns: 3, icon: 26 } as const;
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
    private settings: Laya.Sprite | null = null;
    private nightEffects: Laya.Sprite | null = null;
    private shownNightEffects = "";
    private buildHints: Laya.Sprite[] = [];
    private hintSeconds = 0;
    private sideScroll = 0;
    coinIcon: Laya.Sprite | null = null;
    readonly featureButtons: Laya.Sprite[] = [];
    guideTargets: Partial<Record<StarterTarget, Laya.Sprite>> = {};
    startButton: Laya.Sprite | null = null;
    tacticBadge: Laya.Sprite | null = null;
    constructor(private game: GameSession, _art: SpriteFrames, private ui: UiWidgets, private panels: GamePanels, private refresh: () => void) { }
    clear() {
        this.gateGauge = this.gateShield = null;
        this.nightControls = null;
        this.nightStatus = null;
        this.settings = null;
        this.nightEffects = null;
        this.shownNightEffects = "";
        this.buildHints.length = 0;
        this.startButton = this.tacticBadge = null;
        this.guideTargets = {};
        this.coinIcon = null;
        this.featureButtons.length = 0;
        this.node.destroyChildren();
        this.node.graphics.clear();
    }
    drawHeader(layout: GameLayout) {
        const statusY = layout.mapTop - HUD.statusHeight;
        this.node.graphics.drawRect(0, 0, LAYOUT.width, statusY, C.cream);
    }
    draw(s: GameState, layout: GameLayout, scene: ReturnType<typeof layoutVillage>, anchors: WorldHudAnchors, shownFeatures: number = SIDE_FEATURES.length, tacticUnread = false) {
        const battle = this.game.battle, statusY = layout.mapTop - HUD.statusHeight, bottomY = layout.footerTop;
        const blocked = actionHintsBlocked(this.game);
        const hints = actionHints(s, blocked);
        const resource = HUD.resource;
        this.coinIcon = this.ui.iconValue(this.node, "icon_coin", amount(s.coins, true), 97, layout.resourcesY + resource.textY,
            226, resource.height, C.ink, resource.font);
        this.ui.iconValue(this.node, "icon_population", `${s.people.length}/${capacity(s)}`, 397, layout.resourcesY + resource.textY,
            226, resource.height, C.ink, resource.font);
        this.node.graphics.drawRect(0, statusY, LAYOUT.width, HUD.statusHeight, s.phase === "NIGHT" ? C.nightRibbon : C.dayRibbon);
        const count = s.wave?.entries.length || 0;
        this.nightStatus = this.ui.label(this.node, s.phase === "NIGHT" ? `守夜中 · 已守 ${amount(s.completed)} 波` : `第 ${s.day} 天 · 今夜 ${count} 名来敌 · 已守 ${amount(s.completed)} 波`, 28, statusY, 664, 23, C.cream, true, HUD.statusHeight);
        this.nightStatus.align = "center";
        this.nightStatus.wordWrap = false;
        this.nightStatus.overflow = Laya.Text.SHRINK;
        if (s.phase === "DAY" || s.phase === "NIGHT") {
            const spec = HUD.settings;
            this.settings = this.ui.button(this.node, "设置", LAYOUT.width - spec.right - spec.size, layout.mapTop + TACTIC_UI.side.top,
                spec.size, () => this.panels.open({ type: "settings" }), C.muted, spec.size);
            const face = this.settings.getChildByName("buttonFace") as Laya.Sprite;
            this.ui.image(face, "icon_settings", (spec.size - spec.icon) / 2, spec.iconTop, spec.icon).name = "buttonIcon";
            const text = face.getChildByName("buttonText") as Laya.Text;
            text.pos(8, spec.captionTop); text.size(spec.size - 16, 30); text.fontSize = spec.font;
        }
        if (battle) {
            const effects = this.nightEffects = this.node.addChild(new Laya.Sprite());
            effects.name = "NightEffects";
            effects.pos(LAYOUT.width - NIGHT_EFFECTS.width - NIGHT_EFFECTS.margin, layout.mapTop + NIGHT_EFFECTS.margin);
            effects.mouseEnabled = effects.visible = false;
            this.drawNightEffects();
        }
        // 开村即开放的入口也参与排布；其余入口按已提交的最高守夜记录逐项开放。
        if (s.phase !== "NIGHT") {
            const itemHints = itemActionHints(this.game, s, blocked);
            const side = TACTIC_UI.side;
            const unlocked = SIDE_FEATURES.filter(entry => featureUnlocked(entry.panel === "expedition" ? s.completed : s.legacy.bestNight, entry.panel));
            const showTest = this.game.testEntryEnabled && s.phase === "DAY";
            const testSlots = Number(showTest), slots = unlocked.length + testSlots;
            const available = layout.gateY - layout.mapTop - side.top * 2;
            const compact = slots > 3 && available < slots * (side.size + side.gap) - side.gap;
            const gap = compact ? slots >= SIDE_FEATURES.length ? side.expeditionGap : side.compactGap : side.gap;
            const size = compact ? Math.max(side.minSize, Math.min(side.size, Math.floor((available + gap) / slots - gap))) : side.size;
            const ratio = size / side.size;
            const height = slots * (size + gap) - gap;
            let parent = this.node, x: number = side.x, y = layout.mapTop + side.top;
            if ((showTest || unlocked.length === SIDE_FEATURES.length) && height > available) {
                const reveal = shownFeatures === SIDE_FEATURES.length - 1;
                const rail = new ScrollList(size + UI.scrollGutter, available, height,
                    reveal ? height - available : this.sideScroll, offset => this.sideScroll = offset);
                rail.name = "SideFeatureRail";
                rail.pos(x, y); this.node.addChild(rail);
                parent = rail.content; x = y = 0;
            } else this.sideScroll = 0;
            if (showTest) {
                const test = this.ui.button(parent, "测试", x, y, size, () => this.game.jumpToTestNight(), C.gold, size, !blocked);
                test.name = "TestJumpButton";
            }
            unlocked.forEach((entry, slot) => {
                const title = entry.panel === "expedition" && compact ? "勇闯" : entry.title;
                const b = this.ui.button(parent, title, x, y + (slot + testSlots) * (size + gap), size,
                    () => this.panels.open({ type: entry.panel }), C.muted, size);
                b.name = entry.name;
                b.visible = FEATURE_WINS[entry.panel] === 0 || SIDE_FEATURES.indexOf(entry) < shownFeatures;
                b.mouseEnabled = b.visible;
                this.featureButtons.push(b);
                if (entry.panel === "tactics") this.guideTargets.tactics = b;
                const face = b.getChildByName("buttonFace") as Laya.Sprite;
                this.ui.image(face, entry.icon, (size - side.icon * ratio) / 2, side.iconY * ratio, side.icon * ratio).name = "buttonIcon";
                const text = face.getChildByName("buttonText") as Laya.Text;
                text.pos(12, side.textY * ratio); text.size(size - 24, 32 * ratio); text.fontSize = Math.round(side.font * ratio);
                if (entry.panel === "tactics" && !blocked && s.phase === "DAY" && (tacticUnread || tacticActionReady(s)))
                    this.tacticBadge = this.ui.actionBadge(b, "TacticActionHint");
                if (entry.panel === "dailyTasks" && !blocked && dailyTasksClaimable(s, this.game.taskDate))
                    this.ui.actionBadge(b, "DailyTasksActionHint");
                if (entry.panel === "expedition" && !blocked && s.phase === "DAY" && s.expedition?.remaining)
                    this.ui.actionBadge(b, "ExpeditionActionHint");
                if ((entry.panel === "shop" || entry.panel === "backpack") && itemHints[entry.panel])
                    this.ui.actionBadge(b, `ActionHint:${entry.panel}`);
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
        const emptyPad = s.towers.findIndex(t => !t.kind);
        // 第四波从真实可点塔位中优先指向首个空位，建满时教玩家使用第一座塔。
        const guidePad = emptyPad < 0 ? 0 : emptyPad;
        for (let i = 0; i < scene.pads.length; i++) {
            const t = battle?.base.towers[i] || s.towers[i], pos = anchors.towerAnchor(i);
            const b = new Laya.Sprite();
            b.pos(scene.pads[i].x + HUD.tower.hitX, scene.pads[i].y + HUD.tower.hitY);
            b.size(HUD.tower.hitWidth, t.kind ? HUD.tower.hitHeight : HUD.towerBuildHint.hitHeight);
            b.name = `TowerHotspot:${i}`;
            // 塔面板只使用 open/close 配对管理的 CHOICE 暂停，不把临时调任变成手动暂停。
            this.ui.bindClick(b, () => this.panels.open({ type: "tower", index: i }));
            this.node.addChild(b);
            if (i === guidePad) this.guideTargets.tower = b;
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
            const label = this.ui.label(this.node, `${TOWER_AMMO[t.kind].name} ${amount(t.level)}阶\n${op}`, pos.x - HUD.tower.labelWidth / 2, pos.y, HUD.tower.labelWidth, HUD.tower.font, t.operator ? C.cream : "#fff0b2", true, HUD.tower.occupiedHeight);
            label.fontSize = HUD.tower.font;
            label.leading = HUD.tower.leading;
            label.stroke = HUD.tower.stroke;
            label.align = "center";
            label.valign = "top";
            label.wordWrap = false;
            label.overflow = Laya.Text.SHRINK;
        }
        this.node.graphics.drawRect(0, bottomY, LAYOUT.width, layout.height - bottomY, C.cream);
        const footer = HUD.footer;
        if (s.phase === "DAY") {
            const e = economy(s), info = footer.info, wave = footer.wave, start = footer.start;
            const y = bottomY + info.y;
            this.ui.iconValue(this.node, "icon_coin", `守夜奖励 +${amount(e.total, true)}`, info.x, y, info.width, info.height, C.ink, 24);
            // 来敌入口退为信息行文字，仍复用原按钮的点击、音效和按压取消逻辑。
            const preview = this.ui.button(this.node, `来敌 ${amount(count, true)} ›`, wave.x, bottomY + wave.y, wave.width,
                () => this.panels.open({ type: "nightDetails", back: { type: "start" } }), C.muted, wave.height);
            preview.name = "button:今夜来敌";
            const previewFace = preview.getChildByName("buttonFace") as Laya.Sprite;
            previewFace.graphics.clear();
            const previewText = previewFace.getChildByName("buttonText") as Laya.Text;
            previewText.pos(0, info.y); previewText.size(wave.width, info.height);
            previewText.fontSize = wave.font; previewText.color = C.timber; previewText.underline = true;
            previewText.wordWrap = false; previewText.overflow = Laya.Text.SHRINK;
            const primary = this.ui.button(this.node, "", start.x, bottomY + start.y, start.size, () => this.panels.open({ type: "start" }), C.green, start.size);
            this.startButton = primary;
            this.guideTargets.start = primary;
            primary.name = "button:开始守夜";
            const face = primary.getChildByName("buttonFace") as Laya.Sprite;
            face.graphics.clear();
            this.ui.image(face, HUD.roundButtonSkin, 0, 0, start.size, start.size, false).name = "buttonSkin";
            this.ui.image(face, "icon_night_shield", (start.size - start.icon) / 2, start.iconY, start.icon).name = "buttonIcon";
            const caption = this.ui.label(face, "开始守夜", start.textX, start.textY, start.textWidth, start.font, C.ink, true, start.textHeight);
            caption.name = "buttonText"; caption.align = "center"; caption.wordWrap = false; caption.overflow = Laya.Text.SHRINK;
            caption.stroke = 0; caption.strokeColor = C.outline;
        }
        else if (s.phase === "NIGHT") {
            this.nightControls = new NightControls(this.game, this.ui, this.panels, this.refresh);
            this.nightControls.node.y = bottomY;
            this.node.addChild(this.nightControls.node);
        }
        else
            this.ui.label(this.node, s.summary, 28, bottomY + 16, 664, 23, C.green, true, 110);
        if (s.phase !== "NIGHT") HUD.navigation.forEach(({ title, panel, icon }, i) => {
            const nav = footer.navigation, daytime = s.phase === "DAY";
            const button = this.ui.button(this.node, title, daytime ? nav.xs[i] : 28 + 168 * i, bottomY + (daytime ? nav.y : 150), daytime ? nav.width : 160, () => this.panels.open({ type: panel }), C.muted, daytime ? nav.height : 78);
            if (panel === "people" || panel === "families" || panel === "build") this.guideTargets[panel] = button;
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
        this.drawNightEffects();
        if (battle) {
            const ringing = !battle.outcome && battle.bellTicks > 0, seconds = Math.ceil(battle.bellTicks * RULE.step / this.game.battleSpeed);
            if (this.nightStatus) {
                const tactic = battle.tactic;
                const effect = tactic.effect === "GATE_INVULNERABLE" ? "城门无敌" :
                    tactic.effect === "MULTI_TARGET" ? `同时攻击 ${tactic.targets} 目标` :
                    tactic.effect === "SUMMON_CHARGE" ? (battle.summonCharge?.gathered === 1 ? "分身冲锋中" : "分身集结中") :
                    tactic.effect === "MIND_LOCK" ? "全场定身" : tactic.effect === "TIMED_BLAST" ? "即将引爆" :
                        tactic.effect === "DRAGON_POISON" ? "毒伤持续" : "multiplier" in tactic ?
                        `${tactic.effect === "ATTACK_DAMAGE" ? "伤害" : "攻速"} +${Math.round((tactic.multiplier - 1) * 100)}%` : "";
                const duration = tactic.effect === "SUMMON_CHARGE" ? "" : ` · 还剩 ${seconds}秒`;
                const hand = battle.handSpeed;
                this.nightStatus.text = hand ? "战场已冻结" :
                    this.game.blastAiming ? "点友谊路埋弹 · 再点泻火取消" : ringing ?
                    `${tactic.name} · ${effect}${duration}` : `守夜中 · 已守 ${amount(s.completed)} 波`;
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
    private drawNightEffects() {
        const box = this.nightEffects, battle = this.game.battle;
        if (!box || !battle) return;
        const night = battle.base.night;
        if (!night) return;
        const signature = `${night.rewardDie}|${night.patrolRation}|${night.patrolWideImpact}|${battle.wavePoisoned}|${battle.weakenedReinforcements}`;
        if (signature === this.shownNightEffects) return;
        this.shownNightEffects = signature;
        const effects: { icon: string; name: string; value: string; penalty?: boolean }[] = [];
        if (night.rewardDie !== undefined) {
            const multiplier = nightRewardMultiplier(night.rewardDie);
            effects.push({ icon: ITEMS.yuexiu_dice.icon, name: "骰子产出", value: `×${multiplier}`, penalty: multiplier < 1 });
        }
        if (night.patrolRation) effects.push({ icon: ITEMS.patrol_ration.icon, name: "旋转伤害", value: `+${Math.round((PATROL_RATION.damageMultiplier - 1) * 100)}%` });
        if (night.patrolWideImpact) effects.push({ icon: ITEMS.liang_indulgence.icon, name: "砸地半径", value: `+${Math.round((LIANG_INDULGENCE.radiusMultiplier - 1) * 100)}%` });
        if (battle.wavePoisoned) effects.push({ icon: DRAGON_POISON.icon, name: "整波来敌中毒", value: "中毒" });
        if (battle.weakenedReinforcements) effects.push({ icon: "icon_heart", name: "后续来敌减血", value: "减血" });
        box.destroyChildren();
        box.graphics.clear();
        box.visible = effects.length > 0;
        const { width, titleHeight, rowHeight, columns, cell, icon } = NIGHT_EFFECTS;
        const height = titleHeight + Math.ceil(effects.length / columns) * rowHeight + 5;
        if (this.settings) this.settings.y = box.visible ? box.y + height + HUD.settings.gap : box.y - NIGHT_EFFECTS.margin + TACTIC_UI.side.top;
        if (!box.visible) return;
        box.size(width, height);
        box.graphics.drawRoundRect(0, 0, width, height, 15, 15, 15, 15, C.paper, C.lockedRim, 3);
        this.ui.label(box, "本夜效果", 12, 2, width - 24, 21, C.ink, true, titleHeight - 4).align = "center";
        effects.forEach((effect, i) => {
            const row = Math.floor(i / columns), count = Math.min(columns, effects.length - row * columns);
            const x = (width - count * cell) / 2 + (i % columns) * cell, y = titleHeight + row * rowHeight;
            this.ui.image(box, effect.icon, x + (cell - icon) / 2, y + 2, icon).name = effect.name;
            const value = this.ui.label(box, effect.value, x, y + icon, cell, 17, effect.penalty ? C.red : C.green, true, rowHeight - icon);
            value.align = "center"; value.fontSize = 17; value.wordWrap = false; value.overflow = Laya.Text.SHRINK;
        });
    }
    /** 与游戏共用暂停后的视觉时间，刷新HUD只重建节点，不重置呼吸相位。 */
    advance(delta: number) {
        const hint = HUD.towerBuildHint;
        this.hintSeconds = (this.hintSeconds + delta) % hint.seconds;
        const scale = 1 + Math.sin(this.hintSeconds / hint.seconds * Math.PI * 2) * hint.amplitude;
        for (const icon of this.buildHints) icon.scale(scale, scale);
    }
}
