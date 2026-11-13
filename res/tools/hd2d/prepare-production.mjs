import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { enemySources, buildingSheets, componentCells, iconCells, detailCells, panelCells, environmentSources } from '../../source/rendered2d/production-sources.mjs';

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
    if (!nineSlice) run([...command, '-strip', target]);
    const sourceSheet = path.relative(root, target), sourceRect = { x: 0, y: 0, w: width, h: height };
    assets.push({ id, label: id, category, categoryLabel: category, path: `runtime/${category}/${id}.png`, width, height,
        pivot, sourceSheet, sourceRect, sourceCropWithinCell: sourceRect, nineSlice, mapping: '', animation: spec.animation || null,
        fitPadding: 0, resizeMode: 'stretch', sampling: 'Lanczos', runtime: true, usage: 'HD production', bundle: category === 'building-parts' ? 'buildings' : bundle,
        provenance: { source, crop, objectBox, alphaCutoff, fullCanvas, motherSize: spec.motherSize, groupCrop: spec.groupCrop, sourceHash: hash(input), outputHash: hash(target) } });
    return id;
}
function clip(id, frameIds, fps, category, mapping) {
    const first = assets.find(a => a.id === frameIds[0]);
    animations.push({ id, frameIds, frameCount: frameIds.length, fps, loop: true, restFrame: frameIds[0],
        category, mapping, canvas: { w: first.width, h: first.height }, pivot: first.pivot,
        clock: category === 'enemies' ? 'battle' : 'scene_visual_or_battle', trimPolicy: 'atlas_trim_restore_source_canvas' });
}
for (const [kind, poses] of Object.entries(enemySources)) {
    // 整组使用同一母画布、共同裁框、共同缩放。不同输出分辨率先换算到
    // 第一帧母画布；不按每帧动作外轮廓单独放大，避免迈步时身体忽大忽小。
    const firstSource = generated('enemies/' + poses[0].sheet);
    const motherSize = (poses[0].crop || cell(firstSource, poses[0].columns, 1, poses[0].cell)).slice(2);
    let left = motherSize[0], top = motherSize[1], right = 0, bottom = 0;
    for (const p of poses) {
        const source = generated('enemies/' + p.sheet), crop = p.crop || cell(source, p.columns, 1, p.cell);
        const rgba = run([path.join(root, source), '-crop', geometry(crop), '+repage', '-filter', 'Lanczos', '-resize', `${motherSize[0]}x${motherSize[1]}!`, '-depth', '8', 'rgba:-']);
        for (let y = 0; y < motherSize[1]; y++) for (let x = 0; x < motherSize[0]; x++) if (rgba[(y * motherSize[0] + x) * 4 + 3] >= 240) {
            left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
        }
    }
    const groupCrop = [left, top, right - left + 1, bottom - top + 1];
    const ids = poses.map((p, i) => {
        const source = generated('enemies/' + p.sheet);
        return importImage({ id: `enemy_${kind}_walk_${i.toString().padStart(2, '0')}`, source, crop: p.crop || cell(source, p.columns, 1, p.cell),
            category: 'enemies', bundle: 'battle', width: 256, pivot: { x: 128, y: 256 * 92 / 96 }, fitHeight: 232, fitWidth: 244, motherSize, groupCrop, animation: `enemy_${kind}_walk` });
    });
    clip(`enemy_${kind}_walk`, ids, poses.length * 1.5, 'enemies', `enemy_${kind}`);
    enemyNativeFacing[`enemy_${kind}`] = 'DOWN';
}
for (const [index, name] of ['band', 'antlers', 'feathers', 'banner', 'leaves', 'mask'].entries()) {
    const source = generated('enemies/accessories_candidate');
    importImage({ id: 'enemy_acc_' + name, source, crop: cell(source, 3, 2, index), category: 'enemy-parts', bundle: 'battle', width: 128, fitHeight: 116 });
}
for (const [role, identities] of Object.entries({ male: ['male_a'], female: ['female_a'], child: ['boy', 'girl'], elder: ['elder_male', 'elder_female'] })) {
    const profile = JSON.parse(fs.readFileSync(path.join(root, `source/rendered2d/characters/${role}/rig-profile.json`)));
    if (profile.poses.length !== 8 || !(profile.walkCycle.strideCanvasPixels > 0)) throw new Error('未完成八帧步态：' + role);
    for (const direction of ['down', 'left', 'up', 'right']) {
        const ids = profile.poses.map((_, index) => index + 1).map(i => importImage({ id: `hd_${role}_${direction}_${i}`, source: `design/hd2d/directions/${role}/${role}_${direction}_${i}.png`,
            category: 'characters', bundle: 'characters', width: 256, pivot: { x: 128, y: 256 * .847929 }, alphaCutoff: 0, fullCanvas: true, animation: `hd_${role}_${direction}` }));
        const restFrame = importImage({ id: `hd_${role}_${direction}_idle`, source: `design/hd2d/directions/${role}/${role}_${direction}_idle.png`,
            category: 'characters', bundle: 'characters', width: 256, pivot: { x: 128, y: 256 * .847929 }, alphaCutoff: 0, fullCanvas: true });
        for (const identity of identities) {
            const id = `villager_${identity}_walk${direction === 'down' ? '' : '_' + direction}`;
            clip(id, ids, profile.fps, 'characters', `${role} actual ${direction}`);
            Object.assign(animations.at(-1), { restFrame, stridePixels: profile.walkCycle.strideCanvasPixels });
            (walkDirections[identity] ||= {})[direction.toUpperCase()] = { clip: id, mirror: false };
        }
    }
    if (role === 'elder') {
        const ids = [1, 2].map(i => importImage({ id: `hd_elder_idle_${i}`, source: `source/rendered2d/characters/elder/rest/elder_idle_${i}.png`,
            category: 'characters', bundle: 'characters', width: 256, pivot: { x: 128, y: 256 * .847929 }, alphaCutoff: 0, fullCanvas: true, animation: 'elder_idle' }));
        for (const identity of identities) clip(`villager_${identity}_idle`, ids, 2, 'characters', 'gender-neutral elder rest');
    }
    if (role === 'male' || role === 'female') for (const action of ['farm', 'chop', 'care']) {
        const base = `villager_${identities[0]}_${action === 'farm' && role === 'female' ? 'harvest' : action}`;
        for (const direction of action === 'farm' ? ['down'] : ['right', 'left']) {
            const ids = [1, 2, 3, 4].map(i => importImage({ id: `hd_${role}_${action}_${direction}_${i}`, source: `source/rendered2d/characters/${role}/labor/${role}_${action}_${direction}_${i}.png`,
                category: 'characters', bundle: 'characters', width: 256, pivot: { x: 128, y: 256 * .847929 }, alphaCutoff: 0, fullCanvas: true, animation: base }));
            const id = base + (direction === 'left' ? '_left' : ''); clip(id, ids, 6, 'characters', `${role} ${action} ${direction}`);
            if (action !== 'farm') (laborDirections[base] ||= {})[direction.toUpperCase()] = { clip: id, mirror: false };
        }
    }
}
const babyIds = [1, 2, 3, 4].map(i => importImage({ id: `hd_baby_idle_${i}`, source: `design/hd2d/directions/baby/baby_idle_${i}.png`, category: 'characters', bundle: 'characters', width: 192,
    pivot: { x: 96, y: 192 * .698817 }, alphaCutoff: 0, fullCanvas: true, animation: 'villager_baby_idle' }));
clip('villager_baby_idle', babyIds, 2, 'characters', 'gender-neutral baby');
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
    importImage({ id: 'icon_' + name, source, crop: cell(source, 4, 4, index), category: 'ui/icons', width: 96, pivot: { x: 48, y: 96 }, fitHeight: 96, fitWidth: 96 });
}
for (const [index, id] of detailCells.entries()) {
    const source = generated('environment/details');
    importImage({ id, source, crop: cell(source, 4, 3, index), category: id.startsWith('deco') ? 'decorations' : 'effects',
        bundle: ['fx_arrow', 'fx_stone', 'fx_ice'].includes(id) ? 'battle' : id.startsWith('deco') ? 'base' : 'characters', width: 128, pivot: { x: 64, y: 128 }, fitHeight: 128, fitWidth: 128 });
}
for (const spec of panelCells) {
    importImage({ ...spec, source: generated('ui/bright_skins'), category: 'ui/panels', width: 256,
        pivot: { x: 128, y: spec.height }, alphaCutoff: 0 });
}
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
importImage({ id: 'tile_ground_grass', source: 'design/hd2d/samples/grass_ground_v2.png', category: 'terrain', width: 512, alphaCutoff: 0, fullCanvas: true });
importImage({ id: 'map_road', source: 'design/hd2d/parts/road_sprite.png', category: 'terrain', width: 512, height: 768, alphaCutoff: 0, fullCanvas: true });
const fireIds = [1, 2, 3, 4].map(i => importImage({ id: i === 1 ? 'building_hearth_lit' : `hearth_burn_${i}`,
    source: `source/rendered2d/environment/campfire/campfire_${i}.png`, category: 'decorations', width: 192,
    pivot: { x: 96, y: 180 }, alphaCutoff: 0, fullCanvas: true, animation: 'hearth_burn' }));
clip('hearth_burn', fireIds, 6, 'decorations', 'fixed back stones / flame / fixed front stones');
const recipe = { version: 4, status: 'HD staging, not published', atlas: { padding: 2, trimAlphaThreshold: 0, preserveNineSliceCanvas: true, sampling: 'linear' }, assets,
    animations: { version: 3, animations, walkDirections, laborDirections, enemyNativeFacing }, externalAssets: [] };
fs.writeFileSync(path.join(root, 'source/rendered2d/production_recipe.json'), JSON.stringify(recipe, null, 2) + '\n');
console.log(JSON.stringify({ status: recipe.status, assets: assets.length, clips: animations.length, output }));
