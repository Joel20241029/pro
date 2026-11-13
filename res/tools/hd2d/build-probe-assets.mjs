/** Rebuild the isolated HD art probe. Never writes game atlases or release packages. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const recipe = JSON.parse(fs.readFileSync(path.join(root, 'res/design/hd2d/parts/probe-recipe.json'), 'utf8'));
const output = path.join(root, recipe.output);
fs.mkdirSync(output, { recursive: true });
const records = [];
for (const asset of recipe.assets) {
    const input = path.join(root, recipe.sourceRoot, asset.source);
    const target = path.join(output, asset.id + '.png');
    // User-authorized atlas preparation: crop transparent margins and downsample
    // with smooth filtering; do not redraw silhouettes or replace source art.
    const args = [input];
    if (asset.crop) {
        const [x, y, w, h] = asset.crop;
        args.push('-crop', `${w}x${h}+${x}+${y}`, '+repage');
    }
    args.push('-filter', 'Lanczos', '-resize', `x${asset.height}`, '-strip', target);
    execFileSync('magick', args, { stdio: 'pipe' });
    const [width, height] = execFileSync('magick', ['identify', '-format', '%w %h', target], { encoding: 'utf8' }).split(' ').map(Number);
    const data = fs.readFileSync(target);
    records.push({ id: asset.id, source: asset.source, crop: asset.crop, width, height,
        bytes: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex') });
}
fs.writeFileSync(path.join(output, '../texture-manifest.json'), JSON.stringify({
    status: 'probe_not_game_runtime', sampling: 'smooth', assets: records,
    pngBytes: records.reduce((n, a) => n + a.bytes, 0),
    decodedRgbaBytes: records.reduce((n, a) => n + a.width * a.height * 4, 0)
}, null, 2) + '\n');
console.log(JSON.stringify({ textures: records.length, output,
    pngBytes: records.reduce((n, a) => n + a.bytes, 0) }));
