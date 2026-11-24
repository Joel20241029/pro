// Materialize the approved local clips into the runtime recipe and editable Laya prefabs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const res = fileURLToPath(new URL('../..', import.meta.url));
const sourceDir = 'source/rendered2d/production/building-motion';
const workshop = path.join(res, 'editor/BuildingWorkshop/assets/buildingAuthoring');
const recipePath = path.join(res, 'source/asset_recipe.json');
const recipe = JSON.parse(fs.readFileSync(recipePath));
const approved = JSON.parse(fs.readFileSync(path.join(res, sourceDir, 'layers.json')));
const masterHash = createHash('sha256').update(fs.readFileSync(path.join(res, sourceDir, 'approved-sheet.png'))).digest('hex');
// The palisade is authored in the current cartoon renderer. Preserve its source, geometry
// and hashes when regenerating the workshop from the older building contact sheet.
const gateArt = new Map(recipe.assets.filter(a =>
    a.id === approved.gate.body.id || a.animation === 'motion_gate_doors'
).map(a => [a.id, a]));
const obsolete = /^(?:hd_(?:arrow|stone|slow|gate|house|farm|logging|part)_|hd_village_part_|farm_crop_|patrol_booth_|hearth_burn_|building_hearth_lit$|motion_)/;
const uuid = name => {
    const h = createHash('sha256').update('daidai-building-motion/' + name).digest('hex');
    return [h.slice(0,8), h.slice(8,12), h.slice(12,16), h.slice(16,20), h.slice(20,32)].join('-');
};
recipe.assets = recipe.assets.filter(a => !a.id.startsWith('motion_'));
for (const a of recipe.assets) if (obsolete.test(a.id)) a.runtime = false;
recipe.animations.animations = recipe.animations.animations.filter(a => a.id !== 'hearth_burn' && !/^(motion_|farm_crop_)/.test(a.id));
const asset = (id, animation = null) => {
    fs.writeFileSync(path.join(workshop, 'textures', id + '.png.meta'),
        JSON.stringify({ uuid: uuid(id), importer: { textureType: 2 } }, null, 2) + '\n');
    if (gateArt.has(id)) {
        const current = gateArt.get(id);
        recipe.assets.push(current);
        return { w: current.width, h: current.height };
    }
    const sourceSheet = sourceDir + '/' + id + '.png';
    const header = fs.readFileSync(path.join(res, sourceSheet));
    const w = header.readUInt32BE(16), h = header.readUInt32BE(20);
    const rect = { x: 0, y: 0, w, h };
    recipe.assets.push({ id, label: id, category: 'building-parts', categoryLabel: '建筑动效',
        path: 'runtime/building-parts/' + id + '.png', width: w, height: h, pivot: { x: 0, y: 0 },
        sourceSheet, sourceRect: rect, sourceCropWithinCell: rect, nineSlice: null, mapping: '',
        animation, fitPadding: 0, resizeMode: 'stretch', sampling: 'Lanczos', runtime: true,
        usage: '固定建筑主体或局部动画拆件', bundle: 'buildings',
        provenance: {
            source: sourceDir + '/approved-sheet.png',
            sourceHash: masterHash,
            outputHash: createHash('sha256').update(header).digest('hex')
        } });
    return { w, h };
};
const sprite = (name, props = {}, children) => ({
    _$id: uuid(name).slice(0, 8), _$type: 'Sprite', name, ...props,
    ...(children ? { _$child: children } : {})
});
const piece = (name, p, id = p.id) => sprite(name, {
    x: p.x, y: p.y, width: p.w, height: p.h, texture: { _$uuid: uuid(id), _$type: 'Texture' }
});
const clipNode = clip => piece(
    clip.id === 'motion_gate_doors' ? 'GateDoors' : (clip.attack ? 'Attack:' : 'Loop:') + clip.id,
    clip, clip.rest
);
const upgrades = JSON.parse(fs.readFileSync(path.join(workshop, 'animations/upgrade.mc.meta'))).uuid;
asset('motion_patrol_icon');
for (const [id, art] of Object.entries(approved)) {
    const kind = id.toUpperCase(), file = path.join(workshop, 'prefabs', kind + '.lh');
    const prior = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : null;
    const first = prior?._$child[0];
    const markers = first?._$child?.filter(n => ['VisualBounds','Footprint','SortOrigin'].includes(n.name))
        ?? ['VisualBounds','Footprint','SortOrigin'].map(name =>
            sprite(name, name === 'SortOrigin' ? { visible: false, x: 64, y: 120 } : { visible: false }));
    const bodyKids = [piece('Structure', art.body)];
    const layoutKids = [];
    asset(art.body.id);
    for (const clip of art.clips) {
        const sizes = [...new Set([...clip.frames, clip.rest])].map(id => asset(id, clip.id));
        const [canvas] = sizes;
        if (sizes.some(({ w, h }) => w !== canvas.w || h !== canvas.h))
            throw new Error('建筑局部动画帧尺寸不一致：' + clip.id);
        recipe.animations.animations.push({
            id: clip.id, frameIds: clip.frames, frameCount: clip.frames.length, fps: clip.fps, loop: !clip.attack,
            restFrame: clip.rest, category: 'building-parts', canvas,
            pivot: { x: 0, y: 0 }, clock: clip.attack ? 'battle_shot' : 'scene_visual_or_battle'
        });
    }
    if (art.muzzle) {
        const [x,y] = art.muzzle;
        const attackNodes = art.clips.map(clipNode);
        const muzzle = sprite('Muzzle',{x,y,width:0,height:0});
        const weapon = id === 'arrow' ? [
            sprite('FacingRight',{},[...attackNodes,muzzle]),
            sprite('FacingLeft',{x:128,scaleX:-1,visible:false},[...attackNodes,muzzle])
        ] : [...attackNodes,muzzle];
        // Match the existing rage orbit anchor at the mounting point on top of the tower.
        bodyKids.push(sprite('Weapon',{width:128,height:id === 'slow' ? 46 : 58},weapon));
    } else {
        bodyKids.push(...art.clips.filter(c => c.id !== 'motion_farm_wheel').map(clipNode));
    }
    if (art.wheel) {
        const x=104, y=93, p=art.wheel, clip=art.clips.find(c => c.id === 'motion_farm_wheel');
        asset(p.id);
        layoutKids.push(sprite('AboveGround',{x,y},[
            piece('WheelBase',{...p,x:p.x-x,y:p.y-y}),
            clipNode({...clip,x:clip.x-x,y:clip.y-y})
        ]));
        markers.push(sprite('AboveFootprint',{x:91,y:85,width:26,height:8,visible:false}));
    }
    const applyUpgrade = nodes => {
        for (const node of nodes) {
            if (node._$child) applyUpgrade(node._$child);
            else if (node.name.startsWith('Attack:') || node.name === 'GateDoors' ||
                /^(Loop:motion_(?:house_window|farm_wheat|logging_saw|patrol_lantern))$/.test(node.name)) {
                node._$comp = [{ _$type: 'AnimatorClip2D', clip: { _$uuid: upgrades }, autoPlay: false }];
            }
        }
    };
    applyUpgrade(bodyKids);
    const body = sprite('Body',{x:64,y:120,width:128,height:128,anchorX:.5,anchorY:.9375},bodyKids);
    const root=prior ?? sprite(kind,{width:128,height:128});
    root._$child=[sprite(kind+'_1_1',{width:128,height:128},[body,...layoutKids,...markers])];
    // Assign stable unique IDs even when both arrow facings reuse the same frame textures.
    const identify = (node,parent) => {
        const key=parent+'/'+node.name;
        node._$id=uuid(key).slice(0,8);
        node._$child?.forEach(n => identify(n,key));
    };
    // The two facings need distinct child objects before IDs are assigned.
    const exportRoot=JSON.parse(JSON.stringify(root));
    identify(exportRoot,'prefab');
    fs.writeFileSync(file,JSON.stringify(exportRoot,null,2)+'\n');
    if (!prior) fs.writeFileSync(file+'.meta',JSON.stringify({uuid:uuid(kind + '.lh')},null,2)+'\n');
}
fs.writeFileSync(recipePath,JSON.stringify(recipe,null,2)+'\n');
