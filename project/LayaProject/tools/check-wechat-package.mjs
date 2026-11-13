import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
// 高清四包规格。微信普通分包无独立4MiB上限，主包4MiB、合计30MiB；详见doc/tech/32。
// 此处保守用目录原始字节校验，微信工具上传压缩量另记，不能混作同一数据。
const BUDGET = { main: 4 * 1024 * 1024, total: 30 * 1024 * 1024 };
const [directory, reportPath] = process.argv.slice(2);
if (!directory || !reportPath) throw new Error('用法：node tools/check-wechat-package.mjs <微信导出目录> <Downloads内报告路径>');
const root = path.resolve(directory), projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resRoot = path.resolve(projectRoot, '../../res'), files = [], errors = [];
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function walk(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const file = path.join(dir, entry.name); if (entry.isDirectory()) walk(file); else if (entry.isFile()) files.push({ path: path.relative(root, file).split(path.sep).join('/'), bytes: fs.statSync(file).size, sha256: hash(file) }); } }
walk(root);
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const game = read('game.json'), project = read('project.config.json');
const boot = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
for (const module of ['laya.d3', 'laya.webgl_3D', 'laya.particleCommon', 'laya.particle', 'laya.particle3D']) if (files.some(f => f.path === `libs/${module}.js`) || boot.includes(`require("libs/${module}.js")`)) errors.push('高清二维包残留3D或粒子模块：' + module);
const index = fs.readFileSync(path.join(root, 'js/index.js'), 'utf8'), match = index.match(/JSON\.parse\(`(.*?)`\)/s);
if (!match) throw new Error('发布器启动配置格式变化，必须重新检查');
const config = JSON.parse(match[1]);
if (game.deviceOrientation !== 'portrait' || game.plugins) errors.push('必须竖屏且不使用引擎插件');
if (game.openDataContext !== 'openDataContext') errors.push('未声明本地开放数据域');
if (project.compileType !== 'game' || project.appid !== 'wx46e59dc5dc95b52f') errors.push('微信项目类型或AppID不符');
const nativeBundles = ['buildings', 'characters', 'battle'];
if (game.subPackages || game.subpackages?.length !== 3 || nativeBundles.some(name => !game.subpackages?.some(p => p.name === 'resources/' + name && p.root === 'resources/' + name + '/' && !p.independent))) errors.push('必须声明建筑、人物和战斗三个普通原生分包');
if (config.pkgs.length !== 4 || config.pkgs.filter(p => p.path === '' && p.autoLoad === true).length !== 1 || nativeBundles.some(name => !config.pkgs.some(p => p.path === 'resources/' + name && !p.autoLoad)) || config.pkgs.some(p => p.remoteUrl)) errors.push('只有主包自动加载；三分包按时机手动加载，禁止远程URL');
const openFiles = ['engine.js', 'index.js', 'score-store.js', 'render.js', 'LICENSE'];
if (files.some(f => f.path.startsWith('openDataContext/') && !openFiles.includes(path.basename(f.path)))) errors.push('开放域含未使用示例文件');
for (const name of openFiles) if (files.find(f => f.path === 'openDataContext/' + name)?.sha256 !== hash(path.join(projectRoot, 'build-templates/wxgame/openDataContext', name))) errors.push('开放域与制作源不一致：' + name);
const manifest = JSON.parse(fs.readFileSync(path.join(resRoot, 'manifest.json'))), audio = manifest.audio;
if (manifest.version !== 3 || manifest.preferredRuntimeMode !== 'atlas_plus_audio') errors.push('必须使用二维图集与动画资源清单');
const mainConfig = read('fileconfig.json');
const configFiles = data => Object.entries(data.files).flatMap(([dir, names]) => names.map(name => (dir ? dir + '/' : '') + name)).sort();
const mainFiles = configFiles(mainConfig);
// 本项目3.4.2把编辑器二维动画发布为.mc.bin；字节与源.mc一致，加载器自动补后缀。
const exportedName = name => name.endsWith('.mc') ? name + '.bin' : name;
for (const bundle of ['base', ...nativeBundles]) {
    const prefix = 'resources/' + bundle + '/', sourcePrefix = 'bundles/' + bundle + '/';
    const names = manifest.bundles[bundle].map(file => file.slice(sourcePrefix.length));
    const expected = [...names.map(exportedName), ...(bundle === 'base' ? [] : ['game.js', 'fileconfig.json'])].map(name => prefix + name).sort();
    const actual = files.filter(file => file.path.startsWith(prefix)).map(file => file.path).sort();
    if (JSON.stringify(expected) !== JSON.stringify(actual)) errors.push('包内白名单不一致：' + bundle + ' / missing=' + expected.filter(f => !actual.includes(f)).slice(0, 5) + ' / extra=' + actual.filter(f => !expected.includes(f)).slice(0, 5));
    const atlas = read(prefix + 'frames.json'), animations = read(prefix + 'animations.json');
    if (atlas.bundle !== bundle || !atlas.pages?.length || !Array.isArray(animations.animations)) errors.push('二维资源清单不完整或跨包：' + bundle);
    for (const page of atlas.pages) if (!files.some(file => file.path === prefix + page.runtimeFile)) errors.push('图集页缺失：' + page.runtimeFile);
    for (const clip of animations.animations) if (!clip.frameIds?.length || clip.frameIds.some(id => !atlas.frames[id])) errors.push('动画帧缺失：' + clip.id);
    if (bundle !== 'base' && mainFiles.some(f => f.startsWith(prefix))) errors.push('主包仍引用分包资产：' + bundle);
    for (const name of names) {
        const source = path.join(projectRoot, 'assets', prefix, name), sourceHash = hash(source), expectedPath = prefix + exportedName(name);
        if (sourceHash !== hash(path.join(resRoot, 'bundles', bundle, name))) errors.push('制作资源未同步：' + name);
        if (files.find(f => f.path === expectedPath)?.sha256 !== sourceHash) errors.push('资源与导出不一致：' + expectedPath);
    }
}
if (audio.tracks.filter(t => t.packageFile !== 'village_loop.mp3').reduce((n,t) => n+t.bytes,0) > 80000 || audio.tracks.find(t => t.packageFile === 'village_loop.mp3')?.bytes > 120000) errors.push('音频超出紧凑预算');
const total = files.reduce((n,f) => n + f.bytes, 0);
const subpackages = nativeBundles.map(name => ({ name: 'resources/' + name, root: 'resources/' + name + '/', rawBytes: files.filter(f => f.path.startsWith('resources/' + name + '/')).reduce((n,f) => n+f.bytes,0) }));
const mainPackageBytes = total - subpackages.reduce((n,p) => n+p.rawBytes,0);
if (mainPackageBytes > BUDGET.main || total > BUDGET.total) errors.push('超出主包或合计容量限制');
if (files.some(f => /\.(map|ts|gif|glb|blend|lh|lm|lani|lmat)$/.test(f.path) || /(^|\/)(source|preview|village|world3d)\//.test(f.path))) errors.push('包含开发源、3D模型或预览资源');
const report = { createdAt: new Date().toISOString(), root, rawDirectoryBytes: total, rawMainPackageBytes: mainPackageBytes, subpackages, internalBudgets: BUDGET, platformUploadBytes: null, platformUploadStatus: 'not_uploaded', errors: [...new Set(errors)], files };
fs.mkdirSync(path.dirname(path.resolve(reportPath)), { recursive: true }); fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ bytes: total, mainPackageBytes, subpackages, errors: report.errors }));
if (errors.length) process.exitCode = 1;
