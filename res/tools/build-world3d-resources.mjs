import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildParticleLayouts } from './build-particle-layouts.mjs';
import { copyNativeClosure } from './native3d-closure.mjs';

/** 官方编辑器导出的原生闭包是唯一模型输入，不复制GLB/Blender/序列帧到发布目录。 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), argument = key => args[args.indexOf(key) + 1];
if (!args.includes('--native') || !args.includes('--work')) throw new Error('用法：node res/tools/build-world3d-resources.mjs --native <Downloads/native3d/export> --work <Downloads/build> [--sync]');
const native = path.resolve(argument('--native')), work = path.resolve(argument('--work'));
if (![native, work].every(p => p.startsWith('/Users/happyelements/Downloads/'))) throw new Error('原生导出和中间目录必须在 Downloads');
fs.mkdirSync(work, { recursive: true });
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n'); };
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const names = {
    base: Object.keys(read(path.join(root, 'source/3d/environment/manifest.json')).assets).sort(),
    characters: ['male', 'female', 'child', 'elder', 'baby'],
    battle: read(path.join(root, 'source/3d/enemies/manifest.json')).assets.map(asset => asset.id).sort()
};
const effects = { base: [], characters: ['elite_ring'], battle: ['hit_arrow', 'hit_stone', 'hit_ice', 'hit_gate'] };
const sameSet = (a, b) => a.length === b.length && new Set(a).size === a.length && b.every(id => a.includes(id));
const relative = file => typeof file === 'string' && !path.isAbsolute(file) && !file.split('/').includes('..') && !file.includes('\\');
const audio = read(path.join(root, 'audio/manifest.json'));
for (const track of audio.tracks) if (hash(path.join(root, track.runtimeFile)) !== track.sha256) throw new Error('音频台账未同步：' + track.packageFile);
const previousFile = path.join(root, 'manifest.json'), previous = fs.existsSync(previousFile) ? read(previousFile) : null;
const particleLayouts = buildParticleLayouts(root), bundles = {}, contract = {}, report = [];
const archive = path.join(work, 'replaced-resources');
function backup(file, name) { if (!fs.existsSync(file)) return; const target = path.join(archive, name); fs.mkdirSync(path.dirname(target), { recursive: true }); if (!fs.existsSync(target)) fs.copyFileSync(file, target); }
for (const bundle of Object.keys(names)) {
    const sourceDir = path.join(native, bundle), data = read(path.join(sourceDir, 'manifest.json'));
    if (data.bundle !== bundle || !sameSet(data.models.map(m => m.id), names[bundle]) || !sameSet(data.effects.map(e => e.id), effects[bundle])) throw new Error('原生模型/粒子集合不完整：' + bundle);
    if (!Array.isArray(data.files) || data.files.some(file => !relative(file) || /\.(glb|blend|ts|map|meta)$/.test(file)) || new Set(data.files).size !== data.files.length) throw new Error('原生文件闭包非法：' + bundle);
    const output = path.join(work, 'prepared', bundle); fs.mkdirSync(output, { recursive: true });
    const compacted = copyNativeClosure(sourceDir, output, data.files);
    const files = [...compacted.files];
    write(path.join(work, 'native-dedup-' + bundle + '.json'), compacted);
    const models = data.models.map(({ id, file, height, clips }) => {
        if (!relative(file) || !files.includes(file) || !file.endsWith('.lh') || !(height > 0) || !Array.isArray(clips)) throw new Error('模型元信息不完整：' + id);
        const expected = bundle === 'base' ? [] : bundle === 'battle' ? ['idle', 'walk'] : id === 'baby' ? ['idle'] : id === 'child' || id === 'elder' ? ['idle', 'walk'] : ['idle', 'walk', 'farm', 'chop', 'care'];
        if (!sameSet(clips, expected)) throw new Error('模型动作集合不符：' + id);
        return { id, file, height, clips };
    });
    for (const effect of data.effects) if (!relative(effect.file) || !files.includes(effect.file) || !effect.file.endsWith('.lh')) throw new Error('粒子闭包缺失：' + effect.id);
    write(path.join(output, 'models.json'), { version: 1, bundle, models });
    write(path.join(output, 'world-particles.json'), { version: 1, bundle, effects: data.effects.map(({ id, file }) => ({ id, file })) });
    const pages = [], frames = {};
    if (bundle === 'characters') for (const id of names.characters) {
        const name = 'portrait_' + id, file = name + '.png', from = path.join(root, 'source/ui/hd/portraits', id + '.png');
        const bytes = fs.readFileSync(from), width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
        if (width !== 256 || height !== 256) throw new Error('头像须为256px统一画布：' + id);
        fs.writeFileSync(path.join(output, file), bytes); files.push(file); pages.push({ id: name, runtimeFile: file });
        frames[name] = { page: name, rect: { x: 0, y: 0, w: width, h: height }, sourceSize: { w: width, h: height }, trimOffset: { x: 0, y: 0 } };
    }
    write(path.join(output, 'frames.json'), { version: 4, bundle, pages, frames });
    files.push('models.json', 'world-particles.json', 'frames.json');
    if (bundle === 'base') { fs.copyFileSync(path.join(root, particleLayouts.base), path.join(output, 'particles.json')); files.push('particles.json'); }
    for (const track of audio.tracks.filter(track => (track.packageFile === 'battle_loop.mp3' ? 'battle' : 'base') === bundle)) { fs.copyFileSync(path.join(root, track.runtimeFile), path.join(output, track.packageFile)); files.push(track.packageFile); }
    const target = path.join(root, 'bundles', bundle);
    const project = path.resolve(root, '../project/LayaProject/assets/resources', bundle);
    // 只清除上一份受管清单内、现已退出运行的文件；源素材和不认识的文件不删除。
    const oldFiles = (previous?.bundles?.[bundle] || []).map(file => file.slice(('bundles/' + bundle + '/').length));
    for (const [dir, label] of [[target, 'res-' + bundle], ...(args.includes('--sync') ? [[project, 'game-' + bundle]] : [])]) {
        fs.mkdirSync(dir, { recursive: true });
        for (const file of oldFiles) if (relative(file) && !files.includes(file)) {
            const old = path.join(dir, file); backup(old, label + '/' + file); fs.rmSync(old, { force: true });
            backup(old + '.meta', label + '/' + file + '.meta'); fs.rmSync(old + '.meta', { force: true });
        }
        for (const file of files) { const dest = path.join(dir, file); backup(dest, label + '/' + file); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(path.join(output, file), dest); }
    }
    files.sort(); bundles[bundle] = files.map(file => `bundles/${bundle}/${file}`);
    contract[bundle] = { frames: Object.keys(frames).sort(), models: names[bundle], particles3D: effects[bundle] };
    report.push({ bundle, models: models.length, effects: data.effects.length, files: files.length, bytes: files.reduce((sum, file) => sum + fs.statSync(path.join(output, file)).size, 0) });
}
backup(previousFile, 'manifest.json');
const assets = Object.values(bundles).flat().map(file => ({ file, bytes: fs.statSync(path.join(root, file)).size, sha256: hash(path.join(root, file)) }));
write(previousFile, { version: 4, status: 'native_3d_and_hd_ui', preferredRuntimeMode: 'laya_native_3d', bundles, runtimeWhitelist: Object.values(bundles).flat(), assets, audio, source: 'editor/BuildingWorkshop/assets/world3d', verification: '../doc/tech/30_全场景3D与高清UI.md' });
fs.writeFileSync(path.resolve(root, '../project/LayaProject/src/config/ResourceManifest.ts'), '/** 由 res/tools/build-world3d-resources.mjs 生成；帧、模型与粒子完整性由主包契约校验。 */\nexport const RESOURCE_CONTRACT: Record<string, { frames: string[]; models: string[]; particles3D: string[] }> = ' + JSON.stringify(contract) + ';\n');
write(path.join(root, 'budget_report.json'), { mode: 'native_3d_and_hd_ui', generatedAt: new Date().toISOString(), resourceBundles: report, resourceBytes: assets.reduce((sum, asset) => sum + asset.bytes, 0), limitations: ['Resource bytes exclude Laya engine and game code', 'WeChat upload size and device performance require separate verification'] });
write(path.join(work, 'resource-build.json'), { bundles: report, nativeSource: native, sync: args.includes('--sync'), assets });
console.log(JSON.stringify({ bundles: report, sync: args.includes('--sync') }));
