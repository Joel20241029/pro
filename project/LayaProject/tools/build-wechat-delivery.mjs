import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const [version, workPath, laya, delivery = 'native'] = process.argv.slice(2);
if (!/^1\.0\.\d+$/.test(version ?? '') || !workPath || !laya || !['native', 'remote'].includes(delivery))
    throw new Error('用法：node tools/build-wechat-delivery.mjs <版本> <Downloads任务目录> <Laya CLI> [native|remote]');
const work = path.resolve(workPath);
if (!work.startsWith('/Users/happyelements/Downloads/')) throw new Error('构建中间文件放在 Downloads');
const source = fileURLToPath(new URL('..', import.meta.url)), repository = path.resolve(source, '../..');
const mirrorRoot = path.resolve(repository, '../remote-res');
const manifestPath = path.join(source, 'src/config/RemoteResourceManifest.ts');
const remote = JSON.parse(fs.readFileSync(manifestPath, 'utf8').match(/REMOTE_RESOURCE_MANIFEST = (.*) as const;/s)[1]);
const mirror = path.join(mirrorRoot, remote.version);
const stages = ['village', 'night'];
const release = 'src/config/ReleaseInfo.ts';
const json = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const digest = data => createHash('sha256').update(data).digest('hex');
fs.mkdirSync(work, { recursive: true });
const buildDir = fs.mkdtempSync(path.join(work, 'build-'));
const staging = path.join(buildDir, 'project');
fs.mkdirSync(staging);
for (const name of ['LayaProject.laya', 'assets', 'build-templates', 'engine', 'packages', 'settings', 'src', 'tsconfig.json'])
    fs.cpSync(path.join(source, name), path.join(staging, name), { recursive: true });
fs.mkdirSync(path.join(staging, 'local'));
const settingsPath = path.join(staging, 'settings/BuildSettings.json');
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
settings.outputPath = '{projectPath}/../output/{platform}';
if (delivery === 'native') {
    const gameplay = path.join(staging, 'assets/resources/gameplay');
    fs.rmSync(gameplay, { recursive: true, force: true });
    settings.subpackages = stages.map(stage => ({
        path: 'resources/gameplay/' + stage, packAllAssets: true, autoLoad: false, remote: false
    }));
    const replacements = new Set(Object.values(remote.files).flatMap(file => file.astcFor ? [file.astcFor] : []));
    for (const [name, entry] of Object.entries(remote.files)) {
        if (replacements.has(name)) continue;
        if (!stages.includes(entry.stage) || /\.(png|jpg)$/.test(name)) throw new Error('原生分包要求全部图集有 ASTC：' + name);
        const data = fs.readFileSync(path.join(mirror, name));
        if (data.length !== entry.bytes || digest(data) !== entry.sha256) throw new Error('本地资源与已校验版本不符：' + name);
        const target = path.join(gameplay, entry.stage, name);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, data);
    }
}
json(settingsPath, settings);
const inputs = [];
function collect(dir) {
    for (const entry of fs.readdirSync(path.join(staging, dir), { withFileTypes: true })) {
        const name = dir + '/' + entry.name;
        if (entry.isDirectory()) collect(name);
        else if (!name.endsWith('.meta') && !name.endsWith('.DS_Store') && name !== release) inputs.push(name);
    }
}
for (const dir of ['src', 'assets/resources', 'build-templates', 'settings']) collect(dir);
const rows = inputs.sort().map(name => [name, digest(fs.readFileSync(path.join(staging, name)))]);
const fingerprint = digest(JSON.stringify({ delivery, files: rows })), build = version + '-' + fingerprint.slice(0, 12);
const releaseSource = '/** 客户端诊断标识，构建指纹覆盖实际配送方式、代码和资源。 */\n' +
    `export const RELEASE = { version: "${version}", build: "${build}" } as const;\n`;
fs.writeFileSync(path.join(staging, release), releaseSource);
json(path.join(work, 'source-inputs.json'), { delivery, build, fingerprint, files: rows });
fs.mkdirSync(path.join(buildDir, 'tmp'));
const compiled = spawnSync(laya, ['build', 'wxgame', '-p', staging], {
    stdio: 'inherit', env: { ...process.env, TMPDIR: path.join(buildDir, 'tmp') }
});
if (compiled.error || compiled.status !== 0) throw compiled.error ?? new Error('Laya 微信导出失败');
const output = path.join(buildDir, 'output/wxgame');
const verify = spawnSync(process.execPath, [path.join(source, 'tools/check-wechat-package.mjs'),
    output, path.join(work, 'package-report.json'), output + '-remote', build], { stdio: 'inherit' });
if (verify.error || verify.status !== 0) throw verify.error ?? new Error('微信导出校验失败');
const publish = (generated, destination) => {
    const backup = path.join(buildDir, path.basename(destination) + '-previous');
    if (fs.existsSync(destination)) fs.renameSync(destination, backup);
    try { fs.renameSync(generated, destination); }
    catch (error) {
        if (fs.existsSync(backup)) fs.renameSync(backup, destination);
        throw error;
    }
};
const official = path.join(repository, 'tryVersion/wxgame');
publish(output, official);
if (delivery === 'remote') publish(output + '-remote', official + '-remote');
fs.writeFileSync(path.join(source, release), releaseSource);
console.log(JSON.stringify({ delivery, build, output: official, buildDir }));
