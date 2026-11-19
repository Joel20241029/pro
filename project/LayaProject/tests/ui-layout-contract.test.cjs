const fs = require('node:fs');
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
class Sprite{
 constructor(){this.name='';this.children=[];this.x=this.y=0;this.events={};this.graphics={save(){},scale(){},draw9Grid(){},restore(){}};}
 size(width,height){Object.assign(this,{width,height});return this;}
 pos(x,y){Object.assign(this,{x,y});return this;}
 pivot(pivotX,pivotY){Object.assign(this,{pivotX,pivotY});return this;}
 scale(scaleX,scaleY){Object.assign(this,{scaleX,scaleY});return this;}
 addChild(c){c.parent=this;this.children.push(c);return c;}
 getChildByName(name){return this.children.find(c=>c.name===name);}
 on(type,caller,fn){this.events[type]=fn.bind(caller);}
}
class Text extends Sprite{get textWidth(){return this.text.length*this.fontSize;}}
const Tween={killAll(){},create(target){return {duration(){return this;},to(key,value){target[key]=value;return this;},ease(){return this;}};}};
global.Laya={Sprite,Text,Tween,Ease:{elasticOut(){}},Event:{MOUSE_DOWN:'down',MOUSE_UP:'up',MOUSE_OUT:'out',UNDISPLAY:'hidden',CLICK:'click'},InputManager:{cancelClick(){} }};
const base=process.env.DAIDAI_TEST_BUILD;
const {SpriteFrames}=require(path.join(base,'view/SpriteFrames.js')),{UiWidgets}=require(path.join(base,'view/UiWidgets.js'));
// 完整世界在建筑包就绪后创建；世界阴影随建筑包，UI图标仍在基础包。
const frames=JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/resources/gameplay/map/frames.bin'), 'utf8')).frames,art=new SpriteFrames();
for(const [id,f]of Object.entries(frames)){art.layouts.set(id,f);art.textures.set(id,{id});}
const near=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('all nine-slice surfaces preserve drawing state and leave a positive center at actual button sizes',()=>{
 for(const id of Object.keys(frames).filter(id=>frames[id].nineSlice))for(const [w,h]of [[54,54],[110,44],[192,104],[600,78],[584,208],[668,860]]){
  const calls=[],s=new Sprite();s.size(w,h);s.graphics={save(){calls.push('save');},scale(x,y){calls.push([x,y]);},draw9Grid(t,x,y,w,h,g){calls.push({w,h,g});},restore(){calls.push('restore');}};
  art.panel(s,id,w,h);assert.equal(calls[0],'save');assert.equal(calls[3],'restore');const scale=calls[1][0],draw=calls[2];
  near(draw.w*scale,w);near(draw.h*scale,h);assert(draw.w>draw.g[1]+draw.g[3]);assert(draw.h>draw.g[0]+draw.g[2]);assert.equal(s.width,w);assert.equal(s.height,h);assert.equal(s.children.length,0);
 }
});
test('trimmed UI icons fit their box and have a centered visible outline',()=>{
 const ui=new UiWidgets(art,()=>{}),parent=new Sprite();
 for(const id of ['icon_food','icon_wood','icon_population','icon_house']){
  const image=ui.image(parent,id,12,24,44,44),child=image.children[0],f=frames[id],scale=child.width/f.sourceSize.w;
  const x=child.x+f.trimOffset.x*scale,y=child.y+f.trimOffset.y*scale;
  assert(x>=-1e-6&&y>=-1e-6);near(x+f.rect.w*scale/2,22);near(y+f.rect.h*scale/2,22);
 }
});
test('world shadows keep the authored canvas and contact anchor instead of using icon fit',()=>{
 const ui=new UiWidgets(art,()=>{}),image=ui.image(new Sprite(),'shadow_actor',10,20,120,120,false);
 assert.equal(image.texture.id,'shadow_actor');assert.equal(image.children.length,0);assert.equal(image.x,10);assert.equal(image.y,20);assert.equal(image.width,120);
});
test('the skin, caption and icon share one pressed face with a fixed outer hit area',()=>{
 const ui=new UiWidgets(art,()=>{}),button=ui.button(new Sprite(),'建设',10,20,160,()=>{});ui.buttonIcon(button,'icon_build',40);
 const face=button.getChildByName('buttonFace');assert(face.getChildByName('buttonIcon'));assert(face.getChildByName('buttonText'));
 const center=[face.x,face.y];button.events.down({touchId:1});assert(face.scaleX>1&&face.scaleY<1);
 assert.deepEqual([face.x,face.y],center);assert.equal(button.y,20);button.events.up({touchId:1});assert.equal(face.scaleY,1);
});
