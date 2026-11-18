import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { enemySources, buildingSheets, componentCells, iconCells, detailCells, panelCells, environmentSources } from '../../source/rendered2d/production-sources.mjs';
import { enemyMotionProfiles } from '../../source/rendered2d/enemy-layouts.mjs';
import { runtimeTextureSizes } from '../../source/rendered2d/runtime-texture-sizes.mjs';
import { fitVillageMap } from './fit-village-map.mjs';
import { importVillagers } from './import-villagers.mjs';
import { prepareVillageMotion } from './prepare-village-motion.mjs';

// 技术导入：清理生成稿的低alpha背景，再统一画布/足点和平滑缩小。
// 不绘制或替换主体，不镜像、不把静止图片伪装成行走；不会同步正式游戏。
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.join(root, 'source/rendered2d/production');
const args = process.argv.slice(2), work = args[args.indexOf('--work') + 1];
if (!work?.startsWith('/Users/happyelements/Downloads/')) throw new Error('显式 --work 必须位于 Downloads');
fs.mkdirSync(work, { recursive: true }); fs.mkdirSync(output, { recursive: true });
const magick = '/opt/homebrew/bin/magick';
const run = a => execFileSync(magick, a, { maxBuffer: 64 * 1024 * 1024 });
const geometry = ([x, y, w, h]) => `${w}x${h}+${x}+${y}`;
const size = file => run(['identify', '-format', '%w %h', file]).toString().split(' ').map(Number);
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const assets = [], animations = [], walkDirections = {}, laborDirections = {}, enemyNativeFacing = {};
const generated = name => `source/rendered2d/generated/${name}.png`;
// 整图已收录这些地形和点缀。原稿及裁片留作制作参考，不再随进村阶段发布。
const bakedLandscape = new Set(['tile_ground_grass', 'map_road', 'map_gate_lane', 'deco_bush', 'deco_rocks', 'deco_blossom_pink']);
/** 图稿等分格边缘偶有相邻单元碎片。只取最大连通主体的外框，仍保留框内
 * 全部原像素，不抹绘造型；只用于非动画的建筑/单件装饰，绝不逐帧套用。 */
function mainObjectBox(rgba, width, height) {
    const seen = new Uint8Array(width * height), queue = new Int32Array(width * height);
    let best = null;
    for (let start = 0; start < seen.length; start++) {
        if (seen[start] || !rgba[start * 4 + 3]) continue;
        let count = 0, length = 1, left = width, top = height, right = 0, bottom = 0;
        queue[0] = start; seen[start] = 1;
        while (count < length) {
            const at = queue[count++], x = at % width, y = Math.floor(at / width);
            left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
            for (const next of [x > 0 ? at - 1 : -1, x < width - 1 ? at + 1 : -1, y > 0 ? at - width : -1, y < height - 1 ? at + width : -1])
                if (next >= 0 && !seen[next] && rgba[next * 4 + 3]) { seen[next] = 1; queue[length++] = next; }
        }
        if (!best || count > best.count) best = { count, box: [left, top, right - left + 1, bottom - top + 1] };
    }
    if (!best) throw new Error('建筑原稿没有可见主体');
    return best.box;
}
function cell(source, columns, rows, index) {
    const [w, h] = size(path.join(root, source));
    const x = Math.round(index % columns * w / columns), y = Math.round(Math.floor(index / columns) * h / rows);
    return [x, y, Math.round((index % columns + 1) * w / columns) - x, Math.round((Math.floor(index / columns) + 1) * h / rows) - y];
}
function importImage(spec) {
    const { id, source, category, bundle = 'base', width = 256, height = width,
        pivot = { x: width / 2, y: height * 15 / 16 }, alphaCutoff = 240, fullCanvas = false,
        fitHeight = height - 16, fitWidth = width - 16, nineSlice = null } = spec;
    const input = path.join(root, source), crop = spec.crop || [0, 0, ...size(input)];
    const clean = path.join(work, id + '-clean.png'), target = path.join(output, category, id + '.png');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    // ImageMagick black-threshold still bases its decision on color intensity
    // when an alpha channel is selected. Operate on alpha bytes explicitly;
    // above the cutoff preserve both source alpha and RGB without binarizing.
    const rgba = run([input, '-crop', geometry(crop), '+repage', '-depth', '8', 'rgba:-']);
    // 光效母图的极低alpha底雾连续归零；保留高光255，避免硬阈值切出可见的半透明断层。
    if (spec.alphaFloor) for (let i = 3; i < rgba.length; i += 4)
        rgba[i] = Math.round(Math.max(0, rgba[i] - spec.alphaFloor) * 255 / (255 - spec.alphaFloor));
    if (alphaCutoff) for (let i = 0; i < rgba.length; i += 4) if (rgba[i + 3] < alphaCutoff) rgba.fill(0, i, i + 4);
    execFileSync(magick, ['-size', `${crop[2]}x${crop[3]}`, '-depth', '8', 'rgba:-',
        ...(spec.motherSize ? ['-filter', 'Lanczos', '-resize', `${spec.motherSize[0]}x${spec.motherSize[1]}!`] : []), '-strip', clean], { input: rgba });
    const objectBox = spec.isolate ? mainObjectBox(rgba, crop[2], crop[3]) : null;
    const command = [clean, ...(objectBox ? ['-crop', geometry(objectBox), '+repage'] : [])];
    if (nineSlice) {
        // 仅压缩横向中心，完整保留96/128行纵向渐变。普通contain会把长按钮
        // 压成十几像素的细条，二维压成2x2中心又会丢失明暗层次。
        const wide = path.join(work, id + '-wide.png');
        run([clean, '-trim', '+repage', '-filter', 'Lanczos', '-resize', `x${height}`, wide]);
        const [wideWidth] = size(wide), edge = Math.min(Math.floor(width / 4), Math.ceil(height / 2));
        const parts = [];
        for (const [name, x, w, targetWidth] of [['left', 0, edge, edge], ['middle', edge, wideWidth - edge * 2, width - edge * 2], ['right', wideWidth - edge, edge, edge]]) {
            const file = path.join(work, `${id}-${name}.png`);
            run([wide, '-crop', geometry([x, 0, w, height]), '+repage', '-filter', 'Lanczos', '-resize', `${targetWidth}x${height}!`, file]); parts.push(file);
        }
        run([...parts, '+append', '-strip', target]);
    } else if (fullCanvas) command.push('-filter', 'Lanczos', '-resize', `${width}x${height}!`);
    else {
        command.push(...(spec.groupCrop ? ['-crop', geometry(spec.groupCrop), '+repage'] : ['-trim', '+repage']), '-filter', 'Lanczos', '-resize', `${fitWidth}x${fitHeight}`,
            '-background', 'none', '-gravity', 'south', '-extent', `${width}x${Math.round(pivot.y)}`,
            '-gravity', 'north', '-extent', `${width}x${height}`);
    }
    if (spec.modulate) command.push('-modulate', spec.modulate);
    // 额外裁掉成图右侧的孤点，按原点补回透明画布，避免重新缩放主体。
    if (spec.cropRight) command.push('-gravity', 'northwest', '-crop', geometry([0, 0, width - spec.cropRight, height]),
        '+repage', '-compose', 'Copy', '-background', 'none', '-extent', `${width}x${height}`);
    if (!nineSlice) run([...command, '-strip', target]);
    const sourceSheet = path.relative(root, target), sourceRect = { x: 0, y: 0, w: width, h: height };
    assets.push({ id, label: id, category, categoryLabel: category, path: `runtime/${category}/${id}.png`, width, height,
        pivot, sourceSheet, sourceRect, sourceCropWithinCell: sourceRect, nineSlice, mapping: '', animation: spec.animation || null,
        fitPadding: 0, resizeMode: 'stretch', sampling: 'Lanczos', runtime: !bakedLandscape.has(id), usage: 'HD production', bundle: ['building-parts', 'terrain', 'environment', 'buildings', 'decorations'].includes(category) && !['tile_ground_grass', 'deco_tree_oak', 'deco_tree_pine'].includes(id) ? 'buildings' : bundle,
        provenance: { source, crop, objectBox, alphaCutoff, alphaFloor: spec.alphaFloor, fullCanvas, motherSize: spec.motherSize, groupCrop: spec.groupCrop, modulate: spec.modulate, cropRight: spec.cropRight, sourceHash: hash(input), outputHash: hash(target) } });
    return id;
}
function clip(id, frameIds, fps, category, mapping) {
    const first = assets.find(a => a.id === frameIds[0]);
    animations.push({ id, frameIds, frameCount: frameIds.length, fps, loop: true, restFrame: frameIds[0],
        category, mapping, canvas: { w: first.width, h: first.height }, pivot: first.pivot,
        clock: category === 'enemies' ? 'battle' : 'scene_visual_or_battle', trimPolicy: 'atlas_trim_restore_source_canvas' });
}
for (const [kind, poses] of Object.entries(enemySources)) {
    const profile = enemyMotionProfiles['enemy_'+kind];
    // 归一化阶段沿用1.0.49的原画布，发布阶段再整体缩小，保留首领原始取景和足底比例。
    const canvas = Math.max(256, runtimeTextureSizes.enemies[kind] * 2);
    const ids = poses.map((p, i) => {
        const source = generated('enemies/' + p.sheet);
        return importImage({ id: `enemy_${kind}_walk_${i.toString().padStart(2, '0')}`, source,
            crop: cell(source, p.columns, p.rows, p.cell), category: 'enemies', bundle: 'battle', width: canvas,
            pivot: { x: canvas / 2, y: canvas * profile.foot / 96 }, alphaCutoff: 0, fullCanvas: true,
            animation: `enemy_${kind}_walk` });
    });
    clip(`enemy_${kind}_walk`, ids, poses.length * 1.5, 'enemies', `enemy_${kind}`);
    animations[animations.length-1].stridePixels = profile.stride * canvas / 96;
    enemyNativeFacing[`enemy_${kind}`] = 'DOWN';
}
for (const [index, name] of ['band', 'antlers', 'feathers', 'banner', 'leaves', 'mask'].entries()) {
    if (!['feathers', 'banner'].includes(name)) continue;
    const source = generated('enemies/accessories_candidate');
    const canvas = Math.max(128, runtimeTextureSizes.enemyParts['enemy_acc_' + name] * 2);
    importImage({ id: 'enemy_acc_' + name, source, crop: cell(source, 3, 2, index), category: 'enemy-parts', bundle: 'battle', width: canvas, fitHeight: 116 / 128 * canvas, fitWidth: 112 / 128 * canvas });
}
importVillagers(root, importImage, clip, animations, walkDirections, laborDirections);
for (const [kind, sheet] of Object.entries(buildingSheets)) for (let index = 0; index < 4; index++) {
    const source = generated('buildings/' + sheet);
    importImage({ id: `hd_${kind.toLowerCase()}_body_${index}`, source, crop: cell(source, 4, 1, index), category: 'building-parts', width: 256, fitHeight: 230, isolate: true });
}
for (const [index, name] of componentCells.entries()) {
    const source = generated('buildings/components');
    importImage({ id: 'hd_part_' + name, source, crop: cell(source, 4, 3, index), category: 'building-parts', width: 192, pivot: { x: 96, y: 192 }, fitHeight: 188, fitWidth: 188 });
}
for (const [index, name] of iconCells.entries()) {
    const source = generated('ui/icons');
    // 木材成图第 93～95 列有孤点。只裁这三列，保留原 96×96 画布与锚点。
    importImage({ id: 'icon_' + name, source, crop: cell(source, 4, 4, index), category: 'ui/icons', width: 96,
        pivot: { x: 48, y: 96 }, fitHeight: 96, fitWidth: 96, cropRight: name === 'wood' ? 3 : undefined });
}
for (const [index, id] of detailCells.entries()) {
    if (id.startsWith('emote_')) continue; // 对话共用民房气泡，原始美术稿留档，六张旧表情停止出包。
    const source = generated('environment/details');
    importImage({ id, source, crop: cell(source, 4, 3, index), category: id.startsWith('deco') ? 'decorations' : 'effects',
        bundle: ['fx_arrow', 'fx_stone', 'fx_ice'].includes(id) ? 'battle' : id.startsWith('deco') ? 'base' : 'characters', width: 128, pivot: { x: 64, y: 128 }, fitHeight: 128, fitWidth: 128 });
}
for (const spec of panelCells) {
    importImage({ ...spec, source: generated('ui/bright_skins'), category: 'ui/panels', width: 256,
        pivot: { x: 128, y: spec.height }, alphaCutoff: 0 });
}
// 圆形底栏确认稿：只新增圆钮底图和月亮盾牌，文字/红点及四个村务图标复用原实现。
// 按母图实际可见框裁切；16/255仅清掉远离主体的极低alpha噪点，边缘仍保留抗锯齿。
// 384px圆钮覆盖172逻辑px在1440屏宽下的344物理px；盾牌128px覆盖62逻辑px的124物理px。
importImage({ id: 'button_night_round', source: 'source/ui/circular-footer/round-button-and-shield.png', crop: [90, 90, 700, 707],
    category: 'ui/buttons', width: 384, height: 384, pivot: { x: 192, y: 384 }, fitWidth: 384, fitHeight: 384, alphaCutoff: 16 });
importImage({ id: 'icon_night_shield', source: 'source/ui/circular-footer/round-button-and-shield.png', crop: [1087, 180, 485, 521],
    category: 'ui/icons', width: 128, height: 128, pivot: { x: 64, y: 128 }, fitWidth: 128, fitHeight: 128, alphaCutoff: 16 });
// 守夜三按钮：完整圆钮与冠心分离，沿用白天384/128的高清采样；灰态和倒计时由Laya绘制。
importImage({ id: 'button_heart_round', source: 'source/ui/night-controls/gold-button-and-heart.png', crop: [77, 83, 714, 718],
    category: 'ui/buttons', width: 384, height: 384, pivot: { x: 192, y: 384 }, fitWidth: 384, fitHeight: 384, alphaCutoff: 16 });
importImage({ id: 'icon_crowned_heart', source: 'source/ui/night-controls/gold-button-and-heart.png', crop: [1064, 140, 527, 623],
    category: 'ui/icons', width: 128, height: 128, pivot: { x: 64, y: 128 }, fitWidth: 128, fitHeight: 128, alphaCutoff: 16 });
// 战技入口原图独立保存；96px覆盖46逻辑px在两倍采样下的92px，裁边保留抗锯齿。
importImage({ id: 'icon_tactic_scroll', source: 'source/ui/tactics/scroll.png', category: 'ui/icons',
    width: 96, height: 96, pivot: { x: 48, y: 96 }, fitWidth: 96, fitHeight: 96, alphaCutoff: 16 });
// 百毅靓之怒：图标/柔光/命中保留1.0.20原图，旧静止半环被B方案旋刃替代。
const rageSource = 'source/effects/tactic-rage/rage-sheet.png';
importImage({ id: 'icon_tactic_rage', source: rageSource, crop: [0, 0, 627, 627], category: 'ui/icons',
    width: 96, height: 96, pivot: { x: 48, y: 96 }, fitWidth: 96, fitHeight: 96, alphaCutoff: 16 });
for (const [id, crop, width, height] of [
    ['fx_rage_glow', [0, 627, 627, 627], 96, 96],
    ['fx_rage_hit', [627, 627, 627, 627], 64, 64]
]) importImage({ id, source: rageSource, crop, category: 'effects', bundle: 'battle', width, height,
    pivot: { x: width / 2, y: height / 2 }, fullCanvas: true, alphaCutoff: 0 });
// 正俯视圆图在运行时先旋转再压扁，前后由scrollRect裁切；256px保留手机采样。
// 正圆红环由白天精英和守夜战技共用，随人物包就绪；战技箭头仍在战斗包。
for (const [id, crop, width] of [
    ['fx_rage_orbit', [0, 128, 768, 768], 256],
    ['fx_rage_up', [896, 256, 512, 512], 64]
]) importImage({ id, source: 'source/effects/tactic-rage/orbit-b-sheet.png', crop, category: 'effects', bundle: id === 'fx_rage_orbit' ? 'characters' : 'battle',
    width, height: width, pivot: { x: width / 2, y: width / 2 }, fullCanvas: true, alphaCutoff: 0 });
// 二楠之盾：原稿低alpha白雾不作为场景底色；光效用24/255连续归零，图标按32阈值清理。
// 一张96px基础包图标；三张透明共享贴图随守夜battle包加载，不引入粒子与逐帧图。
const shieldSource = 'source/effects/tactic-shield/shield-sheet.png';
importImage({ id: 'icon_tactic_shield', source: shieldSource, crop: [208, 64, 370, 400], category: 'ui/icons',
    width: 96, pivot: { x: 48, y: 96 }, fitWidth: 96, fitHeight: 96, alphaCutoff: 32 });
for (const [id, crop, width, height] of [
    ['fx_shield_dome', [820, 24, 660, 460], 256, 192],
    ['fx_shield_ring', [64, 680, 640, 184], 256, 80],
    ['fx_shield_hit', [960, 590, 380, 370], 96, 96]
]) importImage({ id, source: shieldSource, crop, category: 'effects', bundle: 'battle', width, height,
    pivot: { x: width / 2, y: height / 2 }, fullCanvas: true, alphaCutoff: 0, alphaFloor: 24 });
for (const spec of environmentSources) importImage({ ...spec, category: 'decorations' });
for (const [index, id] of ['deco_bush', null, 'deco_log_pile', 'building_palisade', 'building_tower_pad'].entries()) {
    if (!id) continue; // 原候选为一对火把，正式单火把来自 finishing_parts。
    const source = generated('environment/decor');
    importImage({ id, source, crop: cell(source, 4, 2, index), category: 'decorations' });
}
for (let index = 0; index < 12; index++) {
    const source = generated('buildings/finishing_parts');
    const id = index < 4 ? `hd_house_wing_${index}` : index < 8 ? `hd_gate_doors_${index - 4}` : ['deco_torch', 'shadow_actor', 'shadow_tree', 'panel_anchored_tip_tail'][index - 8];
    const row = Math.floor(index / 4), edges = [0, 420, 722, 1086];
    // 阴影轮廓跨过等分格界；用实际对象外框，不带进相邻树影的一角。
    const crop = index === 9 ? [348, 824, 342, 160] : index === 10 ? [690, 775, 425, 260] : [index % 4 * 362, edges[row], 362, edges[row + 1] - edges[row]];
    importImage({ id, source, crop, category: index < 8 ? 'building-parts' : index === 11 ? 'ui/panels' : 'decorations',
        width: index === 11 ? 64 : 192, alphaCutoff: [9, 10].includes(index) ? 0 : 240, isolate: index >= 8 });
}
for (const [index, id] of ['fx_hit', 'fx_slow_ring'].entries()) importImage({ id, source: generated('enemies/boar_front_impacts'),
    crop: [index * 768, 640, 768, 384], category: 'effects', bundle: 'battle', width: 128, fitWidth: 124, fitHeight: 124, pivot: { x: 64, y: 128 }, alphaCutoff: 0 });
// 三套命中关键帧同画布同中心；裁边由图集处理，保持每帧的实际接触点。
for (const kind of ['arrow', 'stone', 'slow']) {
    const animation = `fx_impact_${kind}`;
    const ids = [1, 2, 3, 4, 5].map(frame => {
        const id = `${animation}_${frame}`;
        return importImage({ id, source: `source/rendered2d/feedback134/${id}.png`, category: 'effects',
            bundle: 'battle', width: 80, pivot: { x: 40, y: 40 }, alphaCutoff: 0, fullCanvas: true, animation });
    });
    clip(animation, ids, 24, 'effects', kind);
    animations.at(-1).loop = false;
}
for (const id of ['tag_recommended', 'tag_favorite']) importImage({ id, source: `source/rendered2d/feedback134/${id}.png`,
    category: 'ui/icons', width: 152, height: 50, alphaCutoff: 0, fullCanvas: true });
importImage({ id: 'icon_baby_cry', source: 'source/rendered2d/feedback134/icon_baby_cry.png',
    category: 'effects', bundle: 'characters', width: 78, height: 68, alphaCutoff: 0, fullCanvas: true });
// 历史地形组件用于复现旧版，当前画面由整图提供。
importImage({ id: 'tile_ground_grass', source: 'source/rendered2d/generated/environment/grass_ground_soft.png', category: 'terrain', width: 512,
    alphaCutoff: 0, fullCanvas: true, modulate: '105,85,100' });
importImage({ id: 'map_road', source: 'design/hd2d/parts/road_sprite.png', category: 'terrain', width: 512, height: 768, alphaCutoff: 0, fullCanvas: true });
// 城门脚横路只保留母图中的窄带；清除极低alpha背景噪点，保留道路及草边的渐隐过渡。
importImage({ id: 'map_gate_lane', source: 'source/rendered2d/generated/environment/gate_lane.png', crop: [16, 464, 1504, 128], category: 'terrain', width: 512, height: 48, alphaCutoff: 16, fullCanvas: true });
const mapSource = generated('environment/village_map');
const fittedMap = path.join(work, 'village-map-aligned.png');
const { width: mapWidth, height: mapHeight, wallRow, sourceSha256, registration } =
    fitVillageMap(root, path.join(root, mapSource), fittedMap, magick);
importImage({ id: 'map_scene', source: path.relative(root, fittedMap), category: 'terrain', width: mapWidth, height: mapHeight,
    pivot: { x: mapWidth / 2, y: wallRow }, alphaCutoff: 0, fullCanvas: true });
Object.assign(assets.at(-1).provenance, { source: mapSource, sourceHash: sourceSha256, registration });
const fireIds = [1, 2, 3, 4].map(i => importImage({ id: i === 1 ? 'building_hearth_lit' : `hearth_burn_${i}`,
    source: `source/rendered2d/environment/campfire/campfire_${i}.png`, category: 'decorations', width: 192,
    pivot: { x: 96, y: 180 }, alphaCutoff: 0, fullCanvas: true, animation: 'hearth_burn' }));
clip('hearth_burn', fireIds, 6, 'decorations', 'fixed back stones / flame / fixed front stones');

// 对已对齐的完整画布统一降采样，不再trim/fit，避免左右脚、劳动工具或各方向发生位移。
for (const asset of assets) {
    // 高分辨率支撑木只用于生成可编辑的半尺寸配件，所有实际摆放改用后者。
    if (asset.id === 'hd_part_brace') asset.runtime = false;
    let width = asset.width;
    if (asset.category === 'enemies') {
        width = runtimeTextureSizes.enemies[asset.id.split('_')[1]];
        if (!width) throw new Error('未声明怪物发布尺寸：' + asset.id);
    } else if (asset.category === 'enemy-parts') {
        width = runtimeTextureSizes.enemyParts[asset.id];
        if (!width) throw new Error('未声明配件发布尺寸：' + asset.id);
    } else if (Object.hasOwn(runtimeTextureSizes.buildingParts, asset.id)) width = runtimeTextureSizes.buildingParts[asset.id];
    if (width === asset.width) continue;
    if (width > asset.width || asset.nineSlice) throw new Error('发布尺寸不能放大或修改九宫格：' + asset.id);
    const original = { width: asset.width, height: asset.height, pivot: { ...asset.pivot } };
    const scale = width / asset.width, height = Math.round(asset.height * scale);
    const target = path.join(root, asset.sourceSheet), resized = path.join(work, asset.id + '-sized.png');
    run([target, '-filter', 'Lanczos', '-resize', `${width}x${height}!`, '-depth', '8', '-strip', resized]);
    fs.copyFileSync(resized, target);
    asset.width = width; asset.height = height;
    asset.pivot = { x: original.pivot.x * scale, y: original.pivot.y * scale };
    asset.sourceRect = { x: 0, y: 0, w: width, h: height };
    asset.sourceCropWithinCell = { ...asset.sourceRect };
    Object.assign(asset.provenance, { normalizedCanvas: original, runtimeScale: scale, outputHash: hash(target) });
}
prepareVillageMotion({ root, work, assets, run, importImage, clip });
// clip.pivot原本与首帧共用对象，必须整体换新而非原地乘，避免孩子/老人双身份重复缩放。
for (const animation of animations) {
    const first = assets.find(a => a.id === animation.frameIds[0]), scale = first.width / animation.canvas.w;
    if (animation.stridePixels !== undefined) animation.stridePixels *= scale;
    animation.canvas = { w: first.width, h: first.height }; animation.pivot = { ...first.pivot };
}
const recipe = { version: 4, status: 'HD staging, not published', atlas: { padding: 2, trimAlphaThreshold: 0, preserveNineSliceCanvas: true, sampling: 'linear' }, assets,
    animations: { version: 3, animations, walkDirections, laborDirections, enemyNativeFacing }, externalAssets: [] };
fs.writeFileSync(path.join(root, 'source/rendered2d/production_recipe.json'), JSON.stringify(recipe, null, 2) + '\n');
console.log(JSON.stringify({ status: recipe.status, assets: assets.length, clips: animations.length, output }));
