import { PADS, TowerKind } from "../game/GameConfig";
import { GameLayout } from "./GameLayout";

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
export function towerLaunch(index: number, kind: TowerKind, pads: readonly GroundPoint[] = PADS): GroundPoint {
    const pad = pads[index], at = TOWER_VIEW.muzzle[kind], scale = TOWER_VIEW.size / TOWER_VIEW.canvas;
    return { x: pad.x + (at.x - TOWER_VIEW.canvas / 2) * scale * (kind === "ARROW" ? TOWER_VIEW.facing[index] : 1), y: pad.y + TOWER_VIEW.top + at.y * scale };
}

/** 原 GameView 的固定地图与图集足底（中心、15/16 高度）。占地仅覆盖底座，屋顶/树冠可以遮住行人。 */
function prop(id: string, frame: string, left: number, top: number, size: number, baseWidth: number, baseDepth: number): VillageProp {
    const x = left + size / 2, y = top + size * 15 / 16;
    return { id, frame, x, y, size, footprint: { left: x - baseWidth / 2, top: y - baseDepth, right: x + baseWidth / 2, bottom: y } };
}
export const VILLAGE_PROPS: VillageProp[] = [
    // 30棵固定树簇：大小/纵深错落并保留塔侧空隙。仅表现布点，不消耗业务随机数，也不改变林地通行边界。
    ...[
        [46, 312, 100], [112, 336, 118], [16, 382, 95], [72, 380, 94], [141, 408, 90],
        [48, 457, 112], [102, 488, 118], [63, 531, 100], [140, 556, 92],
        [44, 606, 108], [102, 634, 116], [59, 687, 98], [132, 713, 102], [28, 736, 84], [73, 763, 114],
        [656, 304, 102], [592, 333, 118], [625, 377, 94], [686, 413, 110], [575, 443, 90],
        [642, 469, 120], [592, 512, 98], [678, 539, 110], [625, 580, 96],
        [583, 619, 112], [664, 652, 100], [619, 698, 116], [687, 730, 108], [578, 756, 96], [648, 777, 94]
    ].map(([x, y, size], i): VillageProp => ({ id: `forest:${i}`, frame: i % 4 === 0 ? "deco_tree_pine" : "deco_tree_oak", x, y, size, footprint: null })),
    ...[28, 92, 156, 220, 500, 564, 628, 692].map((x, i): VillageProp => ({ id: `wall:${i}`, frame: "building_palisade", x, y: 830, size: 78, footprint: null })),
    // 树足底下移30，树冠与民居分开；底座与工位同步调整，尺寸和足底排序不变。
    { id: "tree:logging", frame: "deco_tree_oak", x: 98, y: 1012, size: 90, footprint: { left: 87, top: 997, right: 109, bottom: 1012 } },
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
        ...[[58, 950], [146, 950], [194, 950], [238, 950], [182, 986], [216, 986],
            [50, 1022], [182, 1022], [230, 1022], [586, 1018], [630, 1018], [674, 1018], [644, 970], [674, 932], [634, 875]].map(([x, y]) => ({ x, y })),
        ...[58, 98, 140, 182, 224].map(x => ({ x, y: 874 }))
    ],
    farm: [{ x: 486, y: 879 }, { x: 546, y: 879 }, { x: 606, y: 879 }, { x: 486, y: 924 }, { x: 546, y: 924 }, { x: 606, y: 924 }],
    // 工位围绕下移后的树干排列，下排仍留在短屏底部操作区之外。
    logging: [{ x: 56, y: 994 }, { x: 142, y: 994 }, { x: 76, y: 1026 }, { x: 126, y: 1026 }],
    // 有意包含屋后与屋前的休息点，行人绕过墙基后会自然发生遮挡切换。
    rest: CAMP_STOPS,
    children: CAMP_STOPS,
    // 篝火前的双人会合点，与所有家门/工作点共用导航和足底遮挡；不新增建筑或家庭归属。
    wedding: [{ x: 330, y: 990 }, { x: 370, y: 990 }],
    towers: PADS.map(p => ({ x: p.x, y: p.y + 54 }))
};

/** 建筑底座保持图片的真实尺寸；农田/伐木工作点跟随各自资源，不能把动作点单独拉到图外。 */
export function layoutVillage(layout: GameLayout) {
    const point = (p: GroundPoint): GroundPoint => ({ x: p.x, y: layout.worldY(p.y) });
    const pads = PADS.map(point);
    const props = VILLAGE_PROPS.map(p => {
        const at = point(p);
        if (p.id.startsWith("tower:")) at.y = pads[Number(p.id.split(":")[1])].y + TOWER_VIEW.top + p.size * 15 / 16;
        const dy = at.y - p.y;
        return { ...p, ...at, footprint: p.footprint ? { ...p.footprint, top: p.footprint.top + dy, bottom: p.footprint.bottom + dy } : null };
    });
    // 小村庄优先占用靠近火堆的位置；基准排序固定，换屏时不交换席位或照料者的左右关系。
    const hearth = VILLAGE_PROPS.find(p => p.id === "building:hearth")!;
    const camp = CAMP_STOPS.slice().sort((a, b) => distance(a, hearth) - distance(b, hearth)).map(point);
    const relative = (points: GroundPoint[], anchor: string) => {
        const before = VILLAGE_PROPS.find(p => p.id === anchor)!, after = props.find(p => p.id === anchor)!;
        return points.map(p => ({ x: p.x, y: after.y + p.y - before.y }));
    };
    const stops = {
        homes: VILLAGE_STOPS.homes.map(point), farm: relative(VILLAGE_STOPS.farm, "building:farm"),
        logging: relative(VILLAGE_STOPS.logging, "tree:logging"), rest: camp, children: camp,
        wedding: VILLAGE_STOPS.wedding.map(point), towers: pads.map(p => ({ x: p.x, y: p.y + 54 }))
    };
    const landscape = LANDSCAPE_FOOTPRINTS.map((r, i) => ({ ...r,
        top: i < 2 ? layout.worldY(r.top) : layout.gateY - (830 - r.top), bottom: layout.worldY(r.bottom)
    }));
    const bounds = { ...MOTION.bounds, top: layout.worldY(MOTION.bounds.top), bottom: layout.footerTop - 14 };
    return { props, pads, stops, landscape, bounds };
}

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
    constructor(props = VILLAGE_PROPS, landscape = LANDSCAPE_FOOTPRINTS, readonly bounds: Footprint = MOTION.bounds) {
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
        const b = this.bounds;
        return p.x >= b.left && p.x <= b.right && p.y >= b.top && p.y <= b.bottom &&
            !this.obstacles.some(r => p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom);
    }
    /** 仅窗口重排使用：行人映射后若与新底座相交，移到最近的可行走边缘，不改变业务或目的地。 */
    relocate(p: GroundPoint): GroundPoint {
        const b = this.bounds, at = { x: Math.max(b.left, Math.min(b.right, p.x)), y: Math.max(b.top, Math.min(b.bottom, p.y)) };
        if (this.walkable(at)) return at;
        const candidates = this.corners.slice();
        for (const r of this.obstacles) {
            candidates.push({ x: r.left - MOTION.cornerGap, y: at.y }, { x: r.right + MOTION.cornerGap, y: at.y },
                { x: at.x, y: r.top - MOTION.cornerGap }, { x: at.x, y: r.bottom + MOTION.cornerGap });
        }
        const nearest = candidates.filter(q => this.walkable(q)).sort((a, c) => distance(at, a) - distance(at, c))[0];
        if (!nearest) throw new Error("窗口重排后没有可行走位置");
        return { ...nearest };
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
