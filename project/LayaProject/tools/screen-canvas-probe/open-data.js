const Layout=require('./engine.js').default,render=require('./render.js');
const canvas=wx.getSharedCanvas(),ctx=canvas.getContext('2d');
wx.onMessage(message=>{
    Layout.clearAll();ctx.clearRect(0,0,canvas.width,canvas.height);
    if(message.type==='probe-hide')return;
    if(message.type==='probe-plain') {
        ctx.fillStyle='#ffdf7e';ctx.fillRect(0,0,600,680);
        ctx.fillStyle='#bb382a';ctx.fillRect(12,12,576,100);
        ctx.font='bold 32px sans-serif';ctx.textAlign='center';ctx.fillStyle='#ffffff';ctx.fillText('开放域基础绘制正常',300,78);
        for(let i=0;i<4;i++){ctx.fillStyle=i%2?'#39732f':'#4a89c5';ctx.fillRect(24,150+i*112,552,90);}
        console.info('[screenCanvas-probe] plain drawn');return;
    }
    // 只测试模板与触摸滚动，静态样例不会调用好友API、云成绩读取或写入。
    const rows=Array.from({length:20},(_,i)=>({rank:i+1,nickname:`绘制测试 ${i+1}`,score:0,avatarUrl:''}));
    Layout.init(render.template(rows,0),render.style,render.decode);Layout.updateViewPort(message.box);Layout.layout(ctx);
    console.info('[screenCanvas-probe] template drawn');
});
