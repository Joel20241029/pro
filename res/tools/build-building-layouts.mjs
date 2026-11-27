import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// .lh 是唯一布局源。只转换已验证的 Sprite 子集；新增编辑器特性必须显式接入，不能静默丢弃。
export function buildBuildingLayouts(resRoot) {
    const source = path.resolve(resRoot, 'editor/BuildingWorkshop/assets/buildingAuthoring');
    const recipe = JSON.parse(fs.readFileSync(path.join(resRoot, 'source/asset_recipe.json')));
    const frames = new Set(recipe.assets.filter(a => a.runtime).map(a => a.id));
    const uuidFrames = new Map(), uuidClips = new Map();
    for (const file of fs.readdirSync(path.join(source, 'textures')).filter(f => f.endsWith('.png.meta'))) {
        const id = file.slice(0, -9), meta = JSON.parse(fs.readFileSync(path.join(source, 'textures', file)));
        if (uuidFrames.has(meta.uuid)) throw new Error('重复部件 UUID:' + file);
        uuidFrames.set(meta.uuid, id);
    }
    const nativeFiles = [];
    for (const clip of ['upgrade', 'attack']) {
        const file = path.join(source, 'animations', clip + '.mc');
        const meta = JSON.parse(fs.readFileSync(file + '.meta'));
        uuidClips.set(meta.uuid, clip);
        const dest = 'native/building_' + clip + '.mc';
        fs.mkdirSync(path.join(resRoot, 'native'), { recursive: true });
        fs.copyFileSync(file, path.join(resRoot, dest)); nativeFiles.push(dest);
    }
    const props = ['x', 'y', 'width', 'height', 'anchorX', 'anchorY', 'scaleX', 'scaleY', 'rotation', 'alpha', 'visible'];
    const allowed = new Set(['_$ver', '_$id', '_$type', 'name', '_$child', '_$comp', 'texture', ...props]);
    const sources = {}, layouts = {};
    const unitContainer = (n, where) => {
        if (n.frame || n.clip || ['x', 'y', 'anchorX', 'anchorY', 'rotation'].some(k => (n[k] || 0) !== 0)
            || ['scaleX', 'scaleY', 'alpha'].some(k => n[k] !== undefined && n[k] !== 1)
            || n.width !== 128 || n.height !== 128) throw new Error('建筑容器必须保持128画布和单位变换，请编辑内部部件:' + where);
    };
    const convert = (node, nodePath) => {
        if (node._$type !== 'Sprite') throw new Error('建筑仅支持 Sprite:' + nodePath);
        for (const key of Object.keys(node)) if (!allowed.has(key)) throw new Error('不支持的编辑器属性:' + nodePath + '/' + key);
        const out = { name: node.name };
        for (const key of props) if (node[key] !== undefined) out[key] = node[key];
        if (node.texture) {
            out.frame = uuidFrames.get(node.texture._$uuid);
            if (!out.frame || !frames.has(out.frame)) throw new Error('未映射或未发布纹理:' + nodePath);
        }
        if (node._$comp) for (const component of node._$comp) {
            if (component._$type !== 'AnimatorClip2D' || component.autoPlay !== false || Object.keys(component).some(k => !['_$type', 'clip', 'autoPlay'].includes(k))) throw new Error('不支持的建筑组件:' + nodePath);
            out.clip = uuidClips.get(component.clip._$uuid);
            if (!out.clip) throw new Error('未声明动画:' + nodePath);
        }
        if (node._$child) {
            if (new Set(node._$child.map(c => c.name)).size !== node._$child.length) throw new Error('同级节点重名:' + nodePath);
            out.children = node._$child.map(c => convert(c, nodePath + '/' + c.name));
        }
        return out;
    };
    const kinds = ['HOUSE', 'FARM', 'LOGGING', 'GATE', 'CANNON', 'PATROL', 'HEARTH'];
    const files = fs.readdirSync(path.join(source, 'prefabs')).filter(f => f.endsWith('.lh')).sort();
    if (files.length !== kinds.length || files.some(f => !kinds.includes(f.slice(0, -3)))) throw new Error('必须每种建筑一个固定外观预制体');
    const find = (node, name) => node.name === name ? node : (node.children || []).map(n => find(n, name)).find(Boolean);
    for (const file of files) {
        const raw = fs.readFileSync(path.join(source, 'prefabs', file)), node = JSON.parse(raw);
        const id = file.slice(0, -3);
        if (id !== node.name) throw new Error('预制体文件名与根节点不同:' + id);
        const root = convert(node, id);
        unitContainer(root, id);
        if (root.visible === false) throw new Error('建筑根不能隐藏:' + id);
        for (const layout of root.children || []) {
            unitContainer(layout, layout.name);
            if (!layout.name.startsWith(id + '_') || layouts[layout.name]) throw new Error('无效/重复建筑变体:' + layout.name);
            const body = layout.children?.find(n => n.name === 'Body');
            if (!body || !find(body, 'Structure') || body.clip) throw new Error('建筑主体必须使用固定单张贴图:' + layout.name);
            if (id === 'CANNON' && ['Muzzle', 'Weapon', 'RestBarrel', 'AimedBarrel'].some(name => !find(body, name))) throw new Error('缺少射口或武器:' + layout.name);
            const marker = name => {
                const value = layout.children.find(n => n.name === name);
                if (!value || value.visible !== false || Object.keys(value).some(k => !['name', 'visible', 'x', 'y', 'width', 'height'].includes(k))) throw new Error('无效范围标记:' + layout.name + '/' + name);
                return { x: value.x || 0, y: value.y || 0, width: value.width || 0, height: value.height || 0 };
            };
            layout.bounds = marker('VisualBounds'); layout.footprint = marker('Footprint');
            const sort = marker('SortOrigin'); layout.sort = { x: sort.x, y: sort.y };
            if (sort.x !== 64 || sort.y !== 120) throw new Error('升级不能移动排序足底:' + layout.name);
            if (find(layout, 'AboveGround')) layout.aboveFootprint = marker('AboveFootprint');
            layout.children = layout.children.filter(n => !['VisualBounds', 'Footprint', 'SortOrigin', 'AboveFootprint'].includes(n.name));
            // 编辑时只显示一个变体；发布时只实例化被选中的变体，不能继承编辑器隐藏状态。
            delete layout.visible;
            layouts[layout.name] = layout;
        }
        sources[id] = crypto.createHash('sha256').update(raw).digest('hex');
    }
    for (const kind of kinds)
        if (!layouts[`${kind}_1_1`]) throw new Error('缺少固定建筑布局:' + kind);
    if (Object.keys(layouts).length !== kinds.length) throw new Error('每种建筑必须只有一套固定外观');
    fs.writeFileSync(path.join(resRoot, 'native/buildings.json'), JSON.stringify({ layouts }) + '\n');
    fs.writeFileSync(path.join(resRoot, 'source/buildings/editor-manifest.json'), JSON.stringify({ format: 'Laya Sprite prefab source', sourceDirectory: 'res/editor/BuildingWorkshop/assets/buildingAuthoring', sources, nativeFiles }, null, 2) + '\n');
    return ['native/buildings.json', ...nativeFiles];
}
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(buildBuildingLayouts(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')));
