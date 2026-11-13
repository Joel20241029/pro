/** Isolated art validation: writes only hd2dAuthoring assets and Downloads evidence. */
export class Hd2dWorkshop {
    @IEditor.menu("App/tool/BuildHd2dProbe")
    static async build() {
        const fs = IEditor.require("fs");
        const path = IEditor.require("path"), crypto = IEditor.require("crypto");
        const root = path.resolve(Editor.projectPath, "../../..");
        const recipePath = "res/design/hd2d/parts/probe-recipe.json";
        const recipe = JSON.parse(fs.readFileSync(path.join(root, recipePath), "utf8"));
        const manifest = JSON.parse(fs.readFileSync(Editor.projectPath + "/assets/hd2dAuthoring/texture-manifest.json", "utf8"));
        const output = IEditor.require("os").homedir() + "/Downloads/daidai-hd2d-20261113/native";
        // Fingerprints belong to capture time. The verifier must not attach new
        // source hashes to old screenshots after a layout-only change.
        const inputs = new Set<string>([recipePath, ...recipe.evidenceInputs]);
        for (const asset of recipe.assets) {
            inputs.add(recipe.sourceRoot + "/" + asset.source);
            inputs.add(recipe.output + "/" + asset.id + ".png");
            inputs.add(recipe.output + "/" + asset.id + ".png.meta");
        }
        const hash = (file: string) => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");
        const captureInputs = [...inputs].map(file => ({ file, sha256: hash(file) }));
        const result = await Editor.scene.runScript("Hd2dProbeScene.build", manifest, output);
        for (const input of captureInputs) if (hash(input.file) !== input.sha256) {
            throw new Error("采样过程中输入发生变化，请重新生成: " + input.file);
        }
        const captureOutputs = ["Hd2dProbe.ls", ...result.prefabs].map(file => {
            const relative = "res/editor/BuildingWorkshop/assets/" + file;
            return { file: relative, sha256: hash(relative) };
        });
        Object.assign(result, { captureInputs, captureOutputs });
        fs.writeFileSync(output + "/native-report.json", JSON.stringify(result, null, 2) + "\n");
        console.log("HD2D_NATIVE_PROBE_SAVED", JSON.stringify(result));
    }
}
