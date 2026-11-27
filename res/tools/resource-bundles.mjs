import fs from 'node:fs';
import path from 'node:path';

export const atlasGroups = {
    ui: { category: 'ui', stage: 'village' },
    // 单张整图保持原采样尺寸；散件页按实际占位输出。
    // 不透明整图使用已选的 94 品质及全色度采样；保留草纹和路边颜色。
    terrain: { category: 'map', stage: 'village', standalone: true, jpegQuality: 94 },
    map: { category: 'map', stage: 'village' },
    buildings: { category: 'buildings', stage: 'village' },
    characters: { category: 'characters', stage: 'village' },
    village_effects: { category: 'effects', stage: 'village' },
    enemies: { category: 'enemies', stage: 'night' },
    heroes: { category: 'characters', stage: 'village' },
    delivery_combat: { category: 'characters', stage: 'night' },
    night_effects: { category: 'effects', stage: 'night' }
};
/** 村内常驻特效及已加载的战技红环，三种品质小图共用此图页。 */
const villageEffects = new Set(['fx_hearts', 'icon_baby_cry', 'fx_rage_orbit', 'fx_rage_up', 'fx_quality_elite', 'fx_quality_hero', 'fx_quality_legendary', 'delivery_bike']);

export function atlasGroup(asset) {
    const category = asset.category.split('/')[0];
    switch (category) {
        case 'ui': return 'ui';
        case 'terrain': return 'terrain';
        case 'decorations': return 'map';
        case 'building-parts': return 'buildings';
        case 'characters': {
            if (asset.id.startsWith('hero_delivery_'))
                return /_(ride|windup|throw|recover)$/.test(asset.id) ? 'delivery_combat' : 'heroes';
            return /^hero_(zhizhuo|songlei)_/.test(asset.id) ? 'heroes' : 'characters';
        }
        case 'enemies':
        case 'enemy-parts': return 'enemies';
        case 'effects': return villageEffects.has(asset.id) ? 'village_effects' : 'night_effects';
        default: throw new Error('素材缺少发布分类：' + asset.id);
    }
}

export function writeBundles(root, pages, frames, animations, buildingFiles, audio, enemyFile) {
    const result = { village: [], night: [] }, mainAudio = [], required = {};
    const copy = (files, source, relative) => {
        const destination = path.join(root, 'bundles', relative);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(path.join(root, source), destination);
        files.push('bundles/' + relative);
    };
    const writeJson = (stage, relative, data) => {
        const destination = path.join(root, 'bundles', relative);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, JSON.stringify(data));
        result[stage].push('bundles/' + relative);
    };
    for (const stage of Object.keys(result)) {
        const village = stage === 'village';
        const selected = pages.filter(p => atlasGroups[p.group].stage === stage);
        const pageIds = new Set(selected.map(p => p.id));
        const stageFrames = Object.fromEntries(Object.entries(frames).filter(([, f]) => pageIds.has(f.page)));
        const clips = animations.animations.filter(c => stageFrames[c.frameIds[0]]);
        for (const clip of clips) {
            if (!stageFrames[clip.restFrame] || !clip.frameIds.every(id => stageFrames[id]))
                throw new Error('动画跨越加载阶段：' + clip.id);
        }
        writeJson(stage, (village ? 'map' : 'enemies') + '/frames.bin', {
            version: 4, stage, pages: selected.map(p => ({ id: p.id, runtimeFile: p.runtimeFile })), frames: stageFrames
        });
        writeJson(stage, (village ? 'characters' : 'enemies') + '/animations.bin', {
            animations: clips,
            walkDirections: village ? animations.walkDirections : {},
            laborDirections: village ? animations.laborDirections : {},
            enemyNativeFacing: village ? {} : animations.enemyNativeFacing
        });
        for (const p of selected) copy(result[stage], p.path, p.runtimeFile);
        for (const file of village ? buildingFiles : [enemyFile]) {
            copy(result[stage], file, (village ? 'buildings/' : 'enemies/') + path.basename(file).replace(/\.json$/, '.bin'));
        }
        required[stage] = { frames: Object.keys(stageFrames).sort(), clips: clips.map(c => c.id).sort() };
    }
    for (const track of audio.tracks) copy(mainAudio, track.runtimeFile, 'music/' + path.basename(track.runtimeFile));
    const buildings = JSON.parse(fs.readFileSync(path.join(root, 'native/buildings.json'))).layouts;
    const enemies = JSON.parse(fs.readFileSync(path.join(root, enemyFile)));
    const villageFrames = new Set(required.village.frames), nightFrames = new Set(required.night.frames);
    const villageClips = new Set(required.village.clips);
    for (const directions of [animations.walkDirections, animations.laborDirections]) {
        for (const poses of Object.values(directions)) for (const pose of Object.values(poses)) {
            if (!villageClips.has(pose.clip)) throw new Error('村民动作需要在进村前准备：' + pose.clip);
        }
    }
    const checkBuilding = node => {
        if (node.frame && !villageFrames.has(node.frame)) throw new Error('建筑引用的素材需在进村前加载：' + node.frame);
        for (const child of node.children || []) checkBuilding(child);
    };
    for (const layout of Object.values(buildings)) checkBuilding(layout);
    for (const layout of Object.values(enemies.definitions)) {
        if (!villageFrames.has(layout.shadow.frame)) throw new Error('怪物共享阴影需在进村前准备：' + layout.shadow.frame);
        for (const frame of layout.frames) {
            if (!nightFrames.has(frame.body) || Object.keys(frame.parts).some(id => !nightFrames.has(id)))
                throw new Error('怪物主体或配饰需在守夜前准备：' + frame.body);
        }
    }
    const lines = [
        '/** 由 res/tools/build-resources.mjs 生成。运行期按阶段校验图集、方向、建筑与怪物布局。 */',
        'export const RESOURCE_CONTRACT: Record<"village" | "night", { frames: string[]; clips: string[] }> = ' + JSON.stringify(required) + ';',
        'export const REQUIRED_ENEMY_LAYOUT_VERSION = ' + enemies.version + ';',
        'export const REQUIRED_WALK_DIRECTIONS = ' + JSON.stringify(animations.walkDirections) + ';',
        'export const REQUIRED_LABOR_DIRECTIONS = ' + JSON.stringify(animations.laborDirections) + ';',
        'export const REQUIRED_BUILDING_LAYOUTS = ' + JSON.stringify(Object.keys(buildings).sort()) + ';'
    ];
    fs.writeFileSync(path.resolve(root, '../project/LayaProject/src/config/ResourceManifest.ts'), lines.join('\n') + '\n');
    return { stages: result, mainAudio };
}

export function syncGameplayAssets(root, files, previousFiles, mainAudio) {
    const destination = path.resolve(root, '../project/LayaProject/assets/resources');
    const allowed = new Set(files.map(file => file.slice('bundles/'.length)));
    const audio = new Set(mainAudio.map(file => file.slice('bundles/'.length)));
    // 只清理上一份发布清单明确列出的工程生成文件。
    for (const file of previousFiles) {
        if (!/^bundles\/[a-z_]+\/[a-z0-9_.]+$/.test(file)) throw new Error('历史运行文件路径不合法：' + file);
        const relative = file.slice('bundles/'.length);
        const stagedAsset = path.join(destination, 'gameplay', relative);
        if (!allowed.has(relative) || audio.has(relative)) {
            fs.rmSync(stagedAsset, { force: true });
            fs.rmSync(stagedAsset + '.meta', { force: true });
        }
        if (relative.startsWith('music/') && !audio.has(relative)) {
            const local = path.join(destination, relative);
            fs.rmSync(local, { force: true });
            fs.rmSync(local + '.meta', { force: true });
        }
    }
    for (const file of files) {
        const relative = file.slice('bundles/'.length);
        const target = audio.has(relative) ? path.join(destination, relative) : path.join(destination, 'gameplay', relative);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(root, file), target);
    }
}
