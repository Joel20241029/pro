import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
// 首屏在微信主包，其他运行素材从 GitHub 下载。仅微信目录占用平台包体。
// 此处保守用目录原始字节校验，微信工具上传压缩量另记，不能混作同一数据。
const BUDGET = { main: 4 * 1024 * 1024, total: 30 * 1024 * 1024 };
const [directory, reportPath, remoteDirectory] = process.argv.slice(2);
if (!directory || !reportPath) throw new Error('用法：node tools/check-wechat-package.mjs <微信导出目录> <Downloads内报告路径> [Laya 远程导出目录]');
const root = path.resolve(directory), projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const remoteRoot = path.resolve(remoteDirectory || root + '-remote');
const resRoot = path.resolve(projectRoot, '../../res'), files = [], remoteFiles = [], errors = [];
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function walk(dir, base, list) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const file = path.join(dir, entry.name); if (entry.isDirectory()) walk(file, base, list); else if (entry.isFile()) list.push({ path: path.relative(base, file).split(path.sep).join('/'), bytes: fs.statSync(file).size, sha256: hash(file) }); } }
walk(root, root, files);
walk(remoteRoot, remoteRoot, remoteFiles);
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
if (game.subPackages?.length || game.subpackages?.length) errors.push('微信包残留原生分包');
if (config.pkgs.length !== 2 || config.pkgs.filter(p => p.path === '' && p.autoLoad === true).length !== 1 ||
    !config.pkgs.some(p => p.path === 'resources/gameplay' && !p.autoLoad) || config.pkgs.some(p => p.remoteUrl))
    errors.push('只有主包自动加载，游戏素材按两个阶段准备');
if (project.setting?.urlCheck !== true) errors.push('微信导出需启用资源域名校验');
const openFiles = ['engine.js', 'index.js', 'score-store.js', 'render.js', 'LICENSE'];
if (files.some(f => f.path.startsWith('openDataContext/') && !openFiles.includes(path.basename(f.path)))) errors.push('开放域含未使用示例文件');
for (const name of openFiles) if (files.find(f => f.path === 'openDataContext/' + name)?.sha256 !== hash(path.join(projectRoot, 'build-templates/wxgame/openDataContext', name))) errors.push('开放域与制作源不一致：' + name);
const manifest = JSON.parse(fs.readFileSync(path.join(resRoot, 'manifest.json')));
if (manifest.version !== 4 || manifest.preferredRuntimeMode !== 'atlas_plus_audio') errors.push('必须使用二维图集与动画资源清单');
const clientSource = fs.readFileSync(path.join(projectRoot, 'src/config/RemoteResourceManifest.ts'), 'utf8');
const client = JSON.parse(clientSource.match(/export const REMOTE_RESOURCE_MANIFEST = (.*) as const;/s)[1]);
const bundleCode = fs.readFileSync(path.join(root, 'js/bundle.js'), 'utf8');
if (!/^[a-f0-9]{40}$/.test(client.revision) || !bundleCode.includes(client.revision)) errors.push('客户端与导出包的资源提交不一致');
const mainConfig = read('fileconfig.json');
const configFiles = data => Object.entries(data.files).flatMap(([dir, names]) => names.map(name => (dir ? dir + '/' : '') + name));
const mainFiles = configFiles(mainConfig);
const launcher = 'resources/launcher.jpg';
const launcherAsset = files.find(file => file.path === launcher);
if (!mainFiles.includes(launcher) || launcherAsset?.sha256 !== hash(path.join(projectRoot, 'assets', launcher)))
    errors.push('主包启动图缺失或与工程字节不一致');
const allowedMain = new Set([launcher, 'resources/layaAir.png']);
if ([...mainFiles, ...files.map(file => file.path)].some(file => file.startsWith('resources/') && !allowedMain.has(file)))
    errors.push('主包包含需要按阶段下载的资源');
const filesByPath = new Map(remoteFiles.map(file => [file.path, file]));
const exported = file => prefix + file + (file.endsWith('.mc') ? '.bin' : '');
const expectedRemote = [...Object.keys(client.files).map(exported), prefix + 'fileconfig.json', prefix + 'game.js'].sort();
if (JSON.stringify(expectedRemote) !== JSON.stringify([...filesByPath.keys()].sort()))
    errors.push('Laya 包外素材与版本清单不一致');
if (Object.keys(client.files).length !== manifest.runtimeWhitelist.length) errors.push('客户端远程资源清单过期');
const remote = [];
for (const [stage, paths] of Object.entries(manifest.stages)) {
    const table = read(prefix + (stage === 'village' ? 'map' : 'enemies') + '/frames.json', remoteRoot);
    const animations = read(prefix + (stage === 'village' ? 'characters' : 'enemies') + '/animations.json', remoteRoot);
    if (table.stage !== stage || !table.pages.length || table.pages.some(page => client.files[page.runtimeFile]?.stage !== stage))
        errors.push('图集页的阶段归属不一致：' + stage);
    for (const clip of animations.animations)
        if (!table.frames[clip.restFrame] || !clip.frameIds.every(id => table.frames[id])) errors.push('动画帧缺失：' + clip.id);
    let bytes = 0;
    for (const bundled of paths) {
        const file = bundled.slice('bundles/'.length), item = client.files[file];
        const source = path.join(projectRoot, 'assets', prefix, file), sourceHash = hash(source);
        if (hash(path.join(resRoot, bundled)) !== sourceHash || filesByPath.get(exported(file))?.sha256 !== sourceHash)
            errors.push('制作素材、工程或包外导出不一致：' + file);
        const mirror = path.resolve(resRoot, '../remoteRes', client.version, file);
        if (item?.stage !== stage || item.sha256 !== sourceHash || item.bytes !== fs.statSync(source).size || hash(mirror) !== sourceHash)
            errors.push('GitHub 版本内容与导出不一致：' + file);
        if (!client.sources[item?.source]?.endsWith('/' + client.revision + '/remoteRes/' + client.version + '/'))
            errors.push('下载地址未绑定版本和提交：' + file);
        bytes += fs.statSync(source).size;
    }
    remote.push({ stage, files: paths.length, bytes });
}
const release = fs.readFileSync(path.join(projectRoot, 'src/config/ReleaseInfo.ts'), 'utf8');
if (release.match(/version: "([^"]+)"/)?.[1] !== client.version) errors.push('微信包与远程资源版本不一致');
const total = files.reduce((n,f) => n + f.bytes, 0);
const mainPackageBytes = total;
if (mainPackageBytes > BUDGET.main || total > BUDGET.total) errors.push('超出主包或合计容量限制');
if (files.some(f => /\.(map|ts|gif|glb|blend|lh|lm|lani|lmat)$/.test(f.path) || /(^|\/)(source|preview|village|world3d)\//.test(f.path))) errors.push('包含开发源、3D模型或预览资源');
const report = { createdAt: new Date().toISOString(), root, remoteRoot, rawDirectoryBytes: total, rawMainPackageBytes: mainPackageBytes, remoteVersion: client.version, remoteRevision: client.revision, launcher: launcherAsset, remote, internalBudgets: BUDGET, platformUploadBytes: null, platformUploadStatus: 'not_uploaded', errors: [...new Set(errors)], files };
fs.mkdirSync(path.dirname(path.resolve(reportPath)), { recursive: true }); fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ bytes: total, mainPackageBytes, remote, errors: report.errors }));
if (errors.length) process.exitCode = 1;
