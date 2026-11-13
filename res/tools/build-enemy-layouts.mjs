import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
/** 正式运行布局只读取 Laya 保存的十个独立 .lh；种子文件不替代编辑器成品。 */
export function buildEnemyLayouts(root) {
    const dir = path.join(root, 'editor/BuildingWorkshop/assets/enemyAuthoring');
    const recipe = JSON.parse(fs.readFileSync(path.join(root, 'source/asset_recipe.json')));
    const clips = recipe.animations.animations.filter(c => c.category === 'enemies');
    const kinds = clips.map(c => c.mapping);
    const frames = new Set(recipe.assets.filter(a => a.runtime && a.bundle === 'battle').map(a => a.id));
    const textures = new Map();
    for (const file of fs.readdirSync(path.join(dir, 'textures')).filter(f => f.endsWith('.png.meta'))) textures.set(JSON.parse(fs.readFileSync(path.join(dir, 'textures', file))).uuid, file.slice(0, -9));
    const definitions = {}, hashes = {};
    const allowed = new Set(['_$ver', '_$id', '_$type', 'name', 'width', 'height', 'x', 'y', 'visible', 'texture', '_$child']);
    const check = n => {
        if (n._$type !== 'Sprite' || Object.keys(n).some(k => !allowed.has(k))) throw new Error('不支持的怪物预制体属性:' + n.name);
        for (const child of n._$child || []) check(child);
    };
    const point = n => ({ x: n.x || 0, y: n.y || 0 });
    const child = (n, name) => { const found = n._$child?.find(c => c.name === name); if (!found) throw new Error('缺少节点:' + n.name + '/' + name); return found; };
    for (const kind of kinds) {
        const raw = fs.readFileSync(path.join(dir, 'prefabs', kind + '.lh')), prefab = JSON.parse(raw); check(prefab);
        if (prefab.name !== kind || prefab.width !== 96 || prefab.height !== 96 || prefab.x || prefab.y) throw new Error('怪物根必须为96画布单位变换:' + kind);
        const foot = point(child(prefab, 'SortOrigin')), bounds = child(prefab, 'VisualBounds');
        const clip = clips.find(c => c.mapping === kind);
        if (foot.x !== 48 || foot.y !== 92 || bounds.width !== 96 || bounds.height !== 96 || bounds.x || bounds.y || prefab._$child.length !== clip.frameCount + 2 || clip.frameCount < 2 || clip.frameCount > 4) throw new Error('怪物范围/共同足底被改变:' + kind);
        const poses = [];
        for (let i = 0; i < clip.frameCount; i++) {
            const frame = child(prefab, 'Frame' + i), body = child(frame, 'Body');
            if (frame.x || frame.y || frame.width !== 96 || frame.height !== 96 || frame._$child.length !== 3) throw new Error('帧容器必须保留统一画布与单位变换:' + kind);
            const readLayer = layer => {
                const id = textures.get(layer.texture?._$uuid);
                if (!id || !frames.has(id) || layer.width !== 96 || layer.height !== 96 || layer.x || layer.y || layer.visible === false) throw new Error('未发布纹理或图层坐标非法:' + kind);
                return id;
            };
            const bodyId = readLayer(body);
            if (bodyId !== clip.frameIds[i]) throw new Error('编辑器帧序与动画清单不一致:' + kind);
            poses.push({ body: bodyId, head: point(child(frame, 'HeadSocket')), back: point(child(frame, 'BackSocket')) });
        }
        definitions[kind] = { canvas: 96, foot, fps: clip.fps, frames: poses };
        hashes[kind] = crypto.createHash('sha256').update(raw).digest('hex');
    }
    if (kinds.length !== 10 || Object.keys(definitions).length !== 10) throw new Error('必须5小怪+5首领独立预制体');
    const file = 'native/enemies.json'; fs.writeFileSync(path.join(root, file), JSON.stringify({ version: 1, sources: hashes, definitions }));
    return file;
}
