import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// 从正式路图提取通行边缘；只读取像素，不改原图。草丝和半透明过渡不算可落脚路面。
// 每4参考像素保留一行，左右再内收6像素；当前逐行插值误差上界4.22，预留额外柔边余量。
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = path.join(root, 'source/rendered2d/production/terrain/map_road.png');
const [width, height] = execFileSync('/opt/homebrew/bin/magick', ['identify', '-format', '%w %h', source]).toString().split(' ').map(Number);
const rgba = execFileSync('/opt/homebrew/bin/magick', [source, '-depth', '8', 'rgba:-'], { maxBuffer: 64 * 1024 * 1024 });
const referenceWidth = 720, referenceHeight = 1065, start = 174, end = 766, step = 4, inset = 6;
const rows = [];
for (let y = start; y <= end; y++) {
    const py = Math.round(y * height / referenceHeight), runs = [];
    let left = -1;
    for (let x = 0; x <= width; x++) {
        const i = (py * width + x) * 4;
        const soil = x < width && rgba[i + 3] >= 240 && rgba[i] > rgba[i + 1] * 1.05 && rgba[i + 1] > rgba[i + 2] * 1.05;
        if (soil && left < 0) left = x;
        else if (!soil && left >= 0) { runs.push([left, x - 1]); left = -1; }
    }
    if (!runs.length) throw new Error('道路没有连续土路：' + y);
    runs.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));
    rows.push([y, runs[0][0] * referenceWidth / width, runs[0][1] * referenceWidth / width]);
}
const profile = rows.filter((_, i) => i % step === 0).map(([y, left, right]) => [y, +(left + inset).toFixed(3), +(right - inset).toFixed(3)]);
if (profile.at(-1)[0] !== end) throw new Error('道路末端必须完整采样');
for (let y = start; y <= end; y++) {
    const i = Math.min(Math.floor((y - start) / step), profile.length - 2), a = profile[i], b = profile[i + 1], t = (y - a[0]) / step;
    if (a[1] + (b[1] - a[1]) * t < rows[y - start][1] || a[2] + (b[2] - a[2]) * t > rows[y - start][2]) throw new Error('插值越过土路，请提高采样密度：' + y);
}
const hash = crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
const target = path.resolve(root, '../project/LayaProject/src/config/RoadGeometry.ts');
fs.writeFileSync(target, `/** 由 res/tools/hd2d/extract-road-corridor.mjs 从 map_road.png 生成，勿手改。\n * 原图SHA256 ${hash}\n * 512×768原图映射720×1065；alpha>=240的连续土路，排除绿草与透明柔边，再内收6参考像素。\n * 每行[y,left,right]；只定义落脚走廊，不定义速度、伤害或到门进度。更换路图必须重新提取。\n */\nexport const ROAD_PROFILE = [\n${profile.map(row => '    [' + row.join(', ') + '],').join('\n')}\n] as const;\n`);
console.log(JSON.stringify({ rows: profile.length, sourceHash: hash, target }));
