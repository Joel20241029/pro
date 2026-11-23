import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { nativeResourcePlan, stages, verifyAstcPage } from '../../../res/tools/prepare-native-subpackages.mjs';
// 首屏在微信主包，其余运行素材由微信按阶段下载。
// 此处保守用目录原始字节校验，微信工具上传压缩量另记，不能混作同一数据。
const BUDGET = { main: 4 * 1024 * 1024, total: 30 * 1024 * 1024 };
const [directory, reportPath, inputsPath] = process.argv.slice(2);
if (!directory || !reportPath) throw new Error('用法：node tools/check-wechat-package.mjs <微信导出目录> <Downloads内报告路径> [构建输入记录]');
const root = path.resolve(directory), projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resRoot = path.resolve(projectRoot, '../../res'), files = [], errors = [];
const inputs = inputsPath ? JSON.parse(fs.readFileSync(inputsPath, 'utf8')) : null;
const digests = new Map(inputs?.files);
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function walk(dir, base, list) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const file = path.join(dir, entry.name); if (entry.isDirectory()) walk(file, base, list); else if (entry.isFile()) list.push({ path: path.relative(base, file).split(path.sep).join('/'), bytes: fs.statSync(file).size, sha256: hash(file) }); } }
walk(root, root, files);

const read = (file, dir = root) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
const game = read('game.json'), project = read('project.config.json');
const boot = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
for (const module of ['laya.d3', 'laya.webgl_3D', 'laya.particleCommon', 'laya.particle', 'laya.particle3D']) if (files.some(f => f.path === `libs/${module}.js`) || boot.includes(`require("libs/${module}.js")`)) errors.push('高清二维包残留3D或粒子模块：' + module);
const index = fs.readFileSync(path.join(root, 'js/index.js'), 'utf8'), match = index.match(/JSON\.parse\(`(.*?)`\)/s);
if (!match) throw new Error('发布器启动配置格式变化，必须重新检查');
const config = JSON.parse(match[1]);
if (game.deviceOrientation !== 'portrait' || game.plugins) errors.push('必须竖屏且不使用引擎插件');
if (game.openDataContext !== 'openDataContext') errors.push('未声明本地开放数据域');
if (project.compileType !== 'game' || project.appid !== 'wx46e59dc5dc95b52f') errors.push('微信项目类型或AppID不符');
const prefix = 'resources/gameplay/';
const nativePackages = game.subpackages ?? game.subPackages ?? [];
const roots = Object.fromEntries(stages.map(stage => [stage, prefix + stage]));
const expectedRoots = Object.values(roots);
const mainPackage = files.filter(file => !expectedRoots.some(root => file.path.startsWith(root + '/')));
if (config.pkgs.length !== expectedRoots.length + 1 || config.pkgs.filter(p => p.path === '' && p.autoLoad === true).length !== 1 ||
    !expectedRoots.every(root => config.pkgs.some(p => p.path === root && !p.autoLoad)) || config.pkgs.some(p => p.remoteUrl))
    errors.push('只有主包自动加载，游戏素材按两个阶段准备');
if (nativePackages.length !== expectedRoots.length || !expectedRoots.every(root => nativePackages.some(pack =>
    pack.name === root && pack.root.replace(/\/$/, '') === root && !pack.independent))) errors.push('微信原生分包声明不一致');
if (project.setting?.urlCheck !== true) errors.push('微信导出需启用资源域名校验');
const openFiles = ['engine.js', 'index.js', 'score-store.js', 'render.js', 'LICENSE'];
if (files.some(f => f.path.startsWith('openDataContext/') && !openFiles.includes(path.basename(f.path)))) errors.push('开放域含未使用示例文件');
for (const name of openFiles) if (files.find(f => f.path === 'openDataContext/' + name)?.sha256 !== hash(path.join(projectRoot, 'build-templates/wxgame/openDataContext', name))) errors.push('开放域与制作源不一致：' + name);
const manifest = JSON.parse(fs.readFileSync(path.join(resRoot, 'manifest.json')));
const plan = nativeResourcePlan(resRoot);
const bundleCode = fs.readFileSync(path.join(root, 'js/bundle.js'), 'utf8');
if (bundleCode.includes('gitee.com/sun-wen-sky/remote-res') || bundleCode.includes('raw.giteeusercontent.com'))
    errors.push('客户端包含已停用的资源服务器地址');
const mainConfig = read('fileconfig.json');
const configFiles = data => Object.entries(data.files).flatMap(([dir, names]) => names.map(name => (dir ? dir + '/' : '') + name));
const mainFiles = configFiles(mainConfig);
const launcher = 'resources/launcher.jpg';
const launcherAsset = files.find(file => file.path === launcher);
if (!mainFiles.includes(launcher) || launcherAsset?.sha256 !== hash(path.join(projectRoot, 'assets', launcher)))
    errors.push('主包启动图缺失或与工程字节不一致');
const audioPaths = manifest.mainAudio.map(file => file.replace(/^bundles\//, 'resources/'));
const allowedMain = new Set([launcher, 'resources/layaAir.png', ...audioPaths]);
for (const file of audioPaths) {
    if (files.find(entry => entry.path === file)?.sha256 !== hash(path.join(projectRoot, 'assets', file)))
        errors.push('主包音频缺失或与工程不一致：' + file);
}
if ([...mainFiles, ...mainPackage.map(file => file.path)].some(file => file.startsWith('resources/') && !allowedMain.has(file)))
    errors.push('主包包含需要按阶段下载的资源');
const nativeStats = [];
for (const [stage, dir] of Object.entries(roots)) {
    const expected = plan.filter(item => item.stage === stage);
    const packageFiles = files.filter(file => file.path.startsWith(dir + '/'));
    const byPath = new Map(packageFiles.map(file => [file.path, file]));
    const names = new Set(byPath.keys());
    const metadata = read(dir + '/fileconfig.json');
    const recordedTextures = new Set(configFiles(metadata));
    for (const item of expected) {
        const local = dir + '/' + item.output;
        // Laya 发布器为原生帧动画文件附加二进制后缀。
        const name = local + (item.output.endsWith('.mc') ? '.bin' : '');
        const packed = byPath.get(name);
        const expectedHash = inputs ? digests.get('assets/' + local) : item.page ? null : hash(path.join(resRoot, item.bundled));
        if (!packed || (expectedHash && packed.sha256 !== expectedHash) || (inputs && !expectedHash))
            errors.push('原生分包文件或哈希不符：' + name);
        else if (item.page) {
            try { verifyAstcPage(fs.readFileSync(path.join(root, name)), item); }
            catch (error) { errors.push(error.message); }
            if (!recordedTextures.has(name)) errors.push('未注册 ASTC 图页：' + name);
        }
        names.delete(name);
    }
    for (const name of ['game.js', 'fileconfig.json']) if (!names.delete(dir + '/' + name)) errors.push('原生分包缺少入口：' + dir);
    if (names.size) errors.push('原生分包含多余文件：' + [...names].join(','));
    const category = stage === 'village' ? 'map' : 'enemies';
    const table = read(dir + '/' + category + '/frames.bin');
    const animations = read(dir + '/' + (stage === 'village' ? 'characters' : 'enemies') + '/animations.bin');
    const stagePages = new Set(expected.filter(item => item.page).map(item => item.source));
    if (table.stage !== stage || table.pages.length !== stagePages.size || !table.pages.every(page => stagePages.delete(page.runtimeFile)))
        errors.push('原生图集页阶段归属不一致：' + stage);
    for (const clip of animations.animations)
        if (!table.frames[clip.restFrame] || !clip.frameIds.every(id => table.frames[id])) errors.push('动画帧缺失：' + clip.id);
    nativeStats.push({ stage, root: dir, files: packageFiles.length, bytes: packageFiles.reduce((sum, file) => sum + file.bytes, 0) });
}
const release = fs.readFileSync(path.join(projectRoot, 'src/config/ReleaseInfo.ts'), 'utf8');
const build = inputs?.build || release.match(/build: "([^"]+)"/)?.[1];
if (!build || !bundleCode.includes(build)) errors.push('微信包与源码构建指纹不一致');
const total = files.reduce((n,f) => n + f.bytes, 0);
const mainPackageBytes = mainPackage.reduce((n, f) => n + f.bytes, 0);
if (mainPackageBytes > BUDGET.main || total > BUDGET.total) errors.push('超出主包或合计容量限制');
if (files.some(f => /\.(map|ts|gif|glb|blend|lh|lm|lani|lmat)$/.test(f.path) || /(^|\/)(source|preview|world3d)\//.test(f.path))) errors.push('包含开发源、3D模型或预览资源');
const report = { createdAt: new Date().toISOString(), root, build, delivery: 'native', native: nativeStats, rawDirectoryBytes: total,
    rawMainPackageBytes: mainPackageBytes, launcher: launcherAsset, internalBudgets: BUDGET, platformUploadBytes: null,
    platformUploadStatus: 'not_uploaded', errors: [...new Set(errors)], files };
fs.mkdirSync(path.dirname(path.resolve(reportPath)), { recursive: true }); fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ bytes: total, mainPackageBytes, native: nativeStats, errors: report.errors }));
if (errors.length) process.exitCode = 1;
