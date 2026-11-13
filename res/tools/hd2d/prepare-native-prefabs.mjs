import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { productionBuildings } from '../../source/rendered2d/building-layouts.mjs';

// 明确重制的独立制作区；日常图集构建只读.lh，不能覆盖后续编辑器人工调整。
// 运行此脚本不替换旧正式prefab，不导出、不发布。
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const target = path.join(root, 'editor/BuildingWorkshop/assets/hd2dProduction');
const recipe = JSON.parse(fs.readFileSync(path.join(root, 'source/rendered2d/production_recipe.json')));
const uuid = value => { const h = crypto.createHash('sha256').update('daidai-hd2d:' + value).digest('hex'); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`; };
const textures = {};
for (const family of ['buildingAuthoring', 'enemyAuthoring']) {
    const dir = path.join(target, family); fs.mkdirSync(path.join(dir, 'textures'), { recursive: true }); fs.mkdirSync(path.join(dir, 'prefabs'), { recursive: true });
    const categories = family === 'buildingAuthoring' ? ['building-parts'] : ['enemies', 'enemy-parts'];
    for (const asset of recipe.assets.filter(a => categories.includes(a.category))) {
        const file = path.join(dir, 'textures', asset.id + '.png'); fs.copyFileSync(path.join(root, asset.sourceSheet), file);
        textures[asset.id] = uuid('texture/' + asset.id);
        fs.writeFileSync(file + '.meta', JSON.stringify({ uuid: textures[asset.id], importer: { textureType: 2 } }, null, 2));
    }
}
const clips = {};
for (const name of ['upgrade', 'attack']) {
    const source = path.join(root, 'editor/BuildingWorkshop/assets/buildingAuthoring/animations', name + '.mc');
    const file = path.join(target, 'buildingAuthoring/animations', name + '.mc'); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.copyFileSync(source, file);
    clips[name] = uuid('animation/' + name);
    fs.writeFileSync(file + '.meta', JSON.stringify({ uuid: clips[name] }, null, 2));
}
function native(node, parent = '') {
    const result = { _$id: uuid(parent + '/' + node.name).replaceAll('-', '').slice(0, 8), _$type: 'Sprite', name: node.name };
    for (const [key, value] of Object.entries(node)) {
        if (key === 'children') result._$child = value.map(child => native(child, parent + '/' + node.name));
        else if (key === 'frame') { if (!textures[value]) throw new Error('缺少制作纹理:' + value); result.texture = { _$uuid: textures[value], _$type: 'Texture' }; }
        else if (key === 'clip') result._$comp = [{ _$type: 'AnimatorClip2D', clip: { _$uuid: clips[value], _$type: 'AnimationClip2D' }, autoPlay: false }];
        else result[key] = value;
    }
    return result;
}
function save(family, data) {
    const file = path.join(target, family, 'prefabs', data.name + '.lh');
    fs.writeFileSync(file, JSON.stringify({ _$ver: 1, ...native(data) }, null, 2) + '\n');
    fs.writeFileSync(file + '.meta', JSON.stringify({ uuid: uuid(family + '/' + data.name) }, null, 2));
}
const buildingData = Object.values(productionBuildings());
const enemyData = [];
for (const data of buildingData) save('buildingAuthoring', data);
for (const clip of recipe.animations.animations.filter(c => c.category === 'enemies')) {
    const frames = clip.frameIds.map((id, i) => ({ name: 'Frame' + i, width: 96, height: 96, visible: i === 0,
        children: [{ name: 'Body', frame: id, width: 96, height: 96 },
            { name: 'HeadSocket', x: 48, y: ['enemy_boar', 'enemy_tuskking', 'enemy_wolfking'].includes(clip.mapping) ? 32 : 29, width: 0, height: 0 },
            { name: 'BackSocket', x: 48, y: 62, width: 0, height: 0 }] }));
    const data = { name: clip.mapping, width: 96, height: 96, children: [...frames,
        { name: 'SortOrigin', x: 48, y: 92, width: 0, height: 0, visible: false },
        { name: 'VisualBounds', x: 0, y: 0, width: 96, height: 96, visible: false }] };
    save('enemyAuthoring', data); enemyData.push(data);
}
fs.writeFileSync(path.join(target, 'layout-seeds.json'), JSON.stringify({ buildings: buildingData, enemies: enemyData }, null, 2));
fs.writeFileSync(path.join(target, 'README.md'), '# 高清正式替换制作区\n\n七种建筑分别一个预制体，包含108个等级/房数布局；十种怪物分别一个预制体，采用2～4帧正面整图与头背挂点。当前为未发布制作候选，尚需原生编辑器和正式游戏验证。\n\n纹理来自 `res/source/rendered2d/production_recipe.json`。`prepare-native-prefabs.mjs` 仅用于本次明确重制的初始化；编辑器调整后以 `.lh` 为准，不在日常构建中重新执行初始化。\n');
console.log(JSON.stringify({ target, buildings: 7, variants: 108, enemies: 10, status: 'staging_not_published' }));
