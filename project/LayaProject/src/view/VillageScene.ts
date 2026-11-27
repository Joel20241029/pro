import { ROAD_PROFILE } from "../config/RoadGeometry";
import { PADS, TowerKind } from "../game/GameConfig";
import { GameLayout } from "./GameLayout";
import { FACTORY_PROP } from "./config/VillageSceneConfig";
import { GroundPoint, Footprint, TOWER_VIEW, TOWER_SCREEN_LAYOUTS, VILLAGE_PROPS, LANDSCAPE_FOOTPRINTS, MOTION, CAMP_STOPS, VILLAGE_STOPS } from "./config/VillageSceneConfig";
export { GroundPoint, Footprint, VillageProp, TOWER_VIEW, VILLAGE_PROPS, LANDSCAPE_FOOTPRINTS, MOTION, CAMP_STOPS, WEDDING, VILLAGE_STOPS } from "./config/VillageSceneConfig";
export function towerLaunch(index: number, _kind: TowerKind, pads: readonly GroundPoint[] = PADS): GroundPoint {
    const pad = pads[index], at = TOWER_VIEW.muzzle, scale = TOWER_VIEW.size / TOWER_VIEW.canvas;
    return { x: pad.x + (at.x - TOWER_VIEW.canvas / 2) * scale * TOWER_VIEW.facing[index], y: pad.y + TOWER_VIEW.top + at.y * scale };
}
/** 建筑底座保持图片的真实尺寸；制衣工位跟随厂房足点，不能把动作点单独拉到图外。 */
export function layoutVillage(layout: GameLayout) {
    const point = (p: GroundPoint): GroundPoint => ({ x: p.x, y: layout.worldY(p.y) });
    const battleHeight = layout.gateY - layout.mapTop;
    const authored = TOWER_SCREEN_LAYOUTS.reduce((best, candidate) =>
        Math.abs(candidate.height - battleHeight) < Math.abs(best.height - battleHeight) ? candidate : best);
    const towerScale = authored.scale;
    const towerFootOffset = (TOWER_VIEW.top + TOWER_VIEW.size * 15 / 16) * towerScale;
    const roadEdge = (y: number, onLeft: boolean) => {
        const foot = y + towerFootOffset;
        const top = layout.referenceY(foot - TOWER_VIEW.footprintDepth);
        const bottom = layout.referenceY(foot);
        const samples = ROAD_PROFILE.filter(([row], i) =>
            (i === 0 || ROAD_PROFILE[i - 1][0] <= bottom) &&
            (i === ROAD_PROFILE.length - 1 || ROAD_PROFILE[i + 1][0] >= top));
        return onLeft ? Math.min(...samples.map(([, left]) => left)) : Math.max(...samples.map(([, , right]) => right));
    };
    const pads = authored.points.map(([baseX, refY], index) => {
        const minY = layout.mapTop + TOWER_VIEW.hudClearance * towerScale + TOWER_VIEW.hudEdgePadding;
        const y = Math.max(layout.worldY(refY), minY);
        const onLeft = TOWER_VIEW.facing[index] > 0;
        const clearance = index === 0 ? TOWER_VIEW.upperLeftRoadClearance
            : index === 1 ? TOWER_VIEW.upperRightRoadClearance
            : index === 4 ? TOWER_VIEW.lowerRightRoadClearance
            : index === 2 && authored === TOWER_SCREEN_LAYOUTS[0] ? TOWER_VIEW.compactLowerLeftRoadClearance
            : TOWER_VIEW.roadClearance;
        const edgeGap = TOWER_VIEW.footprintWidth / 2 + clearance;
        const edge = roadEdge(y, onLeft);
        const x = onLeft ? Math.min(baseX, edge - edgeGap) : Math.max(baseX, edge + edgeGap);
        if (index === 3 || index === 4) {
            const liftedY = Math.max(layout.worldY(refY - authored.rightTowerLift[index - 3]), minY);
            return { x: x + roadEdge(liftedY, onLeft) - edge, y: liftedY };
        }
        return { x, y };
    });
    const props = VILLAGE_PROPS.map(p => {
        const [signX, signY] = authored.friendshipSign;
        const at = p.id === "deco:friendship-road-sign" ? point({ x: signX, y: signY }) : point(p);
        if (p.id.startsWith("tower:")) {
            const pad = pads[Number(p.id.split(":")[1])];
            at.x = pad.x;
            at.y = pad.y + towerFootOffset;
        }
        const dx = at.x - p.x, dy = at.y - p.y;
        return { ...p, ...at, footprint: p.footprint ? { left: p.footprint.left + dx, right: p.footprint.right + dx, top: p.footprint.top + dy, bottom: p.footprint.bottom + dy } : null };
    });
    // 小村庄优先占用靠近村中央的位置；基准排序固定，换屏时不交换席位。
    const campCenter = { x: 360, y: 964 };
    const campOrder = CAMP_STOPS.map((_, i) => i).sort((a, b) => distance(CAMP_STOPS[a], campCenter) - distance(CAMP_STOPS[b], campCenter));
    const camp = campOrder.map(i => point(CAMP_STOPS[i]));
    const nightCamp = campOrder.map(i => point(VILLAGE_STOPS.nightRest[i]));
    const relative = <T extends GroundPoint>(points: T[], anchor: string) => {
        const before = VILLAGE_PROPS.find(p => p.id === anchor)!, after = props.find(p => p.id === anchor)!;
        return points.map(p => ({ ...p, y: after.y + p.y - before.y }));
    };
    const stops = {
        homes: VILLAGE_STOPS.homes.map(point), factoryDoor: relative(VILLAGE_STOPS.factoryDoor, FACTORY_PROP),
        sewing: relative(VILLAGE_STOPS.sewing, FACTORY_PROP),
        rest: camp, nightRest: nightCamp, children: camp, waiting: VILLAGE_STOPS.waiting.map(point),
        wedding: VILLAGE_STOPS.wedding.map(point), // 首塔在短屏靠近林带边缘，驻塔村民从通行区的一侧接近。
        towers: pads.map(p => ({
            x: Math.max(LANDSCAPE_FOOTPRINTS[0].right + MOTION.clearance + MOTION.cornerGap, Math.min(p.x, LANDSCAPE_FOOTPRINTS[1].left - MOTION.clearance - MOTION.cornerGap)),
            y: Math.min(p.y + 54, layout.gateY - 27)
        }))
    };
    const landscape = LANDSCAPE_FOOTPRINTS.map((r, i) => ({ ...r,
        top: i < 2 ? layout.worldY(r.top) : layout.gateY - (830 - r.top), bottom: layout.worldY(r.bottom)
    }));
    const bounds = { ...MOTION.bounds, top: layout.worldY(MOTION.bounds.top), bottom: layout.footerTop - 14 };
    const sign = props.find(p => p.id === "deco:friendship-road-sign")!;
    const friendshipSign = "restingSign" in authored ? {
        prop: sign, active: { x: sign.x, y: sign.y }, resting: point({ x: authored.restingSign[0], y: authored.restingSign[1] })
    } : null;
    return { props, pads, stops, landscape, bounds, towerScale, friendshipSign };
}
export interface DepthKey {
    id: string;
    y: number;
}
/** 同一逻辑足底用类型前缀+稳定 ID 打破平局；动画帧、精灵池下标、镜像不参与排序。 */
export function compareDepth(a: DepthKey, b: DepthKey): number {
    return a.y - b.y || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
export function distance(a: GroundPoint, b: GroundPoint): number { return Math.hypot(b.x - a.x, b.y - a.y); }
/** 固定小地图的可见性图：只在改变目的地时寻路，障碍角点及静态边一次构建，最多 20 名行人复用。 */
export class VillageNavigation {
    readonly obstacles: Footprint[];
    private corners: GroundPoint[] = [];
    private edges: {
        to: number;
        cost: number;
    }[][] = [];
    constructor(props = VILLAGE_PROPS, landscape = LANDSCAPE_FOOTPRINTS, readonly bounds: Footprint = MOTION.bounds) {
        // 可开合的双扇门可穿行。门柱已计入两侧城墙的碰撞块。
        this.obstacles = [...props.filter(p => p.footprint && p.id !== "building:gate").map(p => p.footprint!), ...landscape].map(r => ({
            left: r.left - MOTION.clearance, top: r.top - MOTION.clearance,
            right: r.right + MOTION.clearance, bottom: r.bottom + MOTION.clearance
        }));
        for (const r of this.obstacles) {
            const gap = MOTION.cornerGap;
            for (const p of [{ x: r.left - gap, y: r.top - gap }, { x: r.right + gap, y: r.top - gap }, { x: r.left - gap, y: r.bottom + gap }, { x: r.right + gap, y: r.bottom + gap }]) {
                if (this.walkable(p))
                    this.corners.push(p);
            }
        }
        this.edges = this.corners.map((): {
            to: number;
            cost: number;
        }[] => []);
        for (let i = 0; i < this.corners.length; i++)
            for (let j = i + 1; j < this.corners.length; j++) {
                if (!this.clear(this.corners[i], this.corners[j]))
                    continue;
                const cost = distance(this.corners[i], this.corners[j]);
                this.edges[i].push({ to: j, cost });
                this.edges[j].push({ to: i, cost });
            }
    }
    walkable(p: GroundPoint): boolean {
        const b = this.bounds;
        return p.x >= b.left && p.x <= b.right && p.y >= b.top && p.y <= b.bottom &&
            !this.obstacles.some(r => p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom);
    }
    /** 仅窗口重排使用：行人映射后若与新底座相交，移到最近的可行走边缘，不改变业务或目的地。 */
    relocate(p: GroundPoint): GroundPoint {
        const b = this.bounds, at = { x: Math.max(b.left, Math.min(b.right, p.x)), y: Math.max(b.top, Math.min(b.bottom, p.y)) };
        if (this.walkable(at))
            return at;
        const candidates = this.corners.slice();
        for (const r of this.obstacles) {
            candidates.push({ x: r.left - MOTION.cornerGap, y: at.y }, { x: r.right + MOTION.cornerGap, y: at.y }, { x: at.x, y: r.top - MOTION.cornerGap }, { x: at.x, y: r.bottom + MOTION.cornerGap });
        }
        const nearest = candidates.filter(q => this.walkable(q)).sort((a, c) => distance(at, a) - distance(at, c))[0];
        if (!nearest)
            throw new Error("窗口重排后没有可行走位置");
        return { ...nearest };
    }
    clear(a: GroundPoint, b: GroundPoint): boolean {
        if (!this.walkable(a) || !this.walkable(b))
            return false;
        // 线段与轴对齐矩形的 slab 相交，拐角也视为占地，避免靠采样漏掉窄墙。
        for (const r of this.obstacles) {
            let enter = 0, leave = 1;
            for (const [start, delta, low, high] of [[a.x, b.x - a.x, r.left, r.right], [a.y, b.y - a.y, r.top, r.bottom]]) {
                if (delta === 0) {
                    if (start < low || start > high) {
                        enter = 2;
                        break;
                    }
                }
                else {
                    const t1 = (low - start) / delta, t2 = (high - start) / delta;
                    enter = Math.max(enter, Math.min(t1, t2));
                    leave = Math.min(leave, Math.max(t1, t2));
                }
            }
            if (enter <= leave)
                return false;
        }
        return true;
    }
    route(start: GroundPoint, goal: GroundPoint): GroundPoint[] {
        if (!this.walkable(start) || !this.walkable(goal))
            throw new Error("村民站点落入建筑占地，请检查地图配置");
        if (this.clear(start, goal))
            return [{ ...goal }];
        const n = this.corners.length, points = [...this.corners, start, goal];
        const edges = this.edges.map(e => e.slice());
        edges.push([], []);
        for (const end of [n, n + 1])
            for (let i = 0; i < n; i++) {
                if (!this.clear(points[end], points[i]))
                    continue;
                const cost = distance(points[end], points[i]);
                edges[end].push({ to: i, cost });
                edges[i].push({ to: end, cost });
            }
        const costs = points.map(() => Infinity), previous = points.map(() => -1), visited = new Set<number>();
        costs[n] = 0;
        while (visited.size < points.length) {
            let current = -1;
            for (let i = 0; i < points.length; i++)
                if (!visited.has(i) && (current < 0 || costs[i] < costs[current]))
                    current = i;
            if (current < 0 || !Number.isFinite(costs[current]))
                break;
            if (current === n + 1) {
                const route: GroundPoint[] = [];
                for (let at = current; at !== n; at = previous[at])
                    route.unshift({ ...points[at] });
                return route;
            }
            visited.add(current);
            for (const e of edges[current])
                if (costs[current] + e.cost < costs[e.to]) {
                    costs[e.to] = costs[current] + e.cost;
                    previous[e.to] = current;
                }
        }
        throw new Error("村民目标不可达，请检查地图通路");
    }
}
