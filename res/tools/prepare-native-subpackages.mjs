import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { atlasGroups } from './resource-bundles.mjs';

export const stages = ['village', 'night'];
const imageExtension = /\.(png|jpg)$/;

export function nativeResourcePlan(res) {
    const manifest = JSON.parse(fs.readFileSync(path.join(res, 'manifest.json'), 'utf8'));
    const atlas = JSON.parse(fs.readFileSync(path.join(res, 'atlases/frames.json'), 'utf8'));
    if (manifest.version !== 4 || manifest.preferredRuntimeMode !== 'atlas_plus_audio')
        throw new Error('需要二维图集与动画资源清单');
    const pages = new Map(atlas.pages.map(page => [page.runtimeFile, page]));
    const portraitPages = new Set(Object.entries(atlas.frames).filter(([id]) => id.startsWith('portrait_')).map(([, frame]) => frame.page));
    const planned = new Set();
    const files = stages.flatMap(stage => manifest.stages[stage].map(bundled => {
        if (!/^bundles\/[a-z_]+\/[a-z0-9_.]+\.(png|jpg|bin|mc)$/.test(bundled) || planned.has(bundled))
            throw new Error('运行资源路径冲突或不合法：' + bundled);
        planned.add(bundled);
        const source = bundled.slice('bundles/'.length);
        const page = pages.get(source);
        if (imageExtension.test(source) !== !!page || (page && atlasGroups[page.group]?.stage !== stage))
            throw new Error('图页与分包阶段不符：' + source);
        // UI、攻击特效和头像保留 4×4 精度，其他世界图集沿用 6×6。
        const block = page && (page.group === 'ui' || page.group === 'night_effects' || portraitPages.has(page.id) ? 4 : 6);
        return { stage, source, bundled, output: source.replace(imageExtension, '.ktx'), page, block };
    }));
    if ([...pages.keys()].some(file => !planned.has('bundles/' + file))) throw new Error('图页没有加入分包');
    return files;
}

export function verifyAstcPage(data, { page, block, output }) {
    const payload = Math.ceil(page.width / block) * Math.ceil(page.height / block) * 16;
    const level = data.length >= 68 ? 64 + data.readUInt32LE(60) : -1;
    if (level < 64 || data.subarray(0, 12).toString('hex') !== 'ab4b5458203131bb0d0a1a0a' ||
        data.readUInt32LE(12) !== 0x04030201 || data.readUInt32LE(28) !== (block === 4 ? 37808 : 37812) ||
        data.readUInt32LE(36) !== page.width || data.readUInt32LE(40) !== page.height ||
        data.readUInt32LE(56) !== 1 || level + 4 + payload !== data.length || data.readUInt32LE(level) !== payload)
        throw new Error('ASTC 图页格式或尺寸不符：' + output);
}

/** 从制作清单生成临时项目的微信分包。Laya 编辑器预览继续读取未压缩的制作图集。 */
export function prepareNativeSubpackages(res, assets, destination, encoder = process.env.DAIDAI_ASTCENC || 'astcenc') {
    for (const entry of nativeResourcePlan(res)) {
        const { stage, source, bundled, page, block, output } = entry;
        const original = path.join(res, bundled), bytes = fs.readFileSync(original);
        if (!bytes.equals(fs.readFileSync(path.join(assets, source))))
            throw new Error('正式 Laya 工程素材未同步：' + source);
        if (page && createHash('sha256').update(bytes).digest('hex') !== page.sha256)
            throw new Error('待压缩图页与制作帧表不符：' + source);
        const target = path.join(destination, stage, output);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        if (!page) { fs.writeFileSync(target, bytes); continue; }
        // Laya 从压缩块上传时不转换 alpha，编码阶段完成预乘。
        execFileSync(encoder, ['-cl', original, target, `${block}x${block}`, '-thorough', '-pp-premultiply']);
        verifyAstcPage(fs.readFileSync(target), entry);
    }
}
