/** 实际正式代码+实际三包资源的 Laya 原生渲染夹具，独立内存存档，不访问微信帐号。 */
@IEditorEnv.regClass()
export class EnemyGameCheck {
    static async render(modules: Record<string, string>, output: string, urls: string[]) {
        const fs = IEditorEnv.require("fs"), BufferClass = IEditorEnv.require("buffer").Buffer;
        fs.mkdirSync(output, { recursive: true });
        const loaded: Record<string, any> = {};
        const load = (id: string): any => {
            if (loaded[id]) return loaded[id].exports;
            if (!modules[id]) throw new Error("缺少正式模块:" + id);
            const module = loaded[id] = { exports: {} };
            const requireModule = (request: string) => {
                const parts = id.split("/"); parts.pop();
                for (const part of request.split("/")) { if (part === "..") parts.pop(); else if (part !== ".") parts.push(part); }
                return load(parts.join("/"));
            };
            new Function("Laya", "require", "module", "exports", modules[id])(Laya, requireModule, module, module.exports);
            return module.exports;
        };
        for (const url of urls) Laya.loader.clearRes(url);
        const { SpriteFrames } = load("view/SpriteFrames"), { GameView } = load("view/GameView"), { EnemyVisuals } = load("view/EnemyVisuals");
        const { GameSession } = load("game/GameSession"), { SaveStore } = load("storage/SaveStore");
        const { ResourcePreparation } = load("platform/ResourcePreparation"), { createGame, applyCommand } = load("game/VillageRules");
        const { BattleSimulation, PATH_LENGTH } = load("game/BattleSimulation"), { ENEMIES } = load("config/EnemyConfig");
        const art = new SpriteFrames(), resources = new ResourcePreparation({ download: async () => true, decode: (bundle: string) => art.loadBundle(bundle) });
        await resources.ensure("base");
        const capture = async (node: Laya.Sprite, name: string) => {
            await new Promise<void>(resolve => Laya.systemTimer.frameOnce(2, null, resolve));
            const canvas = node.drawToCanvas(Math.ceil(node.width), Math.ceil(node.height), 0, 0);
            fs.writeFileSync(output + "/" + name + ".png", BufferClass.from(canvas.source.toDataURL("image/png").split(",")[1], "base64"));
        };
        const checks: any[] = [];
        for (const short of [false, true]) {
            const memory = new Map(), game = new GameSession(new SaveStore({ read: (k: string) => memory.get(k) || null, write: (k: string, v: string) => memory.set(k, v) }));
            game.state = createGame(7); game.pause("ASSETS");
            const platform = { window: { windowWidth: short ? 320 : 390, windowHeight: short ? 568 : 844, screenTop: 0, statusBarHeight: short ? 20 : 47, safeArea: { top: short ? 20 : 47, bottom: short ? 568 : 810 } }, menu: { top: short ? 24 : 51, bottom: short ? 56 : 83, width: 88, height: 32, left: short ? 222 : 292, right: short ? 310 : 380 } };
            const view = new GameView(game, art, platform, () => {}, resources); Laya.stage.addChild(view.root);
            resources.changed = () => view.refresh();
            try {
                if (!short) {
                    resources.states.characters.phase = "DOWNLOAD"; view.refresh(); await capture(view.root, "01_地图先显示_人物下载中");
                    if (view.village.people.some((n: Laya.Sprite) => n.visible)) throw new Error("人物未就绪却显示");
                    resources.states.characters.phase = "FAILED"; view.refresh(); await capture(view.root, "02_人物下载失败_可重试");
                    if (!await resources.ensure("characters")) throw new Error(resources.states.characters.error);
                }
                game.resume("ASSETS"); view.refresh(); for (let i = 0; i < 60; i++) view.update(.05);
                await capture(view.root, short ? "03_短屏_村庄就绪" : "03_长屏_村庄就绪");
                game.state.day = 60; game.state.completed = 59;
                const { generateWave } = load("game/WaveGenerator"); game.state.wave = generateWave(game.state);
                view.panels.open({ type: "start" });
                await resources.ensure("battle");
                if (!resources.ready("battle")) throw new Error(resources.states.battle.error);
                await capture(view.root, short ? "04_短屏_战前预览" : "04_长屏_战前预览");
                view.panels.close();
                game.state.towers.forEach((tower: any, i: number) => { tower.kind = ["ARROW", "STONE", "SLOW", "ARROW"][i]; tower.level = 4; tower.operator = game.state.people[i].id; });
                applyCommand(game.state, { type: "NIGHT" }); game.battle = new BattleSimulation(game.state);
                game.battle.enemies = Object.keys(ENEMIES).map((kind, i) => ({ seq: i, kind, appearanceSeed: i * 179 + 89, progress: (i + 1) * PATH_LENGTH / 12, hp: ENEMIES[kind].hp, speed: ENEMIES[kind].speed, slow: 0, slowTicks: 0, born: 0, summoned: 0 }));
                view.refresh(); for (let i = 0; i < 60; i++) view.update(.05);
                await capture(view.root, short ? "05_短屏_十种怪物道路" : "05_长屏_十种怪物道路");
                checks.push({ short, enemies: view.village.enemies.filter((n: Laya.Sprite) => n.visible).length, pool: view.village.enemies.length, sceneHeight: view.root.height });
                // 仅内存压力夹具：饱和敌人池与20名村民，不写真实存档，不把CPU循环计时当手机FPS。
                const kinds = Object.keys(ENEMIES), first = game.battle.enemies[0];
                game.battle.enemies = Array.from({ length: 40 }, (_, i) => ({ ...first, seq: i, kind: kinds[i % kinds.length], appearanceSeed: i * 179 + 89, progress: (i + 1) * PATH_LENGTH / 42 }));
                game.state.houses = 5;
                while (game.state.people.length < 20) game.state.people.push({ ...game.state.people[0], id: "stress-" + game.state.people.length, spouse: null });
                view.refresh();
                const pool = view.village.enemies.slice();
                for (let i = 0; i < 180; i++) view.update(.05);
                if (pool.some((node: Laya.Sprite, i: number) => node !== view.village.enemies[i])) throw new Error("敌人容器持续重建");
                await capture(view.root, short ? "08_短屏_容量压力实绘" : "08_长屏_容量压力实绘");
                checks.push({ short, stressVisibleEnemies: view.village.enemies.filter((n: Laya.Sprite) => n.visible).length, people: game.state.people.length, stablePool: true, frameUpdates: 180 });
            } finally { resources.changed = () => {}; view.destroy(); }
        }
        for (const mode of ["variants", "frames"]) {
            const scene = new Laya.Scene(); scene.size(1140, 1870); scene.graphics.drawRect(0, 0, 1140, 1870, "#e9e0c6");
            const text = (value: string, x: number, y: number, width: number) => { const t = new Laya.Text(); t.text = value; t.fontSize = 24; t.color = "#4a3421"; t.align = "center"; t.valign = "middle"; t.size(width, 50).pos(x, y); scene.addChild(t); };
            text(mode === "variants" ? "5种小怪＋5种首领 · Laya实际组合" : "四帧走路 · 共同画布与脚底", 0, 8, 1140);
            for (const [row, kind] of Object.keys(ENEMIES).entries()) {
                text(ENEMIES[kind].name, 8, 100 + row * 180, 190);
                for (let col = 0; col < 4; col++) {
                    const n = new Laya.Sprite(), visual = new EnemyVisuals(n, art); scene.addChild(n);
                    visual.draw(kind, mode === "variants" ? [0, 89, 158, 219][col] : 89, mode === "frames" ? col / 6 : 0, mode === "variants" && col === 3);
                    n.scale(n.scaleX * 1.6, n.scaleY * 1.6); n.pos(300 + col * 230, 216 + row * 180);
                    scene.graphics.drawLine(n.x - 70, n.y, n.x + 70, n.y, "#bd9363", 1);
                }
            }
            await IEditorEnv.CreateAssetUtil.createScene(scene, mode === "variants" ? "EnemyVariantsPreview.ls" : "EnemyWalkPreview.ls");
            await capture(scene, mode === "variants" ? "06_怪物组合总览" : "07_四帧对齐检查"); scene.destroy(true);
        }
        resources.destroy(); art.destroy(); fs.writeFileSync(output + "/native-checks.json", JSON.stringify(checks, null, 2));
        return checks;
    }
}
