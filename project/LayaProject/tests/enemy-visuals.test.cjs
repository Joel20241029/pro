const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const built=process.env.DAIDAI_TEST_BUILD;
assert(built,'DAIDAI_TEST_BUILD must point to compiled src');
const {EnemyVisuals}=require(path.join(built,'view/EnemyVisuals.js'));
const {ENEMY_LOOKS,ENEMY_PALETTES,ENEMY_SCALES}=require(path.join(built,'view/config/EnemyVisualConfig.js'));
const {FEEDBACK}=require(path.join(built,'view/config/FeedbackConfig.js'));
const definitions=require('../../../res/native/enemies.json').definitions;
class Sprite {
 constructor(){this.calls=[];this.children=[];this.graphics={clear:()=>this.calls.length=0,drawImage:(...args)=>this.calls.push(args),drawTexture:(...args)=>this.calls.push(args),drawCircle(){},drawCurves(){},drawPoly(){},drawRoundRect(){},drawLines(){}};}
 addChild(child){this.children.push(child);}
 scale(x,y){this.scaleX=x;this.scaleY=y;return this;}
 size(w,h){this.width=w;this.height=h;return this;}
 pivot(x,y){this.pivotX=x;this.pivotY=y;return this;}
 pos(x,y){this.x=x;this.y=y;return this;}
}
global.Laya={Sprite};
function fixture(){
 const node=new Sprite(),visual=new EnemyVisuals(node,{enemyLayouts:definitions,get:id=>id,
  frameId:(id,age)=>`${id}_${1+Math.floor(age*FEEDBACK.impact.fps)}`,
  applyFrame:(sprite,id,size)=>{sprite.texture=id;sprite.size(size,size);}});
 return {node,visual,get calls(){return [...node.calls,...node.children[0].calls];}};
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
test('frost and the other head statuses share a centered row across mirror, expiry and sprite reuse',()=>{
 const {node,visual}=fixture(),kind='enemy_tuskking',step=FEEDBACK.enemyStatus.spacing;
 const marks=()=>node.children.slice(1).filter(child=>child.visible);
 const center=child=>Math.round((child.x-node.pivotX)*node.scaleX)+0;
 for(const mirror of [false,true]){
  visual.draw(kind,0,0,mirror,false,undefined,0,0,undefined,true,undefined,true);
  assert.deepEqual(Object.fromEntries(marks().map(child=>[child.name,center(child)])),{MindLockMark:-step,FrostMark:0,DragonPoisonMark:step});
  visual.draw(kind,0,0,mirror,false,undefined,0,undefined,undefined,true,undefined,true);
  assert.deepEqual(Object.fromEntries(marks().map(child=>[child.name,center(child)])),{FrostMark:-step/2,DragonPoisonMark:step/2});
  visual.draw(kind,0,0,mirror,false,undefined,0,undefined,undefined,true);
  assert.deepEqual(marks().map(child=>[child.name,center(child)]),[['DragonPoisonMark',0]]);
 }
 visual.draw('enemy_raider',0,0,false);
 assert.deepEqual(marks(),[]);
});
test('patrol uses arrow impact frames and keeps their size as the target moves, mirrors and flattens',()=>{
 const {node,visual}=fixture(),kind='enemy_raider';
 visual.draw(kind,0,0,false,true,undefined,4,undefined,undefined,false,undefined,true,0);
 const impact=node.children.find(child=>child.name==='PatrolImpact'), body=node.children[0];
 assert(impact.visible&&node.children.find(child=>child.name==='FrostMark').visible);
 assert.equal(impact.texture,'fx_impact_arrow_1');
 const offset=()=>(impact.y-node.pivotY)*node.scaleY;
 const height=offset();
 assert(height<0);assert.equal(impact.x,node.pivotX+body.x);
 visual.draw(kind,0,0,true,false,{scaleY:.22,alpha:1},0,undefined,undefined,false,undefined,false,.11);
 assert(Math.abs(offset()-height*.22)<1e-9);assert.equal(impact.texture,'fx_impact_arrow_3');
 assert(Math.abs(node.scaleY*impact.scaleY*impact.width-FEEDBACK.impact.size.ARROW*FEEDBACK.impactScale)<1e-9);
 visual.draw(kind,0,0,true);
 assert(!impact.visible);assert.equal(node.children.filter(child=>child.name==='PatrolImpact').length,1);
});
test('boar body registration keeps ground position stable; mirror and hit feedback do not leave stale attachments in a reused node',()=>{
 const f=fixture(),kind='enemy_boar',def=definitions[kind],seed=8;
 const step=def.stride*ENEMY_LOOKS[kind].size*ENEMY_SCALES[1]/def.canvas/def.frames.length;
 f.visual.draw(kind,seed,0,false);const shadow=f.calls[0].slice();
 assert.equal(f.calls.find(c=>c[0]===def.frames[0].body)[1],0);
 f.visual.draw(kind,seed,step+.001,false);
 assert.equal(f.calls.find(c=>c[0]===def.frames[1].body)[1],0);
 assert.deepEqual(f.calls[0],shadow);
 f.visual.draw(kind,seed,step+.001,true,true,undefined,FEEDBACK.hitShake.pixels);
 assert(f.node.scaleX<0);assert(f.calls.slice(1).every(c=>c[5]===FEEDBACK.flashColor));assert.deepEqual(f.calls[0],shadow);
 assert(Math.abs(f.node.children[0].x*f.node.scaleX-FEEDBACK.hitShake.pixels)<1e-9);
 f.visual.draw('enemy_raider',8,0,false);
 assert.deepEqual(f.calls.map(c=>c[0]),['shadow_actor','enemy_raider_walk_00']);assert(f.node.scaleX>0);
 assert.equal(f.node.children[0].x,0);
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
