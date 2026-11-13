import { checkVillageInteraction } from "./PersonClickCheckScene";
/** 原生场景进程中的正式 GameView 渲染夹具，与编辑器菜单进程分开编译。 */
@IEditorEnv.regClass()
export class BuildingGameCheck {
    static async render(modules: Record<string, string>, output: string, resources: string[], architecture?: "monolith" | "components" | "anchored-tip" | "person-click") {
        const fs = IEditorEnv.require("fs"), BufferClass = IEditorEnv.require("buffer").Buffer;
        // 仅移除上次中断留下的同名验收根；正式游戏从不在建筑源工程场景中运行。
        Laya.stage.getChildByName("VillageGame")?.destroy(true);
        const loaded: Record<string, any> = {};
        const load = (id: string): any => {
            if (loaded[id]) return loaded[id].exports;
            if (!modules[id]) throw new Error("缺少正式编译模块:" + id);
            const module = loaded[id] = { exports: {} };
            const requireModule = (request: string) => {
                const segments = id.split("/"); segments.pop();
                for (const segment of request.split("/")) { if (segment === "..") segments.pop(); else if (segment !== ".") segments.push(segment); }
                return load(segments.join("/"));
            };
            new Function("Laya", "require", "module", "exports", modules[id])(Laya, requireModule, module, module.exports);
            return module.exports;
        };
        const { SpriteFrames, VILLAGE_RESOURCE_PACKAGE } = load("view/SpriteFrames"), { GameView } = load("view/GameView");
        const { GameSession } = load("game/GameSession"), { SaveStore } = load("storage/SaveStore");
        const { createGame, applyCommand } = load("game/VillageRules"), { gateCapacity } = load("game/Growth");
        const { BattleSimulation } = load("game/BattleSimulation");
        // 每次验收使用刚复制的白名单资源，防止编辑器进程复用上一轮图集/JSON缓存。
        const historical = architecture === "monolith" || architecture === "components";
        for (const name of resources) Laya.loader.clearRes(historical ? VILLAGE_RESOURCE_PACKAGE + "/" + name : name);
        const art = new SpriteFrames();
        let preparation: any;
        if (historical) await art.load();
        else {
            const { ResourcePreparation } = load("platform/ResourcePreparation");
            preparation = new ResourcePreparation({ download: async () => true, decode: (bundle: string) => art.loadBundle(bundle) });
            for (const bundle of ["base", "characters", "battle"]) if (!await preparation.ensure(bundle)) throw new Error(preparation.states[bundle].error);
        }
        // 节点路径/顺序及可见属性的快照只供重构对照，不采集引擎分配的实例 ID。
        const snapshot = (node: Laya.Sprite): object => {
            const fields = ["name", "x", "y", "width", "height", "pivotX", "pivotY", "scaleX", "scaleY", "rotation", "alpha", "visible", "zIndex", "stackingRoot", "mouseEnabled", "mouseThrough"] as const;
            const data: Record<string, any> = {};
            for (const key of fields) data[key] = node[key];
            if (node instanceof Laya.Text) for (const key of ["text", "html", "font", "fontSize", "color", "bold", "stroke", "strokeColor", "align", "valign", "wordWrap", "leading", "overflow"] as const) data[key] = node[key];
            data.children = [];
            for (let i = 0; i < node.numChildren; i++) data.children.push(snapshot(node.getChildAt(i) as Laya.Sprite));
            return data;
        };
        const checks: { name: string; height: number; buildings: number; wheel: boolean }[] = [];
        const tipChecks: object[] = [];
        const interactionChecks: object[] = [];
        for (const level of [1, 12]) for (const short of [false, true]) {
            const memory = new Map(), saves = new SaveStore({ read: (key: string) => memory.has(key) ? memory.get(key) : null, write: (key: string, value: string) => memory.set(key, value) });
            const game = new GameSession(saves), s = createGame(7); game.state = s;
            s.farm = s.logging = s.housing = s.gateLevel = level; s.houses = level === 1 ? 2 : 5; s.gate = gateCapacity(s);
            s.legacy.bestNight = 1; // 仅内存视觉夹具：显示首波后解锁的排行入口，避免遗漏图文排版验收。
            s.towers.forEach((t: any, i: number) => { t.kind = ["ARROW", "STONE", "SLOW", "ARROW"][i]; t.level = level; t.operator = s.people[i].id; });
            // 只在内存夹具验证下排高阶塔的最长精英名，检查移动后与城门血条的间距。
            if (level === 12) for (const index of [2, 3]) { s.people[index].name = "四辈儿"; s.people[index].elite = true; }
            const platform = { window: { windowWidth: short ? 320 : 390, windowHeight: short ? 568 : 844, screenTop: 0, statusBarHeight: short ? 20 : 47, safeArea: { top: short ? 20 : 47, bottom: short ? 568 : 810 } }, menu: { top: short ? 24 : 51, bottom: short ? 56 : 83, width: 88, height: 32, left: short ? 222 : 292, right: short ? 310 : 380 } };
            const view = new GameView(game, art, platform, () => {}, preparation);
            Laya.stage.addChild(view.root);
            try {
                for (let i = 0; i < 360; i++) view.update(.05);
                const capture = async (suffix: string) => {
                    // 编辑状态的游戏时钟暂停；使用持续运行的系统时钟等待 Text/Button 的延迟排版。
                    await new Promise<void>(resolve => Laya.systemTimer.frameOnce(2, null, resolve));
                    const canvas = view.root.drawToCanvas(720, Math.ceil(view.root.height), 0, 0);
                    const name = `游戏实绘_${level}级_${short ? "短屏" : "iPhone12比例"}_${suffix}.png`;
                    fs.writeFileSync(output + "/" + name, BufferClass.from(canvas.source.toDataURL("image/png").split(",")[1], "base64"));
                    if (architecture === "monolith" || architecture === "components") fs.writeFileSync(output + "/" + name.replace(/\.png$/, ".nodes.json"), JSON.stringify(snapshot(view.root)));
                    const world = view.root.getChildByName("VillageWorld") as Laya.Sprite;
                    let buildings = 0;
                    for (let i = 0; i < world.numChildren; i++) if (world.getChildAt(i).getChildByName("EditorBuilding")) buildings++;
                    checks.push({ name, height: view.root.height, buildings, wheel: !!world.getChildByName("building:farm:above") });
                };
                // 原生引擎坐标/命中/事件回调验收；只操作内存夹具，不调用微信或真实存档。
                const clickHouse = (id: string, expected: string) => {
                    const world = view.root.getChildByName("VillageWorld") as Laya.Sprite;
                    const house = world.getChildByName(id) as Laya.Sprite, r = house.hitArea as Laya.Rectangle;
                    if (!r || r.width <= 0 || r.height <= 0) throw new Error("民房点击范围为空:" + id);
                    const point = house.localToGlobal(new Laya.Point(r.x + r.width / 2, r.y + r.height / 2));
                    if (!house.hitTestPoint(point.x, point.y)) throw new Error("民房全局坐标命中失败");
                    const local = view.root.globalToLocal(point, true);
                    const target = Laya.InputManager.inst.getSpriteUnderPoint(view.root, local.x, local.y);
                    if (!target || (!target.name.startsWith("person:") && target !== house)) throw new Error("民房被其他输入层遮住:" + target?.name);
                    const before = JSON.stringify(game.state), event = { touchId: 9, stageX: point.x, stageY: point.y };
                    target.event(Laya.Event.MOUSE_DOWN, event); target.event(Laya.Event.MOUSE_UP, event); target.event(Laya.Event.CLICK, event);
                    const tip = view.root.getChildByName("AnchoredTip") as Laya.Sprite;
                    const label = tip.getChildByName("AnchoredTipText") as Laya.Text;
                    if (!tip.visible || label.text !== expected) throw new Error("民房气泡名称不符:" + label.text);
                    if (before !== JSON.stringify(game.state)) throw new Error("民房气泡修改了业务数据");
                    return tip;
                };
                await capture("白天");
                if (architecture === "person-click") interactionChecks.push({ level, short, phase: "DAY", ...await checkVillageInteraction(view, game, capture) });
                if (architecture === "anchored-tip") {
                    let tip = clickHouse("building:house-a", "佟楼");
                    const anchorX = tip.x, anchorY = tip.y;
                    view.update(.08);
                    if (!(tip.scaleX > 0 && tip.scaleX < 1)) throw new Error("气泡未从尖端展开");
                    const fixed = tip.localToGlobal(new Laya.Point(tip.pivotX, tip.pivotY), false, view.root);
                    if (Math.abs(fixed.x - anchorX) > .001 || Math.abs(fixed.y - anchorY) > .001) throw new Error("气泡缩放时尖端漂移");
                    if (level === 1 && short) await capture("气泡_展开中");
                    view.update(.12); await capture("气泡_佟楼");
                    for (let i = 0; i < 20; i++) view.update(.05);
                    clickHouse("building:house-a", "佟楼");
                    for (let i = 0; i < 20; i++) view.update(.05);
                    if (!tip.visible) throw new Error("重复点按没有重置计时");
                    tip = clickHouse("building:house-b", "南楼");
                    view.update(.2); await capture("气泡_南楼");
                    for (let i = 0; i < 34; i++) view.update(.05);
                    if (!(tip.scaleX > 0 && tip.scaleX < 1)) throw new Error("气泡未缩回尖端");
                    if (level === 1 && short) await capture("气泡_收起中");
                    for (let i = 0; i < 4; i++) view.update(.05);
                    if (tip.visible) throw new Error("气泡超时未消失");
                    clickHouse("building:house-a", "佟楼");
                    view.panels.open({ type: "settings" });
                    if (tip.visible) throw new Error("主动面板未收起气泡");
                    const covered = view.root.getChildByName("VillageWorld").getChildByName("building:house-a") as Laya.Sprite;
                    const coveredBounds = covered.hitArea as Laya.Rectangle;
                    const coveredPoint = covered.localToGlobal(new Laya.Point(coveredBounds.x + coveredBounds.width / 2, coveredBounds.y + coveredBounds.height / 2), false, view.root);
                    if (Laya.InputManager.inst.getSpriteUnderPoint(view.root, coveredPoint.x, coveredPoint.y) === covered) throw new Error("面板没有拦截民房点按");
                    view.panels.close();
                    clickHouse("building:house-a", "佟楼");
                    game.dailyRationDate = "2026-11-12"; view.refresh();
                    if (tip.visible) throw new Error("自动面板未收起气泡");
                    game.dailyRationDate = null; view.refresh();
                    clickHouse("building:house-a", "佟楼");
                    s.housing = level + 1; view.refresh(); view.update(.1);
                    const a = view.village.props.find((p: any) => p.id === "building:house-a").visual.bodyRegion();
                    const roof = a.node.localToGlobal(new Laya.Point(a.bounds.x + a.bounds.width / 2, a.bounds.y), false, view.root);
                    if (Math.abs(tip.x - roof.x) > .001 || Math.abs(tip.y - roof.y + 8) > .001) throw new Error("升级后气泡未跟随屋顶");
                    s.housing = level; view.refresh();
                    const world = view.root.getChildByName("VillageWorld") as Laya.Sprite;
                    const first = world.getChildByName("building:house-a") as Laya.Sprite, second = world.getChildByName("building:house-b") as Laya.Sprite;
                    const originalX = second.x, originalY = second.y;
                    second.pos(first.x, first.y - 10);
                    clickHouse("building:house-b", "佟楼");
                    second.pos(originalX, originalY);
                    const oldHeight = platform.window.windowHeight, oldBottom = platform.window.safeArea.bottom;
                    platform.window.windowHeight += 120; platform.window.safeArea.bottom += 120;
                    view.resize();
                    const moved = view.village.props.find((p: any) => p.id === "building:house-a").visual.bodyRegion();
                    const at = moved.node.localToGlobal(new Laya.Point(moved.bounds.x + moved.bounds.width / 2, moved.bounds.y), false, view.root);
                    if (!tip.visible || Math.abs(tip.y - at.y + 8) > .001) throw new Error("窗口变化后屋顶挂点错误");
                    platform.window.windowHeight = oldHeight; platform.window.safeArea.bottom = oldBottom; view.resize();
                    tipChecks.push({ level, short, names: true, nativeInput: true, modalBlocksHouse: true, overlapFrontHouse: true, anchorFixed: true, repeatRestarted: true, timeout: true, activeAndAutomaticPanels: true, upgradeFollowed: true, resizeFollowed: true });
                    view.anchoredTip.hide();
                }
                if ((architecture === "monolith" || architecture === "components") && level === 1 && !short) {
                    // 通过实际 open/close/refresh 绘制；入口由测试版本显式指定，运行时代码没有兼容分支。
                    const panels = architecture === "components" ? view.panels : view;
                    const cases = [
                        { type: "settings" }, ...[0, 1, 2, 3, 4].map(tab => ({ type: "guide", tab })),
                        { type: "people" }, { type: "person", id: s.people[0].id }, { type: "families" },
                        { type: "partners" }, { type: "partners", a: s.people[2].id },
                        { type: "carers", id: s.families[0].id }, { type: "care", id: s.people[0].id },
                        { type: "operators", index: 0 }, { type: "workers", id: s.people[4].id, job: "FARM" },
                        { type: "build" }, { type: "tower", index: 0 }, { type: "wave" }, { type: "start" },
                        { type: "history" }, { type: "restart" }, { type: "cleanStart" }, { type: "inherit" }
                    ];
                    for (let i = 0; i < cases.length; i++) {
                        panels.open(cases[i]); await capture(`面板_${i}_${cases[i].type}`); panels.close();
                    }
                }
                applyCommand(s, { type: "NIGHT" }); game.battle = new BattleSimulation(s); view.refresh();
                for (let i = 0; i < 100; i++) { game.battle.step(); view.update(.05); }
                await capture("守夜");
                if (architecture === "person-click") {
                    game.battle = new BattleSimulation(s); view.refresh();
                    interactionChecks.push({ level, short, phase: "NIGHT", ...await checkVillageInteraction(view, game, capture) });
                }
                if (architecture === "anchored-tip") {
                    for (const [id, title] of [["building:house-a", "佟楼"], ["building:house-b", "南楼"]]) {
                        clickHouse(id, title); view.update(.2); await capture("守夜气泡_" + title);
                    }
                    game.cleanStart();
                    if (view.anchoredTip.visible || view.anchoredTip.target !== null) throw new Error("重新开村后旧气泡目标未清理");
                    tipChecks[tipChecks.length - 1] = { ...tipChecks[tipChecks.length - 1], newVillageCleared: true };
                }
            } finally { view.destroy(); }
        }
        art.destroy(); fs.writeFileSync(output + "/game-render-check.json", JSON.stringify(checks, null, 2));
        if (architecture === "anchored-tip") fs.writeFileSync(output + "/tip-behavior-check.json", JSON.stringify(tipChecks, null, 2));
        if (architecture === "person-click") fs.writeFileSync(output + "/interaction-check.json", JSON.stringify(interactionChecks, null, 2));
        return checks;
    }
}
