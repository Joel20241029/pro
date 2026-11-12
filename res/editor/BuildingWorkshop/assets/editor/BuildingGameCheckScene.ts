/** 原生场景进程中的正式 GameView 渲染夹具，与编辑器菜单进程分开编译。 */
@IEditorEnv.regClass()
export class BuildingGameCheck {
    static async render(modules: Record<string, string>, output: string, resources: string[], architecture?: "monolith" | "components") {
        const fs = IEditorEnv.require("fs"), BufferClass = IEditorEnv.require("buffer").Buffer;
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
        for (const name of resources) Laya.loader.clearRes(VILLAGE_RESOURCE_PACKAGE + "/" + name);
        const art = new SpriteFrames(); await art.load();
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
        for (const level of [1, 12]) for (const short of [false, true]) {
            const memory = new Map(), saves = new SaveStore({ read: (key: string) => memory.has(key) ? memory.get(key) : null, write: (key: string, value: string) => memory.set(key, value) });
            const game = new GameSession(saves), s = createGame(7); game.state = s;
            s.farm = s.logging = s.housing = s.gateLevel = level; s.houses = level === 1 ? 2 : 5; s.gate = gateCapacity(s);
            s.towers.forEach((t: any, i: number) => { t.kind = ["ARROW", "STONE", "SLOW", "ARROW"][i]; t.level = level; t.operator = s.people[i].id; });
            // 只在内存夹具验证下排高阶塔的最长精英名，检查移动后与城门血条的间距。
            if (level === 12) for (const index of [2, 3]) { s.people[index].name = "四辈儿"; s.people[index].elite = true; }
            const platform = { window: { windowWidth: short ? 320 : 390, windowHeight: short ? 568 : 844, screenTop: 0, statusBarHeight: short ? 20 : 47, safeArea: { top: short ? 20 : 47, bottom: short ? 568 : 810 } }, menu: { top: short ? 24 : 51, bottom: short ? 56 : 83, width: 88, height: 32, left: short ? 222 : 292, right: short ? 310 : 380 } };
            const view = new GameView(game, art, platform, () => {});
            Laya.stage.addChild(view.root);
            for (let i = 0; i < 360; i++) view.update(.05);
            const capture = async (suffix: string) => {
                // 编辑状态的游戏时钟暂停；使用持续运行的系统时钟等待 Text/Button 的延迟排版。
                await new Promise<void>(resolve => Laya.systemTimer.frameOnce(2, null, resolve));
                const canvas = view.root.drawToCanvas(720, Math.ceil(view.root.height), 0, 0);
                const name = `游戏实绘_${level}级_${short ? "短屏" : "iPhone12比例"}_${suffix}.png`;
                fs.writeFileSync(output + "/" + name, BufferClass.from(canvas.source.toDataURL("image/png").split(",")[1], "base64"));
                if (architecture) fs.writeFileSync(output + "/" + name.replace(/\.png$/, ".nodes.json"), JSON.stringify(snapshot(view.root)));
                const world = view.root.getChildByName("VillageWorld") as Laya.Sprite;
                let buildings = 0;
                for (let i = 0; i < world.numChildren; i++) if (world.getChildAt(i).getChildByName("EditorBuilding")) buildings++;
                checks.push({ name, height: view.root.height, buildings, wheel: !!world.getChildByName("building:farm:above") });
            };
            await capture("白天");
            if (architecture && level === 1 && !short) {
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
            await capture("守夜"); view.destroy();
        }
        art.destroy(); fs.writeFileSync(output + "/game-render-check.json", JSON.stringify(checks, null, 2));
        return checks;
    }
}
