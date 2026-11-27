import { ResourceStage } from "../config/ResourceConfig";
import { RESOURCE_CONTRACT, REQUIRED_WALK_DIRECTIONS, REQUIRED_BUILDING_LAYOUTS, REQUIRED_ENEMY_LAYOUT_VERSION } from "../config/ResourceManifest";
import { BuildingDefinition, BuildingNode } from "./BuildingLayout";
import { ENEMY_LOOKS, EnemyLayout } from "./config/EnemyVisualConfig";
import { ENEMIES } from "../config/EnemyConfig";

export interface Clip { id: string; frameIds: string[]; fps: number; restFrame: string; canvas: { w: number; h: number }; stridePixels?: number; contactFrame?: number; displayScale?: number; }
interface AnimationManifest {
    animations: Clip[];
    walkDirections?: Record<string, Record<string, { clip: string; mirror: boolean }>>;
    laborDirections?: Record<string, Record<string, { clip: string; mirror: boolean }>>;
}
interface LayoutManifest {
    layouts?: Record<string, BuildingDefinition>;
    version?: number;
    definitions?: Record<string, EnemyLayout>;
}
/**
 * 仅检查新建贴图之后的完整包合同，保持原错误顺序和文案。
 * 读取失败及贴图回收由 SpriteFrames.loadStage 负责。
 */
export function validateSpriteStage(content: {
    stage: ResourceStage;
    created: ReadonlyMap<string, Laya.Texture>;
    animations: AnimationManifest;
    definitions?: LayoutManifest;
}, loaded: { textures: ReadonlyMap<string, Laya.Texture>; clips: ReadonlyMap<string, Clip> }) {
    const { stage, created, animations, definitions } = content;
    const clips = animations.animations;
    const required = RESOURCE_CONTRACT[stage];
    if (created.size !== required.frames.length || required.frames.some(id => !created.has(id))) throw new Error("必需素材缺失");
    if (!Array.isArray(clips) || clips.length !== required.clips.length || required.clips.some(id => !clips.some(c => c.id === id))) throw new Error("必需动画缺失");
    if (stage === "village") for (const [identity, directions] of Object.entries(REQUIRED_WALK_DIRECTIONS)) for (const [direction, pose] of Object.entries(directions)) {
        const actual = animations.walkDirections?.[identity]?.[direction];
        if (!actual || actual.clip !== pose.clip || actual.mirror !== pose.mirror) throw new Error("人物方向映射缺失：" + identity + "/" + direction);
    }
    for (const clip of clips) {
        const directContact = clip.id.includes("_work_");
        if (loaded.clips.has(clip.id) || !Number.isFinite(clip.fps) || clip.fps <= 0 || clip.frameIds.length < 2 ||
            !clip.frameIds.every(id => created.has(id)) || !created.has(clip.restFrame) || !clip.canvas ||
            (clip.displayScale !== undefined && (!Number.isFinite(clip.displayScale) || clip.displayScale <= 0)) ||
            (clip.id.includes("_walk") && stage === "village" && !(clip.stridePixels > 0)) ||
            (directContact && (!Number.isInteger(clip.contactFrame) || clip.contactFrame < 0 || clip.contactFrame >= clip.frameIds.length)))
            throw new Error("动画帧不完整：" + clip.id);
    }
    if (stage === "village") {
        const layouts: Record<string, BuildingDefinition> = definitions.layouts;
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
    const enemyLayouts: Record<string, EnemyLayout> = stage === "night" ? definitions.definitions : null;
    if (stage === "night") {
        if (definitions.version !== REQUIRED_ENEMY_LAYOUT_VERSION || !enemyLayouts || Object.keys(enemyLayouts).length !== Object.keys(ENEMY_LOOKS).length || Object.keys(ENEMY_LOOKS).some(id => !enemyLayouts[id])) throw new Error("怪物布局缺失或版本不符");
        for (const [kind, layout] of Object.entries(enemyLayouts)) {
            const shadow = layout.shadow;
            // 怪物共享进村阶段已载入的影子。
            if (!shadow || !RESOURCE_CONTRACT.village.frames.includes(shadow.frame) || !loaded.textures.has(shadow.frame) ||
                ![shadow.x, shadow.y, shadow.width, shadow.height, shadow.alpha].every(Number.isFinite) || shadow.width <= 0 || shadow.height <= 0 || shadow.alpha <= 0 || shadow.alpha > 1)
                throw new Error("怪物接地影不完整：" + kind);
            const clip = clips.find(c => c.id === kind + "_walk");
            const look = ENEMY_LOOKS[kind as keyof typeof ENEMY_LOOKS], parts = [...look.head, ...look.back].filter((id): id is string => id !== null);
            if (!clip || layout.canvas !== 96 || layout.foot?.x !== 48 || !Number.isFinite(layout.foot?.y) || layout.foot.y < 72 || layout.foot.y > 94 || !(layout.stride > 0) || !Number.isFinite(layout.stride) || !(clip.stridePixels > 0) || Math.abs(layout.stride / layout.canvas - clip.stridePixels / clip.canvas.w) > 1e-9 || layout.fps !== clip.fps || !Array.isArray(layout.frames) || layout.frames.length !== clip.frameIds.length || layout.frames.length !== (ENEMIES[kind as keyof typeof ENEMIES].boss ? 8 : 6)) throw new Error("怪物帧与挂点不完整");
            for (const [i, frame] of layout.frames.entries()) {
                if (!created.has(frame.body) || frame.body !== clip.frameIds[i] || !Number.isFinite(frame.x) || !Number.isFinite(frame.y) || !frame.parts || Object.keys(frame.parts).length !== parts.length) throw new Error("怪物主体或配饰缺失");
                for (const id of parts) {
                    const p = frame.parts[id];
                    if (!created.has(id) || !p || ![p.x, p.y, p.width, p.height].every(Number.isFinite) || p.width <= 0 || p.height <= 0 || typeof p.behind !== "boolean") throw new Error("怪物配饰挂点非法：" + kind + "/" + id);
                }
            }
        }
    }
    return enemyLayouts;
}
