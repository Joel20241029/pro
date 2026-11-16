import fs from 'node:fs';
import path from 'node:path';
/** 已确认高清四包规格；每张素材在 asset_recipe.json 显式归属，禁止跨包重复打图集。 */
// 1024页；主包UI/地图先显示加载界面，建筑→人物顺序准备，战斗在守夜前准备，失败手动重试。
export const bundles = { base: { size: 1024 }, buildings: { size: 1024 }, characters: { size: 1024 }, battle: { size: 1024 } };
export function writeBundles(root, pages, frames, animations, buildingFiles, audio, enemyFile) {
    const result = {}, required = {};
    for (const bundle of Object.keys(bundles)) {
        const dir = path.join(root, 'bundles', bundle); fs.mkdirSync(dir, { recursive: true });
        const selected = pages.filter(p => p.group === bundle), ids = new Set(selected.map(p => p.id));
        const bundleFrames = Object.fromEntries(Object.entries(frames).filter(([, f]) => ids.has(f.page)));
        const clips = animations.animations.filter(c => bundleFrames[c.frameIds[0]]);
        const files = ['frames.json', 'animations.json', ...selected.map(p => p.runtimeFile)];
        fs.writeFileSync(path.join(dir, 'frames.json'), JSON.stringify({ version: 3, bundle, pages: selected, frames: bundleFrames }));
        fs.writeFileSync(path.join(dir, 'animations.json'), JSON.stringify({ animations: clips, walkDirections: bundle === 'characters' ? animations.walkDirections : {}, laborDirections: bundle === 'characters' ? animations.laborDirections : {}, enemyNativeFacing: bundle === 'battle' ? animations.enemyNativeFacing : {} }));
        for (const p of selected) fs.copyFileSync(path.join(root, p.path), path.join(dir, p.runtimeFile));
        const extras = [...(bundle === 'buildings' ? buildingFiles : bundle === 'battle' ? [enemyFile] : []), ...audio.tracks.filter(t => t.bundle === bundle).map(t => t.runtimeFile)];
        for (const file of extras) { fs.copyFileSync(path.join(root, file), path.join(dir, path.basename(file))); files.push(path.basename(file)); }
        result[bundle] = files.map(file => `bundles/${bundle}/${file}`);
        required[bundle] = { frames: Object.keys(bundleFrames).sort(), clips: clips.map(c => c.id).sort() };
    }
    const contract = '/** 由 res/tools/build-resources.mjs 生成的主包依赖契约；不信任下载清单自报完整。修改素材请重建，禁止手工修改。 */\n'
        + `export const RESOURCE_CONTRACT: Record<string, { frames: string[]; clips: string[] }> = ${JSON.stringify(required)};\n`
        + `/** 原生怪物布局格式；由制作导出读取版本，改变足点/阴影合同须同步重新发布。 */\nexport const REQUIRED_ENEMY_LAYOUT_VERSION = ${JSON.parse(fs.readFileSync(path.join(root, 'native/enemies.json'))).version};\n`
        + `export const REQUIRED_WALK_DIRECTIONS = ${JSON.stringify(animations.walkDirections)};\n`
        + `export const REQUIRED_LABOR_DIRECTIONS = ${JSON.stringify(animations.laborDirections)};\n`
        + `export const REQUIRED_BUILDING_LAYOUTS = ${JSON.stringify(Object.keys(JSON.parse(fs.readFileSync(path.join(root, 'native/buildings.json'))).layouts).sort())};\n`;
    fs.writeFileSync(path.resolve(root, '../project/LayaProject/src/config/ResourceManifest.ts'), contract);
    return result;
}
