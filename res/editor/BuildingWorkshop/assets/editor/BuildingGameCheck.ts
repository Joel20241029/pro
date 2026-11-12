/** 仅供编辑器验收：使用已编译的正式 GameView，不把夹具、编译JS或复制的图集提交/发布。 */
export class BuildingGameCheckMenu {
    /** 使用下载目录中锁定的两份正式编译产物做显示对照，不接触微信/本地真实存档。 */
    @IEditor.menu("App/tool/CompareGameRefactor")
    static async compareRefactor() {
        const fs = IEditor.require("fs"), path = IEditor.require("path"), home = IEditor.require("os").homedir();
        const task = home + "/Downloads/daidai-refactor-20261112";
        const repo = path.resolve(Editor.projectPath, "../../.."), dest = Editor.projectPath + "/assets/resources/village";
        const manifest = JSON.parse(fs.readFileSync(repo + "/res/manifest.json", "utf8"));
        fs.mkdirSync(dest, { recursive: true });
        for (const file of manifest.runtimeWhitelist) fs.copyFileSync(repo + "/res/" + file, dest + "/" + path.basename(file));
        const results = [];
        for (const [version, architecture] of [["baseline", "monolith"], ["current", "components"]]) {
            const compiled = task + "/" + version + "-build/src", output = task + "/native-" + version;
            fs.mkdirSync(output, { recursive: true });
            const modules: Record<string, string> = {};
            const walk = (dir: string) => {
                for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                    const file = path.join(dir, entry.name);
                    if (entry.isDirectory()) walk(file);
                    else if (entry.name.endsWith(".js")) modules[path.relative(compiled, file).replace(/\.js$/, "")] = fs.readFileSync(file, "utf8");
                }
            };
            walk(compiled);
            results.push({ version, checks: await Editor.scene.runScript("BuildingGameCheck.render", modules, output, manifest.runtimeWhitelist.map((file: string) => path.basename(file)), architecture) });
        }
        fs.writeFileSync(task + "/native-checks.json", JSON.stringify(results, null, 2));
        console.log("VILLAGE_REFACTOR_VISUAL_CHECK", JSON.stringify(results));
    }
    @IEditor.menu("App/tool/CheckBuildingsInGame")
    static async run(mode?: "anchored-tip" | "person-click") {
        const fs = IEditor.require("fs"), path = IEditor.require("path"), home = IEditor.require("os").homedir();
        const evidence = home + (mode === "person-click" ? "/Downloads/daidai-person-click-20261112/native" : mode === "anchored-tip" ? "/Downloads/daidai-building-tip-20261112/native" : "/Downloads/daidai-building-editor-20261112/evidence");
        fs.mkdirSync(evidence, { recursive: true });
        const compiled = home + "/Downloads/daidai-building-editor-20261112/test-suite/src";
        const modules: Record<string, string> = {};
        const walk = (dir: string) => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const name = path.join(dir, entry.name);
                if (entry.isDirectory()) walk(name);
                else if (entry.name.endsWith(".js")) modules[path.relative(compiled, name).replace(/\.js$/, "")] = fs.readFileSync(name, "utf8");
            }
        };
        walk(compiled);
        const repo = path.resolve(Editor.projectPath, "../../.."), dest = Editor.projectPath + "/assets/resources/village";
        fs.mkdirSync(dest, { recursive: true });
        const manifest = JSON.parse(fs.readFileSync(repo + "/res/manifest.json", "utf8"));
        for (const file of manifest.runtimeWhitelist) fs.copyFileSync(repo + "/res/" + file, dest + "/" + path.basename(file));
        const result = await Editor.scene.runScript("BuildingGameCheck.render", modules, evidence, manifest.runtimeWhitelist.map((file: string) => path.basename(file)), mode);
        console.log("VILLAGE_GAME_VISUAL_CHECK", JSON.stringify(result));
    }
    @IEditor.menu("App/tool/CheckBuildingTips")
    static async checkBuildingTips() { await BuildingGameCheckMenu.run("anchored-tip"); }
    @IEditor.menu("App/tool/CheckVillageInteraction")
    static async checkVillageInteraction() { await BuildingGameCheckMenu.run("person-click"); }
}

