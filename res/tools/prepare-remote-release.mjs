import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const [version, revision, mode] = process.argv.slice(2);
if (!/^1\.0\.(?:0|[1-9]\d*)$/.test(version || '') ||
    (revision !== '--stage' && !/^[a-f0-9]{40}$/.test(revision || '')) ||
    (mode && (revision === '--stage' || mode !== '--write'))) {
    throw new Error('用法：node res/tools/prepare-remote-release.mjs <版本号> --stage | <版本号> <已推送的提交 SHA> [--write]');
}
// 新版本发布到项目旁的独立 Gitee 仓库，旧包继续使用自己的提交与下载地址。
const remoteRoot = path.resolve(root, '../remote-res');
const repositoryUrl = 'https://gitee.com/sun-wen-sky/remote-res';
const downloadOrigins = new Set([new URL(repositoryUrl).origin, 'https://raw.giteeusercontent.com']);
if (fs.realpathSync(remoteRoot) !== remoteRoot) throw new Error('远程资源根目录不能是链接');
if (execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: remoteRoot, encoding: 'utf8' }).trim() !== remoteRoot)
    throw new Error('独立远程资源仓库位置不符：' + remoteRoot);
const destination = path.join(remoteRoot, version);
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'res/manifest.json'), 'utf8'));
if (manifest.version !== 4) throw new Error('请先用新流程构建资源');
const digest = data => createHash('sha256').update(data).digest('hex');
const categories = ['characters', 'enemies', 'map', 'buildings', 'effects', 'ui'];
const artifacts = new Map(), files = {};
for (const stage of ['village', 'night']) {
    for (const bundled of manifest.stages[stage]) {
        const relative = bundled.slice('bundles/'.length);
        const [category, name, extra] = relative.split('/');
        if (!bundled.startsWith('bundles/') || !categories.includes(category) || !/^[a-z0-9_.]+\.(png|jpg|bin|mc)$/.test(name || '') || extra !== undefined || files[relative])
            throw new Error('运行资源路径冲突或不合法：' + bundled);
        const bytes = fs.readFileSync(path.join(root, 'res', bundled));
        if (!bytes.equals(fs.readFileSync(path.join(root, 'project/LayaProject/assets/resources/gameplay', relative))))
            throw new Error('工程素材与制作清单不一致：' + relative);
        artifacts.set(relative, bytes);
        files[relative] = { stage, bytes: bytes.length, sha256: digest(bytes) };
    }
}
// 保持现有帧表/外扩：只替换整页存储格式。高清头像和 UI 优先保细节，其余采用 6×6。
const atlas = JSON.parse(fs.readFileSync(path.join(root, 'res/atlases/frames.json'), 'utf8'));
const portraitPages = new Set(Object.entries(atlas.frames).filter(([id]) => id.startsWith('portrait_')).map(([, frame]) => frame.page));
const encoder = process.env.DAIDAI_ASTCENC || 'astcenc';
const work = path.join(os.homedir(), 'Downloads', 'daidai-astc-build', version);
const stagedAlready = fs.existsSync(destination);
for (const page of atlas.pages) {
    const original = files[page.runtimeFile], relative = page.runtimeFile.replace(/\.(png|jpg)$/, '.ktx');
    if (!original || original.sha256 !== page.sha256 || relative === page.runtimeFile || files[relative])
        throw new Error('图页与 ASTC 输入清单不符：' + page.runtimeFile);
    // Thin antialiased attack silhouettes need the same precision as UI. Keep other world pages at 6×6.
    const block = page.group === 'ui' || page.group === 'night_effects' || portraitPages.has(page.id) ? 4 : 6;
    const target = stagedAlready ? path.join(destination, relative) : path.join(work, relative);
    if (!stagedAlready) {
        if (revision !== '--stage') throw new Error('先生成远程资源版本：' + version);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        // Laya 的 2D 混合需要预乘像素，GPU 上传压缩块时不会替我们转换。
        execFileSync(encoder, ['-cl', path.join(root, 'res/bundles', page.runtimeFile), target, `${block}x${block}`, '-thorough', '-pp-premultiply']);
    }
    const data = fs.readFileSync(target), payload = Math.ceil(page.width / block) * Math.ceil(page.height / block) * 16;
    const level = data.length >= 68 ? 64 + data.readUInt32LE(60) : -1;
    if (data.subarray(0, 12).toString('hex') !== 'ab4b5458203131bb0d0a1a0a' ||
        data.readUInt32LE(12) !== 0x04030201 || data.readUInt32LE(28) !== (block === 4 ? 37808 : 37812) ||
        data.readUInt32LE(36) !== page.width || data.readUInt32LE(40) !== page.height ||
        data.readUInt32LE(56) !== 1 || level + 4 + payload !== data.length || data.readUInt32LE(level) !== payload)
        throw new Error('ASTC 图页格式或尺寸不符：' + relative);
    artifacts.set(relative, data);
    files[relative] = { stage: original.stage, bytes: data.length, sha256: digest(data), astcFor: page.runtimeFile };
}
const bytes = Object.values(files).reduce((sum, item) => sum + item.bytes, 0);
artifacts.set('manifest.bin', Buffer.from(JSON.stringify({ schema: 1, version, files }, null, 2) + '\n'));
if (revision === '--stage' && !fs.existsSync(destination)) {
    fs.mkdirSync(destination);
    try {
        for (const [relative, data] of artifacts) {
            const target = path.join(destination, relative);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, data, { flag: 'wx' });
        }
    } catch (error) {
        // 此次创建的新目录尚未发布，可以安全移除半成品。
        fs.rmSync(destination, { recursive: true, force: true });
        throw error;
    }
}
if (fs.realpathSync(destination) !== destination) throw new Error('版本目录不能是链接');
const scan = (directory, prefix = '') => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) return scan(path.join(directory, entry.name), relative + '/');
    if (entry.isFile()) return [relative];
    throw new Error('版本目录包含异常文件：' + relative);
});
const recorded = scan(destination).sort();
if (JSON.stringify(recorded) !== JSON.stringify([...artifacts.keys()].sort()))
    throw new Error('版本目录与发布清单不一致：' + destination);
for (const [relative, expected] of artifacts) {
    if (!fs.readFileSync(path.join(destination, relative)).equals(expected))
        throw new Error('版本目录已有不同的文件：' + relative);
}

if (revision === '--stage') {
    console.log(JSON.stringify({ version, destination, files: Object.keys(files).length, bytes }));
    process.exit(0);
}
const sources = { raw: repositoryUrl + '/raw/' + revision + '/' + version + '/' };
for (const [relative, expected] of artifacts) {
    // Gitee 会返回短期签名跳转。客户端只持久化可重复请求的提交地址。
    const response = spawnSync('curl', ['-q', '--fail', '--silent', '--compressed', '--location',
        '--proto', '=https', '--proto-redir', '=https', '--max-redirs', '1', '--connect-timeout', '8', '--max-time', '30',
        '--write-out', '%{stderr}%{url_effective}', sources.raw + relative], { maxBuffer: expected.length * 2 + 65536 });
    if (response.error || response.status !== 0) throw new Error('Gitee 资源下载失败：' + relative);
    if (!downloadOrigins.has(new URL(response.stderr.toString()).origin))
        throw new Error('Gitee 资源跳转域名与微信白名单不符：' + relative);
    if (!expected.equals(response.stdout)) throw new Error('Gitee 资源与发布文件不一致：' + relative);
    if (files[relative]) files[relative].source = 'raw';
}
const output = path.join(root, 'project/LayaProject/src/config/RemoteResourceManifest.ts');
const data = '/** 由 prepare-remote-release.mjs 生成。版本目录和 Gitee 提交共同锁定已校验的资源。 */\n'
    + 'export const REMOTE_RESOURCE_MANIFEST = ' + JSON.stringify({ version, revision, sources, files }, null, 4) + ' as const;\n';
if (mode === '--write') fs.writeFileSync(output, data);
else if (fs.readFileSync(output, 'utf8') !== data) throw new Error('客户端远程资源清单过期');
console.log(JSON.stringify({ version, revision, files: Object.keys(files).length, bytes, verifiedOnline: true }));
