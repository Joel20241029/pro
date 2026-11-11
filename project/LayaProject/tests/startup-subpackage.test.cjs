const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { createRequire } = require('node:module');
const compiled = process.env.DAIDAI_TEST_BUILD;
if (!compiled) throw new Error('Set DAIDAI_TEST_BUILD to the compiled project under Downloads');
const mainFile = path.join(compiled, 'Main.js'), actualRequire = createRequire(mainFile);

function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
function setup() {
    const packageGate = deferred(), imageGate = deferred();
    const requests = [], textures = [], hide = new Set(), show = new Set();
    let storageReads = 0, views = 0;
    class Sprite {
        constructor() { this.children = []; this.destroyed = false; }
        pos() { return this; } size() { return this; } scale() { return this; }
        addChild(child) { this.children.push(child); child.parent = this; }
        destroy() { this.destroyed = true; if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); }
    }
    class Text extends Sprite {
        set text(value) { assert.equal(this.destroyed, false, 'must not write a destroyed loading label'); this.value = value; }
        get text() { return this.value; }
    }
    class GameView {
        constructor() { views++; this.root = new Sprite(); }
        destroy() { this.root.destroy(); }
    }
    const stage = new Sprite(); stage.height = 1280;
    const frames = { pages: [{ id: 'world', runtimeFile: 'world_0.png' }], frames: { villager: { page: 'world', rect: { x: 0, y: 0, w: 8, h: 8 }, trimOffset: { x: 0, y: 0 }, sourceSize: { w: 8, h: 8 }, pivot: { x: 4, y: 8 } } } };
    const animations = { animations: [{ id: 'walk', frameIds: ['villager'], fps: 4, restFrame: 'villager' }], walkDirections: {}, enemyNativeFacing: {} };
    global.Laya = {
        Script: class {}, regClass: () => target => target, Text, stage, Loader: { JSON: 'json', IMAGE: 'image' },
        loader: {
            loadPackage(name) { requests.push(['package', name]); return packageGate.promise; },
            load(url, type) {
                requests.push([type, url]);
                if (url.endsWith('/frames.json')) return Promise.resolve({ data: frames });
                if (url.endsWith('/animations.json')) return Promise.resolve({ data: animations });
                assert.equal(url, 'resources/village/world_0.png'); return imageGate.promise;
            }
        },
        Texture: { create() { const texture = { destroyed: false, destroy() { this.destroyed = true; } }; textures.push(texture); return texture; } }
    };
    global.wx = {
        getWindowInfo: () => ({ windowWidth: 720, windowHeight: 1280, safeArea: { top: 0, bottom: 1280 } }),
        getStorageInfoSync: () => { storageReads++; return { keys: [] }; },
        onHide: fn => hide.add(fn), offHide: fn => hide.delete(fn), onShow: fn => show.add(fn), offShow: fn => show.delete(fn)
    };
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(mainFile, 'utf8'), {
        module, exports: module.exports, Laya: global.Laya,
        require: name => name === './view/GameView' ? { GameView } : actualRequire(name),
        console: { log() {}, error() {} }
    }, { filename: mainFile });
    const main = new module.exports.Main(), running = main.onStart(), loading = stage.children[0];
    return { main, running, loading, stage, requests, textures, packageGate, imageGate, hide, show, get views() { return views; }, get storageReads() { return storageReads; } };
}

test('native package gates atlas reads, village creation and save loading; each startup creates one view', async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
        const s = setup();
        assert.deepEqual(s.requests, [['package', 'resources/village']]);
        assert.equal(s.views, 0); assert.equal(s.storageReads, 0);
        s.packageGate.resolve(true); await new Promise(setImmediate);
        assert.equal(s.requests.filter(r => r[0] === 'json').length, 2);
        assert.equal(s.views, 0); assert.equal(s.storageReads, 0);
        s.imageGate.resolve({}); await s.running;
        assert.equal(s.views, 1); assert(s.storageReads > 0); assert(s.loading.destroyed);
        assert.equal(s.textures.length, 1); assert.equal(s.textures[0].destroyed, false);
        s.main.onDestroy(); assert(s.textures.every(t => t.destroyed));
    }
});
for (const failure of ['false', 'reject']) {
    test(`package ${failure} stops startup without atlas reads or a partially created village`, async () => {
        const s = setup();
        if (failure === 'false') s.packageGate.resolve(false); else s.packageGate.reject(new Error('network failed'));
        await s.running;
        assert.equal(s.requests.length, 1); assert.equal(s.views, 0); assert.equal(s.storageReads, 0);
        assert.match(s.loading.text, /启动失败，请重新打开小游戏/);
        s.main.onDestroy(); assert.equal(s.stage.children.length, 0);
    });
}
test('destroying during package download removes loading text and subscriptions before a late completion', async () => {
    const s = setup(); s.main.onDestroy();
    assert.equal(s.stage.children.length, 0); assert.equal(s.hide.size, 0); assert.equal(s.show.size, 0);
    s.packageGate.resolve(true); await s.running;
    assert.equal(s.requests.length, 1); assert.equal(s.views, 0); assert.equal(s.storageReads, 0);
});
test('destroying during atlas loading releases textures created by the late completion', async () => {
    const s = setup(); s.packageGate.resolve(true); await new Promise(setImmediate);
    s.main.onDestroy(); s.imageGate.resolve({}); await s.running;
    assert.equal(s.textures.length, 1); assert(s.textures.every(t => t.destroyed));
    assert.equal(s.stage.children.length, 0); assert.equal(s.views, 0); assert.equal(s.storageReads, 0);
});
test('a late asynchronous failure never touches a destroyed loading label', async () => {
    const s = setup(); s.packageGate.resolve(true); await new Promise(setImmediate);
    s.main.onDestroy(); s.imageGate.reject(new Error('image read failed')); await s.running;
    assert.equal(s.stage.children.length, 0); assert.equal(s.views, 0); assert.equal(s.storageReads, 0);
});
