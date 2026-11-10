import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// 首版完整单包内部目标来自技术设计；原始字节不是平台上传压缩体积。
const TARGET_BYTES = 3_500_000;
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
if (game.subpackages?.length || game.subPackages?.length || game.plugins) errors.push('出现分包或引擎插件');
if (project.compileType !== 'game' || project.appid !== 'wx46e59dc5dc95b52f') errors.push('微信项目类型或 AppID 不符');
if (config.pkgs.length !== 1 || config.pkgs[0].path !== '' || config.pkgs[0].remoteUrl) errors.push('出现额外包或远程资源地址');
const actualResources = files.filter(f => f.path.startsWith('resources/village/')).map(f => f.path).sort();
const atlas = JSON.parse(fs.readFileSync(path.join(root, 'resources/village/frames.json'), 'utf8'));
const expectedResources = ['animations.json', 'frames.json', ...atlas.pages.map(p => p.runtimeFile)].map(f => 'resources/village/' + f).sort();
if (atlas.pages.some(p => !/^(world|ui)_\d+\.png$/.test(p.runtimeFile))) errors.push('页表包含非本地图集文件');
if (JSON.stringify(actualResources) !== JSON.stringify(expectedResources)) errors.push('村落资源白名单不符');
const total = files.reduce((n, f) => n + f.bytes, 0);
if (total > TARGET_BYTES) errors.push('超过内部完整单包目标');
if (files.some(f => /\.(map|ts|gif)$/.test(f.path) || /(^|\/)(source|preview)\//.test(f.path))) errors.push('包含开发源文件或预览素材');
const grouped = { engineAndAdapter: 0, businessAndStartup: 0, artAndMetadata: 0, other: 0 };
for (const f of files) {
    const group = f.path.startsWith('libs/') || f.path === 'weapp-adapter.js' ? 'engineAndAdapter' : f.path.startsWith('js/') || f.path === 'game.js' ? 'businessAndStartup' : f.path.startsWith('resources/village/') ? 'artAndMetadata' : 'other';
    grouped[group] += f.bytes;
}
const report = { createdAt: new Date().toISOString(), root, rawDirectoryBytes: total, internalTargetBytes: TARGET_BYTES, remainingToTarget: TARGET_BYTES - total, platformUploadBytes: null, platformUploadStatus: 'not_uploaded', grouped, errors, files };
fs.mkdirSync(path.dirname(path.resolve(reportPath)), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ bytes: total, remaining: TARGET_BYTES - total, grouped, errors }));
if (errors.length) process.exitCode = 1;
