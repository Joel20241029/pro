import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// 把已验证的小场景三层火堆烘成四个二维帧；底座和前石永远不随火焰换位。
// 原始三层与脚本仍保留，不依赖粒子，不使用旧像素火堆。
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2), work = args[args.indexOf('--work') + 1];
if (!work?.startsWith('/Users/happyelements/Downloads/')) throw new Error('需要 Downloads 下的 --work');
fs.mkdirSync(work, { recursive: true });
const output = path.join(root, 'source/rendered2d/environment/campfire'); fs.mkdirSync(output, { recursive: true });
const run = a => execFileSync('/opt/homebrew/bin/magick', a);
const env = path.join(root, 'design/hd2d/environment');
for (const layer of ['base', 'front']) run([path.join(env, `campfire_${layer}.png`), '-crop', '408x216+54+160', '+repage',
    '-filter', 'Lanczos', '-resize', '176x93!', path.join(work, layer + '.png')]);
for (let frame = 1; frame <= 4; frame++) {
    const flame = path.join(work, `flame_${frame}.png`);
    run([path.join(env, 'campfire_flame_strip.png'), '-crop', `543x448+${(frame - 1) * 543}+88`, '+repage',
        '-filter', 'Lanczos', '-resize', '114x94!', flame]);
    run(['-size', '192x192', 'canvas:none', path.join(work, 'base.png'), '-geometry', '+8+87', '-composite',
        flame, '-geometry', '+39+52', '-composite', path.join(work, 'front.png'), '-geometry', '+8+87', '-composite',
        '-strip', path.join(output, `campfire_${frame}.png`)]);
}
console.log(output);
