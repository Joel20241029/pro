const { test } = require('node:test'), assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs');
const compiled = process.env.DAIDAI_TEST_BUILD;
if (!compiled) throw new Error('Set DAIDAI_TEST_BUILD to the compiled project under Downloads');
const { WechatPlatform } = require(path.join(compiled, 'platform/WechatPlatform.js'));
const { SHARE } = require(path.join(compiled, 'config/ShareConfig.js'));
function setup() {
    const events = [], listeners = new Set(), menus = [];
    global.wx = {
        onHide: fn => events.push(['hide', fn]), onShow: fn => events.push(['show', fn]),
        offHide: fn => events.push(['offHide', fn]), offShow: fn => events.push(['offShow', fn]),
        onShareAppMessage(fn) { events.push(['share', fn]); listeners.add(fn); },
        offShareAppMessage(fn) { assert.equal(typeof fn, 'function'); events.push(['offShare', fn]); listeners.delete(fn); },
        showShareMenu(options) { events.push(['menu']); menus.push(options); },
        shareAppMessage() { assert.fail('passive menu registration must not send messages'); },
        getOpenDataContext() { assert.fail('sharing must not touch rankings'); },
        authorize() { assert.fail('sharing must not request profile/friend permissions'); },
        setStorageSync() { assert.fail('sharing must not change progress or rewards'); }
    };
    return { events, listeners, menus, wx: global.wx, platform: new WechatPlatform(), hide() {}, show() {} };
}
test('native friend menu returns the packaged 5:4 card synchronously without user data or side effects', () => {
    const f = setup(); f.platform.bind(f.hide, f.show);
    assert.deepEqual(f.events.map(e => e[0]), ['hide', 'show', 'share', 'menu']);
    assert.equal(f.menus[0].withShareTicket, false); assert.deepEqual(f.menus[0].menus, ['shareAppMessage']);
    const callback = [...f.listeners][0], first = callback();
    assert.deepEqual(first, { title: '你能守住多少波？', imageUrl: 'share/village-share.jpg' });
    first.title = 'mutated'; assert.deepEqual(callback(), { title: SHARE.title, imageUrl: SHARE.imageUrl });
    const project = path.resolve(__dirname, '..');
    const published = fs.readFileSync(path.join(project, 'build-templates/wxgame', SHARE.imageUrl));
    assert(published.equals(fs.readFileSync(path.resolve(project, '../../res/branding/share/village-share.jpg'))));
    assert.equal(published.readUInt16BE(0), 0xffd8); assert(published.length < 200 * 1024);
});
test('repeated bind owns one callback; unbind removes only that callback and rebind restores it', () => {
    const f = setup(), other = () => ({}); f.listeners.add(other);
    f.platform.bind(f.hide, f.show); f.platform.bind(f.hide, f.show);
    assert.equal(f.listeners.size, 2); assert.equal(f.menus.length, 1);
    const own = [...f.listeners].find(fn => fn !== other);
    f.platform.unbind(f.hide, f.show); assert.deepEqual([...f.listeners], [other]);
    assert.deepEqual(f.events.slice(-3), [['offShare', own], ['offHide', f.hide], ['offShow', f.show]]);
    f.platform.bind(f.hide, f.show); assert(f.listeners.has(own)); assert.equal(f.menus.length, 2);
});
test('registration failure is reported without preventing game lifecycle, and normal bind can try again', t => {
    const f = setup(), logs = t.mock.method(console, 'error', () => {}), onShare = f.wx.onShareAppMessage;
    f.wx.onShareAppMessage = () => { throw Error('registration failed'); };
    assert.doesNotThrow(() => f.platform.bind(f.hide, f.show)); assert.equal(logs.mock.calls.length, 1);
    assert.deepEqual(f.events.map(e => e[0]), ['hide', 'show']); assert.equal(f.menus.length, 0);
    f.wx.onShareAppMessage = onShare; f.platform.bind(f.hide, f.show); assert.equal(f.listeners.size, 1);
    f.platform.unbind(f.hide, f.show); assert.equal(f.listeners.size, 0);
});
for (const synchronous of [false, true]) {
    test(`menu ${synchronous ? 'exception' : 'failure callback'} does not duplicate registration or interrupt cleanup`, t => {
        const f = setup(), logs = t.mock.method(console, 'error', () => {});
        f.wx.showShareMenu = options => { if (synchronous) throw Error('menu failed'); options.fail({ errMsg: 'menu failed' }); };
        assert.doesNotThrow(() => f.platform.bind(f.hide, f.show));
        f.platform.bind(f.hide, f.show); assert.equal(f.events.filter(e => e[0] === 'share').length, 1);
        assert.equal(logs.mock.calls.length, 1); f.platform.unbind(f.hide, f.show); assert.equal(f.listeners.size, 0);
    });
}
test('failed listener removal retains ownership and never prevents hide/show cleanup', t => {
    const f = setup(), logs = t.mock.method(console, 'error', () => {}), offShare = f.wx.offShareAppMessage;
    f.platform.bind(f.hide, f.show); f.wx.offShareAppMessage = () => { throw Error('off failed'); };
    assert.doesNotThrow(() => f.platform.unbind(f.hide, f.show)); assert.equal(logs.mock.calls.length, 1);
    assert.deepEqual(f.events.slice(-2), [['offHide', f.hide], ['offShow', f.show]]);
    f.platform.bind(f.hide, f.show); assert.equal(f.events.filter(e => e[0] === 'share').length, 1);
    f.wx.offShareAppMessage = offShare; f.platform.unbind(f.hide, f.show); assert.equal(f.listeners.size, 0);
});
