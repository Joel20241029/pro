import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { prepareNativeSubpackages } from '../../../res/tools/prepare-native-subpackages.mjs';

const [version, workPath, laya, extra] = process.argv.slice(2);
if (!/^1\.0\.\d+$/.test(version ?? '') || !workPath || !laya || extra !== undefined)
    throw new Error('用法：node tools/build-wechat-delivery.mjs <版本> <Downloads任务目录> <Laya CLI>');
const work = path.resolve(workPath);
if (!work.startsWith('/Users/happyelements/Downloads/')) throw new Error('构建中间文件放在 Downloads');
const source = fileURLToPath(new URL('..', import.meta.url)), repository = path.resolve(source, '../..');
const delivery = 'native';
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
const gameplay = path.join(staging, 'assets/resources/gameplay');
fs.rmSync(gameplay, { recursive: true, force: true });
prepareNativeSubpackages(path.join(repository, 'res'), path.join(source, 'assets/resources/gameplay'), gameplay);
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
    output, path.join(work, 'package-report.json'), path.join(work, 'source-inputs.json')], { stdio: 'inherit' });
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
fs.writeFileSync(path.join(source, release), releaseSource);
console.log(JSON.stringify({ delivery, build, output: official, buildDir }));
