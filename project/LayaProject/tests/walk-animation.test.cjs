const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {WalkAnimation}=require(path.join(process.env.DAIDAI_TEST_BUILD,'view/WalkAnimation.js'));
const {VillagerMotion}=require(path.join(process.env.DAIDAI_TEST_BUILD,'view/VillagerMotion.js'));
const {createGame}=require(path.join(process.env.DAIDAI_TEST_BUILD,'game/VillageRules.js'));
const recipe=require('../../../res/source/rendered2d/production_recipe.json');
const clips=new Map(recipe.animations.animations.map(c=>[c.id,c]));
const art={animation:id=>clips.get(id)};
test('all four identities have eight distinct true views, neutral rests and a measured stride',()=>{
 for(const identity of ['male_a','female_a','boy','elder_male']) for(const direction of ['','_left','_up','_right']){
  const c=clips.get(`villager_${identity}_walk${direction}`);
  assert.equal(c.frameIds.length,8);assert(!c.frameIds.includes(c.restFrame));assert(c.stridePixels>0);
  const frames=c.frameIds.map(id=>recipe.assets.find(a=>a.id===id));
  assert.equal(new Set(frames.map(a=>a.provenance.outputHash)).size,8);
  assert(frames.every(a=>a.width===c.canvas.w && a.pivot.y===frames[0].pivot.y));
 }
});
test('distance drives both feet; stop/start and direction changes retain the same gait phase',()=>{
 const walk=new WalkAnimation(art),id='villager_male_a_walk',c=clips.get(id),width=84,stride=c.stridePixels/c.canvas.w*width;
 const pose={id:'test',walkDistance:0,walking:true};
 for(let i=0;i<8;i++){
  pose.walkDistance=(i+.1)*stride/8;
  assert.equal(walk.frame(pose,id,width),c.frameIds[i]);
  pose.walking=false;assert.equal(walk.frame(pose,id,width),c.restFrame);
  pose.walking=true;assert.equal(walk.frame(pose,id,width),c.frameIds[i]);
  assert.equal(walk.frame(pose,id+'_right',width),clips.get(id+'_right').frameIds[i]);
 }
 // A resize must not recalculate the past distance with the new scale.
 assert.equal(walk.frame(pose,id,width*1.25),c.frameIds[7]);
 pose.walkDistance+=stride*1.25/8;assert.equal(walk.frame(pose,id,width*1.25),c.frameIds[0]);
 walk.retain(new Set());pose.walkDistance=0;assert.equal(walk.frame(pose,id,width),c.frameIds[0]);
});
test('1x/2x/3x movement advances the same phase for the same total travel, without another time multiplier',()=>{
 const id='villager_female_a_walk_left',c=clips.get(id),width=84,stride=c.stridePixels/c.canvas.w*width;
 for(const speed of [1,2,3]){
  const walk=new WalkAnimation(art),pose={id:'test',walkDistance:0,walking:true};
  for(let i=0;i<24/speed;i++){pose.walkDistance+=stride/32*speed;walk.frame(pose,id,width);}
  const phase=walk.frame(pose,id,width);assert([c.frameIds[5],c.frameIds[6]].includes(phase));
 }
});
test('motion distance counts each route segment, stays frozen when paused, and never changes game data',()=>{
 const s=createGame(17),before=JSON.stringify(s),motion=new VillagerMotion();motion.sync(s,s.towers);
 let moving=0,stopped=0;
 for(let i=0;i<1000;i++){
  const old=s.people.map(p=>({...motion.get(p.id)}));motion.update(.05);
  s.people.forEach((p,j)=>{const a=old[j],b=motion.get(p.id),delta=b.walkDistance-a.walkDistance;
   assert(delta>=0);assert(delta+1e-7>=Math.hypot(a.x-b.x,a.y-b.y));
   if(delta>0)moving++;else stopped++;
  });
 }
 const saved=s.people.map(p=>motion.get(p.id).walkDistance);motion.update(0);motion.sync(s,s.towers);
 assert.deepEqual(s.people.map(p=>motion.get(p.id).walkDistance),saved);assert(moving&&stopped);assert.equal(JSON.stringify(s),before);
});
