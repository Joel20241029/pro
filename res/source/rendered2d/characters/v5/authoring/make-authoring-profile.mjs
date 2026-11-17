import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const work=path.dirname(fileURLToPath(import.meta.url));
const [role]=process.argv.slice(2);
const target=path.join(work,'models',role);
const config=JSON.parse(fs.readFileSync(path.join(work,'rig-landmarks.json')))[role];
if(!config)throw Error('Missing inspected hip, knees, shoulders and palm landmarks for '+role);
const donor=JSON.parse(fs.readFileSync(`/Users/happyelements/Documents/pro/res/source/rendered2d/characters/v4/${role}/rig-profile.json`));
const bones={};
const set=(key,start,end,parent)=>bones[key]=[start,end,parent];
const {neck,hips,ankle,legX,shoulder,elbow,hand,shoeY,legEnd,amplitude,armBottom,armMaxY,armOuterX,shoeTop=.048,cane}=config;
set('Root',[0,0,0],[0,0,.055],null);
set('Hips',[0,0,hips],[0,0,hips+.05],'Root');
set('Spine',[0,0,hips+.05],[0,-.024,neck],'Hips');
set('Head',[0,-.024,neck],[0,-.03,.86],'Spine');
for(const [side,sign] of [['L',1],['R',-1]]){
    const onSide=([x,y,z])=>[x*sign,y,z];
    const upper=onSide([legX,.015,hips]);
    const knee=onSide([legX,shoeY+.02,(hips+ankle)*.5]);
    const lower=onSide([legX,shoeY+.035,ankle]);
    set('Thigh.'+side,upper,knee,'Hips');
    set('Shin.'+side,knee,lower,'Thigh.'+side);
    set('Foot.'+side,lower,onSide([legX,shoeY-.052,.022]),'Shin.'+side);
    const a=onSide(config[side]?.shoulder??shoulder),b=onSide(config[side]?.elbow??elbow),c=onSide(config[side]?.hand??hand);
    set('UpperArm.'+side,a,b,'Spine');
    set('Forearm.'+side,b,c,'UpperArm.'+side);
    set('Hand.'+side,c,[c[0]+.009*sign,c[1]-.012,c[2]-.03],'Forearm.'+side);
}
if(cane) set('Cane',cane.grip,cane.tip,'Spine');
const motions=Array.from({length:6},(_,i)=>{
    const left=i<3,t=i%3/3,contact=[amplitude*(t*2-1),0];
    const swing=[amplitude*Math.cos(Math.PI*t),(.018+(i>2?.002:0))*Math.sin(Math.PI*t)];
    return {L:left?contact:swing,R:left?swing:contact,support:left?'L':'R',
        bodyY:0,bodyZ:role==='elder'?0:-.022-.005*Math.cos(Math.PI*t)**2-(i===5?.003:0),
        swing:-Math.cos(Math.PI*i/3)};
});
const p={...donor,role,bones,poses:motions,fps:12,cane:cane?{min:cane.min,max:cane.max}:null,
    elbowBend:role==='elder'?0:-.06,armSwing:role==='elder'?0:-.25,
    basis:'Measured against the new approved outfit mesh; six alternating contact/pass poses',
    weightRegions:{centerX:0,headStart:neck,headRigidStart:neck+.024,legEnd,armBottom,
        armOuterX,armTop:shoulder[2]+.014,armMaxY,shoeRigidTop:shoeTop,upperBodyRigidStart:legEnd},
    idlePose:{L:[0,0],R:[0,0],swing:0,bodyY:0,bodyZ:0},
    walkCycle:{...donor.walkCycle,frames:6,strideModelUnits:amplitude*4,strideCanvasPixels:amplitude*4*256/1.3,orthoScale:1.3,
        supportSequence:motions.map(frame=>frame.support)}};
fs.writeFileSync(path.join(target,'rig-profile.json'),JSON.stringify(p,null,2)+'\n');
