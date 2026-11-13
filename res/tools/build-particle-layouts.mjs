import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
/** 粒子系统保留 Laya 原生序列化内容，运行时使用同版本解码器；不重建/猜测省略属性。 */
export function buildParticleLayouts(root) {
    const dir = path.join(root, 'editor/BuildingWorkshop/assets/particleAuthoring');
    const recipe = JSON.parse(fs.readFileSync(path.join(dir, 'recipe.json')));
    const material = JSON.parse(fs.readFileSync(path.join(dir, 'materials/pixel.lmat'))).props;
    const materialId = JSON.parse(fs.readFileSync(path.join(dir, 'materials/pixel.lmat.meta'))).uuid;
    if (material.type !== 'VillageParticle' || material.textures.length !== 1 || material.textures[0].path !== 'res://00000000-0000-0000-0001-000000000000') throw new Error('粒子必须复用内置白纹理');
    const result = {};
    for (const bundle of ['base', 'characters', 'battle']) {
        const definitions = {}, sources = {};
        for (const effect of recipe.effects.filter(e => e.bundle === bundle)) {
            const raw = fs.readFileSync(path.join(dir, 'prefabs', effect.id + '.lh'));
            const prefab = JSON.parse(raw), comp = prefab._$comp?.[0];
            if (prefab.name !== effect.id || prefab._$type !== 'Sprite' || prefab._$comp.length !== 1 || comp._$type !== 'ShurikenParticle2DRenderer' || comp.sharedMaterial._$uuid !== materialId || !comp.particleSystem) throw new Error('粒子预制体或材质不完整:' + effect.id);
            definitions[effect.id] = comp.particleSystem;
            sources[effect.id] = crypto.createHash('sha256').update(raw).digest('hex');
        }
        const file = `native/particles_${bundle}.json`;
        const shared = bundle === 'base' ? { material, shader: fs.readFileSync(path.join(dir, 'shaders/VillageParticle.shader'), 'utf8') } : {};
        fs.writeFileSync(path.join(root, file), JSON.stringify({ version: 1, bundle, sources, definitions, ...shared }));
        result[bundle] = file;
    }
    return result;
}
