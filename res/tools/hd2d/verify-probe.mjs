/** Reproducible asset/road/evidence checks for the isolated HD probe, not gameplay. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const native = process.argv[2];
assert(native && path.isAbsolute(native), 'Pass the absolute native evidence directory in Downloads.');
const editor = 'res/editor/BuildingWorkshop/assets/';
const readJson = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifestPath = editor + 'hd2dAuthoring/texture-manifest.json';
const manifest = readJson(manifestPath);
const scenePath = editor + 'Hd2dProbe.ls';
const scene = readJson(scenePath);
const recipePath = 'res/design/hd2d/parts/probe-recipe.json';
const recipe = readJson(recipePath);
const report=JSON.parse(fs.readFileSync(path.join(native,'native-report.json'),'utf8'));
const expectedInputs = new Set([recipePath, ...recipe.evidenceInputs]);
for (const asset of recipe.assets) {
    expectedInputs.add(recipe.sourceRoot + '/' + asset.source);
    expectedInputs.add(recipe.output + '/' + asset.id + '.png');
    expectedInputs.add(recipe.output + '/' + asset.id + '.png.meta');
}
assert(Array.isArray(report.captureInputs) && Array.isArray(report.captureOutputs),
    'No capture-time provenance. Re-run native BuildHd2dProbe.');
assert.deepEqual(report.captureInputs.map(input => input.file).sort(), [...expectedInputs].sort());
assert.deepEqual(report.captureOutputs.map(output => output.file).sort(),
    [scenePath, ...['ARROW','STONE','SLOW'].map(kind => editor+'hd2dAuthoring/prefabs/'+kind+'.lh')].sort());
for (const captured of [...report.captureInputs, ...report.captureOutputs]) {
    assert.equal(sha(path.join(root, captured.file)), captured.sha256,
        'Native evidence is stale. Re-run BuildHd2dProbe: ' + captured.file);
}
assert.equal(report.pngBytes,manifest.pngBytes,'Re-run native BuildHd2dProbe after rebuilding assets');
const nodes = [];
function collect(node) { nodes.push(node); for (const child of node._$child || []) collect(child); }
collect(scene);

const uuids = new Map();
for (const asset of manifest.assets) {
    const relative = editor + 'hd2dAuthoring/textures/' + asset.id + '.png';
    assert.equal(sha(path.join(root, relative)), asset.sha256, 'Texture differs: ' + asset.id);
    uuids.set(readJson(relative + '.meta').uuid, asset.id);
}
assert.equal(manifest.pngBytes, manifest.assets.reduce((n,a) => n+a.bytes,0));
assert.equal(manifest.decodedRgbaBytes, manifest.assets.reduce((n,a) => n+a.width*a.height*4,0));
const motionChecks = [];
for (const [name, expected, fps] of [
    ['MaleOfflineWalk', ['male_walk_1','male_walk_2','male_walk_3','male_walk_4'], 6],
    ['FemaleOfflineWalk', ['female_walk_1','female_walk_2','female_walk_3','female_walk_4'], 6],
    ['ChildOfflineWalk', ['child_walk_1','child_walk_2','child_walk_3','child_walk_4'], 6],
    ['ElderOfflineWalk', ['elder_walk_1','elder_walk_2','elder_walk_3','elder_walk_4'], 4],
    ['BabyOfflineIdle', ['baby_idle_1','baby_idle_2','baby_idle_3','baby_idle_4'], 2],
    ['RaiderFrontWalk', ['raider_0','raider_1'], 6],
    ['FireFlame', ['env_flame_1','env_flame_2','env_flame_3','env_flame_4'], 6]]) {
    const node = nodes.find(n => n.name === name);
    assert(node, 'Missing motion node: ' + name);
    const motion = node._$comp.find(c => c.scriptPath === 'hd2dAuthoring/Hd2dProbeMotion.ts');
    const ids = motion.frames.map(frame => uuids.get(frame._$uuid));
    assert.deepEqual(ids, expected);
    assert.notEqual(motion.autoPlay, false);
    // Native serialization omits the component's existing 6 fps default.
    assert.equal(motion.fps ?? 6, fps, 'Incorrect authored cadence: ' + name);
    motionChecks.push({ name, frames: ids, fps, serializedAutoPlay: true });
}
assert.equal(nodes.find(n => n.name === 'HdButton')._$type, 'GImage');
assert(scene._$comp.some(c => c.scriptPath === 'hd2dAuthoring/Hd2dProbeViewport.ts'));
const top = scene._$child;
const world = top.find(n => n.name === 'World');
const shadows = top.find(n => n.name === 'GroundShadows');
const hud = top.find(n => n.name === 'ProbeHud');
assert(world && shadows && hud);
assert(top.indexOf(shadows) < top.indexOf(world) && top.indexOf(world) < top.indexOf(hud));
const fire = world._$child.find(n => n.name === 'Campfire');
assert.deepEqual(fire._$child.map(n => n.name), ['Base','FireFlame','FrontStones']);
for (const name of ['FriendshipRoadSign','VillageNameSign']) {
    const sign = world._$child.find(n => n.name === name);
    assert.deepEqual(sign._$child.map(n => n.name), ['WoodenBoard','Inscription']);
    assert.equal(sign._$child[1]._$type, 'Text');
}
assert(world._$child.some(n => n.name === 'MaleOfflineWalk'));

// Parse the real business path without executing or modifying gameplay code.
const ts = createRequire(import.meta.url)('/Applications/LayaAirIDE.app/Contents/Resources/node_modules/typescript');
const defensePath = 'project/LayaProject/src/config/DefenseConfig.ts';
const source = ts.createSourceFile(defensePath, fs.readFileSync(path.join(root,defensePath),'utf8'),ts.ScriptTarget.Latest,true);
let route;
for (const statement of source.statements) if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) if (declaration.name.getText(source)==='PATH') {
        assert(ts.isArrayLiteralExpression(declaration.initializer));
        route = declaration.initializer.elements.map(point => {
            assert(ts.isObjectLiteralExpression(point));
            const value = {};
            for (const p of point.properties) {
                assert(ts.isPropertyAssignment(p) && ts.isNumericLiteral(p.initializer));
                value[p.name.getText(source)] = Number(p.initializer.text);
            }
            return [value.x,value.y];
        });
    }
}
assert(route && route.length > 1, 'No literal PATH in current DefenseConfig');
const roadNode = nodes.find(n => n.name === 'SmoothRoad');
const road = path.join(root,editor,'hd2dAuthoring/textures/road_sprite.png');
const roadAsset = manifest.assets.find(a => a.id==='road_sprite');
const alpha = execFileSync('magick',[road,'-alpha','extract','-depth','8','gray:-'],{maxBuffer:8*1024*1024});
assert.equal(alpha.length,roadAsset.width*roadAsset.height);
let minimum=255,samples=0;
// 101 inclusive samples per path segment, matching the original 505-point check.
for (let i=1;i<route.length;i++) for (let j=0;j<=100;j++) {
    const t=j/100;
    // Scene zero coordinates are omitted by native serialization.
    const px=Math.floor((route[i-1][0]*(1-t)+route[i][0]*t-(roadNode.x ?? 0))*roadAsset.width/roadNode.width);
    const py=Math.floor((route[i-1][1]*(1-t)+route[i][1]*t-(roadNode.y ?? 0))*roadAsset.height/roadNode.height);
    assert(px>=0 && py>=0 && px<roadAsset.width && py<roadAsset.height,'Route outside road canvas');
    minimum=Math.min(minimum,alpha[py*roadAsset.width+px]);samples++;
}
assert(minimum>=128,'Route falls outside the opaque road surface');
const coverage={path:route,renderSize:[roadNode.width,roadNode.height],testedTextureSize:[roadAsset.width,roadAsset.height],samples,
    minimumAlphaOnSimulationPath:minimum,passed:true,scope:'path center only, not full enemy footprint'};
fs.writeFileSync(path.join(root,'res/design/hd2d/parts/road-coverage.json'),JSON.stringify(coverage,null,2)+'\n');

const out=path.join(root,'res/design/hd2d/validation');fs.mkdirSync(out,{recursive:true});
const samplesOut=[];
for(let i=0;i<4;i++) {
    const file='native_frame_'+i+'.png';const dest=path.join(out,file);
    fs.copyFileSync(path.join(native,'动态小场景_'+i+'.png'),dest);
    samplesOut.push({file,bytes:fs.statSync(dest).size,sha256:sha(dest)});
}
assert.equal(new Set(samplesOut.map(s=>s.sha256)).size,4,'Duplicate full-frame evidence');
assert.equal(report.occlusionChecks.length,6);
assert.equal(new Set(report.occlusionChecks.map(c=>c.prop+':'+c.side)).size,6);
for (const check of report.occlusionChecks) {
    assert(['OakNearRoad','FriendshipRoadSign','Campfire'].includes(check.prop));
    assert(['behind','front'].includes(check.side));
    assert.equal(check.side==='behind',check.actorIndex<check.propIndex);
    assert.equal(check.file,`occlusion_${check.prop}_${check.side}.png`);
    const target=path.join(out,check.file);
    fs.copyFileSync(path.join(native,check.file),target);
    check.sha256=sha(target); check.bytes=fs.statSync(target).size;
}
Object.assign(report,{samples:samplesOut,motionChecks,allFourNativeSamplesDiffer:true,
    validationInputs:[defensePath,'res/tools/hd2d/verify-probe.mjs',
        'res/source/rendered2d/characters/male/foot-validation.json'].map(file=>({file,sha256:sha(path.join(root,file))}))});
fs.writeFileSync(path.join(out,'native-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({textures:manifest.assets.length,motions:motionChecks,road:coverage,evidenceFrames:samplesOut.length,occlusionSamples:report.occlusionChecks.length}));
