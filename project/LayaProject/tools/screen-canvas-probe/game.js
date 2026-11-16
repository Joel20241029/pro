// 独立验证项目：先固定开放域模式，再启动 Laya。禁止把此入口复制进正式包。
const openData = wx.getOpenDataContext({ sharedCanvasMode: 'screenCanvas' });
const shared = openData.canvas;
require('./weapp-adapter.js');
require('./libs/laya.core.js');
require('./libs/laya.webgl_2D.js');
require('./libs/laya.adapter-weixin.js');
Laya.init(720, 1280).then(() => {
    Laya.stage.scaleMode = 'fixedwidth'; Laya.stage.bgColor = '#6e8944';
    const label = (text,x,y,w,size=28) => {
        const node = new Laya.Text(); node.text=text;node.color='#fff4d9';node.fontSize=size;node.size(w,64);node.pos(x,y);node.align='center';Laya.stage.addChild(node);return node;
    };
    label('screenCanvas × Laya 3.4.2',20,140,680,32);
    label('独立绘制验证 · 不读取或修改云成绩',20,194,680,24);
    const area=new Laya.Sprite();area.pos(60,280);area.size(600,680);Laya.stage.addChild(area);
    let visible=true,template=false,shifted=false;
    const status=label('',20,990,680,24);
    function place() {
        const at=Laya.SpriteUtils.getTransformRelativeToWindow(area,0,0);
        if(!shared.style)throw Error('screenCanvas style is unavailable');
        if(!visible) {shared.style.width='1px';shared.style.height='1px';shared.style.left='-100px';shared.style.top='-100px';}
        else {shared.style.width=`${600*at.scaleX}px`;shared.style.height=`${680*at.scaleY}px`;shared.style.left=`${at.x}px`;shared.style.top=`${at.y}px`;}
        openData.postMessage({type:visible?(template?'probe-template':'probe-plain'):'probe-hide',box:{x:at.x,y:at.y,width:600*at.scaleX,height:680*at.scaleY}});
        status.text=visible?(template?'模板列表：检查上下滑动':'基础色块：确认文字与边界均可见'):'画布已隐藏：检查绿色背景完整露出';
        console.info('[screenCanvas-probe]',{visible,template,x:at.x,y:at.y,width:600*at.scaleX,height:680*at.scaleY});
    }
    function button(text,x,action) {
        const n=new Laya.Sprite();n.pos(x,1064);n.size(202,72);n.mouseEnabled=true;n.graphics.drawRect(0,0,202,72,'#fff1cb');Laya.stage.addChild(n);
        const t=new Laya.Text();t.text=text;t.color='#48311f';t.fontSize=28;t.size(202,72);t.align='center';t.valign='middle';t.mouseEnabled=false;n.addChild(t);n.on(Laya.Event.CLICK,null,action);
    }
    button('色块 / 模板',28,()=>{template=!template;visible=true;place();});
    button('隐藏 / 重开',259,()=>{visible=!visible;place();});
    button('移动布局',490,()=>{shifted=!shifted;area.pos(shifted?82:60,shifted?300:280);place();});
    const close=new Laya.Sprite();close.pos(624,226);close.size(62,48);close.mouseEnabled=true;close.graphics.drawRect(0,0,62,48,'#a63b2f');Laya.stage.addChild(close);
    const text=new Laya.Text();text.text='关闭';text.fontSize=23;text.color='#fff4d9';text.size(62,48);text.align='center';text.valign='middle';close.addChild(text);
    close.on(Laya.Event.CLICK,null,()=>{visible=false;place();});
    shared.width=600;shared.height=680;
    Laya.stage.on(Laya.Event.RESIZE,null,place);
    wx.onHide(()=>{shared.style.width='1px';shared.style.height='1px';shared.style.left='-100px';shared.style.top='-100px';openData.postMessage({type:'probe-hide'});});
    wx.onShow(place);place();
}).catch(error=>console.error('[screenCanvas-probe] initialization failed',error));
