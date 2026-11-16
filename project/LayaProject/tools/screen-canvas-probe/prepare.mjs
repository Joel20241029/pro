import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../../..');
const out=process.argv[2];
if(!out||!path.isAbsolute(out))throw Error('Provide an absolute Downloads output directory');
// 不覆盖正式包；源代码放 tools 下，输出仅允许下载目录中的独立验证工程。
if(!path.resolve(out).startsWith('/Users/happyelements/Downloads/'))throw Error('Probe output must be under Downloads');
await fs.mkdir(path.join(out,'libs'),{recursive:true});await fs.mkdir(path.join(out,'openDataContext'),{recursive:true});
for(const file of ['weapp-adapter.js','libs/laya.core.js','libs/laya.webgl_2D.js','libs/laya.adapter-weixin.js'])await fs.copyFile(path.join(root,'tryVersion/wxgame',file),path.join(out,file));
for(const file of ['engine.js','render.js','LICENSE'])await fs.copyFile(path.join(root,'project/LayaProject/build-templates/wxgame/openDataContext',file),path.join(out,'openDataContext',file));
await fs.copyFile(path.join(here,'game.js'),path.join(out,'game.js'));await fs.copyFile(path.join(here,'open-data.js'),path.join(out,'openDataContext/index.js'));
await fs.writeFile(path.join(out,'game.json'),JSON.stringify({deviceOrientation:'portrait',showStatusBar:false,openDataContext:'openDataContext',iOSHighPerformance:false,'iOSHighPerformance+':false},null,2));
await fs.writeFile(path.join(out,'project.config.json'),JSON.stringify({appid:'wx46e59dc5dc95b52f',projectname:'DaiDai-ScreenCanvas-Probe',compileType:'game',libVersion:'latest',setting:{urlCheck:false,es6:false,minified:false}},null,2));
console.log(out);
