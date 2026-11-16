const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=process.env.DAIDAI_TEST_BUILD;
if(!root)throw new Error('Set DAIDAI_TEST_BUILD to compiled project under Downloads');
const {WechatMusic}=require(path.join(root,'platform/WechatMusic.js'));
function setup(){
 const events={begin:new Set(),end:new Set()}, calls={created:0,play:0,pause:0,destroy:0,problems:0}, tracks=[];
 global.wx={createInnerAudioContext(){
  calls.created++;
  const audio={src:'',loop:false,autoplay:true,volume:1,played:[],stops:0,
   play(){calls.play++;this.played.push(this.src);},pause(){calls.pause++;},stop(){this.stops++;},destroy(){calls.destroy++;},onError(fn){this.error=fn;}};
  tracks.push(audio);return audio;
 },
 onAudioInterruptionBegin:fn=>events.begin.add(fn),offAudioInterruptionBegin:fn=>events.begin.delete(fn),onAudioInterruptionEnd:fn=>events.end.add(fn),offAudioInterruptionEnd:fn=>events.end.delete(fn)};
 const music=new WechatMusic(()=>calls.problems++);
 return{music,calls,tracks,events};
}
test('gesture starts one looping context without requiring unsupported global audio options',()=>{
 const {music,calls,tracks}=setup();music.setEnabled(true);assert.equal(calls.play,0);music.interact();music.interact();
 assert.equal(calls.created,1);assert.equal(calls.play,1);const audio=tracks[0];
 assert.equal(audio.src,'resources/base/village_loop.mp3');assert.equal(audio.loop,true);assert.equal(audio.autoplay,false);assert.equal(audio.volume,.3);
 music.setEnabled(false);assert.equal(calls.pause,1);music.interact();assert.equal(calls.play,1);music.setEnabled(true);assert.equal(calls.play,1);music.interact();assert.equal(calls.play,2);assert.equal(calls.created,1);music.destroy();
});
test('background pauses playback and waits for next gesture to resume',()=>{
 const {music,calls}=setup();music.setEnabled(true);music.interact();music.suspend();assert.equal(calls.pause,1);assert.equal(calls.play,1);
 music.setEnabled(true);assert.equal(calls.play,1);music.interact();assert.equal(calls.play,2);music.destroy();
});
test('system interruption pauses and waits for a new gesture after ending',()=>{
 const {music,calls,events}=setup();music.setEnabled(true);music.interact();events.begin.forEach(fn=>fn());music.interact();assert.equal(calls.play,1);
 events.end.forEach(fn=>fn());assert.equal(calls.play,1);music.interact();assert.equal(calls.play,2);music.destroy();assert.equal(events.begin.size+events.end.size,0);
});
test('errors notify once, never retry per frame, explicit off/on replaces failed context',()=>{
 const {music,calls,tracks}=setup();music.setEnabled(true);music.interact();tracks[0].error({errMsg:'decoder failure'});tracks[0].error({errMsg:'decoder failure'});
 for(let i=0;i<60;i++)music.interact();assert.equal(calls.problems,1);assert.equal(calls.play,1);
 music.setEnabled(false);music.setEnabled(true);assert.equal(calls.destroy,1);music.interact();assert.equal(calls.created,2);assert.equal(calls.play,2);
 tracks[0].error({errMsg:'late failure of old context'});assert.equal(calls.problems,1);music.destroy();
});
test('destroy is idempotent and ignores late errors and interaction',()=>{
 const {music,calls,events,tracks}=setup();music.setEnabled(true);music.interact();music.destroy();music.destroy();tracks[0].error({errMsg:'late'});music.interact();
 assert.equal(calls.destroy,1);assert.equal(calls.problems,0);assert.equal(calls.play,1);assert.equal(events.begin.size+events.end.size,0);
});
test('synchronous native failure is isolated, disabled music ignores late errors',()=>{
 const {music,calls,tracks}=setup();const create=wx.createInnerAudioContext;wx.createInnerAudioContext=()=>{throw new Error('native create failed');};
 music.setEnabled(true);music.interact();music.interact();assert.equal(calls.problems,1);wx.createInnerAudioContext=create;
 music.setEnabled(false);music.setEnabled(true);music.interact();assert.equal(calls.play,1);music.setEnabled(false);tracks[0].error({errMsg:'late while off'});assert.equal(calls.problems,1);music.destroy();
});
test('battle switches once on the current BGM; a suspended switch only changes the source',()=>{
 const {music,calls,tracks}=setup();music.setEnabled(true);music.interact();
 const [bgm]=tracks;music.setBattle(true);
 assert.equal(bgm.src,'resources/battle/battle_loop.mp3');assert.equal(bgm.volume,.25);assert.equal(bgm.stops,1);
 for(let i=0;i<60;i++)music.setBattle(true);
 assert.deepEqual(bgm.played,['resources/base/village_loop.mp3','resources/battle/battle_loop.mp3']);
 music.suspend();music.setBattle(false);
 assert.equal(bgm.src,'resources/base/village_loop.mp3');assert.equal(bgm.volume,.3);assert.equal(calls.play,2);assert.equal(bgm.stops,1);
 music.interact();assert.equal(bgm.played[2],'resources/base/village_loop.mp3');assert.equal(calls.created,1);music.destroy();
});
test('clicks reuse one short context and stay silent until a gesture after mute, hide, or interruption',()=>{
 const {music,calls,tracks,events}=setup();music.setBattle(true);music.setEnabled(true);music.click();assert.equal(calls.created,0);
 music.interact();music.click();music.click();music.click();
 const [bgm,click]=tracks;
 assert.equal(bgm.played[0],'resources/battle/battle_loop.mp3');assert.equal(calls.created,2);
 assert.equal(click.src,'resources/base/ui_click.mp3');assert.equal(click.volume,.35);
 assert.equal(click.loop,false);assert.equal(click.autoplay,false);assert.equal(click.played.length,3);assert.equal(click.stops,2);
 music.setEnabled(false);music.click();music.setEnabled(true);music.click();assert.equal(click.stops,3);assert.equal(click.played.length,3);
 music.interact();music.click();music.suspend();music.click();assert.equal(click.played.length,4);assert.equal(click.stops,5);
 music.interact();music.click();events.begin.forEach(fn=>fn());music.interact();music.click();
 events.end.forEach(fn=>fn());music.click();assert.equal(click.played.length,5);assert.equal(click.stops,7);
 music.interact();music.click();assert.equal(click.played.length,6);assert.equal(calls.created,2);
 music.destroy();music.click();assert.equal(calls.destroy,2);assert.equal(click.played.length,6);
});
test('an SFX error suspends both tracks and stale errors cannot interrupt the replacements',()=>{
 const {music,calls,tracks}=setup();music.setEnabled(true);music.interact();music.click();
 const [oldBgm,oldClick]=tracks;
 oldClick.error({errMsg:'bad SFX'});oldBgm.error({errMsg:'also failed'});
 assert.equal(calls.problems,1);assert.equal(calls.pause,1);assert.equal(oldClick.stops,1);
 music.interact();music.click();assert.equal(calls.play,2);
 music.setEnabled(false);music.setEnabled(true);music.interact();music.click();
 assert.equal(calls.created,4);assert.equal(calls.destroy,2);
 oldBgm.error({errMsg:'old BGM'});oldClick.error({errMsg:'old SFX'});
 music.click();assert.equal(calls.problems,1);assert.equal(calls.play,5);
 music.destroy();tracks[3].error({errMsg:'old SFX after destroy'});assert.equal(calls.problems,1);
});
test('tower volleys reuse one short SFX, throttle dense fire and stop for mute, background and interruption',()=>{
 const {music,calls,tracks,events}=setup(),originalNow=Date.now;let clock=1000;Date.now=()=>clock;
 try {
  music.setEnabled(true);music.interact();music.towerShot();assert.equal(calls.created,1);
  music.setBattle(true);music.towerShot();const shot=tracks[1];
  assert.equal(shot.src,'resources/battle/tower_fire.mp3');assert.equal(shot.loop,false);assert.equal(shot.volume,.22);assert.equal(shot.played.length,1);
  for(let i=0;i<15;i++)music.towerShot();assert.equal(shot.played.length,1);
  clock+=119;music.towerShot();assert.equal(shot.played.length,1);clock++;music.towerShot();assert.equal(shot.played.length,2);
  music.suspend();clock+=1000;music.towerShot();assert.equal(shot.played.length,2);
  music.interact();music.towerShot();assert.equal(shot.played.length,3);
  events.begin.forEach(fn=>fn());clock+=1000;music.towerShot();events.end.forEach(fn=>fn());music.towerShot();assert.equal(shot.played.length,3);
  music.interact();music.towerShot();assert.equal(shot.played.length,4);
  music.setEnabled(false);clock+=1000;music.towerShot();assert.equal(shot.played.length,4);assert.equal(calls.created,2);
  music.destroy();assert.equal(calls.destroy,2);music.towerShot();assert.equal(shot.played.length,4);
 } finally {Date.now=originalNow;}
});
