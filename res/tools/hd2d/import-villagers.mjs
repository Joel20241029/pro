import fs from 'node:fs';
import path from 'node:path';
import { runtimeTextureSizes } from '../../source/rendered2d/runtime-texture-sizes.mjs';

const directions = ['down', 'down_right', 'right', 'up_right', 'up', 'up_left', 'left', 'down_left'];
const adults = ['blue', 'straw', 'red', 'jade', 'elite_male', 'elite_female'];
const roles = [...adults, 'child', 'elder'];
const adultActions = ['chop', 'farm', 'care', 'strike'];

/** 导入经八向检查的预渲染母片。静止图、足底和步幅共同锁定，不逐帧重定位。 */
export function importVillagers(root, importImage, clip, animations, walkDirections, laborDirections) {
    const sourceRoot = 'source/rendered2d/characters/v5';
    const read = name => JSON.parse(fs.readFileSync(path.join(root, sourceRoot, name), 'utf8'));
    const manifest = read('renders.json');
    function frame(id, source, anchor, width, bundle = 'characters') {
        return importImage({ id, source: sourceRoot + '/' + source, category: 'characters', bundle, width,
            pivot: { x: width * anchor.x, y: width * anchor.y }, alphaCutoff: 0, fullCanvas: true });
    }
    const portraits = [];
    for (const role of roles) {
        const spec = manifest[role];
        const profile = read(role + '/rig-profile.json');
        if (spec.walk.length !== profile.poses.length || !(profile.walkCycle.strideCanvasPixels > 0)) throw new Error('步态母片或步幅不足：' + role);
        const width = runtimeTextureSizes.characters[adults.includes(role) ? 'adult' : role];
        const walkMap = walkDirections[role] = {};
        for (const direction of directions) {
            const base = `hd_${role}_${direction}`;
            const files = spec.walk.map(index => `${role}/walk/${role}_${direction}_${index}.png`);
            const ids = files.map((file, i) => frame(base + '_' + i, file, spec.anchor, width));
            const restFile = `${role}/walk/${role}_${direction}_idle.png`;
            const restFrame = frame(base + '_idle', restFile, spec.anchor, width);
            if (direction === 'down') portraits.push({ restFrame, restFile, anchor: spec.anchor });
            const id = `villager_${role}_walk_${direction}`;
            clip(id, ids, profile.fps, 'characters', id);
            Object.assign(animations.at(-1), { restFrame, stridePixels: profile.walkCycle.strideCanvasPixels / 256 * width });
            walkMap[direction.toUpperCase()] = { clip: id, mirror: false };
        }
        if (!adults.includes(role)) continue;
        for (const action of adultActions) {
            const base = `villager_${role}_${action}`;
            const actionSpec = spec.actions[action];
            const battle = action === 'strike';
            const group = battle ? null : laborDirections[base] = {};
            for (const direction of directions) {
                const id = base + '_' + direction;
                // 扩大画布容纳武器外缘，放大绘制尺寸抵消取景变化，让人物身高和足点保持一致。
                const actionWidth = Math.ceil(width * actionSpec.displayScale / 8) * 8;
                const ids = actionSpec.frames.map(index => frame(`hd_${role}_${action}_${direction}_${index}`,
                    `${role}/labor/${role}_${action}_${direction}_${index}.png`, actionSpec.anchor, actionWidth, battle ? 'battle' : 'characters'));
                clip(id, ids, actionSpec.fps, 'characters', id);
                animations.at(-1).displayScale = actionSpec.displayScale;
                if (action === 'chop') animations.at(-1).contactFrame = actionSpec.frames.indexOf(actionSpec.contactFrame);
                if (battle) animations.at(-1).loop = false;
                else group[direction.toUpperCase()] = { clip: id, mirror: false };
            }
        }
    }
    const baby = manifest.baby;
    const images = new Map();
    const babyIds = baby.frames.map(index => {
        if (!images.has(index)) images.set(index, frame('hd_baby_idle_' + index, `baby/rest/baby_idle_${index}.png`, baby.anchor, runtimeTextureSizes.characters.baby));
        return images.get(index);
    });
    clip('villager_baby_idle', babyIds, baby.fps, 'characters', 'fixed newborn cradle');
    portraits.push({ restFrame: babyIds[0], restFile: `baby/rest/baby_idle_${baby.frames[0]}.png`, anchor: baby.anchor });
    for (const portrait of portraits)
        frame('portrait_' + portrait.restFrame, portrait.restFile, portrait.anchor, runtimeTextureSizes.characters.portrait);
}
