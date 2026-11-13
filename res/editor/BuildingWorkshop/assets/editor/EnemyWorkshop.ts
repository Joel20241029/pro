/** 怪物原生编辑器入口；素材、预制体按独立目录保存，不进入微信包。 */
export class EnemyWorkshop {
    @IEditor.menu("App/tool/VerifyEnemiesInGame")
    static async verify() {
        const fs = IEditor.require("fs"), path = IEditor.require("path");
        const task = "/Users/happyelements/Downloads/daidai-enemies-loading-20261112", compiled = task + "/checks/compiled";
        const modules: Record<string, string> = {};
        const collect = (dir: string) => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const file = path.join(dir, entry.name);
                if (entry.isDirectory()) collect(file);
                else if (entry.name.endsWith(".js")) modules[path.relative(compiled, file).replace(/\.js$/, "")] = fs.readFileSync(file, "utf8");
            }
        };
        collect(compiled);
        const root = path.resolve(Editor.projectPath, "../../.."), manifest = JSON.parse(fs.readFileSync(root + "/res/manifest.json", "utf8"));
        const resources: string[] = [];
        for (const [bundle, files] of Object.entries(manifest.bundles)) {
            const dest = Editor.projectPath + "/assets/resources/" + bundle; fs.mkdirSync(dest, { recursive: true });
            for (const file of files as string[]) { fs.copyFileSync(root + "/res/" + file, dest + "/" + path.basename(file)); resources.push("resources/" + bundle + "/" + path.basename(file)); }
        }
        console.log("ENEMY_GAME_VERIFIED", JSON.stringify(await Editor.scene.runScript("EnemyGameCheck.render", modules, task + "/checks/native", resources)));
    }
    @IEditor.menu("App/tool/BuildVillageEnemies")
    static async build() {
        const fs = IEditor.require("fs");
        const seeds = JSON.parse(fs.readFileSync(Editor.projectPath + "/assets/enemyAuthoring/layout-seeds.json", "utf8"));
        console.log("ENEMY_PREFABS_SAVED", JSON.stringify(await Editor.scene.runScript("EnemyWorkshopScene.build", seeds)));
    }
    @IEditor.menu("App/tool/CheckEnemyComposition")
    static async spike() {
        const result = await Editor.scene.runScript("EnemyWorkshopScene.spike", "/Users/happyelements/Downloads/daidai-enemies-loading-20261112/spike");
        console.log("ENEMY_COMPOSITION_SPIKE", JSON.stringify(result));
    }
}
