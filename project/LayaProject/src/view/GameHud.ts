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
/** 常驻信息与操作区。每次 refresh 重画 chrome；战斗帧只更新文字、血条，不重建按钮。 */
export class GameHud {
    readonly node = new Laya.Sprite();
    private hp!: Laya.Text;
    private count!: Laya.Text;
    private gateGauge: Laya.Sprite | null = null;
    private bellCountdown: Laya.Text | null = null;
    private nightStatus: Laya.Text | null = null;
    constructor(private game: GameSession, private art: SpriteFrames, private ui: UiWidgets, private panels: GamePanels, private refresh: () => void) { }
    clear() {
        this.bellCountdown = null;
        this.nightStatus = null;
        this.node.destroyChildren();
        this.node.graphics.clear();
    }
    drawHeader(layout: GameLayout) {
        const statusY = layout.mapTop - HUD.statusHeight;
        const header = new Laya.Sprite();
        header.pos(0, layout.safeTop);
        this.art.panel(header, "panel_card", LAYOUT.width, statusY - layout.safeTop);
        this.node.addChild(header);
        this.ui.label(this.node, "代代守村", HUD.title.x, layout.dateY + HUD.title.top, HUD.title.width, HUD.title.font, C.ink, true, HUD.title.height).align = "center";
        this.ui.button(this.node, "小记", HUD.settings.x, layout.dateY + HUD.settings.top, HUD.settings.width, () => this.panels.open({ type: "settings" }), C.muted, HUD.settings.height);
    }
    draw(s: GameState, layout: GameLayout, scene: ReturnType<typeof layoutVillage>) {
        const battle = this.game.battle, statusY = layout.mapTop - HUD.statusHeight, bottomY = layout.footerTop;
        this.ui.label(this.node, `第 ${Math.floor((s.day - 1) / 12) + 1} 年 · ${SEASONS[season(s.day)]}${((s.day - 1) % 3) + 1}日`, HUD.date.x, layout.dateY + HUD.date.top, HUD.date.width, HUD.date.font, C.green, true, HUD.date.height).align = "center";
        // 与人口统一为“现有/容量”；窄栏的千进制数值省略小数，始终单行显示。
        const [food, wood, storage] = [s.food, s.wood, storageCapacity(s)].map(value => amount(value, true).replace(/\.\d(?=[kmbtq]$)/, ""));
        [["icon_food", "粮", `${food}/${storage}`], ["icon_wood", "木", `${wood}/${storage}`], ["icon_population", "人", `${s.people.length}/${capacity(s)}`]].forEach(([id, name, value], i) => {
            const x = HUD.resource.x + i * HUD.resource.step, card = new Laya.Sprite();
            card.pos(x, layout.resourcesY);
            this.node.addChild(card);
            const full = i < 2 && (i === 0 ? s.food : s.wood) >= storageCapacity(s);
            const text = this.ui.label(card, `${name} ${value}`, 0, HUD.resource.textY, HUD.resource.textWidth, HUD.resource.font, full ? C.timber : C.ink, true, HUD.resource.height);
            text.name = `resource:${id}`;
            text.wordWrap = false;
            text.align = "center";
            // 极端“999m/999m”也留在各自列内；正常库存保持原字号，只对窄栏长数字缩小。
            while (text.textWidth > text.width && text.fontSize > HUD.resource.minFont)
                text.fontSize--;
            // 图文作为一组居中，使用实际文字宽度；人口短数字也不会把图标留在远处。
            text.width = Math.ceil(text.textWidth) + HUD.resource.textPadding;
            const left = (HUD.resource.width - HUD.resource.icon - HUD.resource.gap - text.width) / 2;
            this.ui.image(card, id, left, HUD.resource.iconY, HUD.resource.icon);
            text.x = left + HUD.resource.icon + HUD.resource.gap;
        });
        this.node.graphics.drawRect(0, statusY, LAYOUT.width, HUD.statusHeight, C.green);
        const count = s.wave?.entries.length || 0;
        this.nightStatus = this.ui.label(this.node, s.phase === "NIGHT" ? `守夜中 · 已守 ${amount(s.completed)} 波 · 齐心护家园` : `第 ${s.day} 天 · 今夜 ${count} 名来敌 · 已守 ${amount(s.completed)} 波 · 挑战 ${s.tier}`, 28, statusY, 664, 24, "#f4edce", true, 37);
        this.nightStatus.align = "center";
        this.nightStatus.wordWrap = false;
        this.nightStatus.overflow = Laya.Text.SHRINK;
        // 首次成功守住一波才解锁；沿用已提交的传承最高纪录，重新开村仍保持入口。
        if (s.legacy.bestNight > 0) {
            const ranking = new Laya.Sprite();
            ranking.name = "RankingButton";
            ranking.pos(24, layout.mapTop + 20);
            ranking.size(96, 104);
            this.art.panel(ranking, "panel_card", 96, 104);
            this.node.addChild(ranking);
            this.ui.image(ranking, "icon_trophy", 18, 8, 60);
            this.ui.label(ranking, "排行", 8, 72, 80, 26, C.ink, true, 28).align = "center";
            this.ui.bindClick(ranking, () => this.panels.open({ type: "ranking" }));
        }
        const gate = battle?.gate ?? s.gate;
        // 血量与88宽血条共同对齐城门中心x360；独立22px字号、轻描边，不受通用地图文字24px下限影响。
        // 沿用资源栏的整数千进制显示，避免高等级数值变长挤到右侧塔身；血条仍按真实耐久比例绘制。
        this.hp = this.ui.label(this.node, `${amount(gate, true)}/${amount(gateCapacity(s), true)}`.replace(/\.\d(?=[kmbtq])/g, ""), HUD.gate.x, layout.gateY + HUD.gate.top, HUD.gate.width, HUD.gate.font, C.cream, true, HUD.gate.height);
        this.hp.fontSize = HUD.gate.font;
        this.hp.stroke = HUD.gate.stroke;
        this.hp.align = "center";
        this.hp.wordWrap = false;
        this.hp.overflow = Laya.Text.SHRINK;
        this.gateGauge = new Laya.Sprite();
        this.gateGauge.pos(HUD.gate.barX, layout.gateY + HUD.gate.barTop);
        this.gateGauge.mouseEnabled = false;
        this.node.addChild(this.gateGauge);
        for (let i = 0; i < scene.pads.length; i++) {
            const t = battle?.base.towers[i] || s.towers[i], pos = scene.pads[i];
            const b = new Laya.Sprite();
            b.pos(pos.x + HUD.tower.hitX, pos.y + HUD.tower.hitY);
            b.size(HUD.tower.hitWidth, HUD.tower.hitHeight);
            // 塔面板只使用 open/close 配对管理的 CHOICE 暂停，不把临时调任变成手动暂停。
            this.ui.bindClick(b, () => this.panels.open({ type: "tower", index: i }));
            this.node.addChild(b);
            const op = t.operator ? coloredName(person(s, t.operator)) : "成年村民不足";
            // 下排说明向道路外侧让位：左下70、右下24；为精英长名与居中的城门血条留间距，不改变塔位和点击范围。
            this.ui.label(this.node, t.kind ? `${TOWERS[t.kind].name} ${amount(t.level)}阶\n${op}` : "＋ 建塔", pos.x - HUD.tower.labelHalfWidth + (i === 3 ? HUD.tower.rightLowerX : i === 2 && t.kind ? HUD.tower.leftLowerX : 0), pos.y + (i === 3 ? HUD.tower.rightLowerTop : HUD.tower.top), HUD.tower.labelWidth, HUD.tower.font, t.operator ? C.cream : "#fff0b2", true, t.kind ? HUD.tower.occupiedHeight : HUD.tower.emptyHeight).align = "center";
        }
        this.node.graphics.drawRect(0, bottomY, 720, layout.height - bottomY, C.cream);
        const bottom = new Laya.Sprite();
        bottom.pos(0, bottomY);
        this.art.panel(bottom, "panel_card", LAYOUT.width, LAYOUT.footerHeight);
        this.node.addChild(bottom);
        if (s.phase === "DAY") {
            const e = economy(s);
            this.count = this.ui.label(this.node, `产粮 ${amount(e.food)}   ·   口粮 ${e.rations}   ·   产木 ${amount(e.wood)}`, 28, bottomY + 16, 664, 28, e.hungry ? C.red : C.ink, true);
            this.count.align = "center";
            this.ui.button(this.node, "今夜来敌", 28, bottomY + 65, 185, () => this.panels.open({ type: "wave" }), C.gold, 68);
            this.ui.button(this.node, "开始守夜", 229, bottomY + 65, 463, () => this.panels.open({ type: "start" }), C.gold, 74);
        }
        else if (s.phase === "NIGHT") {
            this.count = this.ui.label(this.node, "", 28, bottomY + 16, 660, 23, C.muted);
            this.ui.button(this.node, this.game.pauses.has("USER") ? "继续守夜" : "暂停", 28, bottomY + 65, 190, () => {
                if (this.game.pauses.has("USER"))
                    this.game.resume("USER");
                else
                    this.game.pause("USER");
                this.refresh();
            }, C.green, 68);
            this.ui.button(this.node, `速度 ×${s.settings.speed}`, 234, bottomY + 65, 190, () => this.panels.send({ type: "SPEED", value: s.settings.speed === 3 ? 1 : s.settings.speed === 1 ? 2 : 3 }), C.muted, 68);
            const bell = this.ui.button(this.node, battle?.bellUsed ? "警钟已用" : this.game.pauses.size ? "恢复后敲钟" : "敲响警钟", 440, bottomY + 65, 252, () => this.game.bell(), C.gold, 68, !battle?.bellUsed && !this.game.pauses.size);
            this.bellCountdown = bell.getChildAt(0).getChildByName("buttonText") as Laya.Text;
        }
        else
            this.ui.label(this.node, s.summary, 28, bottomY + 16, 664, 23, C.green, true, 110);
        HUD.navigation.forEach(({ title, panel, icon }, i) => {
            const button = this.ui.button(this.node, title, 28 + 168 * i, bottomY + 150, 160, () => this.panels.open({ type: panel }), i === 0 ? C.green : C.muted, 78);
            const face = button.getChildAt(0) as Laya.Sprite;
            const text = face.getChildByName("buttonText") as Laya.Text;
            const textWidth = Math.ceil(text.textWidth) + 4, left = (160 - 44 - 6 - textWidth) / 2;
            text.pos(left + 50, 14);
            text.size(textWidth, 50);
            text.wordWrap = false;
            this.ui.image(face, icon, left, 17, 44);
        });
    }
    update() {
        const s = this.game.state, battle = this.game.battle;
        if (!s)
            return;
        if (battle) {
            const ringing = !battle.outcome && battle.bellTicks > 0, seconds = Math.ceil(battle.bellTicks * RULE.step);
            if (this.bellCountdown)
                this.bellCountdown.text = ringing ? `鼓舞 ${seconds}秒` : battle.bellUsed ? "警钟已用" : this.game.pauses.size ? "恢复后敲钟" : "敲响警钟";
            if (this.nightStatus)
                this.nightStatus.text = ringing ? `警钟鼓舞 · 攻速 +${Math.round((RULE.bellSpeedMultiplier - 1) * 100)}% · 还剩 ${seconds}秒` : `守夜中 · 已守 ${amount(s.completed)} 波 · 齐心护家园`;
            if (this.hp)
                this.hp.text = `${amount(battle.gate, true)}/${amount(gateCapacity(s), true)}`.replace(/\.\d(?=[kmbtq])/g, "");
            if (this.count)
                this.count.text = `${this.game.pauses.size ? "已暂停" : "守夜中"}  ·  场上 ${battle.enemies.length}  ·  待来 ${battle.pendingCount}${battle.base.night!.hungry ? "  · 缺粮" : ""}`;
        }
        if (this.gateGauge) {
            const ratio = (battle ? battle.gate : s.gate) / gateCapacity(s);
            this.gateGauge.graphics.clear();
            this.gateGauge.graphics.drawRect(0, 0, HUD.gate.barWidth, HUD.gate.barHeight, C.outline);
            this.gateGauge.graphics.drawRect(HUD.gate.barInset, HUD.gate.barInset, HUD.gate.fillWidth * ratio, HUD.gate.fillHeight, ratio < HUD.gate.dangerRatio ? C.red : C.gold);
        }
    }
}
