import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

// 原始图片与可编辑配方为唯一输入；临时裁片只能放 Downloads。无额外 npm 依赖。
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), workArg = args.indexOf('--work');
if (workArg < 0 || !args[workArg + 1]) throw new Error('用法：node res/tools/build-resources.mjs --work <Downloads/本任务目录> [--sync]');
const work = path.resolve(args[workArg + 1]);
if (!work.startsWith('/Users/happyelements/Downloads/')) throw new Error('临时目录必须位于 Downloads');
fs.mkdirSync(work, { recursive: true });
const magick = process.env.VILLAGE_MAGICK || '/opt/homebrew/bin/magick';
const run = a => execFileSync(magick, a, { maxBuffer: 32 * 1024 * 1024 });
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const write = (name, data) => { const p = path.join(root, name); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n'); };
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const geometry = r => `${r.w}x${r.h}+${r.x}+${r.y}`;
const decode = file => run([file, '-depth', '8', 'rgba:-']);
const recipe = read('source/asset_recipe.json'), assets = [];
let originalArea = 0, trimmedArea = 0, trimmedCount = 0;

for (const a of recipe.assets) {
    const out = path.join(root, a.path); fs.mkdirSync(path.dirname(out), { recursive: true });
    const crop = a.sourceCropWithinCell;
    run([path.join(root, a.sourceSheet), '-crop', geometry(a.sourceRect), '+repage', '-crop', geometry(crop), '+repage',
        '-filter', 'point', '-resize', `${a.width - a.fitPadding}x${a.height - a.fitPadding}${a.resizeMode === 'stretch' ? '!' : ''}`,
        '-background', 'none', '-gravity', 'center', '-extent', `${a.width}x${a.height}`, '-strip', out]);
    const pixels = decode(out);
    if (pixels.length !== a.width * a.height * 4) throw new Error(`画布尺寸不符：${a.id}`);
    let left = a.width, top = a.height, right = -1, bottom = -1;
    for (let y = 0; y < a.height; y++) for (let x = 0; x < a.width; x++) {
        if (pixels[(y * a.width + x) * 4 + 3] > recipe.atlas.trimAlphaThreshold) {
            left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
    }
    if (right < 0) throw new Error(`空图片：${a.id}`);
    // 九宫格的固定边缘与中心区域保留原画布，普通图片只删除完全透明的外圈。
    if (a.nineSlice) { left = top = 0; right = a.width - 1; bottom = a.height - 1; }
    const trim = { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
    const isTrimmed = trim.w !== a.width || trim.h !== a.height;
    originalArea += a.width * a.height; trimmedArea += trim.w * trim.h; if (isTrimmed) trimmedCount++;
    const packedFile = path.join(work, a.id + '.png');
    run([out, '-crop', geometry(trim), '+repage', '-strip', packedFile]);
    assets.push({ ...a, bytes: fs.statSync(out).size, sha256: hash(out), alpha: 'rgba',
        untrimmedSize: { w: a.width, h: a.height }, trimOffset: { x: left, y: top }, atlasTrim: isTrimmed,
        displaySize: { w: a.width, h: a.height }, pivotUnit: 'pixels in original source canvas, origin top-left',
        plannedLayaPath: 'assets/resources/village/' + a.path.replace('runtime/', ''), importStatus: 'imported_via_atlas', reviewStatus: 'visual_v2',
        _trim: trim, _pixels: pixels, _packedFile: packedFile });
}

function contains(a, b) { return b.x >= a.x && b.y >= a.y && b.x + b.w <= a.x + a.w && b.y + b.h <= a.y + a.h; }
function splitFree(free, used) {
    const result = [];
    for (const f of free) {
        if (used.x >= f.x + f.w || used.x + used.w <= f.x || used.y >= f.y + f.h || used.y + used.h <= f.y) { result.push(f); continue; }
        if (used.x > f.x) result.push({ x: f.x, y: f.y, w: used.x - f.x, h: f.h });
        if (used.x + used.w < f.x + f.w) result.push({ x: used.x + used.w, y: f.y, w: f.x + f.w - used.x - used.w, h: f.h });
        if (used.y > f.y) result.push({ x: f.x, y: f.y, w: f.w, h: used.y - f.y });
        if (used.y + used.h < f.y + f.h) result.push({ x: f.x, y: used.y + used.h, w: f.w, h: f.y + f.h - used.y - used.h });
    }
    return result.filter((f, i) => !result.some((g, j) => j !== i && contains(g, f) && (g.w * g.h > f.w * f.h || j < i)));
}
const pages = [], frames = {}, padding = recipe.atlas.padding;
fs.mkdirSync(path.join(root, 'atlases'), { recursive: true });
for (const [group, size] of [['world', recipe.atlas.worldSize], ['ui', recipe.atlas.uiSize]]) {
    const items = assets.filter(a => (a.category.startsWith('ui/') || a.category === 'effects') === (group === 'ui'))
        .sort((a, b) => Math.max(b._trim.w, b._trim.h) - Math.max(a._trim.w, a._trim.h) || b._trim.w * b._trim.h - a._trim.w * a._trim.h || a.id.localeCompare(b.id));
    const groupPages = [];
    for (const a of items) {
        const w = a._trim.w + padding * 2, h = a._trim.h + padding * 2; let best = null;
        if (w > size || h > size) throw new Error(`单图超过页尺寸：${a.id}`);
        for (const p of groupPages) for (const f of p.free) if (w <= f.w && h <= f.h) {
            const score = Math.min(f.w - w, f.h - h); if (!best || score < best.score) best = { p, f, score };
        }
        if (!best) { const p = { id: `${group}_${groupPages.length}`, free: [{ x: 0, y: 0, w: size, h: size }], placements: [] }; groupPages.push(p); best = { p, f: p.free[0] }; }
        const used = { x: best.f.x, y: best.f.y, w, h }; best.p.free = splitFree(best.p.free, used);
        const rect = { x: used.x + padding, y: used.y + padding, w: a._trim.w, h: a._trim.h };
        best.p.placements.push({ a, rect }); a.atlasPage = best.p.id; a.atlasRect = rect;
        a.importedLayaAtlasPath = `assets/resources/village/${best.p.id}.png`; a.importedFrameId = a.id;
    }
    for (const p of groupPages) {
        const name = `atlases/${p.id}.png`, out = path.join(root, name), command = ['-size', `${size}x${size}`, 'canvas:none'];
        for (const { a, rect } of p.placements) command.push(a._packedFile, '-geometry', `+${rect.x}+${rect.y}`, '-composite');
        run([...command, '-strip', out]);
        const pixels = decode(out);
        for (const { a, rect } of p.placements) {
            const t = a._trim;
            if (t.x < 0 || t.y < 0 || t.x + t.w > a.width || t.y + t.h > a.height) throw new Error(`裁边越界：${a.id}`);
            for (let y = 0; y < a.height; y++) for (let x = 0; x < a.width; x++) {
                const i = (y * a.width + x) * 4;
                if (x < t.x || y < t.y || x >= t.x + t.w || y >= t.y + t.h) {
                    if (a._pixels[i + 3] > recipe.atlas.trimAlphaThreshold) throw new Error(`删除有效像素：${a.id}`);
                    continue;
                }
                const j = ((rect.y + y - t.y) * size + rect.x + x - t.x) * 4;
                if (Math.abs(a._pixels[i + 3] - pixels[j + 3]) > 1) throw new Error(`图集 alpha 不一致：${a.id}`);
                for (let c = 0; c < 3; c++) if (Math.abs(a._pixels[i + c] * a._pixels[i + 3] / 255 - pixels[j + c] * pixels[j + 3] / 255) > 1.05) throw new Error(`图集像素不一致：${a.id}`);
            }
            frames[a.id] = { page: p.id, rect, sourceSize: { w: a.width, h: a.height }, trimOffset: a.trimOffset, pivot: a.pivot, nineSlice: a.nineSlice };
        }
        pages.push({ id: p.id, path: name, runtimeFile: p.id + '.png', width: size, height: size, bytes: fs.statSync(out).size, sha256: hash(out), group });
    }
}
const seen = new Set();
for (const a of assets) { if (seen.has(a.id)) throw new Error('重复资源 ID：' + a.id); seen.add(a.id); }
for (const clip of recipe.animations.animations) {
    const list = clip.frameIds.map(id => assets.find(a => a.id === id));
    if (list.length < 2 || list.length > 4 || list.some(a => !a || a.width !== clip.canvas.w || a.height !== clip.canvas.h || a.pivot.x !== clip.pivot.x || a.pivot.y !== clip.pivot.y)) throw new Error('动画画布或 pivot 不一致：' + clip.id);
    if (!clip.frameIds.includes(clip.restFrame)) throw new Error('静止帧不在动作中：' + clip.id);
    if (new Set(list.map(a => a.sha256)).size < 2) throw new Error('动画帧完全相同：' + clip.id);
}
for (const [character, map] of Object.entries(recipe.animations.walkDirections)) {
    const directionClips = ['DOWN', 'UP', 'RIGHT', 'LEFT'].map(direction => recipe.animations.animations.find(a => a.id === map[direction]?.clip));
    if (directionClips.some(c => !c)) throw new Error('四方向引用不完整：' + character);
    const first = directionClips[0];
    if (directionClips.some(c => c.canvas.w !== first.canvas.w || c.canvas.h !== first.canvas.h || c.pivot.x !== first.pivot.x || c.pivot.y !== first.pivot.y || c.frameCount !== first.frameCount)) throw new Error('四方向画布/足底/帧数不一致：' + character);
}
write('atlases/frames.json', { format: 'daidai-village-rects', version: 2, coordinateSystem: 'top-left pixels', padding, rotated: false, trimmed: true, trimAlphaThreshold: 0, pages, frames });
write('animations.json', recipe.animations);
const publicAssets = assets.map(({ _trim, _pixels, _packedFile, ...a }) => a);
const runtimeFiles = [...pages.map(p => p.path), 'atlases/frames.json', 'animations.json'];
write('manifest.json', { version: 2, status: 'imported_in_wechat_prototype', preferredRuntimeMode: 'atlas_only', runtimeWhitelist: runtimeFiles, assetCount: assets.length, assets: publicAssets,
    externalAssets: recipe.externalAssets, engineImport: { directory: 'project/LayaProject/assets/resources/village', mode: 'trimmed_shared_atlas', runtime: 'WeChat Mini Game', verificationReport: 'doc/tech/06_视觉升级与资源管线.md' } });
const categoryStats = {}; for (const a of assets) { const c = categoryStats[a.category] ??= { count: 0, bytes: 0 }; c.count++; c.bytes += a.bytes; }
const pngBytes = pages.reduce((sum, p) => sum + p.bytes, 0), metadataBytes = runtimeFiles.filter(p => p.endsWith('.json')).reduce((sum, p) => sum + fs.statSync(path.join(root, p)).size, 0);
const packing = { sourceCanvasPixels: originalArea, atlasContentPixels: trimmedArea, savedContentPixels: originalArea - trimmedArea, savedContentPercent: +(100 * (originalArea - trimmedArea) / originalArea).toFixed(2), trimmedAssetCount: trimmedCount, alphaThreshold: 0, nineSlicePreserved: true, paddingPerSide: padding };
write('budget_report.json', { generatedAt: '2026-11-10', runtimeAssetCount: assets.length, animationCount: recipe.animations.animations.length,
    animationFrames: recipe.animations.animations.reduce((s, a) => s + a.frameCount, 0), categoryStats, atlasPages: pages, packing,
    selectedRuntime: { mode: 'atlas_only', pngBytes, metadataBytes, totalBytes: pngBytes + metadataBytes, files: runtimeFiles },
    budgets: { fullPackageTarget: 3500000 }, sourceBytes: read('source/generation_records.json').records.reduce((sum, r) => sum + r.bytes, 0),
    budgetComparison: { worldPngBytes: pages.filter(p => p.group === 'world').reduce((s, p) => s + p.bytes, 0), uiAndEffectsPngBytes: pages.filter(p => p.group === 'ui').reduce((s, p) => s + p.bytes, 0) },
    limitations: ['Atlas content-pixel savings are not identical to PNG byte savings', 'No real phone or platform upload measurement'] });
write('validation_report.json', { date: '2026-11-10', status: 'passed', checks: { pngCount: assets.length, animationGroups: recipe.animations.animations.length, atlasPages: pages.length, exactTransparentTrimOnly: true, sourceCanvasAndPivotsMatch: true, atlasPixelsMatchSourceCrop: true, croppedAwayPixelsAllTransparent: true, directionReferencesValid: true, nineSliceCanvasPreserved: true }, packing, errors: [] });

// 完整画布预览与方向切换页，不进入微信包。
for (const dir of ['preview/animations', 'preview/strips']) fs.mkdirSync(path.join(root, dir), { recursive: true });
for (const clip of recipe.animations.animations) {
    const inputs = clip.frameIds.map(id => path.join(root, assets.find(a => a.id === id).path));
    run([...inputs, '+append', '-filter', 'point', '-resize', '200%', '-background', '#e6e1d2', '-alpha', 'remove', path.join(root, `preview/strips/${clip.id}.png`)]);
    run(['-delay', String(Math.round(100 / clip.fps)), ...inputs, '-loop', '0', '-dispose', 'background', path.join(root, `preview/animations/${clip.id}.gif`)]);
}
run(['montage', ...assets.filter(a => !a.animation).map(a => path.join(root, a.path)), '-background', '#e6e1d2', '-tile', '8x', '-geometry', '128x128+8+8', path.join(root, 'preview/static_contact.png')]);
run(['montage', ...recipe.animations.animations.map(a => path.join(root, `preview/strips/${a.id}.png`)), '-background', '#e6e1d2', '-tile', '2x', '-geometry', '480x120+8+8', path.join(root, 'preview/characters_contact.png')]);
const clips = recipe.animations.animations.map(c => ({ ...c, urls: c.frameIds.map(id => '../' + assets.find(a => a.id === id).path) }));
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>代代守村 · 可迭代资源预览</title><style>body{margin:0;padding:32px;background:#e9e0c9;color:#392c20;font:16px/1.7 system-ui}h1{margin:0}button{font:inherit;padding:8px 20px}section{display:flex;flex-wrap:wrap;gap:20px;margin:24px 0}article{background:#fff4d8;border:2px solid #ae854b;padding:14px;text-align:center;min-width:190px}.sprite{height:176px;display:flex;align-items:center;justify-content:center;background:#dce0c7}img{image-rendering:pixelated}small{display:block}a{color:#5b723c}.contact{max-width:100%}</style><h1>代代守村 · 方向与资源预览</h1><p>${assets.length} 张源画布 / ${clips.length} 组动画 / ${pages.length} 页图集。打图集裁透明边，源画布与脚底保持完整。裁边减少内容占用 ${packing.savedContentPercent}%。</p><button id="pause">暂停 / 播放</button><button id="step">下一帧</button><h2>四方向连续转向</h2><section id="turns"></section><h2>全部动作</h2><section id="clips"></section><h2>静态资源</h2><img class="contact" src="static_contact.png"><script>const clips=${JSON.stringify(clips)},dirs=${JSON.stringify(recipe.animations.walkDirections)};let elapsed=0,last=performance.now(),paused=false;document.querySelector('#pause').onclick=()=>paused=!paused;document.querySelector('#step').onclick=()=>{paused=true;elapsed+=125;render()};const card=(title)=>{let e=document.createElement('article');e.innerHTML='<strong>'+title+'</strong><div class="sprite"><img width="144" height="144"></div><small></small>';return e};const cards=clips.map(c=>{let e=card(c.id);document.querySelector('#clips').append(e);return e});const turns=Object.keys(dirs).map(k=>{let e=card(k);document.querySelector('#turns').append(e);return e});function render(){clips.forEach((c,i)=>{cards[i].querySelector('img').src=c.urls[Math.floor(elapsed*c.fps/1000)%c.frameCount];cards[i].querySelector('small').textContent=c.frameCount+'帧 · '+c.fps+'FPS'});Object.keys(dirs).forEach((k,i)=>{const direction=['DOWN','LEFT','UP','RIGHT'][Math.floor(elapsed/1600)%4],d=dirs[k][direction],c=clips.find(c=>c.id===d.clip),img=turns[i].querySelector('img');img.src=c.urls[Math.floor(elapsed*c.fps/1000)%c.frameCount];img.style.transform=d.mirror?'scaleX(-1)':'';turns[i].querySelector('small').textContent=direction})}function tick(now){if(!paused)elapsed+=Math.min(100,now-last);last=now;render();requestAnimationFrame(tick)}requestAnimationFrame(tick)</script></html>`;
fs.writeFileSync(path.join(root, 'preview/index.html'), html);

if (args.includes('--sync')) {
    const dest = path.resolve(root, '../project/LayaProject/assets/resources/village'); fs.mkdirSync(dest, { recursive: true });
    const allowed = new Set(runtimeFiles.map(p => path.basename(p)));
    for (const name of fs.readdirSync(dest)) if (!name.endsWith('.meta') && !allowed.has(name)) throw new Error('发现非本轮运行白名单文件，请人工核对：' + name);
    for (const name of runtimeFiles) fs.copyFileSync(path.join(root, name), path.join(dest, path.basename(name)));
}
console.log(JSON.stringify({ assets: assets.length, clips: clips.length, pages: pages.length, runtimeBytes: pngBytes + metadataBytes, packing, sync: args.includes('--sync') }));
