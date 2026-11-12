/** 仅在 Laya 编辑器运行。初次搭建后直接编辑 .lh；此菜单显式重新生成，日常资源构建不调用。 */
export class BuildingWorkshop {
    @IEditor.menu("App/tool/BuildVillageBuildings")
    static async build() {
        const fs = IEditor.require("fs");
        const seeds = JSON.parse(fs.readFileSync(Editor.projectPath + "/assets/buildingAuthoring/layout-seeds.json", "utf8"));
        const result = await Editor.scene.runScript("BuildingWorkshopScene.build", seeds);
        console.log("VILLAGE_BUILDINGS_SAVED", JSON.stringify(result));
    }
    @IEditor.menu("App/tool/PreviewVillageBuildings")
    static async preview() {
        const result = await Editor.scene.runScript("BuildingWorkshopScene.preview", "/Users/happyelements/Downloads/daidai-building-editor-20261112/evidence");
        console.log("VILLAGE_BUILDINGS_PREVIEW", JSON.stringify(result));
    }
}
