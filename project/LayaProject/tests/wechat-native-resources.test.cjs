const { test } = require('node:test');
const assert = require('node:assert/strict');
const read = path => require(`${process.env.DAIDAI_TEST_BUILD}/${path}.js`);
const { ResourcePreparation } = read('platform/ResourcePreparation');
const { WechatSubpackageResources } = read('platform/WechatSubpackageResources');
const { NATIVE_RESOURCE_ROOTS } = read('config/ResourceConfig');

function environment(capable, makePackage) {
    const loads = [], calls = [], reads = [];
    global.wx = { downloadFile() { throw new Error('原生模式意外发起外部下载'); } };
    global.Laya = {
        RenderCapable: { COMPRESS_TEXTURE_ASTC: 'astc' },
        LayaGL: { renderEngine: { getCapable(key) { assert.equal(key, 'astc'); return capable; } } },
        Loader: { IMAGE: 'image', JSON: 'json', preLoadedMap: {} }, WrapMode: { Clamp: 1 },
        URL: { formatURL(url) { return url; } }, PAL: { fs: { async readFile(file, encoding) {
            reads.push({ file, encoding }); return '{"purpose":"stage"}';
        } } },
        loader: {
            loadPackage(root, progress) { calls.push(root); return makePackage(progress, calls.length); },
            getRes() { return undefined; },
            async load(url, options) { loads.push({ url, options, registered: Laya.Loader.preLoadedMap[url] }); }
        }
    };
    return { resources: new WechatSubpackageResources(), loads, calls, reads };
}

test('subpackage forwards monotonic native percentages and only caches successful loads', async () => {
    const { resources, calls } = environment(true, async (report, attempt) => {
        for (const value of [-1, 30, 24, 100, .6, Infinity]) report(value);
        return attempt > 1;
    });
    const values = [];
    await assert.rejects(resources.prepare('village', n => values.push(n)), /微信分包加载失败/);
    assert.deepEqual(values, [0, .3, 1]);
    await resources.prepare('village', n => values.push(n));
    await resources.prepare('village', n => values.push(n));
    assert.deepEqual(calls, [NATIVE_RESOURCE_ROOTS.village, NATIVE_RESOURCE_ROOTS.village]);
    assert.deepEqual(values.slice(3), [0, .3, 1, 1, 1]);
});

test('each stage resolves to its own KTX or existing logical metadata and movie filename', async () => {
    const { resources, loads, reads } = environment(true, async () => true);
    await resources.load('village', 'map/terrain_0.jpg', { type: 'image', ignoreCache: true });
    await resources.load('night', 'effects/night_effects_0.png', { type: 'image' });
    await resources.load('night', 'enemies/frames.bin', { type: 'json' });
    await resources.load('village', 'buildings/building_upgrade.mc', {});
    assert.deepEqual(loads.map(x => x.url), [
        'resources/gameplay/village/map/terrain_0.ktx',
        'resources/gameplay/night/effects/night_effects_0.ktx',
        'resources/gameplay/night/enemies/frames.bin',
        'resources/gameplay/village/buildings/building_upgrade.mc'
    ]);
    assert.deepEqual(reads, [{ file: 'resources/gameplay/night/enemies/frames.bin', encoding: 'utf8' }]);
    assert.deepEqual(loads[2].registered, { purpose: 'stage' });
    assert.deepEqual(Laya.Loader.preLoadedMap, {});
    assert.equal(loads[0].options.ignoreCache, true);
    assert.deepEqual(loads[0].options.propertyParams, { premultiplyAlpha: false, wrapModeU: 1, wrapModeV: 1 });
});

test('a device without ASTC shows a terminal unsupported phase without package requests or decoding', async () => {
    const { resources, calls } = environment(false, () => assert.fail('unexpected request'));
    const prep = new ResourcePreparation({ download: resources.prepare.bind(resources), async decode() { assert.fail('decoded unsupported texture'); } });
    assert.equal(await prep.ensure('village'), false);
    assert.equal(prep.states.village.phase, 'UNSUPPORTED');
    assert.match(prep.states.village.error, /不支持 ASTC/);
    assert.equal(await prep.ensure('village'), false);
    assert.deepEqual(calls, []);
});
