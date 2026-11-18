import fs from 'node:fs';
import path from 'node:path';

// 按半分辨率农田画布定位四块作物。范围留出少量固定土床用于拼接，底下的田埂不变形。
const farmPockets = [
    [[21,29,40,31],[69,34,34,26],[16,69,43,31],[71,69,39,29]],
    [[17,31,41,32],[64,35,35,27],[13,71,43,29],[64,72,39,28]],
    [[24,49,38,25],[70,52,32,21],[24,79,36,24],[69,79,34,24]],
    [[23,49,37,26],[68,51,32,23],[22,79,36,24],[68,79,34,25]]
];
const shared = ['brace', 'rivet', 'crest', 'banner'];

// 帧仅替换各块叶片所在的小矩形。形变在边缘收束至零，避免叠影和色缝。
function ripple(source, width, [x,y,w,h], amount, rooted = true) {
    const output = Buffer.alloc(w*h*4);
    for (let row=0; row<h; row++) for (let col=0; col<w; col++) {
        const edge = Math.min(1,col/4,(w-1-col)/4,row/3,(h-1-row)/3);
        const bias = rooted ? 1-row/h : 1;
        const sx = x+col+amount*edge*bias;
        const left = Math.floor(sx), mix = sx-left;
        const start = ((y+row)*width+left)*4, end = (row*w+col)*4;
        for (let c=0; c<4; c++) output[end+c]=Math.round(source[start+c]*(1-mix)+(source[start+4+c]??0)*mix);
    }
    return output;
}

export function prepareVillageMotion({root, work, assets, run, importImage, clip}) {
    const find = id => {
        const a=assets.find(item=>item.id===id);
        if (!a) throw new Error('缺少村内动件原稿：'+id);
        return a;
    };
    const raw = asset => run([path.join(root,asset.sourceSheet),'-depth','8','rgba:-']);
    function derive(id, png, width, height, source, args = {}) {
        const file = path.join(work,id+'-source.png');
        fs.writeFileSync(file,png);
        const pivot = args.pivot ?? {x:width/2,y:height};
        importImage({id,source:path.relative(root,file),category:args.category ?? 'building-parts', width,height,pivot,alphaCutoff:0,fullCanvas:true});
        const asset = find(id);
        Object.assign(asset.provenance,{source:source.provenance.source,sourceHash:source.provenance.sourceHash,derivedFrom:source.id},args.placement && {placement:args.placement});
    }
    for (const name of shared) {
        const a=find('hd_part_'+name), width=a.width/2, height=a.height/2;
        derive('hd_village_part_'+name,run([path.join(root,a.sourceSheet),'-filter','Lanczos','-resize',width+'x'+height+'!','png:-']),width,height,a,
            {pivot:{x:a.pivot.x/2,y:a.pivot.y/2}});
    }
    for (const [stage,pockets] of farmPockets.entries()) {
        const source=find('hd_farm_body_'+stage), rgba=raw(source);
        for (const [plot,placement] of pockets.entries()) {
            const [, ,w,h]=placement, name=`farm_crop_${stage}_${plot}`;
            const frames=[0,2,0,-2].map((amount,frame) => {
                const id=`${name}_${frame}`;
                const data=ripple(rgba,source.width,placement,amount);
                const input=path.join(work,id+'.rgba');
                fs.writeFileSync(input,data);
                derive(id, run(['-size',w+'x'+h,'-depth','8','rgba:'+input,'png:-']),w,h,source, {placement});
                return id;
            });
            clip(name,frames,3,'building-parts','detached crop detail');
        }
    }
    const torch=find('deco_torch'), source=raw(torch), flameRows=25, flameRect=[0,0,torch.width,flameRows];
    const fireFrames=['deco_torch'];
    for (const [index,amount] of [3,-3].entries()) {
        const data=Buffer.from(source), wave=ripple(source,torch.width,flameRect,amount,false);
        wave.copy(data);
        const id='torch_burn_'+(index+1), input=path.join(work,id+'.rgba');
        fs.writeFileSync(input,data);
        derive(id,run(['-size',torch.width+'x'+torch.height,'-depth','8','rgba:'+input,'png:-']),torch.width,torch.height,torch,
            {category:'decorations',pivot:torch.pivot});
        fireFrames.push(id);
    }
    clip('torch_burn',fireFrames,6,'decorations','detached gate torch flame');
    const house=find('hd_house_body_0');
    derive('hd_village_window_glow',run(['-size','28x20','radial-gradient:rgba(255,197,66,0.85)-rgba(255,174,40,0)','png:-']),28,20,house);
}
