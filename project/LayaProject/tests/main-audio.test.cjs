const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const build=process.env.DAIDAI_TEST_BUILD;
test('night-ending volley is heard before switching BGM, even when settlement opens a panel',()=>{
 const exports={},deps={
  './view/SpriteFrames':{SpriteFrames:class{}},
  './platform/ResourcePreparation':{ResourcePreparation:class{states={battle:{phase:'READY'}};advance(){}ready(){return true;}}}
 };
 // 运行真实Main.onUpdate；UI/平台启动在本测试外，模拟GameSession同帧结算清空battle的边界。
 vm.runInNewContext(fs.readFileSync(path.join(build,'Main.js'),'utf8'),{exports,require:name=>deps[name]||{},Laya:{Script:class{},regClass:()=>x=>x,timer:{unscaledDelta:50}}});
 const main=new exports.Main(),battle={volleys:0,outcome:null},calls=[];
 const session={state:{phase:'NIGHT',settings:{music:true},legacy:{bestNight:0}},battle,pauses:new Set(),saves:{pending:null},
  update(){if(this.battle){battle.volleys++;battle.outcome='WIN';this.battle=null;this.state.phase='DAY';this.pauses.add('MODAL');}}
 };
 main.session=session;main.music={setEnabled(){},setBattle:night=>calls.push(night?'night':'day'),towerShot:()=>calls.push('shot')};
 main.onUpdate();assert.deepEqual(calls,['shot','day']);
 main.onUpdate();assert.deepEqual(calls,['shot','day','day']);
});
