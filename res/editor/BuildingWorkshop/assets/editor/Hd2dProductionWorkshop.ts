/** 用户批准的整套替换制作验证。保存本次已确认的高清制作源与下载证据；不修改正式游戏业务。 */
export class Hd2dProductionWorkshop {
    @IEditor.menu('App/tool/RefineHdEnemyAttachments')
    static async refineEnemies() {
        const fs = IEditor.require('fs'), path = IEditor.require('path');
        const source = path.resolve(Editor.projectPath, '../../source/rendered2d');
        const recipe = JSON.parse(fs.readFileSync(source + '/production_recipe.json', 'utf8'));
        const seeds = JSON.parse(fs.readFileSync(source + '/native-layout-seeds.json', 'utf8'));
        const output = IEditor.require('os').homedir() + '/Downloads/daidai-endless-redesign-20261116/native';
        const result = await Editor.scene.runScript('Hd2dEnemyRefinementScene.build', seeds.enemies, recipe, output);
        console.log('HD2D_ENEMY_ATTACHMENTS_REFINED', JSON.stringify(result));
    }
    @IEditor.menu('App/tool/RefineHdArrowWeapons')
    static async refineArrows() {
        const output = IEditor.require('os').homedir() + '/Downloads/daidai-hd2d-full-20261113/native-refinement';
        const result = await Editor.scene.runScript('Hd2dProductionScene.refineArrows', output);
        console.log('HD2D_ARROW_REFINED', JSON.stringify(result));
    }
    @IEditor.menu('App/tool/BuildHd2dProduction')
    static async build() {
        const fs = IEditor.require('fs'), path = IEditor.require('path'), crypto = IEditor.require('crypto');
        const source = path.resolve(Editor.projectPath, '../../source/rendered2d');
        const output = IEditor.require('os').homedir() + '/Downloads/daidai-hd2d-full-20261113/native';
        const recipe = JSON.parse(fs.readFileSync(source + '/production_recipe.json', 'utf8'));
        const seeds = JSON.parse(fs.readFileSync(source + '/native-layout-seeds.json', 'utf8'));
        const before = crypto.createHash('sha256').update(JSON.stringify({ recipe, seeds })).digest('hex');
        const result = await Editor.scene.runScript('Hd2dProductionScene.build', seeds, recipe, output);
        fs.writeFileSync(output + '/native-report.json', JSON.stringify({ ...result, sourceHash: before, status: 'native_staging_not_game_acceptance' }, null, 2));
        console.log('HD2D_PRODUCTION_NATIVE_SAVED', JSON.stringify(result));
    }
}
