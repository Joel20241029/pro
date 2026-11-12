/** 仅供编辑器验收：使用已编译的正式 GameView，不把夹具、编译JS或复制的图集提交/发布。 */
export class BuildingGameCheckMenu {
    @IEditor.menu("App/tool/CheckBuildingsInGame")
    static async run() {
        const fs = IEditor.require("fs"), path = IEditor.require("path"), home = IEditor.require("os").homedir();
        const evidence = home + "/Downloads/daidai-building-editor-20261112/evidence";
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
        const result = await Editor.scene.runScript("BuildingGameCheck.render", modules, evidence, manifest.runtimeWhitelist.map((file: string) => path.basename(file)));
        console.log("VILLAGE_GAME_VISUAL_CHECK", JSON.stringify(result));
    }
}

