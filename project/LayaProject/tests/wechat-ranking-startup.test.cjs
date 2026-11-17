const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const compiled = process.env.DAIDAI_TEST_BUILD;
if (!compiled || !path.resolve(compiled).startsWith('/Users/happyelements/Downloads/')) throw Error('Use the Downloads compiled test build');
global.IEditorEnv = { regBuildPlugin: () => type => type };
const { WechatBuild } = require(path.join(compiled, 'WechatBuild.js'));
const fixtureRoot = path.resolve(compiled, '../../startup-fixtures'); fs.mkdirSync(fixtureRoot, { recursive: true });
function fixture(entry = 'require("weapp-adapter.js");\nrequire("js/bundle.js");\n') {
    const dir = fs.mkdtempSync(path.join(fixtureRoot, 'native-'));
    fs.writeFileSync(path.join(dir, 'game.js'), entry);
    fs.writeFileSync(path.join(dir, 'project.config.json'), JSON.stringify({ setting: { urlCheck: false, es6: false } }));
    const build = new WechatBuild(); build.onCreateManifest({ destPath: dir });
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'project.config.json'), 'utf8')), { setting: { urlCheck: true, es6: false } });
    return { dir, build, entry: fs.readFileSync(path.join(dir, 'game.js'), 'utf8') };
}
test('generated entry selects native screen mode and hides it before loading the WeChat adapter', () => {
    const f = fixture(), calls = [], canvas = { style: {} };
    vm.runInNewContext(f.entry, { wx: { getAppBaseInfo: () => ({ SDKVersion: '3.10.0' }), getOpenDataContext: options => {
        assert.equal(options.sharedCanvasMode, 'screenCanvas'); calls.push('native'); return { canvas };
    } }, require: name => { assert.equal(canvas.style.width, '1px'); assert.equal(canvas.style.left, '-100px'); calls.push(name); }, console });
    assert.deepEqual(calls, ['native', 'weapp-adapter.js', 'js/bundle.js']);
    f.build.onCreateManifest({ destPath: f.dir }); assert.equal(fs.readFileSync(path.join(f.dir, 'game.js'), 'utf8'), f.entry);
});
test('unsupported or failed early native initialization never stops the normal game entry or switches modes', () => {
    const f = fixture();
    for (const sdk of [undefined, '3.6.5', '3.6.6']) {
        let attempts = 0, warnings = 0; const loaded = [];
        vm.runInNewContext(f.entry, { wx: { getAppBaseInfo: () => ({ SDKVersion: sdk }), getOpenDataContext: options => {
            assert.equal(options.sharedCanvasMode, 'screenCanvas'); attempts++; throw Error('native unavailable');
        } }, require: name => loaded.push(name), console: { warn: () => warnings++ } });
        assert.equal(attempts, sdk === '3.6.6' ? 1 : 0); assert.equal(warnings, attempts);
        assert.deepEqual(loaded, ['weapp-adapter.js', 'js/bundle.js']);
    }
});
test('an unexpected engine entry template fails the build visibly instead of inserting late initialization', () => {
    assert.throws(() => fixture('require("unknown-adapter.js");'), /启动模板已变化/);
});
