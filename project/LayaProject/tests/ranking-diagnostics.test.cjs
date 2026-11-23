const { test }=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const compiled=process.env.DAIDAI_TEST_BUILD;
if(!compiled)throw new Error('Set DAIDAI_TEST_BUILD to the compiled project under Downloads');
const {RankingDiagnostics}=require(path.join(compiled,'platform/RankingDiagnostics.js'));
const {WechatPlatform}=require(path.join(compiled,'platform/WechatPlatform.js'));
const {RELEASE}=require(path.join(compiled,'config/ReleaseInfo.js'));
function logger() {
    const logs=[];let listener,common;
    const api={getAccountInfoSync:()=>({miniProgram:{envVersion:'release'}}),getGameLogManager:o=>{common=o.commonInfo;return{log:o=>logs.push(o)};},onError:f=>listener=f,offError:f=>{assert.equal(f,listener);listener=null;}};
    return {api,logs,get common(){return common;},emit:e=>listener?.(e)};
}
test('events carry immutable request IDs and release identity, old close does not end new request',()=>{
    const l=logger(),d=new RankingDiagnostics(l.api),a=d.begin(),b=d.begin();assert.notEqual(a,b);
    d.end(a);l.emit('texStorage2D: immutable texture');d.record('friend_result',a,{result:'ok'});
    assert.equal(l.logs.at(-2).value.request,b);assert.equal(l.logs.at(-1).value.request,a);
    assert.equal(l.common.version,RELEASE.version);assert.equal(l.common.build,RELEASE.build);assert.equal(l.common.env,'release');assert.equal(l.common.render,'screenCanvas');
    d.end(b);const n=l.logs.length;l.emit('after close');assert.equal(l.logs.length,n);d.dispose();
});
test('errors are classified without personal payloads, deduplicated and bounded',()=>{
    const l=logger(),d=new RankingDiagnostics(l.api),id=d.begin();
    const secret={errMsg:'privacy: person_name avatar=https://private invalid',openid:'secret-id',errCode:123};
    for(let i=0;i<30;i++)d.failure('privacy_result',id,secret);
    assert.equal(l.logs.length,2);assert.equal(l.logs[1].value.category,'privacy');assert.equal(l.logs[1].value.code,123);
    assert(!JSON.stringify(l.logs).includes('secret'));assert(!JSON.stringify(l.logs).includes('avatar'));
    for(let i=0;i<1000;i++)d.record('viewport',id,{width:600,height:680});assert.equal(l.logs.length,240);
});
test('native ranking failures report the exact capability check under the same request', () => {
    const { WechatRankingCanvas, RankingCanvasUnsupported } = require(path.join(compiled, 'platform/WechatRankingCanvas.js'));
    const sdk = () => ({ SDKVersion: '3.17.6' });
    const cases = [
        [{}, 'sdk_version_missing'],
        [{ getAppBaseInfo: () => ({ SDKVersion: '3.6.5' }) }, 'sdk_below_minimum'],
        [{ getAppBaseInfo: () => ({ SDKVersion: 'unexpected' }) }, 'sdk_version_rejected'],
        [{ getAppBaseInfo: sdk }, 'open_data_api_missing'],
        [{ getAppBaseInfo: sdk, getOpenDataContext: () => ({}) }, 'canvas_missing'],
        [{ getAppBaseInfo: sdk, getOpenDataContext: () => ({ canvas: {} }) }, 'canvas_style_missing'],
    ];
    for (const [api, reason] of cases) {
        const l = logger(), diagnostics = new RankingDiagnostics(l.api), request = diagnostics.begin();
        const native = new WechatRankingCanvas(api, diagnostics);
        assert.throws(() => native.context, error => {
            assert(error instanceof RankingCanvasUnsupported);
            assert.match(error.message, reason === 'sdk_below_minimum' ? /升级微信/ : /暂时无法打开/);
            diagnostics.failure('view_error', request, error);
            return true;
        });
        const { key, value } = l.logs.at(-1);
        assert.equal(key, 'ranking');
        assert.equal(value.request, request);
        assert.equal(value.nativeCanvasFailure, reason);
    }
});
test('missing, throwing and failed log APIs never change the ranking authorization or message flow',()=>{
    for(const factory of [undefined,()=>{throw Error('init');},()=>({log:()=>{throw Error('report');}}),()=>({log:o=>o.fail()})]) {
        const messages=[];let done=false;
        global.wx={getGameLogManager:factory,getAppBaseInfo:()=>({SDKVersion:'3.17.6'}),getOpenDataContext:()=>({canvas:{style:{}},postMessage:m=>messages.push(m)}),requirePrivacyAuthorize:o=>o.success(),authorize:o=>o.success()};
        const platform=new WechatPlatform();platform.syncBestNight(3);platform.syncBestNight(3);platform.authorizeRanking(()=>true,e=>{assert.equal(e,null);done=true;});
        assert(done);assert.deepEqual(messages,[{bestNight:3}]);platform.rankingDiagnostics.dispose();
    }
});
test('malformed error objects and throwing console do not escape diagnostic methods',()=>{
    const d=new RankingDiagnostics({}),id=d.begin(),error={get message(){throw Error('getter');}},old=console.warn;
    console.warn=()=>{throw Error('console');};
    try{assert.doesNotThrow(()=>d.failure('view_error',id,error));}finally{console.warn=old;}
});

test('environment observations do not prevent logger creation and only include version/platform scalars', () => {
    const l = logger();
    l.api.getAppBaseInfo = () => ({ version: '8.0.65', SDKVersion: '3.17.6', secret: 'not-for-logs' });
    l.api.getDeviceInfo = () => ({ platform: 'ios', deviceId: 'not-for-logs' });
    const d = new RankingDiagnostics(l.api); d.begin();
    assert.equal(l.common.wechatVersion, '8.0.65'); assert.equal(l.common.sdkVersion, '3.17.6'); assert.equal(l.common.platform, 'ios');
    assert(!JSON.stringify(l.common).includes('not-for-logs'));
    const failed = logger(); failed.api.getAccountInfoSync = () => { throw Error('metadata'); };
    const other = new RankingDiagnostics(failed.api); other.begin(); assert.equal(failed.logs.length, 1);
});
test('privacy and friend observations never gate the original authorization, including failures and missing APIs', () => {
    for (const probe of [undefined, () => { throw Error('probe'); }, o => o.fail({ errMsg: 'query failed' }), () => {}]) {
        const l = logger(), calls = [];
        global.wx = { ...l.api, getPrivacySetting: probe, getSetting: probe,
            requirePrivacyAuthorize: o => { calls.push('privacy'); o.success(); }, authorize: o => { calls.push('friend'); o.success(); } };
        const platform = new WechatPlatform(), id = platform.rankingDiagnostics.begin(); let finished = false;
        platform.inspectRankingAuthorization(id);
        platform.authorizeRanking(() => true, error => { assert.equal(error, null); finished = true; }, id);
        assert(finished); assert.deepEqual(calls, ['privacy', 'friend']);
    }
});
test('authorization snapshots preserve false and tri-state friend status without copying names or other permissions', () => {
    for (const value of [true, false, undefined]) {
        const l = logger();
        global.wx = { ...l.api,
            getPrivacySetting: o => o.success({ needAuthorization: false, privacyContractName: 'private-contract-name' }),
            getSetting: o => o.success({ authSetting: { 'scope.WxFriendInteraction': value, unrelated: 'private-value' }, extra: 'private-value' }) };
        const platform = new WechatPlatform(), id = platform.rankingDiagnostics.begin(); platform.inspectRankingAuthorization(id);
        const privacy = l.logs.find(x => x.value.event === 'privacy_snapshot').value;
        const friend = l.logs.find(x => x.value.event === 'friend_snapshot').value;
        assert.equal(privacy.needAuthorization, false); assert.equal(privacy.contractPresent, true);
        assert.equal(friend.friendState, value === true ? 'granted' : value === false ? 'denied' : 'unset');
        assert(!JSON.stringify(l.logs).includes('private-'));
    }
});
test('late authorization observations retain the old request and do not authorize or mutate a replacement panel', () => {
    const l = logger(); let privacy, friend;
    global.wx = { ...l.api, getPrivacySetting: o => privacy = o, getSetting: o => friend = o };
    const platform = new WechatPlatform(), d = platform.rankingDiagnostics, old = d.begin();
    platform.inspectRankingAuthorization(old); d.end(old); const current = d.begin();
    privacy.success({ needAuthorization: true, privacyContractName: 'contract' }); friend.success({ authSetting: {} });
    assert(l.logs.slice(-2).every(x => x.value.request === old));
    l.emit('cannot read properties of null'); assert.equal(l.logs.at(-1).value.request, current);
});
test('error names and stack frames are whitelisted; report acknowledgement is local and one-time', () => {
    const l = logger(), d = new RankingDiagnostics(l.api), id = d.begin();
    d.failure('view_error', id, { name: 'secret-user', message: 'canvas security secret-user', stack: 'https://private/render.js:2:3 secret-user' });
    const error = l.logs.at(-1).value; assert.equal(error.errorName, undefined); assert.equal(error.category, 'canvas_security');
    assert.deepEqual(error.frames, ['render.js:2:3']); assert(!JSON.stringify(l.logs).includes('secret-user'));
    let calls = 0; const original = console.info; console.info = () => calls++;
    try { for (const log of l.logs) log.success(); assert.equal(calls, 1); } finally { console.info = original; }
});
