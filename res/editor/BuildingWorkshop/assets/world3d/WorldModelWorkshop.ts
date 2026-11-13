/** 原生资源节点保留importer子资产UUID；不可使用loader GLB.create再保存，后者会丢失动画来源。 */
@IEditor.regClass()
export class WorldModelWorkshop {
    static async buildAll(output: string, selected = 'base,characters,battle') {
        const fs = IEditor.require('fs');
        const bundles = [
            { bundle: 'base', group: 'environment', effects: [] },
            { bundle: 'characters', group: 'characters', effects: ['elite_ring'] },
            { bundle: 'battle', group: 'enemies', effects: ['hit_arrow', 'hit_stone', 'hit_ice', 'hit_gate'] }
        ];
        const reports: any[] = [];
        for (const bundle of bundles.filter(entry => selected.split(',').includes(entry.bundle))) {
            const names = fs.readdirSync(Editor.assetsPath + '/world3d/' + bundle.group).filter((name: string) => name.endsWith('.glb')).map((name: string) => name.slice(0, -4)).sort();
            const models = await WorldModelWorkshop.importGroup(bundle.group, names);
            const effects = bundle.effects.map(id => ({ id, file: `world3d/effects/prefabs/${id}.lh` }));
            reports.push(await WorldModelWorkshop.exportBundle(bundle.bundle, models, effects, output + '/' + bundle.bundle));
        }
        return reports;
    }
    static async importGroup(group: string, names: string[]) {
        const models: any[] = [];
        for (const id of names) {
            const asset = await Editor.assetDb.getAsset(`world3d/${group}/${id}.glb`);
            if (!asset) throw new Error('模型尚未导入：' + id);
            const node = await Editor.scene.createNodeByAsset(asset.id);
            if (!node) throw new Error('创建模型资源节点失败：' + id);
            const report = await Editor.scene.runScript('WorldModelWorkshopScene.prepareCreated', node.id);
            const saved = await Editor.scene.createPrefab(node.id, `world3d/${group}/prefabs`, `${id}.lh`);
            models.push({ id, file: saved.asset.file, uuid: saved.asset.id, ...report });
        }
        await Editor.assetDb.flushChanges();
        return models;
    }
    static async exportBundle(bundle: string, models: any[], effects: {id: string, file: string}[], output: string) {
        await Editor.assetDb.flushChanges();
        const detail = await Editor.scene.runScript('WorldModelWorkshopScene.exportAssets', [...models.map(model => model.file), ...effects.map(effect => effect.file)], output);
        const fs = IEditor.require('fs');
        const manifest = { bundle, models: models.map(({id, file, height, clips, uuid}) => ({id, file, height, clips, uuid})), effects, files: detail.files.filter((file: any) => !file.noFile).map((file: any) => file.relativePath) };
        for (const file of manifest.files) if (!fs.existsSync(output + '/' + file)) throw new Error('官方导出缺少文件：' + file);
        fs.writeFileSync(output + '/manifest.json', JSON.stringify(manifest, null, 2));
        return manifest;
    }
    static async verifyMale(output: string) { return Editor.scene.runScript('WorldModelWorkshopScene.verifyMale', output); }
}
