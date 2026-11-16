const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const built=process.env.DAIDAI_TEST_BUILD;
assert(built,'DAIDAI_TEST_BUILD must point to compiled src');
const {EnemyVisuals}=require(path.join(built,'view/EnemyVisuals.js'));
const {ENEMY_LOOKS,ENEMY_PALETTES,ENEMY_SCALES}=require(path.join(built,'view/config/EnemyVisualConfig.js'));
const {FEEDBACK}=require(path.join(built,'view/config/FeedbackConfig.js'));
const definitions=require('../../../res/native/enemies.json').definitions;
function fixture(){
 const calls=[];const node={graphics:{clear(){calls.length=0;},drawImage(...args){calls.push(args);},drawTexture(...args){calls.push(args);}},scale(x,y){this.scaleX=x;this.scaleY=y;return this;},size(w,h){this.width=w;this.height=h;return this;},pivot(x,y){this.pivotX=x;this.pivotY=y;return this;}};
 return {node,calls,visual:new EnemyVisuals(node,{enemyLayouts:definitions,get:id=>id})};
}
test('every published accessory combination draws exactly once with valid native placement, stable feet and the original seed choices',()=>{
 const f=fixture();let samples=0;
 for(const [kind,look]of Object.entries(ENEMY_LOOKS)){
  const def=definitions[kind];
  for(let b=0;b<look.back.length;b++)for(let h=0;h<look.head.length;h++)for(let s=0;s<ENEMY_SCALES.length;s++)for(let c=0;c<ENEMY_PALETTES.length;c++){
   const seed=c+8*(s+3*(h+look.head.length*b));
   for(let frame=0;frame<def.frames.length;frame++){
    const distance=(frame+.01)/def.frames.length*def.stride*look.size*ENEMY_SCALES[s]/def.canvas;
    f.visual.draw(kind,seed,distance,false);samples++;
    const expected=[def.shadow.frame,look.back[b],def.frames[frame].body,look.head[h]].filter(Boolean);
    assert.deepEqual(f.calls.map(call=>call[0]),expected);
    assert(f.calls.every(call=>call.slice(1,5).every(Number.isFinite)));
    assert.equal(f.node.pivotX,48);assert.equal(f.node.pivotY,def.foot.y);
    assert.deepEqual(f.calls[0],[def.shadow.frame,def.shadow.x,def.shadow.y,def.shadow.width,def.shadow.height,null,def.shadow.alpha]);
    assert.equal(f.calls.find(call=>call[0]===def.frames[frame].body)[5],ENEMY_PALETTES[c]);
   }
  }
 }
 assert.equal(samples,2304);
});
test('boar body registration keeps ground position stable; mirror and hit feedback do not leave stale attachments in a reused node',()=>{
 const f=fixture(),kind='enemy_boar',def=definitions[kind],seed=8;
 const step=def.stride*ENEMY_LOOKS[kind].size*ENEMY_SCALES[1]/def.canvas/def.frames.length;
 f.visual.draw(kind,seed,0,false);const shadow=f.calls[0].slice();
 assert.equal(f.calls.find(c=>c[0]===def.frames[0].body)[1],0);
 f.visual.draw(kind,seed,step+.001,false);
 assert.equal(f.calls.find(c=>c[0]===def.frames[1].body)[1],0);
 assert.deepEqual(f.calls[0],shadow);
 f.visual.draw(kind,seed,step+.001,true,true);
 assert(f.node.scaleX<0);assert(f.calls.slice(1).every(c=>c[5]===FEEDBACK.flashColor));assert.deepEqual(f.calls[0],shadow);
 f.visual.draw('enemy_raider',8,0,false);
 assert.deepEqual(f.calls.map(c=>c[0]),['shadow_actor','enemy_raider_walk_00']);assert(f.node.scaleX>0);
});
test('ground shadow and feet share the same transform across movement, scale, mirror and all seventy poses',()=>{
 const f=fixture();let samples=0;
 for(const [kind,def]of Object.entries(definitions))for(let size=0;size<ENEMY_SCALES.length;size++)for(const mirror of [false,true])for(let i=0;i<def.frames.length;i++){
  const step=def.stride*ENEMY_LOOKS[kind].size*ENEMY_SCALES[size]/def.canvas;
  f.visual.draw(kind,size*8,(i+.01)*step/def.frames.length,mirror);
  const c=f.calls[0],center={x:c[1]+c[3]*98.56/192,y:c[2]+c[4]*140.46/192};
  for(const [x,y]of [[310,280],[360,480],[420,760]]){
   assert(Math.abs((center.x-f.node.pivotX)*f.node.scaleX+x-x)<=.5*Math.abs(f.node.scaleX));
   assert(Math.abs((center.y-f.node.pivotY)*f.node.scaleY+y-y)<=.5*Math.abs(f.node.scaleY));
  }
  assert.equal(f.calls.filter(c=>c[0]==='shadow_actor').length,1);samples++;
 }
 assert.equal(samples,420);
});
