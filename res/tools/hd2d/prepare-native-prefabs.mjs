import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { productionBuildings } from '../../source/rendered2d/building-layouts.mjs';
import { productionEnemyFrames, productionEnemyShadow, enemyMotionProfiles, enemyContactShadow } from '../../source/rendered2d/enemy-layouts.mjs';

// 日常图集构建只读原生.lh。明确重做布局时才更新种子并在Laya菜单中重新保存预制体。
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// 已存在的Laya资产由编辑器持有UUID；此处只同步贴图和种子，绝不手写.lh或重写.meta。
const target = path.join(root, 'editor/BuildingWorkshop/assets');
const recipe = JSON.parse(fs.readFileSync(path.join(root, 'source/rendered2d/production_recipe.json')));
for (const asset of recipe.assets.filter(a => ['building-parts', 'enemies', 'enemy-parts'].includes(a.category) || a.id === enemyContactShadow.frame)) {
    const family = asset.category === 'building-parts' ? 'buildingAuthoring' : 'enemyAuthoring';
    const file = path.join(target, family, 'textures', asset.id + '.png');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.copyFileSync(path.join(root, asset.sourceSheet), file);
}
const buildingData = Object.values(productionBuildings());
const enemyData = [];
for (const clip of recipe.animations.animations.filter(c => c.category === 'enemies')) {
    const frames = productionEnemyFrames(clip);
    const data = { name: clip.mapping, width: 96, height: 96, children: [productionEnemyShadow(clip.mapping), ...frames,
        { name: 'SortOrigin', x: 48, y: enemyMotionProfiles[clip.mapping].foot, width: 0, height: 0, visible: false },
        { name: 'VisualBounds', x: 0, y: 0, width: 96, height: 96, visible: false }] };
    enemyData.push(data);
}
fs.writeFileSync(path.join(root, 'source/rendered2d/native-layout-seeds.json'), JSON.stringify({ buildings: buildingData, enemies: enemyData }, null, 2) + '\n');
console.log(JSON.stringify({ target, buildings: buildingData.length, enemies: enemyData.length, next: 'Enemy-only changes: Laya Tools / RefineHdEnemyAttachments; do not rebuild buildings' }));
