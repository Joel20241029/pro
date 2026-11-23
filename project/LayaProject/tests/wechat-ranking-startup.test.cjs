const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const compiled = process.env.DAIDAI_TEST_BUILD;
if (!compiled || !path.resolve(compiled).startsWith('/Users/happyelements/Downloads/')) throw Error('Use the Downloads compiled test build');
global.IEditorEnv = { regBuildPlugin: () => type => type };
const { WechatBuild } = require(path.join(compiled, 'WechatBuild.js'));
const fixtureRoot = path.resolve(compiled, '../../startup-fixtures'); fs.mkdirSync(fixtureRoot, { recursive: true });
const nativeRoots = ['resources/gameplay/village/', 'resources/gameplay/night/'];
function fixture(entry = 'require("weapp-adapter.js");\nrequire("js/bundle.js");\n', roots = nativeRoots) {
    const dir = fs.mkdtempSync(path.join(fixtureRoot, 'native-'));
    fs.writeFileSync(path.join(dir, 'game.js'), entry);
    fs.writeFileSync(path.join(dir, 'game.json'), JSON.stringify({ subpackages: roots.map(root => ({ root })) }));
    fs.writeFileSync(path.join(dir, 'project.config.json'), JSON.stringify({ setting: { urlCheck: false, es6: false } }));
    const build = new WechatBuild(); build.onCreateManifest({ destPath: dir });
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'project.config.json'), 'utf8')), { setting: { urlCheck: true, es6: false } });
    return { dir, build, entry: fs.readFileSync(path.join(dir, 'game.js'), 'utf8') };
}
test('entry captures the native screen canvas immediately after creating the main canvas and reuses it after adapter mutation', () => {
    const f = fixture(), calls = [], mainCanvas = {}, style = {}, canvas = { style }, context = { canvas };
    const GameGlobal = {}, createCanvas = function () { assert.equal(this, wx); calls.push('main'); return mainCanvas; };
    const wx = { createCanvas, getAppBaseInfo: () => ({ SDKVersion: '3.10.0' }), getOpenDataContext: options => {
        assert.equal(wx.createCanvas, createCanvas);
        assert.equal(options.sharedCanvasMode, 'screenCanvas'); calls.push('native'); return context;
    } };
    vm.runInNewContext(f.entry, { GameGlobal, wx, require: name => {
        calls.push(name);
        if (name === 'weapp-adapter.js') {
            assert.equal(wx.createCanvas(), mainCanvas);
            assert.equal(style.width, '1px'); assert.equal(style.left, '-100px');
            assert.equal(canvas.width, 600); assert.equal(canvas.height, 680);
            delete canvas.style;
        }
    }, console });
    assert.deepEqual(calls, ['weapp-adapter.js', 'main', 'native', 'js/bundle.js']);
    assert.equal(wx.createCanvas, createCanvas);
    assert.equal(GameGlobal.daidaiNativeRanking.styleRetainedAfterAdapter, false);
    const { WechatRankingCanvas } = require(path.join(compiled, 'platform/WechatRankingCanvas.js'));
    const ranking = new WechatRankingCanvas(wx, { record() {} }, GameGlobal.daidaiNativeRanking);
    assert.equal(ranking.context, context);
    ranking.show('a', { x: 10, y: 20, width: 300, height: 340 });
    assert.equal(style.width, '300px'); ranking.hide('a'); assert.equal(style.width, '1px');
    assert.equal(calls.filter(call => call === 'native').length, 1);
    f.build.onCreateManifest({ destPath: f.dir }); assert.equal(fs.readFileSync(path.join(f.dir, 'game.js'), 'utf8'), f.entry);
});
test('unsupported or failed early native initialization never stops the normal game entry or switches modes', () => {
    const f = fixture();
    for (const sdk of [undefined, '3.6.5', '3.6.6']) {
        let attempts = 0; const loaded = [], GameGlobal = {}, createCanvas = () => ({});
        const wx = { createCanvas, getAppBaseInfo: () => ({ SDKVersion: sdk }), getOpenDataContext: options => {
            assert.equal(options.sharedCanvasMode, 'screenCanvas'); attempts++; throw Error('native unavailable');
        } };
        vm.runInNewContext(f.entry, { GameGlobal, wx, require: name => {
            loaded.push(name);
            if (name === 'weapp-adapter.js') wx.createCanvas();
        }, console });
        assert.equal(attempts, sdk === '3.6.6' ? 1 : 0);
        assert.equal(GameGlobal.daidaiNativeRanking.reason, !sdk ? 'sdk_version_missing' : sdk === '3.6.5' ? 'sdk_below_minimum' : 'startup_capture_error');
        assert.equal(wx.createCanvas, createCanvas);
        assert.deepEqual(loaded, ['weapp-adapter.js', 'js/bundle.js']);
    }
});
test('entry leaves the main canvas untouched and restores the original factory when the adapter never calls it', () => {
    const f = fixture(), main = { style: {} }, createCanvas = () => main;
    for (const skip of [true, false]) {
        const GameGlobal = {}, wx = { createCanvas, getAppBaseInfo: () => ({ SDKVersion: '3.18.0' }),
            getOpenDataContext: () => ({ canvas: main }) };
        vm.runInNewContext(f.entry, { GameGlobal, wx, require: name => {
            if (!skip && name === 'weapp-adapter.js') assert.equal(wx.createCanvas(), main);
        }, console });
        assert.equal(GameGlobal.daidaiNativeRanking.reason, skip ? 'startup_hook_unavailable' : 'canvas_is_main');
        assert.equal(wx.createCanvas, createCanvas);
        assert.deepEqual(main, { style: {} });
    }
});
test('an unexpected engine entry template fails the build visibly instead of inserting late initialization', () => {
    assert.throws(() => fixture('require("unknown-adapter.js");'), /启动模板已变化/);
});

test('WeChat exports require both native stages and reject the retired remote-only configuration', () => {
    assert.doesNotMatch(fixture().entry, /daidaiNativeResources/);
    for (const roots of [[], [nativeRoots[0]], [...nativeRoots, 'resources/gameplay/']])
        assert.throws(() => fixture(undefined, roots), /一同声明/);
});
