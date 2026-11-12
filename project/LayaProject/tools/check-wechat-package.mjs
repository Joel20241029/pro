import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// 延用技术设计的完整内容预算，分包不扩大总预算；原始字节不是平台上传压缩体积。
const TARGET_BYTES = 3_500_000;
// 与 BuildSettings.subpackages.path、SpriteFrames 的资源根目录一致；改名须同步三处并重新导出。
const VILLAGE_PACKAGE = 'resources/village';
const VILLAGE_PREFIX = VILLAGE_PACKAGE + '/';
const [directory, reportPath] = process.argv.slice(2);
if (!directory || !reportPath) throw new Error('用法：node tools/check-wechat-package.mjs <微信导出目录> <Downloads 内的报告路径>');
const root = path.resolve(directory);
const files = [];
function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(file);
        else if (entry.isFile()) {
            const data = fs.readFileSync(file);
            files.push({ path: path.relative(root, file).split(path.sep).join('/'), bytes: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex') });
        }
    }
}
walk(root);
const game = JSON.parse(fs.readFileSync(path.join(root, 'game.json'), 'utf8'));
const project = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'));
const index = fs.readFileSync(path.join(root, 'js/index.js'), 'utf8');
const match = index.match(/JSON\.parse\(`(.*?)`\)/s);
if (!match) throw new Error('发布器启动配置格式变化，请重新检查，不跳过校验');
const config = JSON.parse(match[1]);
const errors = [];
if (game.deviceOrientation !== 'portrait') errors.push('不是竖屏');
if (game.plugins) errors.push('出现引擎插件');
if (game.subPackages || game.subpackages?.length !== 1 || game.subpackages[0].name !== VILLAGE_PACKAGE || game.subpackages[0].root !== VILLAGE_PREFIX || game.subpackages[0].independent) errors.push('微信原生村庄分包声明不符');
if (game.openDataContext !== 'openDataContext') errors.push('未声明本地开放数据域');
// 制作源与出包逐文件比对，避免 IDE 默认的随机示例排行榜覆盖正式实现。
const openSource = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../build-templates/wxgame/openDataContext');
const openFiles = ['engine.js', 'index.js', 'score-store.js', 'render.js', 'LICENSE'];
if (files.some(f => f.path.startsWith('openDataContext/') && !openFiles.includes(f.path.slice('openDataContext/'.length)))) errors.push('开放域含未使用的示例文件');
for (const name of openFiles) {
    const source = fs.readFileSync(path.join(openSource, name));
    const output = files.find(f => f.path === 'openDataContext/' + name);
    if (!output || output.sha256 !== crypto.createHash('sha256').update(source).digest('hex')) errors.push('开放域制作源与出包不一致：' + name);
}
if (project.compileType !== 'game' || project.appid !== 'wx46e59dc5dc95b52f') errors.push('微信项目类型或 AppID 不符');
if (config.pkgs.length !== 2 || config.pkgs.filter(p => p.path === '' && p.autoLoad === true).length !== 1 || config.pkgs.filter(p => p.path === VILLAGE_PACKAGE && !p.autoLoad).length !== 1 || config.pkgs.some(p => p.remoteUrl)) errors.push('启动包配置不符：必须仅主包自动加载，村庄包由 Main 加载，禁止远程地址');
const actualResources = files.filter(f => f.path.startsWith(VILLAGE_PREFIX)).map(f => f.path).sort();
const atlas = JSON.parse(fs.readFileSync(path.join(root, VILLAGE_PREFIX + 'frames.json'), 'utf8'));
const audio = JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../res/audio/manifest.json'), 'utf8'));
// 已确认的三轨预算：原村庄曲≤120KB，夜战与点击新增合计≤80KB；与制作源清单逐字节核对。
const AUDIO_NAMES = ['battle_loop.mp3', 'ui_click.mp3', 'village_loop.mp3'];
if (JSON.stringify(audio.tracks.map(t => t.packageFile).sort()) !== JSON.stringify(AUDIO_NAMES) || audio.tracks.filter(t => t.packageFile !== 'village_loop.mp3').reduce((sum,t) => sum+t.bytes,0) > 80000 || audio.tracks.find(t => t.packageFile === 'village_loop.mp3')?.bytes > 120000) errors.push('音频资源名或体积不符');
const artFiles = ['animations.json', 'frames.json', ...atlas.pages.map(p => p.runtimeFile), ...audio.tracks.map(t => t.packageFile)];
// game.js、fileconfig.json 由 Laya 发布器生成，不属于原图/动画资源白名单。
const expectedResources = [...artFiles, 'game.js', 'fileconfig.json'].map(f => VILLAGE_PREFIX + f).sort();
if (atlas.pages.some(p => !/^(world|ui)_\d+\.png$/.test(p.runtimeFile))) errors.push('页表包含非本地图集文件');
if (JSON.stringify(actualResources) !== JSON.stringify(expectedResources)) errors.push('村落资源白名单不符');
const mainConfig = JSON.parse(fs.readFileSync(path.join(root, 'fileconfig.json'), 'utf8'));
const villageConfig = JSON.parse(fs.readFileSync(path.join(root, VILLAGE_PREFIX + 'fileconfig.json'), 'utf8'));
const mainConfigFiles = Object.entries(mainConfig.files).flatMap(([dir, names]) => names.map(name => (dir ? dir + '/' : '') + name));
const villageConfigFiles = Object.entries(villageConfig.files).flatMap(([dir, names]) => names.map(name => (dir ? dir + '/' : '') + name)).sort();
if (mainConfigFiles.some(f => f.startsWith(VILLAGE_PREFIX))) errors.push('主包 fileconfig 仍引用分包资源');
// Laya 3.4.2 实际导出：fileconfig只登记需纹理导入配置的PNG；JSON/原生MP3按包内路径读取。
if (JSON.stringify(villageConfigFiles) !== JSON.stringify(atlas.pages.map(p => VILLAGE_PREFIX + p.runtimeFile).sort())) errors.push('分包纹理配置与页表不符');
const artSource = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets', VILLAGE_PACKAGE);
for (const name of artFiles) {
    const sourceHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(artSource, name))).digest('hex');
    const track = audio.tracks.find(t => t.packageFile === name);
    if (track && sourceHash !== track.sha256) errors.push('音频导入文件与原始清单不一致：' + name);
    if (files.find(f => f.path === VILLAGE_PREFIX + name)?.sha256 !== sourceHash) errors.push('分包素材与工程资源不一致：' + name);
    if (files.some(f => !f.path.startsWith(VILLAGE_PREFIX) && f.sha256 === sourceHash)) errors.push('主包含重复的村庄素材：' + name);
}
const total = files.reduce((n, f) => n + f.bytes, 0);
const subpackageBytes = files.filter(f => f.path.startsWith(VILLAGE_PREFIX)).reduce((n, f) => n + f.bytes, 0);
const mainPackageBytes = total - subpackageBytes;
if (total > TARGET_BYTES) errors.push('主包加分包超过内部完整内容预算');
if (files.some(f => /\.(map|ts|gif)$/.test(f.path) || /(^|\/)(source|preview)\//.test(f.path))) errors.push('包含开发源文件或预览素材');
const grouped = { engineAndAdapter: 0, businessAndStartup: 0, artAndMetadata: 0, other: 0 };
for (const f of files) {
    const group = f.path.startsWith('libs/') || f.path === 'weapp-adapter.js' ? 'engineAndAdapter' : f.path.startsWith('js/') || f.path === 'game.js' ? 'businessAndStartup' : f.path.startsWith('resources/village/') ? 'artAndMetadata' : 'other';
    grouped[group] += f.bytes;
}
const report = { createdAt: new Date().toISOString(), root, rawDirectoryBytes: total, rawMainPackageBytes: mainPackageBytes, subpackages: [{ name: VILLAGE_PACKAGE, root: VILLAGE_PREFIX, rawBytes: subpackageBytes }], internalTargetBytes: TARGET_BYTES, remainingToTarget: TARGET_BYTES - total, platformUploadBytes: null, platformUploadStatus: 'not_uploaded', grouped, errors, files };
fs.mkdirSync(path.dirname(path.resolve(reportPath)), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ bytes: total, mainPackageBytes, subpackageBytes, remaining: TARGET_BYTES - total, grouped, errors }));
if (errors.length) process.exitCode = 1;
