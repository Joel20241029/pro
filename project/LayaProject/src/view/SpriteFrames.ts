import { WalkDirection } from "./VillagerMotion";
import { BuildingDefinition } from "./BuildingLayout";
/** 微信原生村庄资源包根目录，与 BuildSettings.subpackages.path 一致；改名需同步发布配置和资源目录。 */
export const VILLAGE_RESOURCE_PACKAGE = "resources/village";
interface Frame { page: string; rect: { x: number; y: number; w: number; h: number }; sourceSize: { w: number; h: number }; trimOffset: { x: number; y: number }; pivot: { x: number; y: number }; nineSlice: { top: number; right: number; bottom: number; left: number; repeat: number } | null; }
interface Clip { id: string; frameIds: string[]; fps: number; restFrame: string; }
/** 图集页表是加载白名单；裁片恢复原画布，人物始终共用原足底。 */
export class SpriteFrames {
    buildingLayouts: Record<string, BuildingDefinition> = {};
    buildingUpgrade!: Laya.AnimationClip2D;
    buildingAttack!: Laya.AnimationClip2D;
    private textures = new Map<string, Laya.Texture>();
    private clips = new Map<string, Clip>();
    private layouts = new Map<string, Frame>();
    private directions: Record<string, Record<WalkDirection, { clip: string; mirror: boolean }>> = {};
    private enemyFacing: Record<string, string> = {};
    async load() {
        const root = VILLAGE_RESOURCE_PACKAGE + "/";
        const result = await Promise.all([Laya.loader.load(root + "frames.json", Laya.Loader.JSON), Laya.loader.load(root + "animations.json", Laya.Loader.JSON),
            Laya.loader.load(root + "buildings.json", Laya.Loader.JSON), Laya.loader.load(root + "building_upgrade.mc"), Laya.loader.load(root + "building_attack.mc")]);
        if (result.some(r => !r)) throw new Error("本地游戏素材加载失败，请重新打开小游戏");
        const descriptors = result[0].data.pages as { id: string; runtimeFile: string }[];
        const loaded = await Promise.all(descriptors.map(p => Laya.loader.load(root + p.runtimeFile, Laya.Loader.IMAGE)));
        if (loaded.some(p => !p)) throw new Error("图集页缺失，请重新打开小游戏");
        const pages: Record<string, Laya.Texture> = {}; descriptors.forEach((p, i) => pages[p.id] = loaded[i]);
        const frames: Record<string, Frame> = result[0].data.frames;
        for (const id of Object.keys(frames)) {
            const f = frames[id], r = f.rect; this.layouts.set(id, f);
            this.textures.set(id, Laya.Texture.create(pages[f.page], r.x, r.y, r.w, r.h, f.trimOffset.x, f.trimOffset.y, f.sourceSize.w, f.sourceSize.h));
        }
        for (const clip of result[1].data.animations as Clip[]) this.clips.set(clip.id, clip);
        this.directions = result[1].data.walkDirections; this.enemyFacing = result[1].data.enemyNativeFacing;
        this.buildingLayouts = result[2].data.layouts; this.buildingUpgrade = result[3]; this.buildingAttack = result[4];
    }
    get(id: string): Laya.Texture { const t = this.textures.get(id); if (!t) throw new Error(`未声明的图片：${id}`); return t; }
    frameId(clipId: string, time: number, animated = true): string {
        const clip = this.clips.get(clipId); if (!clip) throw new Error(`未声明的动画：${clipId}`);
        return animated ? clip.frameIds[Math.floor(time * clip.fps) % clip.frameIds.length] : clip.restFrame;
    }
    /** 世界精灵统一以图集声明的足底为 pivot；尺寸、镜像、换帧不改变地面坐标。 */
    applyFrame(sprite: Laya.Sprite, id: string, size: number) {
        sprite.texture = this.get(id);
        const f = this.layouts.get(id)!;
        const height = size * f.sourceSize.h / f.sourceSize.w;
        sprite.size(size, height).pivot(f.pivot.x / f.sourceSize.w * size, f.pivot.y / f.sourceSize.h * height);
    }
    walk(character: string, direction: WalkDirection) { const pose = this.directions[character]?.[direction]; if (!pose) throw new Error(`未声明的方向：${character}/${direction}`); return pose; }
    enemyMirror(kind: string, dx: number) { return dx > 0 && this.enemyFacing[kind] === "LEFT"; }
    /** 九宫格维持完整源画布；角饰独立于中心拉伸区域。 */
    panel(sprite: Laya.Sprite, id: string, width: number, height: number) {
        const f = this.layouts.get(id), g = f?.nineSlice;
        if (!g || width < g.left + g.right || height < g.top + g.bottom) throw new Error(`九宫格尺寸不合法：${id}`);
        sprite.graphics.draw9Grid(this.get(id), 0, 0, width, height, [g.top, g.right, g.bottom, g.left, g.repeat]);
    }
    destroy() { for (const t of this.textures.values()) t.destroy(); this.textures.clear(); this.clips.clear(); this.layouts.clear(); }
}
