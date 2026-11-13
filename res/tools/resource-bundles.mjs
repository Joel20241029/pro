import fs from 'node:fs';
import path from 'node:path';
/** 已确认三包制作规格；每张素材在 asset_recipe.json 显式归属，禁止跨包重复打图集。 */
export const bundles = { base: { size: 1024 }, characters: { size: 512 }, battle: { size: 512 } };
export function writeBundles(root, pages, frames, animations, buildingFiles, audio, enemyFile, particleFiles) {
    const result = {}, required = {};
    for (const bundle of Object.keys(bundles)) {
        const dir = path.join(root, 'bundles', bundle); fs.mkdirSync(dir, { recursive: true });
        const selected = pages.filter(p => p.group === bundle), ids = new Set(selected.map(p => p.id));
        const bundleFrames = Object.fromEntries(Object.entries(frames).filter(([, f]) => ids.has(f.page)));
        const clips = animations.animations.filter(c => bundleFrames[c.frameIds[0]]);
        const files = ['frames.json', 'animations.json', ...selected.map(p => p.runtimeFile)];
        fs.writeFileSync(path.join(dir, 'frames.json'), JSON.stringify({ version: 3, bundle, pages: selected, frames: bundleFrames }));
        fs.writeFileSync(path.join(dir, 'animations.json'), JSON.stringify({ animations: clips, walkDirections: bundle === 'characters' ? animations.walkDirections : {}, enemyNativeFacing: bundle === 'battle' ? animations.enemyNativeFacing : {} }));
        for (const p of selected) fs.copyFileSync(path.join(root, p.path), path.join(dir, p.runtimeFile));
        const extras = [...(bundle === 'base' ? buildingFiles : bundle === 'battle' ? [enemyFile] : []), ...audio.tracks.filter(t => (t.packageFile === 'battle_loop.mp3' ? 'battle' : 'base') === bundle).map(t => t.runtimeFile)];
        for (const file of extras) { fs.copyFileSync(path.join(root, file), path.join(dir, path.basename(file))); files.push(path.basename(file)); }
        fs.copyFileSync(path.join(root, particleFiles[bundle]), path.join(dir, 'particles.json')); files.push('particles.json');
        result[bundle] = files.map(file => `bundles/${bundle}/${file}`);
        required[bundle] = { frames: Object.keys(bundleFrames).sort(), clips: clips.map(c => c.id).sort() };
    }
    const contract = '/** 由 res/tools/build-resources.mjs 生成的主包依赖契约；不信任下载清单自报完整。修改素材请重建，禁止手工修改。 */\n'
        + `export const RESOURCE_CONTRACT: Record<string, { frames: string[]; clips: string[] }> = ${JSON.stringify(required)};\n`
        + `export const REQUIRED_WALK_DIRECTIONS = ${JSON.stringify(animations.walkDirections)};\n`;
    fs.writeFileSync(path.resolve(root, '../project/LayaProject/src/config/ResourceManifest.ts'), contract);
    return result;
}
