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
    d.end(a,2);l.emit('texStorage2D: immutable texture');d.record('friend_result',a,{result:'ok'});
    assert.equal(l.logs.at(-2).value.request,b);assert.equal(l.logs.at(-1).value.request,a);
    assert.equal(l.common.version,RELEASE.version);assert.equal(l.common.build,RELEASE.build);assert.equal(l.common.env,'release');assert.equal(l.common.render,'offscreenCanvas');
    d.end(b,10);const n=l.logs.length;l.emit('after close');assert.equal(l.logs.length,n);d.dispose();
});
test('errors are classified without personal payloads, deduplicated and bounded',()=>{
    const l=logger(),d=new RankingDiagnostics(l.api),id=d.begin();
    const secret={errMsg:'privacy: person_name avatar=https://private invalid',openid:'secret-id',errCode:123};
    for(let i=0;i<30;i++)d.failure('privacy_result',id,secret);
    assert.equal(l.logs.length,2);assert.equal(l.logs[1].value.category,'privacy');assert.equal(l.logs[1].value.code,123);
    assert(!JSON.stringify(l.logs).includes('secret'));assert(!JSON.stringify(l.logs).includes('avatar'));
    for(let i=0;i<1000;i++)d.record('viewport',id,{width:600,height:680});assert.equal(l.logs.length,240);
});
test('missing, throwing and failed log APIs never change the ranking authorization or message flow',()=>{
    for(const factory of [undefined,()=>{throw Error('init');},()=>({log:()=>{throw Error('report');}}),()=>({log:o=>o.fail()})]) {
        const messages=[];let done=false;
        global.wx={getGameLogManager:factory,getOpenDataContext:()=>({postMessage:m=>messages.push(m)}),requirePrivacyAuthorize:o=>o.success(),authorize:o=>o.success()};
        const platform=new WechatPlatform();platform.syncBestNight(3);platform.syncBestNight(3);platform.authorizeRanking(()=>true,e=>{assert.equal(e,null);done=true;});
        assert(done);assert.deepEqual(messages,[{bestNight:3}]);platform.rankingDiagnostics.dispose();
    }
});
test('malformed error objects and throwing console do not escape diagnostic methods',()=>{
    const d=new RankingDiagnostics({}),id=d.begin(),error={get message(){throw Error('getter');}},old=console.warn;
    console.warn=()=>{throw Error('console');};
    try{assert.doesNotThrow(()=>d.failure('view_error',id,error));}finally{console.warn=old;}
});
