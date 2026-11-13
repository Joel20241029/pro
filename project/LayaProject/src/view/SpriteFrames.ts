import { WalkDirection } from "./VillagerMotion";
import { BuildingDefinition, BuildingNode } from "./BuildingLayout";
import { RESOURCE_CONTRACT, REQUIRED_WALK_DIRECTIONS, REQUIRED_LABOR_DIRECTIONS, REQUIRED_BUILDING_LAYOUTS } from "../config/ResourceManifest";
import { ENEMY_LOOKS } from "./config/EnemyVisualConfig";
import { ResourceBundle, RESOURCE_BUNDLES } from "../config/ResourceConfig";
import { Person, isElder } from "../game/GameState";
interface Frame { page: string; rect: { x: number; y: number; w: number; h: number }; sourceSize: { w: number; h: number }; trimOffset: { x: number; y: number }; pivot: { x: number; y: number }; nineSlice: { top: number; right: number; bottom: number; left: number; repeat: number } | null; }
interface Clip { id: string; frameIds: string[]; fps: number; restFrame: string; canvas: { w: number; h: number }; stridePixels?: number; }
interface EnemyDefinition { canvas: number; fps: number; foot: { x: number; y: number }; frames: { body: string; head: { x: number; y: number }; back: { x: number; y: number } }[]; }
/** 高清预渲染二维合同：恢复源画布、共同足底与真实方向，九宫格保留原图渐变。 */
export class SpriteFrames {
    enemyLayouts: Record<string, EnemyDefinition> = {};
    buildingLayouts: Record<string, BuildingDefinition> = {};
    buildingUpgrade!: Laya.AnimationClip2D;
    buildingAttack!: Laya.AnimationClip2D;
    private textures = new Map<string, Laya.Texture>();
    private clips = new Map<string, Clip>();
    private layouts = new Map<string, Frame>();
    private directions: Record<string, Record<WalkDirection, { clip: string; mirror: boolean }>> = {};
    private laborDirections: Record<string, Record<string, { clip: string; mirror: boolean }>> = {};
    private enemyFacing: Record<string, string> = {};
    private bundles = new Set<ResourceBundle>();
    private failedUrls = new Set<string>();
    private disposed = false;
    ready(bundle: ResourceBundle) { return this.bundles.has(bundle); }
    /** 失败 URL 绕过 Laya 的 null 缓存；成功图页继续复用。同批请求全部结算后才允许下一次手动重试。 */
    private async readBatch(requests: { url: string; type?: string }[]) {
        const results = await Promise.all(requests.map(async request => {
            try {
                const value = await Laya.loader.load(request.url, { type: request.type, ignoreCache: this.failedUrls.has(request.url) });
                if (!value) throw new Error("素材读取失败：" + request.url);
                this.failedUrls.delete(request.url); return { value, error: null as unknown };
            } catch (error) { this.failedUrls.add(request.url); return { value: null, error }; }
        }));
        const failed = results.find(result => result.error !== null);
        if (failed) throw failed.error;
        return results.map(result => result.value);
    }
    async loadBundle(bundle: ResourceBundle) {
        if (this.disposed) throw new Error("资源容器已经销毁");
        if (this.ready(bundle)) return;
        const root = RESOURCE_BUNDLES[bundle].root + "/";
        const metadata = ["frames.json", "animations.json", ...(bundle === "buildings" ? ["buildings.json", "building_upgrade.mc", "building_attack.mc"] : bundle === "battle" ? ["enemies.json"] : [])];
        const result = await this.readBatch(metadata.map(file => ({ url: root + file, type: file.endsWith(".json") ? Laya.Loader.JSON : undefined })));
        if (this.disposed) throw new Error("资源容器已经销毁");
        const created = new Map<string, Laya.Texture>();
        try {
            const table = result[0].data;
            if (table.bundle !== bundle || !table.pages?.length || !table.frames) throw new Error("图集清单与资源包不匹配");
            const descriptors = table.pages as { id: string; runtimeFile: string }[];
            if (new Set(descriptors.map(p => p.id)).size !== descriptors.length || descriptors.some(p => !/^[a-z0-9_]+\.png$/.test(p.runtimeFile))) throw new Error("图集页名不合法");
            const loaded = await this.readBatch(descriptors.map(p => ({ url: root + p.runtimeFile, type: Laya.Loader.IMAGE })));
            if (this.disposed) throw new Error("资源容器已经销毁");
            const pages: Record<string, Laya.Texture> = {}; descriptors.forEach((p, i) => {
                pages[p.id] = loaded[i]; pages[p.id].bitmap.filterMode = Laya.FilterMode.Bilinear;
            });
            const frames: Record<string, Frame> = table.frames, clips: Clip[] = result[1].data.animations;
            for (const id of Object.keys(frames)) {
                const f = frames[id], r = f.rect, page = pages[f.page];
                if (this.textures.has(id) || !page || !r || r.w <= 0 || r.h <= 0 || r.x < 0 || r.y < 0 || r.x + r.w > page.width || r.y + r.h > page.height || !f.sourceSize || !f.trimOffset || !f.pivot) throw new Error("图集帧不完整：" + id);
                created.set(id, Laya.Texture.create(page, r.x, r.y, r.w, r.h, f.trimOffset.x, f.trimOffset.y, f.sourceSize.w, f.sourceSize.h));
            }
            const required = RESOURCE_CONTRACT[bundle];
            if (created.size !== required.frames.length || required.frames.some(id => !created.has(id))) throw new Error("必需素材缺失");
            if (!Array.isArray(clips) || clips.length !== required.clips.length || required.clips.some(id => !clips.some(c => c.id === id))) throw new Error("必需动画缺失");
            if (bundle === "characters") for (const [identity, directions] of Object.entries(REQUIRED_WALK_DIRECTIONS)) for (const [direction, pose] of Object.entries(directions)) {
                const actual = result[1].data.walkDirections?.[identity]?.[direction];
                if (!actual || actual.clip !== pose.clip || actual.mirror !== pose.mirror) throw new Error("人物方向映射缺失：" + identity + "/" + direction);
            }
            if (bundle === "characters") for (const [action, directions] of Object.entries(REQUIRED_LABOR_DIRECTIONS)) for (const [direction, pose] of Object.entries(directions)) {
                const actual = result[1].data.laborDirections?.[action]?.[direction];
                if (!actual || actual.clip !== pose.clip || actual.mirror !== pose.mirror || !clips.some(c => c.id === pose.clip)) throw new Error("劳动方向映射缺失：" + action + "/" + direction);
            }
            for (const clip of clips) if (this.clips.has(clip.id) || clip.fps <= 0 || !clip.frameIds.length || !clip.frameIds.every(id => created.has(id)) || !clip.frameIds.includes(clip.restFrame)) throw new Error("动画帧不完整：" + clip.id);
            if (bundle === "buildings") {
                const layouts: Record<string, BuildingDefinition> = result[2].data.layouts;
                if (!layouts || Object.keys(layouts).length !== REQUIRED_BUILDING_LAYOUTS.length || REQUIRED_BUILDING_LAYOUTS.some(id => !layouts[id])) throw new Error("建筑布局缺失");
                const check = (node: BuildingNode) => {
                    if (!node || !node.name || (node.frame && !created.has(node.frame)) || (node.clip && node.clip !== "upgrade" && node.clip !== "attack") || (node.children !== undefined && !Array.isArray(node.children))) throw new Error("建筑部件不完整");
                    for (const child of node.children || []) check(child);
                };
                for (const layout of Object.values(layouts)) {
                    if (layout.sort?.x !== 64 || layout.sort?.y !== 120 || !layout.bounds || !layout.footprint) throw new Error("建筑足底或范围不完整");
                    check(layout);
                }
            }
            const enemyLayouts: Record<string, EnemyDefinition> = bundle === "battle" ? result[2].data.definitions : null;
            if (bundle === "battle") {
                if (!enemyLayouts || Object.keys(enemyLayouts).length !== Object.keys(ENEMY_LOOKS).length || Object.keys(ENEMY_LOOKS).some(id => !enemyLayouts[id])) throw new Error("怪物布局缺失");
                for (const [kind, layout] of Object.entries(enemyLayouts)) {
                    const clip = clips.find(c => c.id === kind + "_walk");
                    if (!clip || layout.canvas !== 96 || layout.foot.x !== 48 || layout.foot.y !== 92 || layout.fps !== clip.fps || layout.frames.length !== clip.frameIds.length || layout.frames.length < 2 || layout.frames.length > 4 || layout.frames.some((f, i) => !created.has(f.body) || f.body !== clip.frameIds[i] || !f.head || !f.back)) throw new Error("怪物帧与挂点不完整");
                }
            }
            // 完整校验完成后一次发布，失败不会把半套素材暴露给界面。
            for (const [id, texture] of created) { this.textures.set(id, texture); this.layouts.set(id, frames[id]); }
            for (const clip of clips) this.clips.set(clip.id, clip);
            Object.assign(this.directions, result[1].data.walkDirections);
            Object.assign(this.laborDirections, result[1].data.laborDirections);
            Object.assign(this.enemyFacing, result[1].data.enemyNativeFacing);
            if (bundle === "buildings") { this.buildingLayouts = result[2].data.layouts; this.buildingUpgrade = result[3]; this.buildingAttack = result[4]; }
            if (enemyLayouts) this.enemyLayouts = enemyLayouts;
            this.bundles.add(bundle);
        } catch (error) {
            for (const texture of created.values()) texture.destroy();
            // 元数据结构校验失败后重读清单；有效 PNG 缓存不清除。
            metadata.forEach(file => this.failedUrls.add(root + file));
            throw error;
        }
    }
    get(id: string): Laya.Texture { const t = this.textures.get(id); if (!t) throw new Error(`未声明的图片：${id}`); return t; }
    frameId(clipId: string, time: number, animated = true): string {
        const clip = this.animation(clipId);
        return animated ? clip.frameIds[Math.floor(time * clip.fps) % clip.frameIds.length] : clip.restFrame;
    }
    /** 完整母画布与整轮步幅供距离驱动行走使用；不能用裁切后的纹理宽度替代。 */
    animation(clipId: string): Readonly<Clip> { const clip = this.clips.get(clipId); if (!clip) throw new Error(`未声明的动画：${clipId}`); return clip; }
    /** 复用原二维人物选择规则，家谱按男女老人静止帧；不改变 Person 的性别与年龄。 */
    portraitId(person: Person, historical = false): string {
        const clip = historical || isElder(person) ? `villager_elder_${person.sex === "MALE" ? "male" : "female"}_idle` : person.adult ? `villager_${person.appearance}_walk` : person.growth === 0 ? "villager_baby_idle" : `villager_${person.sex === "MALE" ? "boy" : "girl"}_walk`;
        return this.frameId(clip, 0, false);
    }
    /** 世界精灵统一以图集声明的足底为 pivot；尺寸、镜像、换帧不改变地面坐标。 */
    applyFrame(sprite: Laya.Sprite, id: string, size: number) {
        sprite.texture = this.get(id);
        const f = this.layouts.get(id)!;
        const height = size * f.sourceSize.h / f.sourceSize.w;
        sprite.size(size, height).pivot(f.pivot.x / f.sourceSize.w * size, f.pivot.y / f.sourceSize.h * height);
    }
    walk(character: string, direction: WalkDirection) { const pose = this.directions[character]?.[direction]; if (!pose) throw new Error(`未声明的方向：${character}/${direction}`); return pose; }
    /** 逻辑层原mirror仅表示面向左；选择真实左向渲染，不翻转脸、工具和固定光照。 */
    labor(action: string, left: boolean) { const direction = left ? "LEFT" : "RIGHT", pose = this.laborDirections[action]?.[direction]; if (!pose) throw new Error(`未声明的劳动方向：${action}/${direction}`); return pose; }
    enemyMirror(kind: string, dx: number) { return dx > 0 && this.enemyFacing[kind] === "LEFT"; }
    panel(sprite: Laya.Sprite, id: string, width: number, height: number) {
        const grid = this.layouts.get(id)?.nineSlice;
        if (!grid) throw new Error("未声明的高清面板：" + id);
        sprite.graphics.draw9Grid(this.get(id), 0, 0, width, height, [grid.top, grid.right, grid.bottom, grid.left, grid.repeat]);
    }
    destroy() { this.disposed = true; this.bundles.clear(); for (const t of this.textures.values()) t.destroy(); this.textures.clear(); this.clips.clear(); this.layouts.clear(); }
}
