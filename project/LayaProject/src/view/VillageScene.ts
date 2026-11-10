import { PADS } from "../game/GameConfig";

export interface GroundPoint { x: number; y: number; }
export interface Footprint { left: number; top: number; right: number; bottom: number; }
export interface VillageProp extends GroundPoint {
    id: string; frame: string; size: number; footprint: Footprint | null;
}

/** 原 GameView 的固定地图与图集足底（中心、15/16 高度）。占地仅覆盖底座，屋顶/树冠可以遮住行人。 */
function prop(id: string, frame: string, left: number, top: number, size: number, baseWidth: number, baseDepth: number): VillageProp {
    const x = left + size / 2, y = top + size * 15 / 16;
    return { id, frame, x, y, size, footprint: { left: x - baseWidth / 2, top: y - baseDepth, right: x + baseWidth / 2, bottom: y } };
}
export const VILLAGE_PROPS: VillageProp[] = [
    // 边缘林带复用原松树/橡树，视觉树数与导航障碍数分离，下方仅两个整块林地占地。
    ...Array.from({ length: 42 }, (_, i): VillageProp => {
        const side = i % 2, row = Math.floor(i / 6), column = Math.floor(i / 2) % 3;
        const x = side ? 602 + column * 57 : 8 + column * 57, y = 320 + row * 72 + (column % 2) * 23;
        return { id: `forest:${i}`, frame: i % 3 === 0 ? "deco_tree_pine" : "deco_tree_oak", x, y, size: i % 3 === 0 ? 114 : 110, footprint: null };
    }),
    ...[28, 92, 156, 220, 500, 564, 628, 692].map((x, i): VillageProp => ({ id: `wall:${i}`, frame: "building_palisade", x, y: 830, size: 78, footprint: null })),
    { id: "tree:logging", frame: "deco_tree_oak", x: 642, y: 870, size: 92, footprint: { left: 629, top: 854, right: 655, bottom: 870 } },
    ...[[168, 292], [560, 286], [170, 477], [553, 548], [164, 668], [553, 734]].map(([x, y], i): VillageProp => ({ id: `bush:${i}`, frame: "deco_bush", x, y, size: 64, footprint: null })),
    ...[[279, 822], [441, 822]].map(([x, y], i): VillageProp => ({ id: `torch:${i}`, frame: "deco_torch", x, y, size: 62, footprint: null })),
    prop("building:house-a", "building_house_thatched", 45, 810, 130, 96, 30),
    prop("building:house-b", "building_house_terracotta", 170, 838, 118, 88, 29),
    prop("building:farm", "building_farm", 450, 840, 150, 122, 81),
    prop("building:logging", "building_lumber_shed", 565, 905, 114, 88, 32),
    prop("building:hearth", "building_hearth_lit", 318, 882, 90, 58, 17),
    prop("building:gate", "building_gate_closed", 282, 684, 156, 132, 30),
    ...PADS.map((p, i) => prop(`tower:${i}`, "building_tower_pad", p.x - 54, p.y - 80, 108, 70, 28))
];

/** 林带合并为 2 个固定块，墙体合并为左右两段；城门两边保留 40px 侧道，扣除足底间距后仍可通行。 */
export const LANDSCAPE_FOOTPRINTS: Footprint[] = [
    { left: 0, top: 260, right: 146, bottom: 764 }, { left: 578, top: 260, right: 720, bottom: 764 },
    { left: -7, top: 817, right: 254, bottom: 830 }, { left: 466, top: 817, right: 727, bottom: 830 }
];

/** 纯表现参数：逻辑像素/秒与秒；调整只改变行走节奏、驻足时间和离建筑的距离，不参与生产/战斗结算。 */
export const MOTION = {
    adultSpeed: 40, childSpeed: 31,
    // 老人沿同一可行走路径慢行，仅表现用；不会延迟口粮、养老夜数或守夜结算。
    elderSpeed: 24, clearance: 7, cornerGap: 1,
    workSeconds: 4.5, restSeconds: 1.8, staggerSeconds: .23,
    bounds: { left: 28, top: 275, right: 692, bottom: 1028 }
} as const;

/** 成家后的纯视觉庆祝：两人到齐才显示 2.4 秒红心；不延迟成家存档，也不阻塞守夜。 */
export const WEDDING = {
    heartSeconds: 2.4, heartSize: 30, headOffset: 65, rise: 10, fadeIn: .2, fadeOut: .5,
    pulse: .08, pulseSeconds: .8
} as const;

/** 站点均在占地之外。工作点对应现有最大岗位数，家门仅为表现站点，不新增住宅归属规则。 */
export const VILLAGE_STOPS = {
    homes: Array.from({ length: 20 }, (_, i) => ({ x: 62 + (i % 10) * 25, y: 980 + Math.floor(i / 10) * 34 })),
    farm: [{ x: 438, y: 919 }, { x: 438, y: 956 }, { x: 452, y: 1007 }, { x: 486, y: 1007 }, { x: 520, y: 1007 }, { x: 552, y: 1007 }],
    logging: [{ x: 679, y: 857 }, { x: 667, y: 903 }, { x: 690, y: 949 }, { x: 620, y: 1028 }],
    // 有意包含屋后与屋前的休息点，行人绕过墙基后会自然发生遮挡切换。
    rest: [{ x: 108, y: 884 }, { x: 232, y: 898 }, { x: 300, y: 858 }, { x: 410, y: 904 }, { x: 411, y: 984 }, { x: 300, y: 1006 }],
    children: [{ x: 74, y: 970 }, { x: 166, y: 983 }, { x: 278, y: 974 }, { x: 292, y: 1004 }],
    // 篝火前的双人会合点，与所有家门/工作点共用导航和足底遮挡；不新增建筑或家庭归属。
    wedding: [{ x: 330, y: 990 }, { x: 370, y: 990 }],
    towers: PADS.map(p => ({ x: p.x, y: p.y + 54 }))
};

export interface DepthKey { id: string; y: number; }
/** 同一逻辑足底用类型前缀+稳定 ID 打破平局；动画帧、精灵池下标、镜像不参与排序。 */
export function compareDepth(a: DepthKey, b: DepthKey): number {
    return a.y - b.y || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
export function distance(a: GroundPoint, b: GroundPoint): number { return Math.hypot(b.x - a.x, b.y - a.y); }

/** 固定小地图的可见性图：只在改变目的地时寻路，障碍角点及静态边一次构建，最多 20 名行人复用。 */
export class VillageNavigation {
    readonly obstacles: Footprint[];
    private corners: GroundPoint[] = [];
    private edges: { to: number; cost: number }[][] = [];
    constructor(props = VILLAGE_PROPS, landscape = LANDSCAPE_FOOTPRINTS) {
        this.obstacles = [...props.filter(p => p.footprint).map(p => p.footprint!), ...landscape].map(r => ({
            left: r.left - MOTION.clearance, top: r.top - MOTION.clearance,
            right: r.right + MOTION.clearance, bottom: r.bottom + MOTION.clearance
        }));
        for (const r of this.obstacles) {
            const gap = MOTION.cornerGap;
            for (const p of [{ x: r.left - gap, y: r.top - gap }, { x: r.right + gap, y: r.top - gap }, { x: r.left - gap, y: r.bottom + gap }, { x: r.right + gap, y: r.bottom + gap }]) {
                if (this.walkable(p)) this.corners.push(p);
            }
        }
        this.edges = this.corners.map((): { to: number; cost: number }[] => []);
        for (let i = 0; i < this.corners.length; i++) for (let j = i + 1; j < this.corners.length; j++) {
            if (!this.clear(this.corners[i], this.corners[j])) continue;
            const cost = distance(this.corners[i], this.corners[j]);
            this.edges[i].push({ to: j, cost }); this.edges[j].push({ to: i, cost });
        }
    }
    walkable(p: GroundPoint): boolean {
        const b = MOTION.bounds;
        return p.x >= b.left && p.x <= b.right && p.y >= b.top && p.y <= b.bottom &&
            !this.obstacles.some(r => p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom);
    }
    clear(a: GroundPoint, b: GroundPoint): boolean {
        if (!this.walkable(a) || !this.walkable(b)) return false;
        // 线段与轴对齐矩形的 slab 相交，拐角也视为占地，避免靠采样漏掉窄墙。
        for (const r of this.obstacles) {
            let enter = 0, leave = 1;
            for (const [start, delta, low, high] of [[a.x, b.x - a.x, r.left, r.right], [a.y, b.y - a.y, r.top, r.bottom]]) {
                if (delta === 0) { if (start < low || start > high) { enter = 2; break; } }
                else { const t1 = (low - start) / delta, t2 = (high - start) / delta; enter = Math.max(enter, Math.min(t1, t2)); leave = Math.min(leave, Math.max(t1, t2)); }
            }
            if (enter <= leave) return false;
        }
        return true;
    }
    route(start: GroundPoint, goal: GroundPoint): GroundPoint[] {
        if (!this.walkable(start) || !this.walkable(goal)) throw new Error("村民站点落入建筑占地，请检查地图配置");
        if (this.clear(start, goal)) return [{ ...goal }];
        const n = this.corners.length, points = [...this.corners, start, goal];
        const edges = this.edges.map(e => e.slice()); edges.push([], []);
        for (const end of [n, n + 1]) for (let i = 0; i < n; i++) {
            if (!this.clear(points[end], points[i])) continue;
            const cost = distance(points[end], points[i]); edges[end].push({ to: i, cost }); edges[i].push({ to: end, cost });
        }
        const costs = points.map(() => Infinity), previous = points.map(() => -1), visited = new Set<number>(); costs[n] = 0;
        while (visited.size < points.length) {
            let current = -1;
            for (let i = 0; i < points.length; i++) if (!visited.has(i) && (current < 0 || costs[i] < costs[current])) current = i;
            if (current < 0 || !Number.isFinite(costs[current])) break;
            if (current === n + 1) {
                const route: GroundPoint[] = [];
                for (let at = current; at !== n; at = previous[at]) route.unshift({ ...points[at] });
                return route;
            }
            visited.add(current);
            for (const e of edges[current]) if (costs[current] + e.cost < costs[e.to]) { costs[e.to] = costs[current] + e.cost; previous[e.to] = current; }
        }
        throw new Error("村民目标不可达，请检查地图通路");
    }
}
