/** 只保存村内四类预制体。几何、碰撞标记和已有升级片段沿用原生资产。 */
export class VillageMotionWorkshop {
    @IEditor.menu('App/tool/RefineVillageBuildingMotion')
    static async save() {
        const fs = IEditor.require('fs'), path = IEditor.require('path');
        const recipe = JSON.parse(fs.readFileSync(path.resolve(Editor.projectPath, '../../source/rendered2d/production_recipe.json'), 'utf8'));
        const crops = Object.fromEntries(recipe.assets.filter((a: any) => /^farm_crop_\d_\d_0$/.test(a.id)).map((a: any) => [a.id, a.provenance.placement]));
        const report = await Editor.scene.runScript('VillageMotionScene.save', crops);
        console.log('VILLAGE_MOTION_NATIVE_SAVED', JSON.stringify(report));
        return report;
    }
}
