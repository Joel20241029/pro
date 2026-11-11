import { GameSession } from "../game/GameSession";
import { capacity, economy, JOB_NAMES, person, canMarry, birthUnavailableReason, Command } from "../game/VillageRules";
import { GameState, isElder, isWorkingAdult, Person } from "../game/GameState";
import { ELITE, ENEMIES, PATH, PADS, POLICIES, RULE, SEASONS, SKILLS, TOWERS, TowerKind, TRAITS } from "../game/GameConfig";
import { BattleSimulation, pointAt } from "../game/BattleSimulation";
import { season } from "../game/WaveGenerator";
import { enemyPower, gateCapacity, laborSlots, laborYield, levelPower, repairCost, storageCapacity, UpgradeKind, upgradeCost, upgradeUnavailableReason } from "../game/Growth";
import { SpriteFrames } from "./SpriteFrames";
import { compareDepth, VILLAGE_PROPS, WEDDING } from "./VillageScene";
import { VillagerMotion } from "./VillagerMotion";
import { ProjectileMotion } from "./ProjectileMotion";
import { C, UI } from "./UiTheme";
import { Tip } from "./Tip";
import { ScrollList } from "./ScrollList";
import { RankingView } from "./RankingView";
import { WechatPlatform } from "../platform/WechatPlatform";
import { EMOTE, VillagerEmotes } from "./VillagerEmotes";
type Panel = { type: string; id?: string; index?: number; scroll?: number; a?: string; job?: "FARM" | "LOGGING" };
export class GameView {
    readonly root = new Laya.Sprite();
    private scenery = new Laya.Sprite(); private world = new Laya.Sprite(); private chrome = new Laya.Sprite(); private overlay = new Laya.Sprite();
    private people: Laya.Sprite[] = []; private enemies: Laya.Sprite[] = []; private shots = new Laya.Sprite();
    private hearts: Laya.Sprite[] = [];
    private props: { id: string; y: number; node: Laya.Sprite }[] = [];
    private motion = new VillagerMotion();
    private projectiles = new ProjectileMotion(); private projectileNodes: Laya.Sprite[] = [];
    private lastBattle: BattleSimulation | null = null; private lastBattleTick = 0;
    private hp!: Laya.Text; private count!: Laya.Text;
    private gateGauge: Laya.Sprite | null = null;
    private renderDelta = 0; private panel: Panel | null = null;
    private backgroundKey = "";
    private tip: Tip; private shownErrorRevision = 0;
    private observedRun = 0; private observedDawn = 0;
    private emotes = new VillagerEmotes();
    private emote = new Laya.Sprite();
    showMusicProblem() { this.tip.show("音乐暂时无法播放，可在设置中重新开启"); }
    constructor(private game: GameSession, private art: SpriteFrames, private platform: WechatPlatform) {
        this.root.name = "VillageGame"; this.root.size(720, 1280); this.root.stackingRoot = true;
        [this.scenery, this.world, this.shots, this.chrome, this.overlay].forEach((layer, i) => { layer.stackingRoot = true; layer.zIndex = i; this.root.addChild(layer); });
        this.emote.name = "VillagerEmote"; this.emote.zIndex = 2; this.emote.mouseEnabled = false; this.emote.visible = false; this.root.addChild(this.emote);
        this.tip = new Tip(art); this.tip.stackingRoot = true; this.tip.zIndex = 5; this.tip.pos(360, 640); this.root.addChild(this.tip);
        this.world.name = "VillageWorld";
        this.overlay.size(720, 1280); this.overlay.mouseEnabled = true; this.overlay.mouseThrough = true;
        for (const p of VILLAGE_PROPS) {
            const node = new Laya.Sprite(); node.name = p.id; node.mouseEnabled = false;
            this.art.applyFrame(node, p.frame, p.size); node.pos(p.x, p.y); this.world.addChild(node); this.props.push({ id: p.id, y: p.y, node });
        }
        for (let i = 0; i < RULE.populationCap; i++) {
            const s = new Laya.Sprite(); s.mouseEnabled = false; s.stackingRoot = true; this.world.addChild(s); this.people.push(s);
            // 红心与人物共用足底排序，屋顶仍可遮住他们；固定池随人物销毁，不在逐帧更新中创建节点。
            const heart = new Laya.Sprite(); heart.name = "WeddingHeart"; heart.mouseEnabled = false; heart.visible = false;
            this.art.applyFrame(heart, "fx_hearts", WEDDING.heartSize); s.addChild(heart); this.hearts.push(heart);
        }
        for (let i = 0; i < RULE.enemyCap; i++) { const s = new Laya.Sprite(); s.mouseEnabled = false; this.world.addChild(s); this.enemies.push(s); }
        for (let i = 0; i < RULE.effectCap; i++) { const s = new Laya.Sprite(); s.mouseEnabled = false; s.visible = false; this.shots.addChild(s); this.projectileNodes.push(s); }
        game.changed = () => this.refresh(); this.refresh();
    }
    private label(parent: Laya.Sprite, text: string, x: number, y: number, w: number, size: number = UI.body, color = C.ink, bold = false, h = 48): Laya.Text {
        const t = new Laya.Text(); t.html = text.includes("<font "); t.text = text; t.font = "sans-serif"; t.fontSize = Math.max(parent.name.startsWith("panel:") ? UI.body : UI.mapLabel, size); t.color = color; t.bold = bold; t.wordWrap = true; t.leading = 7; t.size(w, h); t.pos(x, y);
        const rgb = parseInt(color.slice(1), 16), light = ((rgb >> 16) * .299 + ((rgb >> 8) & 255) * .587 + (rgb & 255) * .114) > 165;
        t.stroke = light ? (bold ? 2.5 : 2) : 1; t.strokeColor = light ? C.outline : C.lightEdge;
        t.valign = h <= 60 ? "middle" : "top"; t.mouseEnabled = false; parent.addChild(t); return t;
    }
    private image(parent: Laya.Sprite, id: string, x: number, y: number, w: number, h = w) { const s = new Laya.Sprite(); s.texture = this.art.get(id); s.pos(x, y); s.size(w, h); s.mouseEnabled = false; parent.addChild(s); return s; }
    /** 同一姓名格式用于名册、家庭、详情与驻塔；只给名字上色，说明文字保持自身层级。 */
    private coloredName(p: Person, enabled = true) { return `${p.elite ? `<font color="${enabled ? C.timber : C.muted}">精英·</font>` : ""}<font color="${!enabled ? C.muted : p.sex === "MALE" ? C.maleName : C.femaleName}" stroke="1" strokecolor="${C.lightEdge}">${p.name.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</font>`; }
    /** 顶部窄栏用千进制缩写并向下截断，避免显示出尚未拥有的资源；其他说明沿用万/亿。只改变显示。 */
    private amount(value: number, compact = false) {
        if (compact) {
            for (const [unit, suffix] of [[1e15, "q"], [1e12, "t"], [1e9, "b"], [1e6, "m"], [1e3, "k"]] as const) {
                if (value >= unit) return `${Math.floor(value / unit * 10) / 10}${suffix}`;
            }
            return String(value);
        }
        return value >= 100000000 ? `${(value / 100000000).toFixed(1).replace(/\.0$/, "")}亿` : value >= 10000 ? `${(value / 10000).toFixed(1).replace(/\.0$/, "")}万` : String(value);
    }
    /** 紧凑显示将相邻等级舍入成相同数值时，改列实际增量，避免显示成“升级没收益”。 */
    private growthPreview(current: number, next: number) {
        const before = this.amount(current), after = this.amount(next);
        return before === after ? `${before}（+${this.amount(next - current)}）` : `${before} → ${after}`;
    }
    /** 费用保留精确所需值；不足只标红分子，扣费仍由 VillageRules 校验。 */
    private resourceCost(owned: number, required: number) { const shown = this.amount(owned); return `${owned < required ? `<font color="${C.red}" stroke="1" strokecolor="${C.lightEdge}">${shown}</font>` : shown}/${required}`; }
    /** 建设条目共用图标、效果和材料布局；整个条目可点，原因直接可见，不再靠点击后弹Tip解释。 */
    private buildRow(parent: Laya.Sprite, y: number, icon: string, title: string, effect: string, cost: string, reason: string | null, action: () => void, caption = "升级") {
        const row = this.button(parent, "", 0, y, 584, action, C.muted, 158, !reason);
        const face = row.getChildAt(0) as Laya.Sprite;
        face.graphics.drawRect(12, 20, 5, 116, reason ? C.muted : C.green);
        this.image(face, icon, 26, 35, 64);
        this.label(face, title, 108, 12, 344, 30, reason ? C.muted : C.ink, true, 42);
        this.label(face, reason ? "未满足" : caption, 454, 14, 110, 26, reason ? C.muted : C.green, true, 38).align = "right";
        this.label(face, effect, 108, 54, 452, 26, C.green, false, 36);
        const materials = !reason || (reason.includes("不足") && !reason.includes("仓储"));
        this.label(face, materials ? cost : reason!, 108, 92, 452, 24, reason ? C.muted : C.timber, false, 56);
        return row;
    }
    /** 村民与家庭共用图文条目：头像留独立区域，文字不挤进边框，滚动仍由ScrollList取消误触。 */
    private listItem(parent: Laya.Sprite, title: string, icon: string, y: number, action: () => void, enabled: boolean) {
        const row = this.button(parent, title, 0, y, UI.contentWidth - UI.scrollGutter, action, C.muted, UI.listHeight, enabled);
        const face = row.getChildAt(0) as Laya.Sprite;
        const text = face.getChildByName("buttonText") as Laya.Text;
        text.pos(116, 14); text.size(446, UI.listHeight - 28); text.align = "left"; text.fontSize = 28; text.leading = 6;
        const frame = new Laya.Sprite(); frame.pos(22, 20); this.art.panel(frame, "panel_portrait_frame", 78, 78); frame.mouseEnabled = false; face.addChild(frame);
        this.image(frame, icon, 5, 5, 68).alpha = enabled ? 1 : .5;
        return row;
    }
    private button(parent: Laya.Sprite, title: string, x: number, y: number, w: number, action: () => void, color = C.green, h = 72, enabled = true) {
        const b = new Laya.Sprite(); b.name = `button:${title}`; b.size(w, h); b.pos(x, y);
        const skin = !enabled ? "panel_button_disabled" : color === C.gold ? "panel_button_gold" : color === C.red ? "panel_button_red" : color === C.muted ? "panel_card" : "panel_button_green";
        // 底板、文字及调用方附加的图标共用面层，整体按压；外层点击区域始终固定。
        const face = new Laya.Sprite(); face.name = "buttonFace"; face.mouseEnabled = false; this.art.panel(face, skin, w, h); b.addChild(face);
        if (title) {
            const t = this.label(face, title, 16, 14, w - 32, UI.button, !enabled ? C.muted : color === C.gold || color === C.muted ? C.ink : C.cream, true, h - 28); t.name = "buttonText"; t.align = "center"; t.valign = "middle"; t.leading = 3;
            // 小尺寸关闭按钮只有一个符号，按实际边框留白；其余按钮正文不进入固定14px边缘。
            if (w < 80) { t.fontSize = 24; t.pos(10, 8); t.size(w - 20, h - 22); }
        }
        if (enabled) {
            b.mouseEnabled = true;
            b.on(Laya.Event.MOUSE_DOWN, this, () => face.y = UI.pressedOffset);
            const release = () => face.y = 0;
            b.on(Laya.Event.MOUSE_UP, this, release); b.on(Laya.Event.MOUSE_OUT, this, release); b.on(Laya.Event.UNDISPLAY, this, release);
            b.on(Laya.Event.CLICK, this, action);
        }
        parent.addChild(b); return b;
    }
    private open(panel: Panel) { this.panel = panel; this.game.pause("CHOICE"); this.refresh(); }
    private close() { this.panel = null; this.game.resume("CHOICE"); this.refresh(); }
    private send(c: Command, keep = true) { if (!keep) { this.panel = null; this.game.resume("CHOICE"); } this.game.command(c); }
    private drawScenery(night: boolean) {
        const key = night ? "night" : "day"; if (this.backgroundKey === key) return; this.backgroundKey = key;
        this.scenery.destroyChildren(); this.scenery.graphics.clear();
        this.scenery.graphics.drawRect(0, 0, 720, 1280, night ? C.night : C.grass);
        this.scenery.graphics.drawRect(0, 780, 720, 260, night ? "#6d785e" : "#b5bd86");
        for (let row = 0; row < 8; row++) {
            this.scenery.graphics.drawCircle(50, 280 + row * 70, 112, night ? "#304c45" : "#6e8e4c");
            this.scenery.graphics.drawCircle(672, 280 + row * 70, 112, night ? "#304c45" : "#6e8e4c");
        }
        // 先完成全部路沿，再铺完整路面，避免后一段路沿覆盖前一段路面形成尖刺接缝。
        for (const surface of [{ width: 80, color: night ? "#696f5e" : "#a99867" }, { width: 68, color: night ? "#8d8976" : "#d3bc8a" }])
            for (let i = 1; i < PATH.length; i++) {
                this.scenery.graphics.drawLine(PATH[i - 1].x, PATH[i - 1].y, PATH[i].x, PATH[i].y, surface.color, surface.width);
                this.scenery.graphics.drawCircle(PATH[i].x, PATH[i].y, surface.width / 2, surface.color);
            }
        // 固定点缀不消费业务 RNG；森林阴影、草簇与小石头为道路提供边缘层次。
        for (const [x, y] of [[182, 399], [530, 470], [173, 591], [560, 643], [297, 628], [411, 356]]) this.image(this.scenery, "deco_rocks", x, y, 36);
        for (let i = 0; i < 26; i++) {
            const x = i % 2 ? 560 + i % 5 * 17 : 105 + i % 5 * 16, y = 298 + Math.floor(i / 2) * 35;
            this.scenery.graphics.drawLine(x, y, x - 3, y - 8, night ? "#577451" : "#668445", 3);
            this.scenery.graphics.drawLine(x, y, x + 4, y - 6, night ? "#577451" : "#668445", 3);
        }
        // 美术仅提供地块拼片，不将未验证接缝的地块铺满地图。
    }
    refresh() {
        const s = this.game.state, battle = this.game.battle;
        if (this.shownErrorRevision !== this.game.errorRevision) {
            this.shownErrorRevision = this.game.errorRevision;
            if (s && this.game.error && !this.game.saves.pending) this.tip.show(this.game.error);
        }
        // 无清晨选择时会直接回到白天，用原 Tip 呈现当次结算；读档只记基线，不补播旧通知。
        if (s) {
            if (this.observedRun === s.run && s.completed > this.observedDawn && s.phase === "DAY" && !this.game.error) this.tip.show(s.summary);
            this.observedRun = s.run; this.observedDawn = s.completed;
        }
        if (this.game.saves.pending) this.tip.visible = false;
        this.chrome.destroyChildren(); this.chrome.graphics.clear(); this.overlay.destroyChildren(); this.overlay.graphics.clear(); this.overlay.mouseThrough = true;
        this.drawScenery(s?.phase === "NIGHT");
        this.art.panel(this.chrome, "panel_card", 720, 209);
        this.chrome.graphics.drawRect(18, 14, 684, 5, C.timber);
        this.label(this.chrome, "代代守村", 34, 26, 430, 36, C.ink, true, 50);
        this.button(this.chrome, "小记", 558, 24, 126, () => this.open({ type: "settings" }), C.muted, 60);
        if (!s) { this.drawBoot(); this.updateActors(); return; }
        // 仅确认状态或界面事件时同步目标，帧循环只推进已有路线。
        this.motion.sync(s, battle ? battle.base.towers : s.towers);
        this.emotes.sync(s);
        this.label(this.chrome, `第 ${Math.floor((s.day - 1) / 12) + 1} 年 · ${SEASONS[season(s.day)]}${((s.day - 1) % 3) + 1}日`, 34, 76, 380, 27, C.green, true, 40);
        this.label(this.chrome, `已守 ${this.amount(s.completed)} 波`, 420, 88, 264, 25, C.timber, true, 28).align = "right";
        [["icon_food", this.amount(s.food, true)], ["icon_wood", this.amount(s.wood, true)], ["icon_population", `${s.people.length}/${capacity(s)}`]].forEach(([id, value], i) => {
            const x = 28 + i * 226, card = new Laya.Sprite(); card.pos(x, 122); this.art.panel(card, "panel_card", 212, 74); this.chrome.addChild(card);
            this.image(card, id, 14, 17, 40);
            const text = this.label(card, value, 64, 13, 134, 34, C.ink, true, 48);
            text.name = `resource:${id}`; text.wordWrap = false; text.align = "center";
        });
        this.chrome.graphics.drawRect(0, 209, 720, 37, C.green);
        const count = s.wave?.entries.length || 0;
        this.label(this.chrome, s.phase === "NIGHT" ? "守夜中 · 齐心护家园" : `第 ${s.day} 天 · 今夜 ${count} 名来敌 · 挑战 ${s.tier}`, 28, 209, 664, 24, "#f4edce", true, 37).align = "center";
        // 首次成功守住一波才解锁；沿用已提交的传承最高纪录，重新开村仍保持入口。
        if (s.legacy.bestNight > 0) {
            const ranking = new Laya.Sprite(); ranking.name = "RankingButton"; ranking.pos(24, 266); ranking.size(96, 104); ranking.mouseEnabled = true;
            this.art.panel(ranking, "panel_card", 96, 104); this.chrome.addChild(ranking);
            this.image(ranking, "icon_trophy", 22, 10, 52);
            this.label(ranking, "排行", 8, 62, 80, 26, C.ink, true, 34).align = "center";
            ranking.on(Laya.Event.CLICK, this, () => this.open({ type: "ranking" }));
        }
        const gate = battle?.gate ?? s.gate;
        this.hp = this.label(this.chrome, `城门 ${this.amount(gate)}/${this.amount(gateCapacity(s))}`, 225, 783, 270, 26, C.cream, true, 38); this.hp.align = "center";
        this.gateGauge = new Laya.Sprite(); this.gateGauge.pos(288, 821); this.gateGauge.mouseEnabled = false; this.chrome.addChild(this.gateGauge);
        for (let i = 0; i < PADS.length; i++) {
            const t = battle?.base.towers[i] || s.towers[i], pos = PADS[i];
            const b = new Laya.Sprite(); b.pos(pos.x - 58, pos.y - 80); b.size(116, 134); b.mouseEnabled = true;
            // 塔面板只使用 open/close 配对管理的 CHOICE 暂停，不把临时调任变成手动暂停。
            b.on(Laya.Event.CLICK, this, () => this.open({ type: "tower", index: i })); this.chrome.addChild(b);
            const op = t.operator ? this.coloredName(person(s, t.operator)) : "空岗";
            this.label(this.chrome, t.kind ? `${TOWERS[t.kind].name} ${this.amount(t.level)}阶\n${op}` : "＋ 建塔", pos.x - 116, pos.y + 27, 232, 24, t.operator ? C.cream : "#fff0b2", true, t.kind ? 64 : 40).align = "center";
        }
        this.chrome.graphics.drawRect(0, 1038, 720, 242, C.cream);
        const bottom = new Laya.Sprite(); bottom.pos(0, 1038); this.art.panel(bottom, "panel_card", 720, 242); this.chrome.addChild(bottom);
        if (s.phase === "DAY") {
            const e = economy(s);
            this.count = this.label(this.chrome, `产粮 ${this.amount(e.food)}   ·   口粮 ${e.rations}   ·   产木 ${this.amount(e.wood)}`, 28, 1054, 664, 28, e.hungry ? C.red : C.ink, true); this.count.align = "center";
            this.button(this.chrome, "今夜来敌", 28, 1103, 185, () => this.open({ type: "wave" }), C.gold, 68);
            this.button(this.chrome, "开始守夜", 229, 1103, 463, () => this.open({ type: "start" }), C.gold, 74);
        } else if (s.phase === "NIGHT") {
            this.count = this.label(this.chrome, "", 28, 1054, 660, 23, C.muted);
            this.button(this.chrome, this.game.pauses.has("USER") ? "继续守夜" : "暂停", 28, 1103, 190, () => { if (this.game.pauses.has("USER")) this.game.resume("USER"); else this.game.pause("USER"); this.refresh(); }, C.green, 68);
            this.button(this.chrome, `速度 ×${s.settings.speed}`, 234, 1103, 190, () => this.send({ type: "SPEED", value: s.settings.speed === 3 ? 1 : s.settings.speed === 1 ? 2 : 3 }), C.muted, 68);
            this.button(this.chrome, battle?.bellUsed ? "警钟已用" : "敲响警钟", 440, 1103, 252, () => this.game.bell(), C.gold, 68, !battle?.bellUsed);
        } else this.label(this.chrome, s.summary, 28, 1054, 664, 23, C.green, true, 110);
        ["村民", "家庭", "建设", "家谱"].forEach((title, i) => {
            const button = this.button(this.chrome, title, 28 + 168 * i, 1188, 160, () => this.open({ type: ["people", "families", "build", "history"][i] }), i === 0 ? C.green : C.muted, 78);
            const face = button.getChildAt(0) as Laya.Sprite;
            const text = face.getChildByName("buttonText") as Laya.Text; text.pos(48, 14); text.size(98, 50);
            this.image(face, ["icon_population", "icon_family", "icon_build", "icon_view"][i], 14, 24, 30);
        });
        if (this.game.saves.pending) this.drawPending();
        else if (this.game.pauses.has("WAIT_RESUME")) {
            const box = this.modal("欢迎回来", "战斗与动画已暂停；退出期间没有生产、成长或战斗损耗。", false);
            this.button(box, "继续游戏", 34, 540, 600, () => { this.game.resume("WAIT_RESUME"); this.refresh(); }, C.gold, 80);
        } else if (s.phase === "GAME_OVER") this.drawGameOver(s);
        else if (s.phase === "DAWN") this.drawDawn(s);
        // 切后台只释放已打开的开放域；回前台点“继续游戏”后再请求授权与绘制。
        else if (this.panel && !this.game.pauses.has("BACKGROUND")) this.drawPanel(s, this.panel);
        this.updateActors();
    }
    private modal(title: string, subtitle: string, close = true) {
        this.overlay.mouseThrough = false;
        this.overlay.graphics.drawRect(0, 0, 720, 1280, "rgba(25,31,22,0.68)");
        const box = new Laya.Sprite(); box.name = `panel:${title}`; box.pos(UI.panelX, UI.panelY); box.size(UI.panelWidth, UI.panelHeight); box.mouseEnabled = true;
        this.art.panel(box, "panel_parchment", UI.panelWidth, UI.panelHeight); this.overlay.addChild(box);
        this.label(box, title, 108, 34, 452, title.replace(/<[^>]*>/g, "").length > 12 ? 32 : UI.title, C.ink, true, 60).align = "center";
        box.graphics.drawLine(64, 100, 604, 100, C.gold, 2);
        this.label(box, subtitle, UI.inset, 108, UI.contentWidth, 27, C.muted, false, 100).align = "center";
        // 用户移除左上麦穗，关闭按钮仍在右侧；底角装饰不参与九宫格拉伸。
        if (close) this.button(box, "×", 560, 48, 50, () => this.close(), C.red, 54);
        return box;
    }
    private drawBoot() {
        const b = this.game.boot;
        if (this.game.saves.pending) { this.drawPending(); return; }
        if (b?.kind === "recover") {
            const box = this.modal("发现一份可恢复进度", "另一份存档损坏。确认后从有效存档继续；原始记录不会被悄悄清除。", false);
            this.button(box, `恢复第 ${b.state.day} 天的村落`, 34, 540, 600, () => this.game.recover(), C.gold, 80); return;
        }
        if (b?.kind === "blocked") {
            const box = this.modal("进度需要核对", b.reason, false);
            this.button(box, "重新读取", 34, 490, 600, () => this.game.retry(), C.gold, 80);
            if (b.canReset) this.button(box, "确认放弃损坏进度，重新开村", 34, 622, 600, () => this.game.newVillage(undefined, true), C.red, 80);
            return;
        }
        const box = this.modal("一处村落，代代相守", "白天安排耕作与家庭，夜晚守住城门。孩子继承双亲天赋，长大后接过守村的责任。", false);
        this.image(box, "building_house_terracotta", 239, 228, 190);
        this.label(box, "先让村民成家，迎接孩子、安排照料。\n守住两夜，再为孩子选择一项专长。", 42, 450, 584, 30, C.green, true, 122).align = "center";
        this.button(box, "开村 · 从这一代开始", 34, 646, 600, () => this.game.newVillage(), C.gold, 84);
        this.label(box, "单机存档 · 随时暂停 · 没有最后一关", 34, 758, 600, 28, C.muted).align = "center";
    }
    private drawPending() {
        const box = this.modal("正在核对保存结果", "本次操作已冻结，重试会核对同一份进度，不会再扣资源或再次结算。", false);
        this.label(box, this.game.error || "正在保存…", 40, 250, 588, 28, C.red, false, 270);
        this.button(box, "核对 / 重试保存", 34, 650, 600, () => this.game.retry(), C.gold, 80);
    }
    private drawPanel(s: GameState, p: Panel) {
        const day = s.phase === "DAY";
        if (p.type === "people" || p.type === "history" || p.type === "partners" || p.type === "carers" || p.type === "operators" || p.type === "care" || p.type === "workers") {
            let list: Person[] = s.people;
            let title = "村民名册", sub = `自动安排：专长优先，先农田后伐木。\n待安排 ${s.people.filter(q => isWorkingAdult(q) && q.job === "WAITING").length} 人 · 养老 ${s.people.filter(isElder).length} 人（占住房）。`;
            if (p.type === "history") { list = s.history.slice().reverse(); title = "村落家谱"; sub = `累计诞生 ${s.legacy.births} 人，荣休 ${s.legacy.retirees} 人。珍藏 ${s.favorites.length}/20。`; }
            if (p.type === "partners") { list = s.people.filter(q => p.a ? canMarry(s, person(s, p.a), q) : isWorkingAdult(q) && !s.families.some(f => f.partners.includes(q.id))); title = p.a ? "选择另一半" : "选择成家村民"; sub = "双方须在劳作期、单身；直系亲属与同胞不能成家。"; }
            if (p.type === "carers") { list = s.people.filter(q => isWorkingAdult(q) && q.job !== "CARE"); title = "迎接新生命"; sub = `粮食 ${this.resourceCost(s.food, RULE.birthCost)}（现有/所需）\n选照料者：白天照料，夜间仍可驻塔。`; }
            if (p.type === "operators") { list = s.people.filter(isWorkingAdult); title = "安排驻塔"; sub = "每人只能驻守一座塔；调任会释放原塔。夜间调任只影响当前战斗，重进恢复战前安排。"; }
            if (p.type === "care") { list = s.people.filter(q => !q.adult && !s.people.some(a => a.careChild === q.id)); title = "选择照料的孩子"; sub = "孩子需得到照料并守住两夜才能成年。"; }
            if (p.type === "workers") { list = s.people.filter(q => isWorkingAdult(q) && q.job === p.job && q.id !== p.id); title = "选择替换的工人"; sub = `${JOB_NAMES[p.job!]}岗位已满，选一位村民换岗。\n原工人有其他空岗会自动补位。`; }
            const box = this.modal(title, sub);
            if (!list.length) {
                const empty = this.label(box, p.type === "history" ? "家谱暂无记录" : "暂时没有可选的人", UI.inset, UI.panelHeight / 2 - 48, UI.contentWidth, 34, C.muted, false, 96);
                empty.name = "emptyState"; empty.align = "center"; empty.valign = "middle"; empty.wordWrap = false; return;
            }
            const rows = new ScrollList(UI.contentWidth, 590, Math.max(0, list.length * UI.listStep - 8), p.scroll, offset => p.scroll = offset);
            rows.pos(UI.inset, UI.listTop); box.addChild(rows);
            list.forEach((q, i) => {
                const reason = p.type === "carers" ? birthUnavailableReason(s, p.id!, q.id) : null;
                const desc = `${this.coloredName(q, reason === null)} · ${q.sex === "MALE" ? "男" : "女"} · ${TRAITS[q.trait][0]}\n${reason !== null ? reason : p.type === "history" ? (s.favorites.includes(q.id) ? "★ 珍藏的先辈" : "已寿终 · 留念家谱") : isElder(q) ? `养老 · 余 ${q.elderNights} 夜` : q.adult ? `${JOB_NAMES[q.job]} · 余 ${q.nights} 夜${q.nights <= RULE.retirementNoticeNights ? " · 即将荣休" : ""}` : `孩子 · 成长 ${q.growth}/2`}`;
                const portrait = this.art.frameId(p.type === "history" || isElder(q) ? `villager_elder_${q.sex === "MALE" ? "male" : "female"}_idle` : q.adult ? `villager_${q.appearance}_walk` : q.growth === 0 ? "villager_baby_idle" : `villager_${q.sex === "MALE" ? "boy" : "girl"}_walk`, 0, false);
                this.listItem(rows.content, desc, portrait, i * UI.listStep, () => {
                    if (p.type === "history") this.open({ type: "ancestor", id: q.id });
                    else if (p.type === "partners") { if (p.a) this.send({ type: "FAMILY", a: p.a, b: q.id }, false); else this.open({ type: "partners", a: q.id }); }
                    else if (p.type === "carers") this.send({ type: "BIRTH", family: p.id!, carer: q.id }, false);
                    else if (p.type === "operators") { if (day) this.send({ type: "OPERATOR", index: p.index!, id: q.id }, false); else if (this.game.reassign(p.index!, q.id)) this.close(); }
                    else if (p.type === "care") this.send({ type: "JOB", id: p.id!, job: "CARE", child: q.id }, false);
                    else if (p.type === "workers") this.send({ type: "JOB", id: p.id!, job: p.job!, replace: q.id }, false);
                    else this.open({ type: "person", id: q.id });
                }, reason === null);
            }); return;
        }
        if (p.type === "ranking") {
            const box = this.modal("好友守村榜", "");
            const ranking = new RankingView(this.platform, s.legacy.bestNight); ranking.pos(34, 132); box.addChild(ranking);
            ranking.refreshRanking(); return;
        }
        if (p.type === "person" || p.type === "ancestor") {
            const ancestor = p.type === "ancestor";
            const q = ancestor ? s.history.find(q => q.id === p.id)! : person(s, p.id!), parents = q.parents.map(id => { const parent = [...s.people, ...s.history].find(a => a.id === id); return parent?.name ? this.coloredName(parent) : "更早的家族成员"; });
            const box = this.modal(`${this.coloredName(q)} · 第 ${q.generation} 代`, `${TRAITS[q.trait].join("：")}\n${q.skill ? SKILLS[q.skill].join("：") : "成年后选择专长"}`);
            this.image(box, this.art.frameId(ancestor || isElder(q) ? `villager_elder_${q.sex === "MALE" ? "male" : "female"}_idle` : q.adult ? `villager_${q.appearance}_walk` : q.growth === 0 ? "villager_baby_idle" : `villager_${q.sex === "MALE" ? "boy" : "girl"}_walk`, 0, false), q.elite ? 30 : 44, q.elite ? 206 : 226, q.elite ? 140 : 112);
            const cared = s.people.some(a => a.careChild === q.id);
            this.label(box, ancestor ? `已寿终 · 留念家谱\n来自第 ${q.id.split(":")[0]} 个村落` : isElder(q) ? `安心养老 · 余 ${q.elderNights} 夜\n基础口粮 ${q.trait === "trait_frugal" ? 1 : RULE.adultRation} / 夜` : q.adult ? `余 ${q.nights} 夜劳作期${q.nights <= RULE.retirementNoticeNights ? " · 即将荣休" : ""}\n当前${JOB_NAMES[q.job]}` : `成长 ${q.growth}/2\n${cared ? "照料并守夜即可成长" : "无人照料，成长暂停"}`, 180, 230, 438, 30, C.green, true, 102);
            this.label(box, parents.length ? `双亲：${parents.join("、")}` : q.origin === "TRAVELER" ? "来历：路过村落的旅人" : "来历：第一代开村人", 34, 354, 600, 28, C.muted, false, 68);
            if (q.elite) this.label(box, `耕伐 +50% · 塔伤 +25% · 照料 +${ELITE.careFoodBonus} 粮\n劳作 ${ELITE.adultNights} 夜 · 养老 ${ELITE.elderNights} 夜 · 口粮不变`, 34, 430, 600, 28, C.timber, true, 68).align = "center";
            if (ancestor) {
                this.button(box, s.favorites.includes(q.id) ? "取消珍藏" : "珍藏这位先辈", 34, 510, 600, () => this.send({ type: "FAVORITE", id: q.id }), C.gold, 78);
                this.label(box, "珍藏的先辈随村落传承保留，最多 20 位。\n普通家谱保留最近 60 位先辈。", 34, 650, 600, 28, C.muted, false, 126); return;
            }
            if (isElder(q)) {
                this.label(box, "已卸下劳作，留在熟悉的村落养老。\n占用 1 个住房名额，口粮计入每日消耗。\n成功守夜才推进晚年，寿终后记入家谱。", 34, 504, 600, 29, C.timber, false, 180).align = "center";
                return;
            }
            if (isWorkingAdult(q) && day) {
                (["FARM", "LOGGING"] as const).forEach((job, i) => {
                    const full = s.people.filter(a => a.job === job).length >= laborSlots(job, job === "FARM" ? s.farm : s.logging);
                    const current = q.job === job;
                    this.button(box, `${JOB_NAMES[job]}${current ? " · 当前" : full ? " · 换人" : ""}`, 34 + i * 308, q.elite ? 516 : 484, 292, () => {
                        if (full && !current) this.open({ type: "workers", id: q.id, job });
                        else this.send({ type: "JOB", id: q.id, job });
                    }, current ? C.gold : C.green, 78);
                });
                this.button(box, "安排照料孩子", 34, q.elite ? 624 : 596, 600, () => this.open({ type: "care", id: q.id }), C.green, 78);
            }
            this.label(box, "点击地图防塔，安排夜间驻守。\n白天岗位与夜间驻塔独立分配。", 34, 716, 600, 28, C.muted, false, 96).align = "center"; return;
        }
        if (p.type === "families") {
            const box = this.modal("家庭与新生命", `迎接孩子：粮食 ${this.resourceCost(s.food, RULE.birthCost)}（现有/所需）\n可用条目选择照料者，灰色条目显示原因。`), list = s.families;
            if (list.length) {
                const rows = new ScrollList(UI.contentWidth, 414, Math.max(0, list.length * UI.listStep - (UI.listStep - UI.listHeight)), p.scroll, offset => p.scroll = offset);
                rows.pos(34, 224); box.addChild(rows);
                list.forEach((f, i) => {
                    const reason = birthUnavailableReason(s, f.id), enabled = reason === null;
                    this.listItem(rows.content, `${f.partners.map(id => this.coloredName(person(s, id), enabled)).join(" ＋ ")}\n${enabled ? "迎接孩子 · 选择照料者" : reason}`, "icon_family", i * UI.listStep, () => this.open({ type: "carers", id: f.id }), enabled);
                });
            } else {
                const empty = this.label(box, "还没有家庭，先为村民牵线吧", UI.inset, UI.panelHeight / 2 - 48, UI.contentWidth, 34, C.muted, false, 96);
                empty.name = "emptyState"; empty.align = "center"; empty.valign = "middle"; empty.wordWrap = false;
            }
            this.button(box, "让两位村民成家", 34, 672, 600, () => this.open({ type: "partners" }), C.gold, 78, day); return;
        }
        if (p.type === "build") {
            const box = this.modal("建设村落", `木材 ${this.amount(s.wood)}   粮食 ${this.amount(s.food)}   仓储各 ${this.amount(storageCapacity(s))}\n红字表示材料不足，向上滑动查看更多。`);
            const rows = new ScrollList(UI.contentWidth, 560, 6 * 172 - 14, p.scroll, offset => p.scroll = offset);
            rows.pos(34, 222); box.addChild(rows);
            const definitions: [UpgradeKind, number, string, string, string][] = [
                ["FARM", s.farm, "icon_food", "农田", `每人产粮 ${this.growthPreview(laborYield("FARM", s.farm), laborYield("FARM", s.farm + 1))} · ${laborSlots("FARM", s.farm + 1)} 岗`],
                ["LOGGING", s.logging, "icon_logging", "伐木场", `每人产木 ${this.growthPreview(laborYield("LOGGING", s.logging), laborYield("LOGGING", s.logging + 1))} · ${laborSlots("LOGGING", s.logging + 1)} 岗`],
                ["HOUSING", s.housing, "icon_house", "民居修缮", `仓储 ${this.growthPreview(storageCapacity(s), storageCapacity({ ...s, housing: s.housing + 1 }))}`],
                ["GATE", s.gateLevel, "icon_shield", "城门加固", `耐久上限 ${this.growthPreview(gateCapacity(s), gateCapacity({ ...s, gateLevel: s.gateLevel + 1 }))}`]
            ];
            definitions.forEach(([kind, level, icon, title, effect], i) => {
                const cost = upgradeCost(kind, level);
                this.buildRow(rows.content, i * 172, icon, `${title} · ${this.amount(level)} 阶`, effect, `木 ${this.resourceCost(s.wood, cost.wood)}  粮 ${this.resourceCost(s.food, cost.food)}`, upgradeUnavailableReason(s, cost), () => this.send({ type: "BUILD", kind: kind as "FARM" | "LOGGING" | "HOUSING" | "GATE" }));
            });
            this.buildRow(rows.content, 4 * 172, "icon_build", `增建民居 · ${s.houses}/${RULE.houseMax} 间`, `住房 ${capacity(s)} → ${Math.min(RULE.populationCap, capacity(s) + RULE.houseCapacity)} 人`, `木 ${this.resourceCost(s.wood, RULE.houseCost)}`, !day ? "请在白天建设" : s.houses >= RULE.houseMax ? "住房已齐全，仍可修缮民居" : s.wood < RULE.houseCost ? "木材不足" : null, () => this.send({ type: "BUILD", kind: "HOUSE" }), "增建");
            this.buildRow(rows.content, 5 * 172, "icon_shield", "修复城门", `当前耐久 ${this.amount(s.gate)}/${this.amount(gateCapacity(s))}`, `木 ${this.resourceCost(s.wood, repairCost(s))}`, !day ? "请在白天修门" : s.gate >= gateCapacity(s) ? "城门完好" : s.wood < repairCost(s) ? "木材不足" : null, () => this.send({ type: "REPAIR" }), "修复");
            this.label(box, "点击地图防塔，可升级或调任驻守村民。", 34, 794, 600, 26, C.muted, false, 44).align = "center"; return;
        }
        if (p.type === "tower") {
            const i = p.index!, t = this.game.battle?.base.towers[i] || s.towers[i];
            const box = this.modal(`第 ${i + 1} 塔位${t.kind ? " · " + TOWERS[t.kind].name : " · 空地"}`, t.kind ? `${this.amount(t.level)} 阶 · 驻守 ${t.operator ? this.coloredName(person(s, t.operator)) : "无人"}\n转型保留等级，选择驻守后直接返回村庄。` : "箭楼单体快攻，石塔范围破甲，寒塔减速控场。");
            (Object.keys(TOWERS) as TowerKind[]).forEach((k, j) => this.button(box, `${t.kind && t.kind !== k ? "转为" : ""}${TOWERS[k].name}\n${t.kind === k ? "已建成" : "木 " + this.resourceCost(s.wood, t.kind ? RULE.towerConvert : TOWERS[k].cost)}`, 34 + j * 204, 234, 192, () => this.send({ type: "TOWER", index: i, kind: k }), t.kind === k ? C.gold : C.green, 104, day && t.kind !== k));
            if (t.kind) {
                const cost = upgradeCost("TOWER", t.level), rowParent = new Laya.Sprite(); rowParent.pos(34, 366); box.addChild(rowParent);
                this.buildRow(rowParent, 0, t.kind === "ARROW" ? "icon_arrow" : t.kind === "STONE" ? "icon_stone" : "icon_slow", `升级至 ${this.amount(t.level + 1)} 阶`, `基础伤害 ${this.growthPreview(Math.floor(TOWERS[t.kind].damage * levelPower(t.level)), Math.floor(TOWERS[t.kind].damage * levelPower(t.level + 1)))}`, `木 ${this.resourceCost(s.wood, cost.wood)}  粮 ${this.resourceCost(s.food, cost.food)}`, upgradeUnavailableReason(s, cost), () => this.send({ type: "UPGRADE", index: i }));
            }
            this.button(box, "选择驻守村民", 34, 552, 600, () => this.open({ type: "operators", index: i }), C.green, 78, !!t.kind);
            this.button(box, "释放当前驻守", 34, 656, 600, () => { if (day) this.send({ type: "OPERATOR", index: i, id: null }); else this.game.reassign(i, null); }, C.muted, 78, !!t.operator);
            if (!day) this.label(box, this.game.pauses.has("USER") ? "已手动暂停。关闭窗口后，点击继续守夜。" : "调任期间暂停。关闭窗口后自动继续守夜。", 34, 744, 600, 28, C.muted, false, 70).align = "center"; return;
        }
        if (p.type === "wave" || p.type === "start") {
            const e = economy(s), w = s.wave!;
            const box = this.modal(p.type === "start" ? "今夜，也要守住家" : "瞭望来报", `第 ${s.day} 夜 · ${w.entries.length} 名来敌 · ${({ NONE: "平常夜", FAST: "疾行来袭", STURDY: "坚韧来袭", GROUP: "结队来袭" })[w.affix]}`);
            const counts = Object.keys(ENEMIES).map(k => `${ENEMIES[k as keyof typeof ENEMIES].name} ${w.entries.filter(e => e.kind === k).length}`).filter(v => !v.endsWith(" 0"));
            this.label(box, counts.join("  /  ") + `\n敌军强度 ×${enemyPower(s.day).toFixed(2)}`, 34, 224, 600, 30, C.ink, true, 110).align = "center";
            const summary = new Laya.Sprite(); summary.pos(34, 352); this.art.panel(summary, "panel_card", 600, 210); box.addChild(summary);
            this.label(summary, `粮食 ${this.amount(s.food)} + ${this.amount(e.food)} - ${e.rations} → ${this.amount(e.endFood)}\n木材 ${this.amount(s.wood)} + ${this.amount(e.wood)} → ${this.amount(e.endWood)}\n驻塔 ${s.towers.filter(t => t.operator).length}/4  ·  照料 ${s.people.filter(p => p.job === "CARE").length} 人\n养老 ${s.people.filter(isElder).length} 人 · 基础口粮 ${e.elderRations}（已计入）`, 22, 20, 556, 28, C.green, true, 174);
            this.label(box, `${e.hungry ? "口粮不足：本夜攻速降至 70%。\n" : ""}${!s.towers.some(t => t.operator) ? "没有村民驻塔，城门将直接承受进攻。\n" : ""}离开小游戏可随时暂停；重进时从本夜开头重打。`, 40, 582, 588, 28, e.hungry ? C.red : C.muted, false, 150);
            this.button(box, "确认安排 · 开始守夜", 34, 752, 600, () => this.send({ type: "NIGHT" }, false), C.gold, 78, day); return;
        }
        if (p.type === "restart") {
            const box = this.modal("重新开村", "放弃当前村落，保留累计传承。\n选择一项天赋，交给新村的首位开村人。");
            const rows = new ScrollList(UI.contentWidth, 590, Math.max(0, s.legacy.traits.length * UI.listStep - 8), p.scroll, offset => p.scroll = offset);
            rows.pos(UI.inset, UI.listTop); box.addChild(rows);
            s.legacy.traits.forEach((t, i) => this.button(rows.content, `确认重开 · 传承${TRAITS[t][0]}`, 0, i * UI.listStep, UI.contentWidth - UI.scrollGutter, () => { this.panel = null; this.game.resume("CHOICE"); this.game.resume("USER"); this.game.newVillage(t); }, C.green, UI.listHeight)); return;
        }
        const box = this.modal("村落小记", "村落进度本地保存，无离线收益。\n好友榜同步最高守村纪录。");
        this.button(box, s.settings.music ? "背景音乐 · 开" : "背景音乐 · 关", 34, 224, 600, () => this.send({ type: "MUSIC", enabled: !s.settings.music }), s.settings.music ? C.green : C.muted, 76);
        ["空闲村民自动补岗，可在名册中调岗。", "照料两夜迎来成年，记得安排接班。", "建筑可持续升级，修缮民居扩充仓储。", "旅人会帮助补充缺少的成年性别。", "普通养老三夜、精英五夜，仍吃粮占房。"].forEach((tip, i) => this.label(box, tip, 44, 330 + i * 76, 580, 28, C.ink, false, 70));
        this.button(box, "重新开村…", 34, 754, 600, () => this.open({ type: "restart" }), C.red, 76);
    }
    private drawDawn(s: GameState) {
        const q = s.choices[0]; if (!q) return;
        const box = this.modal("天亮了 · 新的一天", s.summary, false);
        if (q.kind === "SKILL") {
            this.label(box, `${this.coloredName(person(s, q.person))} 成年了\n选择一项专长：`, 34, 226, 600, 32, C.green, true, 104).align = "center";
            q.options.forEach((k, i) => this.button(box, SKILLS[k].join("\n"), 34, 378 + i * 132, 600, () => this.send({ type: "CHOOSE", value: k }), i === 0 ? C.gold : C.green, 102));
        } else if (q.kind === "TRAVELER") {
            this.image(box, this.art.frameId(`villager_${q.person.appearance}_walk`, 0, false), q.person.elite ? 229 : 250, 200, q.person.elite ? 210 : 168);
            this.label(box, `${this.coloredName(q.person)} 希望加入村落\n天赋：${TRAITS[q.person.trait][0]}  ·  专长：${SKILLS[q.person.skill!][0]}\n民居 ${s.people.length}/${capacity(s)}`, 34, 408, 600, 30, C.green, true, 155).align = "center";
            if (q.person.elite) this.label(box, `耕伐 +50% · 塔伤 +25% · 照料 +${ELITE.careFoodBonus} 粮\n劳作 ${ELITE.adultNights} 夜 · 养老 ${ELITE.elderNights} 夜`, 34, 550, 600, 28, C.timber, true, 68).align = "center";
            this.button(box, "欢迎加入", 34, 626, 600, () => this.send({ type: "CHOOSE", value: "accept" }), C.gold, 78, s.people.length < capacity(s));
            this.button(box, "礼貌谢绝", 34, 744, 600, () => this.send({ type: "CHOOSE", value: "decline" }), C.muted, 78);
        } else if (q.kind === "POLICY") {
            this.label(box, `为${SEASONS[season(s.day)]}季定下村规\n持续 3 天`, 34, 226, 600, 32, C.green, true, 104).align = "center";
            q.options.forEach((id, i) => this.button(box, `${POLICIES[id].name}\n${POLICIES[id].desc}`, 34, 378 + i * 132, 600, () => this.send({ type: "CHOOSE", value: id }), i === 0 ? C.gold : C.green, 102));
        } else {
            this.label(box, "又是一年\n选择这一年的挑战", 34, 226, 600, 32, C.green, true, 104).align = "center";
            ["安居 · 0 档", "坚守 · 1 档", "奋战 · 2 档", "无畏 · 3 档"].forEach((v, i) => this.button(box, v, 34, 366 + i * 110, 600, () => this.send({ type: "CHOOSE", value: String(i) }), i === s.tier ? C.gold : C.green, 82));
        }
    }
    private drawGameOver(s: GameState) {
        if (this.panel?.type === "restart") { this.drawPanel(s, this.panel); return; }
        const box = this.modal("灯火未尽，传承不息", "城门被突破。此夜没有推进年龄与日期，村落的故事已记入传承。", false);
        this.image(box, "building_hearth_lit", 253, 226, 162);
        this.label(box, s.summary, 34, 430, 600, 32, C.green, true, 140).align = "center";
        this.label(box, `最长坚守 ${s.legacy.bestNight} 夜 · 累计出生 ${s.legacy.births} 人`, 34, 620, 600, 28, C.muted, false, 80).align = "center";
        this.button(box, "带着天赋 · 再建一个村落", 34, 748, 600, () => this.open({ type: "restart" }), C.gold, 82);
    }
    update(delta: number) {
        if (!this.game.pauses.has("BACKGROUND") && !this.game.pauses.has("DISABLED")) this.tip.advance(Math.min(RULE.frameCap, Math.max(0, delta)));
        const battle = this.game.battle, s = this.game.state;
        if (battle !== this.lastBattle) { this.lastBattle = battle; this.lastBattleTick = 0; }
        const visualDelta = battle ? Math.max(0, battle.tick - this.lastBattleTick) * RULE.step : Math.min(RULE.frameCap, Math.max(0, delta));
        this.lastBattleTick = battle ? battle.tick : 0;
        if (s && !this.game.pauses.size && (s.phase === "DAY" || s.phase === "NIGHT")) {
            this.motion.update(visualDelta);
            this.emotes.update(s, Math.min(RULE.frameCap, Math.max(0, delta)), id => { const pose = this.motion.get(id); return !pose.insideTower && pose.y > 840 && pose.heartElapsed === null; });
        }
        this.renderDelta += delta;
        if (this.renderDelta < 1 / 30) return; this.renderDelta = 0; this.updateActors();
    }
    private updateActors() {
        const s = this.game.state, battle = this.game.battle;
        this.people.forEach(n => n.visible = false); this.enemies.forEach(n => n.visible = false); this.projectileNodes.forEach(n => n.visible = false);
        this.hearts.forEach(n => { n.visible = false; n.alpha = 1; n.scale(1, 1); n.pos(0, 0); });
        this.emote.visible = false;
        this.projectiles.update(battle);
        const depth = this.props.slice();
        if (!s) { depth.sort(compareDepth).forEach((p, i) => p.node.zIndex = i); return; }
        for (const p of this.props) {
            if (p.id === "building:gate") p.node.texture = this.art.get((battle ? battle.gate : s.gate) / gateCapacity(s) < .35 ? "building_gate_damaged" : "building_gate_closed");
            else if (p.id.startsWith("tower:")) { const t = (battle ? battle.base.towers : s.towers)[Number(p.id.split(":")[1])]; p.node.texture = this.art.get(t.kind ? TOWERS[t.kind].image : "building_tower_pad"); }
        }
        s.people.forEach((p, i) => {
            const n = this.people[i], pose = this.motion.get(p.id); n.visible = !pose.insideTower; n.name = `person:${p.id}`;
            const identity = isElder(p) ? `elder_${p.sex === "MALE" ? "male" : "female"}` : p.adult ? p.appearance : p.sex === "MALE" ? "boy" : "girl";
            const facing = pose.clip.endsWith("_walk") ? this.art.walk(identity, pose.direction) : { clip: pose.clip, mirror: pose.mirror };
            this.art.applyFrame(n, this.art.frameId(facing.clip, pose.elapsed, pose.animated), p.adult ? 56 : p.growth === 0 ? 42 : 48);
            const scale = p.elite ? ELITE.visualScale : 1;
            n.pos(pose.x, pose.y); n.scale((facing.mirror ? -1 : 1) * scale, scale);
            if (pose.heartElapsed !== null && n.visible) {
                const heart = this.hearts[i], elapsed = pose.heartElapsed;
                heart.visible = true;
                heart.alpha = Math.min(1, elapsed / WEDDING.fadeIn, (WEDDING.heartSeconds - elapsed) / WEDDING.fadeOut);
                const pulse = 1 + WEDDING.pulse * Math.sin(elapsed / WEDDING.pulseSeconds * Math.PI * 2);
                // 局部坐标以人物原画布为基准，减去足底 pivot 后正好位于头顶；反镜像保持红心构图一致。
                heart.pos(n.pivotX, n.pivotY - WEDDING.headOffset - WEDDING.rise * elapsed / WEDDING.heartSeconds);
                heart.scale((facing.mirror ? -1 : 1) * pulse, pulse);
            }
            depth.push({ id: n.name, y: pose.y, node: n });
        });
        const emote = this.emotes.current;
        if (emote && !this.panel && !this.game.pauses.size && (s.phase === "DAY" || s.phase === "NIGHT")) {
            const pose = this.motion.get(emote.id);
            if (!pose.insideTower) {
                const owner = person(s, emote.id), scale = owner.elite ? ELITE.visualScale : 1;
                const elapsed = EMOTE.seconds - emote.remaining;
                this.emote.visible = true; this.art.applyFrame(this.emote, emote.frameId, EMOTE.size);
                this.emote.pos(Math.max(EMOTE.size / 2, Math.min(720 - EMOTE.size / 2, pose.x)), pose.y - 62 * scale - Math.sin(Math.min(1, elapsed / .25) * Math.PI / 2) * 6);
                this.emote.alpha = Math.min(1, elapsed / .16, emote.remaining / .25);
            }
        }
        if (battle) {
            battle.enemies.forEach((e, i) => {
                const n = this.enemies[i], at = pointAt(e.progress); n.visible = true; n.name = `enemy:${e.seq}`;
                this.art.applyFrame(n, this.art.frameId(`${e.kind}_walk`, battle.tick * RULE.step + e.seq * .13), e.kind === "enemy_chief" ? 82 : 64);
                n.pos(at.x, at.y); n.scale(this.art.enemyMirror(e.kind, pointAt(e.progress + 1).x - at.x) ? -1 : 1, 1); depth.push({ id: n.name, y: at.y, node: n });
            });
            this.projectiles.poses.forEach((p, i) => {
                const n = this.projectileNodes[i]; n.name = `projectile:${p.shot.kind}:${p.shot.tower}:${p.shot.tick}`; n.visible = true;
                this.art.applyFrame(n, p.frame, p.size); n.pos(p.x, p.y); n.rotation = p.rotation; n.alpha = p.alpha;
            });
            if (this.hp) this.hp.text = `城门 ${this.amount(battle.gate)}/${this.amount(gateCapacity(s))}`;
            if (this.count) this.count.text = `${this.game.pauses.size ? "已暂停" : "守夜中"}  ·  场上 ${battle.enemies.length}  ·  待来 ${battle.pendingCount}${battle.base.night!.hungry ? "  · 缺粮" : ""}`;
        }
        if (this.gateGauge) {
            const ratio = (battle ? battle.gate : s.gate) / gateCapacity(s);
            this.gateGauge.graphics.clear(); this.gateGauge.graphics.drawRect(0, 0, 144, 9, C.outline);
            this.gateGauge.graphics.drawRect(2, 2, 140 * ratio, 5, ratio < .35 ? C.red : C.gold);
        }
        // Laya 3.4 的 zIndex 决定渲染顺序；world 为 stackingRoot，不让深度排序覆盖 HUD/弹窗。
        depth.sort(compareDepth).forEach((p, i) => p.node.zIndex = i);
    }
    destroy() { this.game.changed = () => {}; this.root.destroy(true); }
}
