const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const compiled = process.env.DAIDAI_TEST_BUILD;
if (!compiled) throw Error('Set DAIDAI_TEST_BUILD to the compiled project under Downloads');
const { WechatRemoteResources } = require(path.join(compiled, 'platform/WechatRemoteResources.js'));
const { REMOTE_RESOURCE_MANIFEST: manifest } = require(path.join(compiled, 'config/RemoteResourceManifest.js'));

test('remote cache rejects equal-size corruption, commits verified siblings and reuses them on retry', async () => {
    const files = new Map();
    const dirs = new Set();
    const requests = [];
    const stage = 'village', entries = Object.fromEntries(Object.entries(manifest.files).filter(([, file]) => file.stage === stage));
    let corrupt = 'map/frames.json';
    global.wx = {
        env: { USER_DATA_PATH: 'wxfile://usr' },
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
    const remote = new WechatRemoteResources(), local = file => remote.path(file);
    await assert.rejects(remote.prepare(stage, () => {}), /frames.json 文件校验失败/);
    const batch = Object.keys(entries).slice(0, 3);
    assert.deepEqual(requests, batch);
    assert.deepEqual([...files.keys()].sort(), batch.filter(name => name !== corrupt).map(local).sort());
    corrupt = null;
    const progress = [];
    await remote.prepare(stage, value => progress.push(value));
    assert.equal(progress.at(-1), 1);
    assert.equal(files.size, Object.keys(entries).length);
    assert.equal(requests.filter(name => name === 'map/frames.json').length, 2);
    assert.equal(requests.filter(name => name === 'characters/animations.json').length, 1);
    assert.ok(files.has(local('buildings/building_upgrade.mc') + '.bin'));
    const cached = files.get(local('buildings/buildings_0.png'));
    files.set(local('buildings/buildings_0.png'), { ...cached, digest: 'same length, damaged bytes' });
    requests.length = 0;
    await new WechatRemoteResources().prepare(stage, () => {});
    assert.deepEqual(requests, ['buildings/buildings_0.png']);
    assert.deepEqual(files.get(local('buildings/buildings_0.png')), cached);
});
