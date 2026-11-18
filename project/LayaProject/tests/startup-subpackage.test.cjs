const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), { createRequire } = require('node:module');
const compiled = process.env.DAIDAI_TEST_BUILD;
if (!compiled) throw Error('Set DAIDAI_TEST_BUILD under Downloads');
const mainFile = path.join(compiled, 'Main.js'), actualRequire = createRequire(mainFile);
const project = path.resolve(__dirname, '..'), root = 'resources/gameplay/';
const villageFrames = root + 'map/frames.vdata', villageAnimations = root + 'characters/animations.vdata';
const enemyLayouts = root + 'enemies/enemies.vdata';
const read = file => JSON.parse(fs.readFileSync(path.join(project, 'assets', file), 'utf8'));
const flush = () => new Promise(setImmediate);
function deferred() {
    let resolve, reject;
    const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
    return { promise, resolve, reject };
}
function setup() {
    const requests = [], textures = [], cache = new Map(), gates = new Map(), downloads = new Map(), storage = new Map();
    let views = 0, artwork = Promise.resolve(true);
    class Sprite {
        children = []; events = new Map(); destroyed = false;
        addChild(c) { this.children.push(c); c.parent = this; }
        on(event, caller, fn) { this.events.set(event, () => fn.call(caller)); }
        off(event) { this.events.delete(event); }
        destroy() { this.destroyed = true; if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
    }
    class StartupView extends Sprite {
        resize() {}
        loadArtwork() { requests.push({ launcher: true }); return artwork; }
        showPreparation(title, state) { assert(!this.destroyed); this.title = title; this.state = state; }
    }
    class GameView {
        constructor() { views++; this.root = new Sprite(); }
        refresh() {}
        resize() {}
        update() {}
        destroy() { this.root.destroy(); }
    }
    const stage = new Sprite();
    global.Laya = {
        Script: class {}, regClass: () => target => target, stage, Event: { CLICK: 'click', RESIZE: 'resize' },
        timer: { unscaledDelta: 50 }, FilterMode: { Bilinear: 1 }, Loader: { JSON: 'json', IMAGE: 'image' },
        loader: {
            async load(url, options) {
                requests.push({ url, options });
                if (cache.has(url) && !options.ignoreCache) return cache.get(url);
                if (gates.has(url)) { const value = await gates.get(url).promise; cache.set(url, value); return value; }
                const file = path.join(project, 'assets', url);
                let value;
                if (url.endsWith('.vdata')) { assert.equal(options.type, Laya.Loader.JSON); value = { data: read(url) }; }
                else if (url.endsWith('.mc')) { assert(fs.statSync(file).size > 0); value = { binary: file }; }
                else {
                    const bytes = fs.readFileSync(file);
                    if (url === root + 'map/terrain_0.jpg') {
                        assert.equal(bytes.readUInt16BE(0), 0xffd8);
                        value = { width: 1126, height: 1406, bitmap: {} };
                    } else {
                        assert(url.endsWith('.png'), url);
                        value = { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), bitmap: {} };
                    }
                }
                cache.set(url, value);
                return value;
            }
        },
        Texture: { create() { const texture = { destroyed: false, destroy() { this.destroyed = true; } }; textures.push(texture); return texture; } }
    };
    global.wx = {
        getWindowInfo: () => ({ windowWidth: 720, windowHeight: 1280, safeArea: { top: 0, bottom: 1280 } }),
        getStorageInfoSync: () => ({ keys: [...storage.keys()] }), getStorageSync: key => storage.get(key),
        setStorageSync: (key, value) => storage.set(key, value),
        onShareAppMessage(listener) { requests.push({ share: listener }); },
        offShareAppMessage(listener) { requests.push({ offShare: listener }); },
        showShareMenu(options) { requests.push({ shareMenu: options }); },
        onHide() {}, offHide() {}, onShow() {}, offShow() {}, onAudioInterruptionBegin() {}, offAudioInterruptionBegin() {},
        onAudioInterruptionEnd() {}, offAudioInterruptionEnd() {}
    };
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(mainFile, 'utf8'), {
        module, exports: module.exports, Laya: global.Laya, console: { log() {}, error() {} },
        require: name => name === './view/GameView' ? { GameView } : name === './view/StartupView' ? { StartupView } : actualRequire(name)
    }, { filename: mainFile });
    const main = new module.exports.Main(), { ResourcePreparation } = actualRequire('./platform/ResourcePreparation');
    main.resources = new ResourcePreparation({
        download(stage, progress) {
            requests.push({ download: stage });
            const gate = deferred();
            downloads.set(stage, { ...gate, progress });
            return gate.promise;
        },
        decode: stage => main.frames.loadStage(stage)
    });
    return { main, requests, textures, cache, gates, downloads, storage, stage, get views() { return views; }, setArtwork: promise => { artwork = promise; } };
}
async function boot(f) {
    const start = f.main.onStart();
    await flush();
    assert.equal(f.views, 0);
    f.downloads.get('village').resolve();
    await start;
    assert.equal(f.views, 1);
}
async function retryStartup(f) {
    const start = f.main.startVillage();
    await flush();
    f.downloads.get('village').resolve();
    await start;
}
test('bundled launcher is ready before remote files and village waits for complete art', async () => {
    const f = setup(), local = deferred();
    f.setArtwork(local.promise);
    const start = f.main.onStart(); await flush();
    assert(f.requests.some(r => r.launcher));
    assert(!f.downloads.size);
    assert.equal(f.views, 0);
    local.resolve(true); await flush();
    assert(f.downloads.has('village'));
    assert(f.main.session.pauses.has('ASSETS'));
    const frames = read(villageFrames), page = root + frames.pages[0].runtimeFile, gate = deferred();
    f.gates.set(page, gate);
    f.downloads.get('village').progress(.55);
    assert.equal(f.main.resources.states.village.progress, .55);
    f.downloads.get('village').resolve(); await flush();
    assert.equal(f.views, 0);
    gate.resolve({ width: 1024, height: 1024, bitmap: {} });
    await start;
    assert.equal(f.views, 1);
    assert(f.main.frames.ready('village'));
    assert(f.main.frames.portraitId({ id: '1:1', sex: 'MALE', adult: true, appearance: 'male_a' }));
    assert.equal(f.main.resources.states.night.phase, 'IDLE');
    assert(!f.main.session.pauses.has('ASSETS'));
    f.main.onDestroy();
    assert(f.textures.every(t => t.destroyed));
});
test('failed startup retains share and retry shares one request', async () => {
    const f = setup(), start = f.main.onStart(); await flush();
    f.downloads.get('village').progress(.4);
    f.downloads.get('village').reject(Error('offline')); await start;
    assert.equal(f.views, 0);
    assert.equal(f.main.loading.state.phase, 'FAILED');
    assert.equal(f.main.loading.state.progress, .4);
    const share = f.requests.find(row => row.share).share;
    assert.equal(share().imageUrl, 'share/village-share.jpg');
    const retry = f.main.startVillage(); void f.main.startVillage(); await flush();
    const active = f.main.resources.ensure('village');
    assert.equal(active, f.main.resources.ensure('village'));
    assert.equal(f.requests.filter(r => r.download === 'village').length, 2);
    f.downloads.get('village').resolve(); await retry;
    assert.equal(f.views, 1);
    f.main.onDestroy();
    assert.equal(f.requests.find(r => r.offShare).offShare, share);
});
test('slow downloads only count foreground time and progress clears the hint', async () => {
    const f = setup(), start = f.main.onStart(); await flush();
    const resources = f.main.resources;
    resources.advance(60, false);
    assert(!resources.states.village.slow);
    resources.advance(31, true);
    assert(resources.states.village.slow);
    f.downloads.get('village').progress(.5);
    assert(!resources.states.village.slow);
    f.downloads.get('village').resolve(); await start;
    f.main.onDestroy();
});
test('night save waits on launcher at tick zero and resource retry does not reload the save', async () => {
    const f = setup();
    const { SaveStore } = actualRequire('./storage/SaveStore'), { createGame, applyCommand } = actualRequire('./game/VillageRules');
    const state = createGame(123);
    applyCommand(state, { type: 'NIGHT' });
    const saves = new SaveStore({ read: key => f.storage.get(key) ?? null, write: (key, value) => f.storage.set(key, value) });
    saves.inspect(); saves.prepare(state); saves.commit();
    const start = f.main.onStart(); await flush();
    f.downloads.get('village').resolve(); await flush();
    const session = f.main.session, firstBattle = session.battle;
    assert(f.downloads.has('night'));
    assert.equal(f.views, 0);
    assert.equal(session.battle.tick, 0);
    f.main.onUpdate();
    assert.equal(session.battle.tick, 0);
    f.downloads.get('night').reject(Error('offline')); await start;
    const retry = f.main.startVillage(); await flush();
    assert.equal(session.battle, firstBattle);
    assert.equal(f.main.loading.title, '正在恢复守夜');
    f.downloads.get('night').resolve(); await retry;
    assert.equal(f.views, 1);
    assert.equal(session.battle.tick, 0);
    f.main.onDestroy();
});
test('destroy during download suppresses late view and texture creation', async () => {
    const f = setup(), start = f.main.onStart(); await flush();
    f.main.onDestroy();
    const requests = f.requests.length;
    f.downloads.get('village').resolve(); await start;
    assert.equal(f.views, 0);
    assert.equal(f.requests.length, requests);
    assert.equal(f.stage.children.length, 0);
});
test('null atlas pages are retried after siblings finish', async () => {
    const f = setup(), start = f.main.onStart(); await flush();
    const files = read(villageFrames).pages.map(page => root + page.runtimeFile);
    const a = deferred(), b = deferred();
    f.gates.set(files[0], a); f.gates.set(files[1], b);
    f.downloads.get('village').resolve(); await flush();
    a.resolve(null); await flush();
    assert.equal(f.main.resources.states.village.phase, 'DECODE');
    b.resolve({ width: 1024, height: 1024, bitmap: {} }); await start;
    assert.equal(f.views, 0);
    assert.equal(f.main.resources.states.village.phase, 'FAILED');
    f.gates.clear(); await retryStartup(f);
    assert.equal(f.views, 1);
    assert(f.requests.findLast(r => r.url === files[0]).options.ignoreCache);
    assert(!f.requests.findLast(r => r.url === files[1]).options.ignoreCache);
    f.main.onDestroy();
});
for (const [label, file, mutate] of [
    ['missing frame', villageFrames, data => { delete data.frames[Object.keys(data.frames)[0]]; }],
    ['incomplete clips', villageAnimations, data => data.animations.pop()],
    ['missing labor directions', villageAnimations, data => { data.laborDirections = {}; }],
    ['invalid building layout', root + 'buildings/buildings.vdata', data => { delete data.layouts.HOUSE_1_1; }],
    ['invalid late frame', villageFrames, data => { data.frames[Object.keys(data.frames)[2]].rect.w = 0; }]
]) test(label + ' rolls back staged textures and retries metadata', async () => {
    const f = setup(), data = read(file); mutate(data); f.cache.set(file, { data });
    const start = f.main.onStart(); await flush();
    f.downloads.get('village').resolve(); await start;
    assert.equal(f.views, 0);
    assert(!f.main.frames.ready('village'));
    assert(f.textures.length && f.textures.every(t => t.destroyed));
    await retryStartup(f);
    assert.equal(f.views, 1);
    assert(f.requests.findLast(r => r.url === file).options.ignoreCache);
    f.main.onDestroy();
});
for (const [label, alter] of [
    ['missing boss', data => { delete data.definitions.enemy_shaman; }],
    ['missing shadow', data => { delete data.definitions.enemy_raider.shadow; }],
    ['bad shadow alpha', data => { data.definitions.enemy_raider.shadow.alpha = 2; }],
    ['bad shadow texture', data => { data.definitions.enemy_raider.shadow.frame = 'enemy_raider_walk_00'; }],
    ['invalid body', data => { data.definitions.enemy_raider.frames[0].x = NaN; }],
    ['missing accessory', data => { delete data.definitions.enemy_raider.frames[0].parts.enemy_acc_banner; }],
    ['invalid accessory', data => { data.definitions.enemy_raider.frames[0].parts.enemy_acc_banner.behind = 'front'; }]
]) test(label + ' keeps the night stage gated until retry', async () => {
    const f = setup(); await boot(f);
    const data = read(enemyLayouts); alter(data); f.cache.set(enemyLayouts, { data });
    const task = f.main.resources.ensure('night'); await flush();
    f.downloads.get('night').resolve(); assert.equal(await task, false);
    assert(!f.main.frames.ready('night'));
    assert(f.main.frames.ready('village'));
    const retry = f.main.resources.ensure('night'); await flush();
    f.downloads.get('night').resolve(); assert.equal(await retry, true);
    f.main.onDestroy();
});
test('daytime scene includes real directions, full portraits and the shared effects', async () => {
    const f = setup(); await boot(f);
    const art = f.main.frames;
    for (const name of ['shadow_actor', 'fx_rage_orbit', 'fx_hearts', 'icon_baby_cry']) assert(art.get(name));
    for (const identity of ['blue', 'straw', 'red', 'jade', 'elite_male', 'elite_female', 'child', 'elder'])
        for (const direction of ['DOWN', 'RIGHT', 'UP', 'LEFT']) assert.equal(art.walk(identity, direction).mirror, false);
    for (const sex of ['MALE', 'FEMALE']) {
        const person = { id: "1:1", sex, appearance: sex === 'MALE' ? 'male_a' : 'female_a', adult: true, elderNights: 0, nights: 12, growth: 0 };
        assert(art.get(art.portraitId(person)));
        assert(art.get(art.portraitId(person, true)));
        const labor = sex === 'MALE' ? 'villager_blue_chop' : 'villager_red_chop';
        assert.notEqual(art.labor(labor, "RIGHT").clip, art.labor(labor, "LEFT").clip);
        person.adult = false; assert(art.get(art.portraitId(person)));
        person.growth = 1; assert(art.get(art.portraitId(person)));
    }
    f.main.onDestroy();
});
