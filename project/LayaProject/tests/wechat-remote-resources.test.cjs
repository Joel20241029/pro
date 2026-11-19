const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const compiled = process.env.DAIDAI_TEST_BUILD;
if (!compiled) throw Error('Set DAIDAI_TEST_BUILD to the compiled project under Downloads');
const { WechatRemoteResources } = require(path.join(compiled, 'platform/WechatRemoteResources.js'));
const { REMOTE_RESOURCE_MANIFEST: manifest } = require(path.join(compiled, 'config/RemoteResourceManifest.js'));
const { ResourcePreparation } = require(path.join(compiled, 'platform/ResourcePreparation.js'));

for (const supportsAstc of [false, true]) test(`remote cache selects one atlas format with ASTC support ${supportsAstc}`, async () => {
    const files = new Map();
    const dirs = new Set();
    const requests = [];
    const logs = [];
    const stage = 'village', manifestEntries = Object.entries(manifest.files).filter(([, file]) => file.stage === stage);
    const variants = new Map(manifestEntries.filter(([,file]) => file.astcFor).map(([name,file]) => [file.astcFor,name]));
    assert(variants.has('characters/characters_0.png') && variants.has('map/terrain_0.jpg'));
    const entries = Object.fromEntries(manifestEntries.filter(([,file]) => !file.astcFor)
        .map(([name,file]) => supportsAstc && variants.has(name) ? [variants.get(name),manifest.files[variants.get(name)]] : [name,file]));
    global.Laya = { LayaGL: { renderEngine: { getCapable: () => supportsAstc } }, RenderCapable: { COMPRESS_TEXTURE_ASTC: 17 } };
    let corrupt = 'map/frames.bin';
    global.wx = {
        env: { USER_DATA_PATH: 'wxfile://usr' },
        getAccountInfoSync: () => ({ miniProgram: { envVersion: 'release' } }),
        getGameLogManager: () => ({ log: record => logs.push(record) }),
        getNetworkType: ({success}) => success({networkType:'wifi'}),
        getFileSystemManager() {
            return {
                accessSync(target) { if (!files.has(target) && !dirs.has(target)) throw Error('missing'); },
                mkdirSync(target) { dirs.add(target); },
                readdirSync() { return []; },
                unlinkSync(target) { files.delete(target); },
                renameSync(from, to) { files.set(to, files.get(from)); files.delete(from); },
                getFileInfo({ filePath, digestAlgorithm, success, fail }) {
                    assert.equal(digestAlgorithm, 'sha256');
                    const file = files.get(filePath);
                    if (file) success(file); else fail({ errMsg: 'missing' });
                }
            };
        },
        downloadFile({ url, filePath, success }) {
            const root = Object.values(manifest.sources).find(source => url.startsWith(source));
            assert.ok(root, 'download goes through the pinned resource origin');
            const name = url.slice(root.length), file = entries[name];
            assert.ok(file, name);
            assert.equal(url, manifest.sources[file.source] + name);
            requests.push(name);
            setImmediate(() => {
                files.set(filePath, { size: file.bytes, digest: name === corrupt ? 'bad digest' : file.sha256 });
                success({ statusCode: 200 });
            });
            return { onProgressUpdate() {} };
        }
    };
    const remote = new WechatRemoteResources(), local = file => remote.path(manifest.files[file].astcFor ?? file);
    const prep = new ResourcePreparation({ download: remote.prepare.bind(remote), decode: async () => {} },remote.diagnostics);
    const attempt = prep.ensure(stage);
    assert.equal(prep.ensure(stage), attempt);
    assert.equal(await attempt,false);
    assert.match(prep.states[stage].error,/frames\.bin 文件校验失败/);
    const batch = Object.keys(entries).slice(0, 3);
    assert.deepEqual(requests, batch);
    assert.deepEqual([...files.keys()].sort(), batch.filter(name => name !== corrupt).map(local).sort());
    corrupt = null;
    assert.equal(await prep.ensure(stage),true);
    assert.equal(prep.states[stage].progress, 1);
    const values = logs.filter(log => log.key === 'asset_download').map(log => log.value);
    const starts = values.filter(value => value.event === 'start');
    assert.equal(new Set(starts.map(value => value.attempt)).size,2);
    assert(values.some(value => value.event === 'file_failed' && value.operation === 'integrity_mismatch' &&
        value.file === 'map/frames.bin' && value.attempt === starts[0].attempt));
    assert(values.some(value => value.event === 'network' && value.at === 'failure' && value.network === 'wifi'));
    assert(values.some(value => value.event === 'ready' && value.attempt === starts[1].attempt));
    assert(!JSON.stringify(values).includes('https://'));
    assert.equal(files.size, Object.keys(entries).length);
    assert.equal(requests.filter(name => name === 'map/frames.bin').length, 2);
    assert.equal(requests.filter(name => name === 'characters/animations.bin').length, 1);
    assert.ok(files.has(local('buildings/building_upgrade.mc') + '.bin'));
    const cached = files.get(local('buildings/buildings_0.png'));
    files.set(local('buildings/buildings_0.png'), { ...cached, digest: 'same length, damaged bytes' });
    requests.length = 0;
    await new WechatRemoteResources().prepare(stage, () => {});
    assert.deepEqual(requests, [supportsAstc ? 'buildings/buildings_0.ktx' : 'buildings/buildings_0.png']);
    assert.deepEqual(files.get(local('buildings/buildings_0.png')), cached);
});
