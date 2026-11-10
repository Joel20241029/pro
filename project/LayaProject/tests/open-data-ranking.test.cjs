const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const base = path.resolve(__dirname, '../build-templates/wxgame/openDataContext');
const model = require(base + '/score-store.js'), render = require(base + '/render.js');
const kv = score => score === null ? [] : [{ key: model.SCORE_KEY, value: String(score) }];
function fake() {
    const reads = [], writes = [], friends = [];
    return { reads, writes, friends, getUserCloudStorage(o) { reads.push(o); }, setUserCloudStorage(o) { writes.push(o); }, getFriendCloudStorage(o) { friends.push(o); } };
}
test('missing score and zero stay distinct from malformed or unsafe scores', () => {
    assert.equal(model.parseScore([]), null); assert.equal(model.parseScore(kv(0)), 0);
    for (const value of ['', 'abc', '-1', '1.5', '01', '9007199254740992']) assert.throws(() => model.parseScore(kv(value)));
});
test('numeric sorting, tied competition ranks, missing keys and invalid entries', () => {
    const input = [10, 2, 10, null, 'broken', 0].map((score, i) => ({ nickname: `friend${i}`, avatarUrl: '', KVDataList: kv(score) }));
    const result = model.rankFriends(input); assert.deepEqual(result.rows.map(r => [r.score, r.rank]), [[10, 1], [10, 1], [2, 3]]); assert.equal(result.invalid, 1);
    assert.equal(input[0].rank, undefined);
});
test('cloud record higher than local is never downgraded', () => {
    const api = fake(), store = model.createScoreStore(api); let result;
    store.request(3, (error, value) => result = { error, value }); api.reads.shift().success({ KVDataList: kv(20) });
    assert.deepEqual(result, { error: null, value: 20 }); assert.equal(api.writes.length, 0);
});
test('failed reads never write, manual refresh can retry', () => {
    const api = fake(), store = model.createScoreStore(api); let error;
    store.request(3, e => error = e); api.reads.shift().fail({ errMsg: 'offline' }); assert(error); assert.equal(api.writes.length, 0);
    store.request(3, () => {}); assert.equal(api.reads.length, 1); api.reads.shift().success({ KVDataList: kv(10) }); assert.equal(api.writes.length, 0);
});
test('malformed own cloud value is not overwritten as zero', () => {
    const api = fake(), store = model.createScoreStore(api); let error;
    store.request(8, e => error = e); api.reads.shift().success({ KVDataList: kv('unknown') }); assert(error); assert.equal(api.writes.length, 0);
});
test('new score arriving during read merges into the pending write', () => {
    const api = fake(), store = model.createScoreStore(api); store.request(3); store.request(8);
    assert.equal(api.reads.length, 1); api.reads.shift().success({ KVDataList: [] });
    assert.deepEqual(api.writes[0].KVDataList, kv(8)); api.writes.shift().success(); assert.equal(api.reads.length, 0);
});
test('new score arriving during write is serialized and read again before overwrite', () => {
    const api = fake(), store = model.createScoreStore(api); let completed;
    store.request(3); api.reads.shift().success({ KVDataList: [] }); store.request(8, (error, score) => completed = score);
    assert.equal(api.reads.length, 0); api.writes.shift().success(); assert.equal(completed, undefined);
    api.reads.shift().success({ KVDataList: kv(3) }); assert.deepEqual(api.writes[0].KVDataList, kv(8)); api.writes.shift().success(); assert.equal(completed, 8);
});
test('failed writes release busy without automatic retry loops', () => {
    const api = fake(), store = model.createScoreStore(api); store.request(3); api.reads.shift().success({ KVDataList: [] }); api.writes.shift().fail({ errMsg: 'offline' });
    assert.equal(api.reads.length, 0); store.request(4); assert.equal(api.reads.length, 1);
});
test('no zero upload; duplicate completed messages do not start new requests', () => {
    const api = fake(), store = model.createScoreStore(api); store.request(0); assert.equal(api.reads.length, 0);
    store.request(3); api.reads.shift().success({ KVDataList: kv(3) }); store.request(3); assert.equal(api.reads.length, 0);
});
test('synchronous API errors release queue and surface to refresh caller', () => {
    let count = 0, errors = 0;
    const store = model.createScoreStore({ getUserCloudStorage() { count++; throw new Error('sdk unavailable'); } });
    store.request(1, e => { if (e) errors++; }); store.request(1, e => { if (e) errors++; }); assert.equal(count, 2); assert.equal(errors, 2);
});
test('XML attributes round trip exactly once including literal entities and query strings', () => {
    for (const text of ['A&B <hi> "say" \'ok\'', '&amp; &lt;', 'https://example.test/avatar?a=1&b=2']) assert.equal(render.decode(render.escape(text)), text);
    const xml = render.template([{ nickname: '"><view/>', avatarUrl: 'x?a=1&b=2', rank: 1, score: 5 }], 5, 0);
    assert(!xml.includes('value=""><view/>')); assert(xml.includes('x?a=1&amp;b=2'));
});
test('ranking presentation contains only header, scrollable rows and a short hint', () => {
    const xml = render.template([{ rank: 1, nickname: 'same', avatarUrl: '', score: 10 }, { rank: 2, nickname: 'same', avatarUrl: '', score: 5 }], 5, 0);
    assert(!xml.includes('class="mine"')); assert(!xml.includes('按钮')); assert.equal(render.style.root.height, 680);
    assert.equal(render.style.header.height + render.style.list.height + render.style.tip.height, render.style.root.height);
});
function domain() {
    const api = fake(), draws = []; let receive, clears = 0;
    const ctx = { clearRect() {} }; api.getSharedCanvas = () => ({ width: 600, height: 680, getContext: () => ctx }); api.onMessage = fn => receive = fn;
    const layout = { clear() { clears++; }, clearAll() { clears++; }, init(xml) { draws.push(xml); }, layout() {}, updateViewPort() {} };
    vm.runInNewContext(fs.readFileSync(base + '/index.js', 'utf8'), { wx: api, console, require: id => id === './engine.js' ? { default: layout } : require(path.join(base, id)) });
    return { api, draws, send: data => receive(data), clears: () => clears };
}
test('closing while own score writes stops drawing but finishes queue and permits next upload', () => {
    const d = domain(); d.send({ bestNight: 3 }); d.api.reads.shift().success({ KVDataList: [] });
    d.send({ showRanking: true, bestNight: 3 }); d.send({ refreshRanking: true, bestNight: 3 }); d.send({ type: 'close' }); const count = d.draws.length;
    d.api.writes.shift().success(); assert.equal(d.draws.length, count); assert.equal(d.api.friends.length, 0);
    d.send({ bestNight: 4 }); assert.equal(d.api.reads.length, 1);
});
test('late friend callback never resurrects a closed panel', () => {
    const d = domain(); d.send({ showRanking: true }); d.send({ refreshRanking: true }); d.api.reads.shift().success({ KVDataList: [] });
    const pending = d.api.friends.shift(); d.send({ type: 'close' }); const count = d.draws.length; pending.success({ data: [] }); assert.equal(d.draws.length, count);
});
test('authorization refusal makes no friend API call and leaves explicit status', () => {
    const d = domain(); d.send({ showRanking: true }); d.send({ authorizationError: '请开启朋友信息权限' }); assert.equal(d.api.friends.length, 0); assert(d.draws.at(-1).includes('请开启朋友信息权限'));
});
test('superseded refresh callback cannot overwrite a newer request', () => {
    const d = domain(); d.send({ showRanking: true }); d.send({ refreshRanking: true }); d.api.reads.shift().success({ KVDataList: [] }); const old = d.api.friends.shift();
    d.send({ refreshRanking: true }); const count = d.draws.length; old.success({ data: [] }); assert.equal(d.draws.length, count);
});
test('real Layout parser decodes nicknames and avatar query once, without injecting nodes', () => {
    global.__env = { getSharedCanvas: () => ({ width: 600, height: 500 }), getSystemInfoSync: () => ({ devicePixelRatio: 1 }), createImage: () => ({}), createCanvas: () => ({ getContext: () => ({ measureText: text => ({ width: text.length * 10 }) }) }) };
    global.requestAnimationFrame = () => 1; global.cancelAnimationFrame = () => {};
    const Layout = require(base + '/engine.js').default;
    const name = 'A&B <hi> "say" &amp;';
    Layout.init(render.template([{ rank: 1, score: 3, nickname: name, avatarUrl: 'https://x.test/a?q=1&b=2' }], 3, 0), render.style, render.decode);
    assert.equal(Layout.getElementsByClassName('name')[0].value, name);
    assert.equal(Layout.getElementsByClassName('avatar')[0].src, 'https://x.test/a?q=1&b=2');
});
