import { GameSession } from "../game/GameSession";
import { capacity, economy, JOB_NAMES, person, canMarry, Command } from "../game/VillageRules";
import { GameState, Person } from "../game/GameState";
import { ENEMIES, PATH, PADS, POLICIES, RULE, SEASONS, SKILLS, TOWERS, TowerKind, TRAITS, Trait } from "../game/GameConfig";
import { BattleSimulation, pointAt } from "../game/BattleSimulation";
import { season } from "../game/WaveGenerator";
import { SpriteFrames } from "./SpriteFrames";
import { compareDepth, VILLAGE_PROPS } from "./VillageScene";
import { VillagerMotion } from "./VillagerMotion";
import { C, UI } from "./UiTheme";
type Panel = { type: string; id?: string; index?: number; page?: number; a?: string };
export class GameView {
    readonly root = new Laya.Sprite();
    private scenery = new Laya.Sprite(); private world = new Laya.Sprite(); private chrome = new Laya.Sprite(); private overlay = new Laya.Sprite();
    private people: Laya.Sprite[] = []; private enemies: Laya.Sprite[] = []; private shots = new Laya.Sprite();
    private props: { id: string; y: number; node: Laya.Sprite }[] = [];
    private motion = new VillagerMotion();
    private lastBattle: BattleSimulation | null = null; private lastBattleTick = 0;
    private hp!: Laya.Text; private count!: Laya.Text;
    private renderDelta = 0; private panel: Panel | null = null;
    private backgroundKey = "";
    constructor(private game: GameSession, private art: SpriteFrames) {
        this.root.name = "VillageGame"; this.root.size(720, 1280); this.root.stackingRoot = true;
        [this.scenery, this.world, this.shots, this.chrome, this.overlay].forEach((layer, i) => { layer.stackingRoot = true; layer.zIndex = i; this.root.addChild(layer); });
        this.world.name = "VillageWorld";
        this.overlay.size(720, 1280); this.overlay.mouseEnabled = true; this.overlay.mouseThrough = true;
        for (const p of VILLAGE_PROPS) {
            const node = new Laya.Sprite(); node.name = p.id; node.mouseEnabled = false;
            this.art.applyFrame(node, p.frame, p.size); node.pos(p.x, p.y); this.world.addChild(node); this.props.push({ id: p.id, y: p.y, node });
        }
        for (let i = 0; i < RULE.populationCap; i++) { const s = new Laya.Sprite(); s.mouseEnabled = false; this.world.addChild(s); this.people.push(s); }
        for (let i = 0; i < RULE.enemyCap; i++) { const s = new Laya.Sprite(); s.mouseEnabled = false; this.world.addChild(s); this.enemies.push(s); }
        game.changed = () => this.refresh(); this.refresh();
    }
    private label(parent: Laya.Sprite, text: string, x: number, y: number, w: number, size: number = UI.body, color = C.ink, bold = false, h = 48): Laya.Text {
        const t = new Laya.Text(); t.text = text; t.font = "sans-serif"; t.fontSize = Math.max(parent.name.startsWith("panel:") ? UI.body : UI.mapLabel, size); t.color = color; t.bold = bold; t.wordWrap = true; t.leading = 7; t.size(w, h); t.pos(x, y);
        const rgb = parseInt(color.slice(1), 16), light = ((rgb >> 16) * .299 + ((rgb >> 8) & 255) * .587 + (rgb & 255) * .114) > 165;
        t.stroke = light ? (bold ? 2.5 : 2) : 1; t.strokeColor = light ? C.outline : C.lightEdge;
        t.valign = h <= 60 ? "middle" : "top"; t.mouseEnabled = false; parent.addChild(t); return t;
    }
    private image(parent: Laya.Sprite, id: string, x: number, y: number, w: number, h = w) { const s = new Laya.Sprite(); s.texture = this.art.get(id); s.pos(x, y); s.size(w, h); s.mouseEnabled = false; parent.addChild(s); return s; }
    private button(parent: Laya.Sprite, title: string, x: number, y: number, w: number, action: () => void, color = C.green, h = 72, enabled = true) {
        const b = new Laya.Sprite(); b.name = `button:${title}`; b.size(w, h); b.pos(x, y);
        const skin = !enabled ? "panel_button_disabled" : color === C.gold ? "panel_button_gold" : color === C.red ? "panel_button_red" : color === C.muted ? "panel_card" : "panel_button_green";
        // 底座与面层分离，按下只压低面层，点击区域始终固定。
        b.graphics.drawRoundRect(3, 7, w - 6, h - 7, 10, 10, 10, 10, "#513b26");
        const face = new Laya.Sprite(); face.mouseEnabled = false; this.art.panel(face, skin, w, h - 6); b.addChild(face);
        const t = this.label(face, title, 16, 1, w - 32, UI.button, !enabled ? C.muted : color === C.gold || color === C.muted ? C.ink : C.cream, true, h - 8); t.name = "buttonText"; t.align = "center"; t.valign = "middle"; t.leading = 3;
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
        this.label(this.scenery, "家园", 306, 1000, 110, 19, night ? "#ddd9ba" : "#5e754d").align = "center";
    }
    refresh() {
        const s = this.game.state, battle = this.game.battle;
        this.chrome.destroyChildren(); this.chrome.graphics.clear(); this.overlay.destroyChildren(); this.overlay.graphics.clear(); this.overlay.mouseThrough = true;
        this.drawScenery(s?.phase === "NIGHT");
        this.art.panel(this.chrome, "panel_card", 720, 209);
        this.label(this.chrome, "代代守村", 34, 34, 440, 44, C.ink, true, 60);
        this.label(this.chrome, "生生不息 · 守护家园", 36, 99, 490, 26, C.green);
        this.button(this.chrome, "设置", 558, 46, 126, () => this.open({ type: "settings" }), C.muted, 64);
        if (!s) { this.drawBoot(); this.updateActors(); return; }
        // 仅确认状态或界面事件时同步目标，帧循环只推进已有路线。
        this.motion.sync(s, battle ? battle.base.towers : s.towers);
        this.label(this.chrome, `第${Math.floor((s.day - 1) / 12) + 1}年 · ${SEASONS[season(s.day)]}${((s.day - 1) % 3) + 1}日`, 394, 145, 286, 26, C.green, true).align = "right";
        [["icon_food", `${s.food}`], ["icon_wood", `${s.wood}`], ["icon_population", `${s.people.length}/${capacity(s)}`]].forEach(([id, value], i) => { this.image(this.chrome, id, 32 + i * 120, 152, 34); this.label(this.chrome, value, 69 + i * 120, 146, 82, 28, C.ink, true); });
        this.chrome.graphics.drawRect(0, 209, 720, 37, C.green);
        const count = s.wave?.entries.length || 0;
        this.label(this.chrome, s.phase === "NIGHT" ? "守夜中 · 齐心护家园" : `第 ${s.day} 天 · 今夜 ${count} 名来敌 · 挑战 ${s.tier}`, 28, 209, 664, 24, "#f4edce", true, 37).align = "center";
        const gate = battle?.gate ?? s.gate;
        this.hp = this.label(this.chrome, `城门 ${gate}/${RULE.gateMax}`, 225, 789, 270, 26, C.cream, true); this.hp.align = "center";
        for (let i = 0; i < PADS.length; i++) {
            const t = battle?.base.towers[i] || s.towers[i], pos = PADS[i];
            const b = new Laya.Sprite(); b.pos(pos.x - 58, pos.y - 80); b.size(116, 134); b.mouseEnabled = true;
            b.on(Laya.Event.CLICK, this, () => { if (s.phase === "NIGHT") this.game.pause("USER"); this.open({ type: "tower", index: i }); }); this.chrome.addChild(b);
            const op = t.operator ? person(s, t.operator).name : "空岗";
            this.label(this.chrome, t.kind ? `${TOWERS[t.kind].name}${t.level} · ${op}` : "＋ 建塔", pos.x - 116, pos.y + 27, 232, 24, t.operator ? C.cream : "#fff0b2", true, 40).align = "center";
        }
        this.chrome.graphics.drawRect(0, 1038, 720, 242, C.cream);
        const bottom = new Laya.Sprite(); bottom.pos(0, 1038); this.art.panel(bottom, "panel_card", 720, 242); this.chrome.addChild(bottom);
        if (s.phase === "DAY") {
            const e = economy(s);
            this.count = this.label(this.chrome, `产粮 ${e.food}   ·   口粮 ${e.rations}   ·   产木 ${e.wood}`, 28, 1054, 664, 28, e.hungry ? C.red : C.ink, true); this.count.align = "center";
            this.button(this.chrome, "今夜来敌", 28, 1103, 185, () => this.open({ type: "wave" }), C.gold, 68);
            this.button(this.chrome, "开始守夜", 229, 1103, 463, () => this.open({ type: "start" }), C.gold, 74);
        } else if (s.phase === "NIGHT") {
            this.count = this.label(this.chrome, "", 28, 1054, 660, 23, C.muted);
            this.button(this.chrome, this.game.pauses.has("USER") ? "继续守夜" : "暂停", 28, 1103, 190, () => { if (this.game.pauses.has("USER")) this.game.resume("USER"); else this.game.pause("USER"); this.refresh(); }, C.green, 68);
            this.button(this.chrome, `速度 ×${s.settings.speed}`, 234, 1103, 190, () => this.send({ type: "SPEED", value: s.settings.speed === 1 ? 2 : 1 }), C.muted, 68);
            this.button(this.chrome, battle?.bellUsed ? "警钟已用" : "敲响警钟", 440, 1103, 252, () => this.game.bell(), C.gold, 68, !battle?.bellUsed);
        } else this.label(this.chrome, s.summary, 28, 1054, 664, 23, C.green, true, 110);
        ["村民", "家庭", "建设", "家谱"].forEach((title, i) => this.button(this.chrome, title, 28 + 168 * i, 1194, 160, () => this.open({ type: ["people", "families", "build", "history"][i] }), i === 0 ? C.green : C.muted, 64));
        if (this.game.saves.pending) this.drawPending();
        else if (this.game.pauses.has("WAIT_RESUME")) {
            const box = this.modal("欢迎回来", "战斗与动画已暂停；退出期间没有生产、成长或战斗损耗。", false);
            this.button(box, "继续游戏", 34, 540, 600, () => { this.game.resume("WAIT_RESUME"); this.refresh(); }, C.gold, 80);
        } else if (s.phase === "GAME_OVER") this.drawGameOver(s);
        else if (s.phase === "DAWN") this.drawDawn(s);
        else if (this.panel) this.drawPanel(s, this.panel);
        if (this.game.error && !this.game.saves.pending) {
            this.overlay.graphics.drawRect(22, 985, 676, 90, "#803f32"); this.label(this.overlay, this.game.error, 38, 1000, 642, 21, "#fff4da", false, 74);
        }
        this.updateActors();
    }
    private modal(title: string, subtitle: string, close = true) {
        this.overlay.mouseThrough = false;
        this.overlay.graphics.drawRect(0, 0, 720, 1280, "rgba(25,31,22,0.68)");
        const box = new Laya.Sprite(); box.name = `panel:${title}`; box.pos(UI.panelX, UI.panelY); box.size(UI.panelWidth, UI.panelHeight); box.mouseEnabled = true;
        this.art.panel(box, "panel_parchment", UI.panelWidth, UI.panelHeight); this.overlay.addChild(box);
        this.label(box, title, 64, 34, 540, UI.title, C.ink, true, 60).align = "center";
        this.label(box, subtitle, UI.inset, 108, UI.contentWidth, 27, C.muted, false, 100).align = "center";
        // 小角饰独立摆放，缩放九宫格时不会拉长麦穗和叶片。
        this.image(box, "icon_food", 21, 30, 44); this.image(box, "deco_bush", 635, 813, 28, 25);
        if (close) this.button(box, "×", 596, 26, 50, () => this.close(), C.red, 54);
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
    private pagination(box: Laya.Sprite, panel: Panel, total: number, size: number = UI.listSize) {
        const page = panel.page || 0, max = Math.max(0, Math.ceil(total / size) - 1);
        this.button(box, "上一页", 34, UI.footerTop, 175, () => this.open({ ...panel, page: page - 1 }), C.muted, 60, page > 0);
        this.label(box, `${page + 1} / ${max + 1}`, 244, UI.footerTop, 180, 28, C.muted, false, 60).align = "center";
        this.button(box, "下一页", 459, UI.footerTop, 175, () => this.open({ ...panel, page: page + 1 }), C.muted, 60, page < max);
    }
    private drawPanel(s: GameState, p: Panel) {
        const day = s.phase === "DAY";
        if (p.type === "people" || p.type === "history" || p.type === "partners" || p.type === "carers" || p.type === "operators" || p.type === "care") {
            let list: Person[] = s.people;
            let title = "村民名册", sub = "点选村民安排白天岗位。夜间驻塔独立分配。";
            if (p.type === "history") { list = s.history.slice().reverse(); title = "村落家谱"; sub = `累计诞生 ${s.legacy.births} 人，荣休 ${s.legacy.retirees} 人。珍藏 ${s.favorites.length}/20。`; }
            if (p.type === "partners") { list = s.people.filter(q => p.a ? canMarry(s, person(s, p.a), q) : q.adult && !s.families.some(f => f.partners.includes(q.id))); title = p.a ? "选择另一半" : "选择成家村民"; sub = "双方成年、单身；直系亲属与同胞不能成家。"; }
            if (p.type === "carers") { list = s.people.filter(q => q.adult && q.job !== "CARE"); title = "迎接新生命"; sub = `花费 ${RULE.birthCost} 粮，选择一名照料者。其白天岗位会改为照料，夜间仍可驻塔。`; }
            if (p.type === "operators") { list = s.people.filter(q => q.adult); title = "安排驻塔"; sub = "每人只能驻守一座塔；调任会释放原塔。夜间调任只影响当前战斗，重进恢复战前安排。"; }
            if (p.type === "care") { list = s.people.filter(q => !q.adult && !s.people.some(a => a.careChild === q.id)); title = "选择照料的孩子"; sub = "孩子需得到照料并守住两夜才能成年。"; }
            const box = this.modal(title, sub);
            if (!list.length) this.label(box, "这里暂时没有可选的人。", 26, 220, 616, 24, C.muted);
            list.slice((p.page || 0) * UI.listSize, (p.page || 0) * UI.listSize + UI.listSize).forEach((q, i) => {
                const desc = `${q.name} · ${q.sex === "MALE" ? "男" : "女"} · ${TRAITS[q.trait][0]}\n${p.type === "history" ? (s.favorites.includes(q.id) ? "★ 珍藏的先辈" : "已荣休") : q.adult ? `${JOB_NAMES[q.job]} · 余 ${q.nights} 夜` : `孩子 · 成长 ${q.growth}/2`}`;
                this.button(box, desc, UI.inset, UI.listTop + i * UI.listStep, UI.contentWidth, () => {
                    if (p.type === "history") this.open({ type: "ancestor", id: q.id });
                    else if (p.type === "partners") { if (p.a) this.send({ type: "FAMILY", a: p.a, b: q.id }, false); else this.open({ type: "partners", a: q.id }); }
                    else if (p.type === "carers") this.send({ type: "BIRTH", family: p.id!, carer: q.id }, false);
                    else if (p.type === "operators") { if (day) this.send({ type: "OPERATOR", index: p.index!, id: q.id }, false); else { this.panel = { type: "tower", index: p.index }; this.game.reassign(p.index!, q.id); } }
                    else if (p.type === "care") this.send({ type: "JOB", id: p.id!, job: "CARE", child: q.id }, false);
                    else this.open({ type: "person", id: q.id });
                }, C.muted, UI.listHeight);
            }); this.pagination(box, p, list.length); return;
        }
        if (p.type === "person" || p.type === "ancestor") {
            const ancestor = p.type === "ancestor";
            const q = ancestor ? s.history.find(q => q.id === p.id)! : person(s, p.id!), parents = q.parents.map(id => [...s.people, ...s.history].find(a => a.id === id)?.name || "更早的家族成员");
            const box = this.modal(`${q.name} · 第 ${q.generation} 代`, `${TRAITS[q.trait].join("：")}\n${q.skill ? SKILLS[q.skill].join("：") : "成年后选择专长"}`);
            this.image(box, this.art.frameId(q.adult ? `villager_${q.appearance}_walk` : q.growth === 0 ? "villager_baby_idle" : `villager_${q.sex === "MALE" ? "boy" : "girl"}_walk`, 0, false), 44, 226, 112);
            this.label(box, ancestor ? `已荣休\n来自第 ${q.id.split(":")[0]} 个村落` : q.adult ? `余 ${q.nights} 夜劳作期\n当前${JOB_NAMES[q.job]}` : `成长 ${q.growth}/2\n照料并守夜即可成长`, 180, 230, 438, 30, C.green, true, 102);
            this.label(box, parents.length ? `双亲：${parents.join("、")}` : q.origin === "TRAVELER" ? "来历：路过村落的旅人" : "来历：第一代开村人", 34, 365, 600, 28, C.muted, false, 86);
            if (ancestor) {
                this.button(box, s.favorites.includes(q.id) ? "取消珍藏" : "珍藏这位先辈", 34, 510, 600, () => this.send({ type: "FAVORITE", id: q.id }), C.gold, 78);
                this.label(box, "珍藏的先辈随村落传承保留，最多 20 位。\n普通家谱保留最近 60 位先辈。", 34, 650, 600, 28, C.muted, false, 126); return;
            }
            if (q.adult && day) {
                (["WAITING", "FARM", "LOGGING"] as const).forEach((job, i) => this.button(box, JOB_NAMES[job], 34 + i * 204, 484, 192, () => this.send({ type: "JOB", id: q.id, job }), q.job === job ? C.gold : C.green, 78));
                this.button(box, "安排照料孩子", 34, 596, 600, () => this.open({ type: "care", id: q.id }), C.green, 78);
            }
            this.label(box, "点击地图防塔，安排夜间驻守。\n白天岗位与夜间驻塔独立分配。", 34, 716, 600, 28, C.muted, false, 96).align = "center"; return;
        }
        if (p.type === "families") {
            const box = this.modal("家庭与新生命", "每家同时养育一位孩子。双亲均需余 3 夜以上劳作期；安排照料，陪孩子长大。"), list = s.families.slice((p.page || 0) * 4, (p.page || 0) * 4 + 4);
            list.forEach((f, i) => this.button(box, `${f.partners.map(id => person(s, id).name).join(" ＋ ")}\n迎接孩子`, 34, 224 + i * 100, 600, () => this.open({ type: "carers", id: f.id }), C.muted, 86, day));
            if (!list.length) this.label(box, "还没有家庭，先为成年村民牵线吧。", 26, 220, 616, 23, C.muted);
            this.button(box, "让两位村民成家", 34, 672, 600, () => this.open({ type: "partners" }), C.gold, 78, day); this.pagination(box, p, s.families.length, 4); return;
        }
        if (p.type === "build") {
            const box = this.modal("建设村落", `粮仓与木仓上限各 ${RULE.storageCap}。新增岗位后，记得在村民名册安排人手。`);
            const rows: [string, Command, boolean][] = [
                [`建民居  ·  ${RULE.houseCost} 木  ·  当前 ${s.houses}/5 间`, { type: "BUILD", kind: "HOUSE" }, s.houses < 5],
                [`升级农田  ·  ${s.farm < 3 ? RULE.farmUpgrade[s.farm - 1] + " 木" : "已满级"}  ·  ${RULE.farmSlots[s.farm - 1]} 岗`, { type: "BUILD", kind: "FARM" }, s.farm < 3],
                [`升级伐木场  ·  ${s.logging < 3 ? RULE.logUpgrade[s.logging - 1] + " 木" : "已满级"}  ·  ${RULE.logSlots[s.logging - 1]} 岗`, { type: "BUILD", kind: "LOGGING" }, s.logging < 3],
                [`修缮城门  ·  ${RULE.repairCost} 木  ·  当前 ${s.gate}/200`, { type: "REPAIR" }, s.gate < 200]
            ];
            rows.forEach(([title, command, enabled], i) => this.button(box, title.replace("  ·  ", "\n"), 34, 226 + i * 116, 600, () => this.send(command), C.muted, 96, day && enabled));
            this.label(box, "防塔建设与升级：点击地图上的四个塔位。", 34, 744, 600, 28, C.muted, false, 70).align = "center"; return;
        }
        if (p.type === "tower") {
            const i = p.index!, t = this.game.battle?.base.towers[i] || s.towers[i];
            const box = this.modal(`第 ${i + 1} 塔位${t.kind ? " · " + TOWERS[t.kind].name : " · 空地"}`, t.kind ? `等级 ${t.level}/3 · 驻守 ${t.operator ? person(s, t.operator).name : "无人"}\n转型保留等级与驻守者。无人驻塔时不会攻击。` : "箭楼单体快攻，石塔范围破甲，寒塔减速控场。");
            (Object.keys(TOWERS) as TowerKind[]).forEach((k, j) => this.button(box, `${TOWERS[k].name}\n${t.kind ? "转型20木" : TOWERS[k].cost + "木"}`, 34 + j * 204, 234, 192, () => this.send({ type: "TOWER", index: i, kind: k }), t.kind === k ? C.gold : C.green, 104, day && t.kind !== k));
            this.button(box, t.level >= 3 ? "已满级" : `升级 · ${t.level ? RULE.towerUpgrade[t.level - 1] : "—"} 木`, 34, 380, 600, () => this.send({ type: "UPGRADE", index: i }), C.gold, 78, day && !!t.kind && t.level < 3);
            this.button(box, "选择驻守村民", 34, 500, 600, () => this.open({ type: "operators", index: i }), C.green, 78, !!t.kind);
            this.button(box, "释放当前驻守", 34, 620, 600, () => { if (day) this.send({ type: "OPERATOR", index: i, id: null }); else this.game.reassign(i, null); }, C.muted, 78, !!t.operator);
            if (!day) this.label(box, "当前为暂停调任。关闭窗口后，点击继续守夜。", 34, 744, 600, 28, C.muted, false, 70).align = "center"; return;
        }
        if (p.type === "wave" || p.type === "start") {
            const e = economy(s), w = s.wave!;
            const box = this.modal(p.type === "start" ? "今夜，也要守住家" : "瞭望来报", `第 ${s.day} 夜 · ${w.entries.length} 名来敌 · ${({ NONE: "平常夜", FAST: "疾行来袭", STURDY: "坚韧来袭", GROUP: "结队来袭" })[w.affix]}`);
            const counts = Object.keys(ENEMIES).map(k => `${ENEMIES[k as keyof typeof ENEMIES].name} ${w.entries.filter(e => e.kind === k).length}`).filter(v => !v.endsWith(" 0"));
            this.label(box, counts.join("  /  "), 34, 224, 600, 30, C.ink, true, 110).align = "center";
            const summary = new Laya.Sprite(); summary.pos(34, 352); this.art.panel(summary, "panel_card", 600, 172); box.addChild(summary);
            this.label(summary, `粮食 ${s.food} + ${e.food} - ${e.rations} → ${e.endFood}\n木材 ${s.wood} + ${e.wood} → ${e.endWood}\n驻塔 ${s.towers.filter(t => t.operator).length}/4  ·  照料 ${s.people.filter(p => p.job === "CARE").length} 人`, 22, 22, 556, 29, C.green, true, 132);
            this.label(box, `${e.hungry ? "口粮不足：本夜攻速降至 70%。\n" : ""}${!s.towers.some(t => t.operator) ? "没有村民驻塔，城门将直接承受进攻。\n" : ""}离开小游戏可随时暂停；重进时从本夜开头重打。`, 40, 562, 588, 28, e.hungry ? C.red : C.muted, false, 150);
            this.button(box, "确认安排 · 开始守夜", 34, 752, 600, () => this.send({ type: "NIGHT" }, false), C.gold, 78, day); return;
        }
        if (p.type === "restart") {
            const box = this.modal("重新开村", "放弃当前村落，保留累计传承。\n选择一项天赋，交给新村的首位开村人。");
            (s.legacy.traits.slice((p.page || 0) * UI.listSize, (p.page || 0) * UI.listSize + UI.listSize)).forEach((t, i) => this.button(box, `确认重开 · 传承${TRAITS[t][0]}`, UI.inset, UI.listTop + i * UI.listStep, UI.contentWidth, () => { this.panel = null; this.game.resume("CHOICE"); this.game.resume("USER"); this.game.newVillage(t); }, C.green, UI.listHeight)); this.pagination(box, p, s.legacy.traits.length); return;
        }
        const box = this.modal("村落小记", "只在微信中本地保存，无联网生产与离线收益。");
        this.label(box, "玩法提示", 34, 224, 600, 32, C.green, true, 54).align = "center";
        ["1. 安排耕作与伐木，保障村里的粮食和木材。", "2. 生育消耗 20 粮，照料两夜后孩子成年。", "3. 分配驻塔；每夜可敲一次警钟，提速 5 秒。", "4. 守夜胜利才成长与荣休，记得培养下一代。", "5. 每年选择挑战档，村落可以一直延续。"].forEach((tip, i) => this.label(box, tip, 44, 310 + i * 80, 580, 28, C.ink, false, 74));
        this.button(box, "重新开村…", 34, 754, 600, () => this.open({ type: "restart" }), C.red, 76);
    }
    private drawDawn(s: GameState) {
        const q = s.choices[0]; if (!q) return;
        const box = this.modal("天亮了 · 新的一天", s.summary, false);
        if (q.kind === "SKILL") {
            this.label(box, `${person(s, q.person).name} 成年了\n选择一项专长：`, 34, 226, 600, 32, C.green, true, 104).align = "center";
            q.options.forEach((k, i) => this.button(box, SKILLS[k].join("\n"), 34, 378 + i * 132, 600, () => this.send({ type: "CHOOSE", value: k }), i === 0 ? C.gold : C.green, 102));
        } else if (q.kind === "TRAVELER") {
            this.image(box, this.art.frameId(`villager_${q.person.appearance}_walk`, 0, false), 250, 210, 168);
            this.label(box, `${q.person.name} 希望加入村落\n天赋：${TRAITS[q.person.trait][0]}  ·  专长：${SKILLS[q.person.skill!][0]}\n民居 ${s.people.length}/${capacity(s)}`, 34, 408, 600, 30, C.green, true, 155).align = "center";
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
        const battle = this.game.battle, s = this.game.state;
        if (battle !== this.lastBattle) { this.lastBattle = battle; this.lastBattleTick = 0; }
        const visualDelta = battle ? Math.max(0, battle.tick - this.lastBattleTick) * RULE.step : Math.min(RULE.frameCap, Math.max(0, delta));
        this.lastBattleTick = battle ? battle.tick : 0;
        if (s && !this.game.pauses.size && (s.phase === "DAY" || s.phase === "NIGHT")) this.motion.update(visualDelta);
        this.renderDelta += delta;
        if (this.renderDelta < 1 / 30) return; this.renderDelta = 0; this.updateActors();
    }
    private updateActors() {
        const s = this.game.state, battle = this.game.battle;
        this.people.forEach(n => n.visible = false); this.enemies.forEach(n => n.visible = false); this.shots.graphics.clear();
        const depth = this.props.slice();
        if (!s) { depth.sort(compareDepth).forEach((p, i) => p.node.zIndex = i); return; }
        for (const p of this.props) {
            if (p.id === "building:gate") p.node.texture = this.art.get((battle ? battle.gate : s.gate) < 70 ? "building_gate_damaged" : "building_gate_closed");
            else if (p.id.startsWith("tower:")) { const t = (battle ? battle.base.towers : s.towers)[Number(p.id.split(":")[1])]; p.node.texture = this.art.get(t.kind ? TOWERS[t.kind].image : "building_tower_pad"); }
        }
        s.people.forEach((p, i) => {
            const n = this.people[i], pose = this.motion.get(p.id); n.visible = true; n.name = `person:${p.id}`;
            const identity = p.adult ? p.appearance : p.sex === "MALE" ? "boy" : "girl";
            const facing = pose.clip.endsWith("_walk") ? this.art.walk(identity, pose.direction) : { clip: pose.clip, mirror: false };
            this.art.applyFrame(n, this.art.frameId(facing.clip, pose.elapsed, pose.animated), p.adult ? 56 : p.growth === 0 ? 42 : 48);
            n.pos(pose.x, pose.y); n.scale(facing.mirror ? -1 : 1, 1);
            depth.push({ id: n.name, y: pose.y, node: n });
        });
        if (battle) {
            battle.enemies.forEach((e, i) => {
                const n = this.enemies[i], at = pointAt(e.progress); n.visible = true; n.name = `enemy:${e.seq}`;
                this.art.applyFrame(n, this.art.frameId(`${e.kind}_walk`, battle.tick * RULE.step + e.seq * .13), e.kind === "enemy_chief" ? 82 : 64);
                n.pos(at.x, at.y); n.scale(this.art.enemyMirror(e.kind, pointAt(e.progress + 1).x - at.x) ? -1 : 1, 1); depth.push({ id: n.name, y: at.y, node: n });
            });
            for (const shot of battle.shots) { const pos = PADS[shot.tower]; this.shots.graphics.drawLine(pos.x, pos.y - 35, shot.x, shot.y - 20, shot.kind === "SLOW" ? "#bce3ee" : shot.kind === "STONE" ? "#e1c18b" : "#f0e6b2", shot.kind === "STONE" ? 6 : 3); }
            if (this.hp) this.hp.text = `城门 ${battle.gate}/${RULE.gateMax}`;
            if (this.count) this.count.text = `${this.game.pauses.size ? "已暂停" : "守夜中"}  ·  场上 ${battle.enemies.length}  ·  待来 ${battle.pendingCount}${battle.base.night!.hungry ? "  · 缺粮" : ""}`;
        }
        // Laya 3.4 的 zIndex 决定渲染顺序；world 为 stackingRoot，不让深度排序覆盖 HUD/弹窗。
        depth.sort(compareDepth).forEach((p, i) => p.node.zIndex = i);
    }
    destroy() { this.game.changed = () => {}; this.root.destroy(true); }
}
