import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { enemyMotionProfiles, enemyContactShadow } from '../source/rendered2d/enemy-layouts.mjs';
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
    const allowed = new Set(['_$ver', '_$id', '_$type', 'name', 'width', 'height', 'x', 'y', 'alpha', 'visible', 'texture', '_$child']);
    const check = n => {
        if (n._$type !== 'Sprite' || Object.keys(n).some(k => !allowed.has(k))) throw new Error('不支持的怪物预制体属性:' + n.name);
        for (const child of n._$child || []) check(child);
    };
    // Laya 省略值为0的坐标；其他非有限值拒绝发布，不把坏挂点静默归零。
    const point = n => {
        const x = n.x === undefined ? 0 : n.x, y = n.y === undefined ? 0 : n.y;
        if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('怪物坐标不是有限值:' + n.name);
        return { x, y };
    };
    const child = (n, name) => { const found = n._$child?.find(c => c.name === name); if (!found) throw new Error('缺少节点:' + n.name + '/' + name); return found; };
    for (const kind of kinds) {
        const raw = fs.readFileSync(path.join(dir, 'prefabs', kind + '.lh')), prefab = JSON.parse(raw); check(prefab);
        if (prefab.name !== kind || prefab.width !== 96 || prefab.height !== 96 || prefab.x || prefab.y) throw new Error('怪物根必须为96画布单位变换:' + kind);
        const foot = point(child(prefab, 'SortOrigin')), bounds = child(prefab, 'VisualBounds');
        const clip = clips.find(c => c.mapping === kind);
        if (foot.x !== 48 || foot.y !== enemyMotionProfiles[kind].foot || bounds.width !== 96 || bounds.height !== 96 || bounds.x || bounds.y || prefab._$child.length !== clip.frameCount + 3 || ![6,8].includes(clip.frameCount) || !(clip.stridePixels > 0)) throw new Error('怪物范围/共同足底被改变:' + kind);
        const shadowNode = child(prefab, 'ContactShadow'), shadowFrame = textures.get(shadowNode.texture?._$uuid);
        if (prefab._$child[0] !== shadowNode || shadowFrame !== enemyContactShadow.frame || shadowNode.visible === false ||
            ![shadowNode.width, shadowNode.height, shadowNode.alpha].every(Number.isFinite) || shadowNode.width <= 0 || shadowNode.height <= 0 || shadowNode.alpha <= 0 || shadowNode.alpha > 1)
            throw new Error('怪物根级接地影不完整:' + kind);
        const shadow = { frame: shadowFrame, ...point(shadowNode), width: shadowNode.width, height: shadowNode.height, alpha: shadowNode.alpha };
        // 编辑器保存整数矩形，允许Alpha中心取整产生的半个画布单位误差；不允许逐帧漂移。
        if (Math.abs(shadow.x + shadow.width * enemyContactShadow.centerX - foot.x) > .5 || Math.abs(shadow.y + shadow.height * enemyContactShadow.centerY - foot.y) > .5)
            throw new Error('怪物阴影中心未对齐共同足底:' + kind);
        const poses = [];
        for (let i = 0; i < clip.frameCount; i++) {
            const frame = child(prefab, 'Frame' + i), body = child(frame, 'Body');
            if (frame.x || frame.y || frame.width !== 96 || frame.height !== 96) throw new Error('帧容器必须保留统一画布与单位变换:' + kind);
            const bodyId = textures.get(body.texture?._$uuid), offset = point(body);
            if (!bodyId || !frames.has(bodyId) || body.width !== 96 || body.height !== 96 || body.visible === false || Math.abs(offset.x) > 24 || Math.abs(offset.y) > 24) throw new Error('怪物主体布局非法:' + kind);
            if (bodyId !== clip.frameIds[i]) throw new Error('编辑器帧序与动画清单不一致:' + kind);
            const parts = {}, bodyIndex = frame._$child.indexOf(body);
            for (const [index, layer] of frame._$child.entries()) {
                if (['Body', 'HeadSocket', 'BackSocket'].includes(layer.name)) continue;
                const id = textures.get(layer.texture?._$uuid), at = point(layer);
                if (!id?.startsWith('enemy_acc_') || !frames.has(id) || layer.name !== 'Accessory_' + id.slice('enemy_acc_'.length) || parts[id] || layer.visible !== false || !Number.isFinite(layer.width) || layer.width <= 0 || layer.width > 192 || layer.height !== layer.width || Math.abs(at.x) > 192 || Math.abs(at.y) > 192) throw new Error('怪物配饰布局非法:' + kind + '/' + layer.name);
                parts[id] = { ...at, width: layer.width, height: layer.height, behind: index < bodyIndex };
            }
            point(child(frame, 'HeadSocket')); point(child(frame, 'BackSocket'));
            if (frame._$child.length !== Object.keys(parts).length + 3) throw new Error('怪物配饰或挂点重复/缺失:' + kind);
            poses.push({ body: bodyId, ...offset, parts });
        }
        definitions[kind] = { canvas: 96, foot, shadow, fps: clip.fps, stride: clip.stridePixels * 96 / clip.canvas.w, frames: poses };
        hashes[kind] = crypto.createHash('sha256').update(raw).digest('hex');
    }
    if (kinds.length !== 10 || Object.keys(definitions).length !== 10) throw new Error('必须5小怪+5首领独立预制体');
    // v4将独立接地影纳入原生动画根，运行端不再从另一份表现配置推算其位置。
    const file = 'native/enemies.json'; fs.writeFileSync(path.join(root, file), JSON.stringify({ version: 4, sources: hashes, definitions }));
    return file;
}
