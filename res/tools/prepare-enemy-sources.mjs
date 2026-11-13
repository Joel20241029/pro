import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const magick = '/opt/homebrew/bin/magick', run = args => execFileSync(magick, args, { maxBuffer: 32 * 1024 * 1024 });
// AI 原稿的实际网格边界，经逐行检查；统一每行缩放比例，脚底配准而非逐帧自适应缩放。
const rows = [['boar', 0, 280], ['commander', 280, 546], ['wolfking', 546, 828], ['tuskking', 828, 1100], ['shaman', 1100, 1402]];
const source = path.join(root, 'source/enemies/woodland_bases_v1.png'), output = path.join(root, 'source/enemies/prepared');
fs.mkdirSync(output, { recursive: true });
const recipePath = path.join(root, 'source/asset_recipe.json'), recipe = JSON.parse(fs.readFileSync(recipePath));
const original = recipe.assets.find(a => a.id === 'enemy_chief_walk_00');
for (const [kind, top, bottom] of rows) {
    const height = bottom - top, bounds = [];
    for (let frame = 0; frame < 4; frame++) {
        const x = Math.round(frame * 1122 / 4), end = Math.round((frame + 1) * 1122 / 4), width = end - x;
        const raw = run([source, '-crop', `${width}x${height}+${x}+${top}`, '+repage', '-depth', '8', 'rgba:-']);
        let left = width, right = 0, y0 = height, y1 = 0;
        for (let y = 0; y < height; y++) for (let at = 0; at < width; at++) if (raw[(y * width + at) * 4 + 3] >= 240) {
            left = Math.min(left, at); right = Math.max(right, at); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
        bounds.push({ x, width, raw, left, right, y0, y1 });
    }
    const scale = Math.min(84 / Math.max(...bounds.map(b => b.right - b.left + 1)), 86 / Math.max(...bounds.map(b => b.y1 - b.y0 + 1)));
    const evidence = [];
    bounds.forEach((b, frame) => {
        // 同一比例+足底锚点；头/躯干中心固定在单元格中心，保留四肢摆动，不以逐帧外接框中心替代。
        const center = b.width / 2, pixels = Buffer.alloc(96 * 96 * 4);
        for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
            const sx = Math.round((x - 48) / scale + center), sy = Math.round((y - 91) / scale + b.y1);
            if (sx < 0 || sx >= b.width || sy < 0 || sy >= height) continue;
            const from = (sy * b.width + sx) * 4, to = (y * 96 + x) * 4;
            if (b.raw[from + 3] < 240) continue;
            b.raw.copy(pixels, to, from, from + 3); pixels[to + 3] = 255;
        }
        const file = `source/enemies/prepared/${kind}_${frame}.png`;
        execFileSync(magick, ['-size', '96x96', '-depth', '8', 'rgba:-', '-strip', path.join(root, file)], { input: pixels });
        const id = `enemy_${kind}_walk_0${frame}`;
        if (!recipe.assets.some(a => a.id === id)) recipe.assets.push({ ...original, id, label: id, path: `runtime/enemies/${kind}/walk/0${frame}.png`, sourceSheet: file, sourceRect: { x: 0, y: 0, w: 96, h: 96 }, sourceCropWithinCell: { x: 0, y: 0, w: 96, h: 96 }, mapping: `enemy_${kind}`, animation: { animationId: `enemy_${kind}_walk`, characterId: kind, actionId: 'walk', frameIndex: frame }, registrationNote: 'v13：同一行统一比例、单元格中心与脚底92配准；导入alpha>=240，原图保留。' });
        evidence.push({ frame, scale, sourceFoot: b.y1, center, alphaCutoff: 240 });
    });
    if (!recipe.animations.animations.some(c => c.id === `enemy_${kind}_walk`)) {
        const clip = recipe.animations.animations.find(c => c.id === 'enemy_chief_walk');
        recipe.animations.animations.push({ ...clip, id: `enemy_${kind}_walk`, characterId: kind, frameIds: [0, 1, 2, 3].map(i => `enemy_${kind}_walk_0${i}`), restFrame: `enemy_${kind}_walk_01`, mapping: `enemy_${kind}` });
    }
    recipe.animations.enemyNativeFacing[`enemy_${kind}`] = 'DOWN';
    fs.writeFileSync(path.join(output, kind + '.registration.json'), JSON.stringify(evidence, null, 2) + '\n');
}
const accessoryIds = ['band', 'antlers', 'feathers', 'banner', 'leaves', 'mask'];
for (let i = 0; i < accessoryIds.length; i++) {
    const id = 'enemy_acc_' + accessoryIds[i];
    if (recipe.assets.some(a => a.id === id)) continue;
    recipe.assets.push({ id, label: id, category: 'enemy-parts', categoryLabel: '怪物共享配件', path: `runtime/enemies/accessories/${accessoryIds[i]}.png`, width: 48, height: 48, pivot: { x: 24, y: 40 }, sourceSheet: 'source/enemies/accessories_v1.png', sourceRect: { x: i % 3 * 512, y: Math.floor(i / 3) * 512, w: 512, h: 512 }, sourceCropWithinCell: { x: 0, y: 0, w: 512, h: 512 }, nineSlice: null, fitPadding: 0, resizeMode: 'contain', runtime: true, bundle: 'battle', alphaCutoff: 240, usage: '独立头饰/背饰，挂点和兼容范围由编辑器布局定义' });
}
// 原始帧为细节层，再增加中性乘色层；同画布、同trim前坐标、同动画时钟。
for (const a of recipe.assets.filter(a => a.category === 'enemies' && !a.tintLayer)) {
    a.tintLayer = 'detail';
    const tint = { ...a, id: a.id + '_tint', label: a.label + '_tint', path: a.path.replace('.png', '_tint.png'), tintLayer: 'body', animation: null, usage: '中性身体层，与对应原色细节帧同步' };
    recipe.assets.push(tint);
}
fs.writeFileSync(recipePath, JSON.stringify(recipe, null, 2) + '\n');
console.log('Prepared five new bases, four aligned frames each; six accessories; two-layer recipes.');
