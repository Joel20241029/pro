const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {buildingParts,BuildingVisuals}=require(path.join(process.env.DAIDAI_TEST_BUILD,'view/BuildingVisuals.js'));
const recipe=require('../../../res/source/asset_recipe.json');
const ids=new Set(recipe.assets.filter(a=>a.runtime).map(a=>a.id));
test('every upgrade through 12 has a distinct bounded composition and preserves weapon muzzle space',()=>{
 for(const kind of ['HOUSE','FARM','LOGGING','GATE','ARROW','STONE','SLOW']) {
  let last='';for(let level=1;level<=12;level++){
   const pieces=buildingParts(kind,level),signature=JSON.stringify(pieces);assert.notEqual(signature,last,kind+' '+level);last=signature;
   assert(pieces.length<=6);for(const p of pieces){assert(ids.has(p.frame));assert(p.x>=0&&p.y>=0&&p.x+p.w<=128&&p.y+p.h<=128);if(['ARROW','STONE','SLOW'].includes(kind))assert(p.y>=80);}
  }
  const base=buildingParts(kind,12),crest=buildingParts(kind,13);
  assert.equal(crest.length,base.length);
  assert.deepEqual(crest.slice(0,-1),base.slice(0,-1));
  assert.deepEqual(crest.at(-1),{...base.at(-1),frame:'part_crest'});
  assert.deepEqual(buildingParts(kind,16),crest);
  assert.deepEqual(buildingParts(kind,17),base);
  assert.deepEqual(buildingParts(kind,21),crest);
 }
});
class Sprite {
 constructor(){this.children=[];this.width=108;this.scaleX=1;this.graphics={clear(){},drawLine(){}};}
 addChild(n){this.children.push(n);}destroyChildren(){this.children=[];}pos(x,y){this.x=x;this.y=y;return this;}size(w,h){this.width=w;this.height=h;return this;}pivot(x,y){this.pivotX=x;this.pivotY=y;return this;}
}
global.Laya={Sprite,Text:class extends Sprite{static SHRINK='shrink';}};
test('parts are stable between frames; new villages suppress stale upgrade feedback and mirrored towers keep readable badges',()=>{
 const owner=new Sprite(),art={get:id=>id},v=new BuildingVisuals(owner,art);
 owner.scaleX=-1;v.sync('ARROW',13,true);const children=v.parts.children;assert.equal(children.at(-1).scaleX,-1);assert.equal(v.flash.visible,false);
 v.sync('ARROW',13,false);assert.equal(v.parts.children,children);
 v.sync('ARROW',14,false);assert.equal(v.flash.visible,true);v.advance(1);assert.equal(v.flash.visible,false);
 v.sync('ARROW',15,false);v.sync('ARROW',15,true);assert.equal(v.flash.visible,false);
 v.sync(null,0,false);assert.equal(v.parts.children.length,0);
});
test('four-digit badges keep the exact level inside the existing single-line box',()=>{
 const owner=new Sprite(),v=new BuildingVisuals(owner,{get:id=>id});
 for(const level of [1000,1001]){
  v.sync('GATE',level,false);
  const badge=v.parts.children.at(-1);
  assert.equal(badge.text,String(level));assert.equal(badge.overflow,Laya.Text.SHRINK);assert.equal(badge.wordWrap,false);
  assert.equal(badge.width,70*owner.width/128);assert.equal(badge.height,28*owner.width/128);
 }
});
test('same-level fresh village keeps the baseline for its first upgrade flash',()=>{
 const v=new BuildingVisuals(new Sprite(),{get:id=>id});
 v.sync('HOUSE',1,true);v.sync('HOUSE',1,true);assert.equal(v.flash.visible,false);
 v.sync('HOUSE',2,false);assert.equal(v.flash.visible,true);
});
