import { PADS, TowerKind } from "../game/GameConfig";

export interface GroundPoint { x: number; y: number; }
export interface Footprint { left: number; top: number; right: number; bottom: number; }
export interface VillageProp extends GroundPoint {
    id: string; frame: string; size: number; footprint: Footprint | null; ground?: boolean;
}

/** 128px塔源画布的实际弓口/投石兜/水晶挂点；仅表现，不移动逻辑塔位或射程。
 * 左侧1/3塔向右、右侧2/4塔向左；正面石塔/寒塔保持原构图，改建必须重设镜像。
 */
export const TOWER_VIEW = {
    size: 108, top: -80, canvas: 128, facing: [1, -1, 1, -1],
    muzzle: { ARROW: { x: 92, y: 35 }, STONE: { x: 74, y: 50 }, SLOW: { x: 64, y: 32 } }
} as const;
export function towerLaunch(index: number, kind: TowerKind): GroundPoint {
    const pad = PADS[index], at = TOWER_VIEW.muzzle[kind], scale = TOWER_VIEW.size / TOWER_VIEW.canvas;
    return { x: pad.x + (at.x - TOWER_VIEW.canvas / 2) * scale * (kind === "ARROW" ? TOWER_VIEW.facing[index] : 1), y: pad.y + TOWER_VIEW.top + at.y * scale };
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
        const x = side ? 586 + column * 39 : 56 + column * 39, y = 320 + row * 72 + (column % 2) * 23;
        return { id: `forest:${i}`, frame: i % 3 === 0 ? "deco_tree_pine" : "deco_tree_oak", x, y, size: i % 3 === 0 ? 114 : 110, footprint: null };
    }),
    ...[28, 92, 156, 220, 500, 564, 628, 692].map((x, i): VillageProp => ({ id: `wall:${i}`, frame: "building_palisade", x, y: 830, size: 78, footprint: null })),
    { id: "tree:logging", frame: "deco_tree_oak", x: 632, y: 964, size: 82, footprint: { left: 621, top: 949, right: 643, bottom: 964 } },
    { id: "deco:logs", frame: "deco_log_pile", x: 571, y: 1024, size: 60, footprint: null },
    ...[[168, 292], [560, 286], [170, 477], [553, 548], [164, 668], [553, 734]].map(([x, y], i): VillageProp => ({ id: `bush:${i}`, frame: "deco_bush", x, y, size: 64, footprint: null })),
    ...[[279, 822], [441, 822]].map(([x, y], i): VillageProp => ({ id: `torch:${i}`, frame: "deco_torch", x, y, size: 62, footprint: null })),
    prop("building:house-a", "building_house_thatched", 50, 821.25, 116, 84, 27),
    prop("building:house-b", "building_house_terracotta", 169, 820.625, 106, 78, 26),
    // 田地是可站立地面，用农田自身源pivot；不加入建筑排序/导航障碍，人物真正走入垄沟。
    { id: "building:farm", frame: "building_farm", x: 546, y: 954, size: 202, footprint: null, ground: true },
    prop("building:logging", "building_lumber_shed", 467, 922.625, 106, 74, 28),
    prop("building:hearth", "building_hearth_lit", 321, 891, 78, 44, 15),
    prop("building:gate", "building_gate_closed", 282, 684, 156, 132, 30),
    ...PADS.map((p, i) => prop(`tower:${i}`, "building_tower_pad", p.x - TOWER_VIEW.size / 2, p.y + TOWER_VIEW.top, TOWER_VIEW.size, 70, 28))
];

/** 林带合并为 2 个固定块，墙体合并为左右两段；城门两边保留 40px 侧道，扣除足底间距后仍可通行。 */
export const LANDSCAPE_FOOTPRINTS: Footprint[] = [
    { left: 0, top: 260, right: 154, bottom: 764 }, { left: 566, top: 260, right: 720, bottom: 764 },
    { left: -7, top: 817, right: 254, bottom: 830 }, { left: 466, top: 817, right: 727, bottom: 830 }
];

/** 纯表现参数：逻辑像素/秒与秒；调整只改变行走节奏、驻足时间和离建筑的距离，不参与生产/战斗结算。 */
export const MOTION = {
    adultSpeed: 40, childSpeed: 31,
    // 老人沿同一可行走路径慢行，仅表现用；不会延迟口粮、养老夜数或守夜结算。
    elderSpeed: 24, clearance: 7, cornerGap: 1,
    workSeconds: 4.5, restSeconds: 1.8, staggerSeconds: .23,
    bounds: { left: 44, top: 275, right: 676, bottom: 1028 }
} as const;

/** 火堆周围的20个足底站点，避开房屋、农田、炉体底座；新生儿从出生起使用其中的育儿位置。
 * 只作表现，不增加人口容量。按存活人物保留分配，不能以永久人口编号取模复用占位。
 */
export const CAMP_STOPS: GroundPoint[] = [
    { x: 286, y: 872 }, { x: 334, y: 872 }, { x: 382, y: 872 }, { x: 430, y: 872 },
    { x: 286, y: 912 }, { x: 334, y: 912 }, { x: 382, y: 912 }, { x: 430, y: 912 },
    { x: 286, y: 952 }, { x: 430, y: 952 }, { x: 286, y: 988 }, { x: 430, y: 988 },
    { x: 286, y: 1024 }, { x: 334, y: 1024 }, { x: 382, y: 1024 }, { x: 430, y: 1024 },
    { x: 334, y: 988 }, { x: 382, y: 988 }, { x: 244, y: 984 }, { x: 472, y: 972 }
];

/** 成家后的纯视觉庆祝：两人到齐才显示 2.4 秒红心；不延迟成家存档，也不阻塞守夜。 */
export const WEDDING = {
    // 52px 红心与 86px 头顶偏移让庆祝清晰可见且不挡脸；不改变成家时序与持续时间。
    heartSeconds: 2.4, heartSize: 52, headOffset: 86, rise: 10, fadeIn: .2, fadeOut: .5,
    pulse: .08, pulseSeconds: .8
} as const;

/** 站点均在占地之外。工作点对应现有最大岗位数，家门仅为表现站点，不新增住宅归属规则。 */
export const VILLAGE_STOPS = {
    // 家门与火堆/休息点跨集合留出间距，避免一个回家、另一个休息时仍站在一起。
    homes: [
        ...Array.from({ length: 15 }, (_, i) => ({ x: 58 + (i % 5) * 36, y: 950 + Math.floor(i / 5) * 36 })),
        ...[58, 98, 140, 182, 224].map(x => ({ x, y: 874 }))
    ],
    farm: [{ x: 486, y: 879 }, { x: 546, y: 879 }, { x: 606, y: 879 }, { x: 486, y: 924 }, { x: 546, y: 924 }, { x: 606, y: 924 }],
    logging: [{ x: 590, y: 956 }, { x: 670, y: 956 }, { x: 614, y: 1007 }, { x: 662, y: 1007 }],
    // 有意包含屋后与屋前的休息点，行人绕过墙基后会自然发生遮挡切换。
    rest: CAMP_STOPS,
    children: CAMP_STOPS,
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
