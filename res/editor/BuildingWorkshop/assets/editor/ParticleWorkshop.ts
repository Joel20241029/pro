/** 粒子原始工程入口。真正调用编辑器场景中的原生粒子和资产序列化。 */
export class ParticleWorkshop {
    @IEditor.menu("App/tool/VerifyParticlesInGame")
    static async verifyGame() {
        const fs = IEditor.require("fs"), path = IEditor.require("path");
        const task = "/Users/happyelements/Downloads/daidai-release-1.0.13", compiled = task + "/checks/compiled";
        const modules: Record<string, string> = {};
        const collect = (dir: string) => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const file = path.join(dir, entry.name);
                if (entry.isDirectory()) collect(file);
                else if (entry.name.endsWith(".js")) modules[path.relative(compiled, file).replace(/\.js$/, "")] = fs.readFileSync(file, "utf8");
            }
        };
        collect(compiled);
        const resources: string[] = [];
        for (const bundle of ["base", "characters", "battle"]) {
            const root = "resources/" + bundle;
            for (const file of fs.readdirSync(Editor.projectPath + "/assets/" + root)) if (!file.endsWith(".meta")) resources.push(root + "/" + file);
        }
        console.log("PARTICLE_GAME_VERIFIED", JSON.stringify(await Editor.scene.runScript("ParticleGameCheck.render", modules, task + "/checks/native", resources)));
    }

    @IEditor.menu("App/tool/BuildVillageParticles")
    static async build() {
        const fs = IEditor.require("fs"), root = Editor.projectPath + "/assets/particleAuthoring/";
        const recipe = JSON.parse(fs.readFileSync(root + "recipe.json", "utf8"));
        console.log("PARTICLES_AUTHORED", JSON.stringify(await Editor.scene.runScript("ParticleWorkshopScene.build", recipe.effects, fs.readFileSync(root + "shaders/VillageParticle.shader", "utf8"))));
    }
}
