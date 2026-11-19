import fs from 'node:fs';
import path from 'node:path';
import { runtimeTextureSizes } from '../../source/rendered2d/runtime-texture-sizes.mjs';

// Rendered independently from the four cardinal cameras. Diagonal masters stay in authoring.
export const villagerDirections = ['down', 'right', 'up', 'left'];
export const villagerWorkDirections = ['right', 'left'];
const adults = ['blue', 'straw', 'red', 'jade', 'elite_male', 'elite_female'];
const roles = [...adults, 'child'];
// 保留六帧步态中每只脚的起点与过渡，左右半周期各两帧，整轮步幅沿用母片参数。
const rearPoseIndices = [0, 1, 3, 4];

/** 导入经四向检查的预渲染母片。静止图、足底和步幅共同锁定，不逐帧重定位。 */
export function importVillagers(root, importImage, clip, animations, walkDirections, laborDirections) {
    const sourceRoot = 'source/rendered2d/characters/v5';
    const read = name => JSON.parse(fs.readFileSync(path.join(root, sourceRoot, name), 'utf8'));
    const manifest = read('renders.json');
    function frame(id, source, anchor, width) {
        return importImage({ id, source: sourceRoot + '/' + source, category: 'characters', bundle: 'characters', width,
            pivot: { x: width * anchor.x, y: width * anchor.y }, alphaCutoff: 0, fullCanvas: true });
    }
    const portraits = [];
    for (const role of roles) {
        const spec = manifest[role];
        const walkSource = spec.walkSource || role;
        const profile = read(walkSource + '/rig-profile.json');
        if (spec.walk.length !== profile.poses.length || !(profile.walkCycle.strideCanvasPixels > 0)) throw new Error('步态母片或步幅不足：' + role);
        const width = runtimeTextureSizes.characters[adults.includes(role) ? 'adult' : role];
        const walkMap = walkDirections[role] = {};
        for (const direction of villagerDirections) {
            const base = `hd_${role}_${direction}`;
            const poses = direction === 'up' ? rearPoseIndices.map(i => spec.walk[i]) : spec.walk;
            const files = poses.map(index => `${walkSource}/walk/${role}_${direction}_${index}.png`);
            const ids = files.map((file, i) => frame(base + '_' + i, file, spec.anchor, width));
            const restFile = `${walkSource}/walk/${role}_${direction}_idle.png`;
            const restFrame = frame(base + '_idle', restFile, spec.anchor, width);
            if (direction === 'down') portraits.push({ restFrame, restFile, anchor: spec.anchor });
            const id = `villager_${role}_walk_${direction}`;
            clip(id, ids, profile.fps * poses.length / spec.walk.length, 'characters', id);
            Object.assign(animations.at(-1), { restFrame, stridePixels: profile.walkCycle.strideCanvasPixels / 256 * width });
            walkMap[direction.toUpperCase()] = { clip: id, mirror: false };
        }
        if (!adults.includes(role)) continue;
        const base = `villager_${role}_work`, action = spec.work;
        const group = laborDirections[base] = {};
        // 两种工作共用侧身挥刀，扩大画布容纳刀尖，保持与走路相同的身高。
        const actionWidth = Math.ceil(width * action.displayScale / 8) * 8;
        for (const direction of villagerWorkDirections) {
            const id = base + '_' + direction;
            const ids = action.frames.map(index => frame(`hd_${role}_work_${direction}_${index}`,
                `${action.source}/${role}_farm_${direction}_${index}.png`, action.anchor, actionWidth));
            clip(id, ids, action.fps, 'characters', id);
            Object.assign(animations.at(-1), { displayScale: action.displayScale, contactFrame: action.frames.indexOf(action.contactFrame[direction]) });
            group[direction.toUpperCase()] = { clip: id, mirror: false };
        }
    }
    const elder = manifest.elder;
    const seat = read('elder/rest/chair-anchor.json');
    frame('hd_elder_chair', 'elder/rest/' + seat.render, seat.anchor, runtimeTextureSizes.characters.elder);
    portraits.push({ restFrame: 'hd_elder_down_idle', restFile: 'elder/walk/elder_down_idle.png', anchor: elder.anchor });
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
