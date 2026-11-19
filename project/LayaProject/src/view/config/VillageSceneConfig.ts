import { PADS } from "../../game/GameConfig";
import { FARM_WHEEL_FOOTPRINT } from "../BuildingLayout";
export interface GroundPoint {
    x: number;
    y: number;
}
/** 伐木表现目标：树ID稳定用于预占/摇树，站点在树的村内前侧；不决定生产结算。 */
export interface LoggingStop extends GroundPoint { treeId: string; treeX: number; }
export interface Footprint {
    left: number;
    top: number;
    right: number;
    bottom: number;
}
export interface VillageProp extends GroundPoint {
    id: string;
    frame: string;
    size: number;
    footprint: Footprint | null;
    ground?: boolean;
    /** 同一木牌底图的独立文字，与牌体共用缩放、重排和足底排序。 */
    signText?: string;
    /** 村内树冠的小点缀：坐标和尺寸相对树宽，透明度控制视觉强度；随树遮挡，不独立置顶。 */
    canopyDetails?: readonly { frame: string; x: number; y: number; size: number; alpha: number }[];
}
/** 128px塔源画布的实际弓口/投石兜/水晶挂点；仅表现，不移动逻辑塔位或射程。
 * 左侧1/3塔向右、右侧2/4/5塔向左；石塔/寒塔保持正面，箭塔只切换实际左右武器，不镜像主体。
 */
export const TOWER_VIEW = {
    // 三种塔按反馈统一从108放大到124（约15%），top同步上移15以保留原地面足点；空石圈仍约78宽。
    // 最大占地84×34与放大后的底座一致，三种塔预留相同可行走边界；不改变逻辑PADS或射程。
    size: 124, top: -95, canvas: 128, emptyScale: .63, footprintWidth: 84, footprintDepth: 34, facing: [1, -1, 1, -1, -1],
    muzzle: { ARROW: { x: 92, y: 35 }, STONE: { x: 74, y: 50 }, SLOW: { x: 64, y: 32 } }
} as const;
/** 既有固定地图与高清母画布足底（中心、15/16 高度）。占地仅覆盖底座，屋顶/树冠可以遮住行人。 */
function prop(id: string, frame: string, left: number, top: number, size: number, baseWidth: number, baseDepth: number): VillageProp {
    const x = left + size / 2, y = top + size * 15 / 16;
    return { id, frame, x, y, size, footprint: { left: x - baseWidth / 2, top: y - baseDepth, right: x + baseWidth / 2, bottom: y } };
}
/** 城门右后侧的固定占地，三档主体共用脚底，避开紧邻门的火把。 */
export const PATROL_PROP = "building:patrol";
export const VILLAGE_PROPS: VillageProp[] = [
    ...[28, 92, 156, 220, 500, 564, 628, 692].map((x, i): VillageProp => ({ id: `wall:${i}`, frame: "building_palisade", x, y: 830, size: 78, footprint: null })),
    // 村名牌靠左城墙，底座落在已有墙体安全边内；牌面与火把分开，不增加通行障碍。
    { id: "deco:village-sign", frame: "deco_village_sign", x: 178, y: 832, size: 140, footprint: null, signText: "文明里村" },
    // 1.0.25移到道路上段左侧，给右侧新增第五塔让位；复用木牌，保持字号与草地留白。
    { id: "deco:friendship-road-sign", frame: "deco_village_sign", x: 270, y: 265, size: 120, footprint: null, signText: "友谊路" },
    // 下方圆树与左侧松树横向错开66，避免圆树树冠挡住松树前的落斧动作；仍保留原高度/尺寸。
    { id: "tree:logging", frame: "deco_tree_oak", x: 164, y: 1012, size: 90, footprint: { left: 153, top: 997, right: 175, bottom: 1012 }, canopyDetails: [
        { frame: "deco_apple_pair", x: .22, y: .37, size: .14, alpha: .85 },
        { frame: "deco_apple_pair", x: .59, y: .24, size: .12, alpha: .8 }
    ] },
    // 角落圆树参考原伐木树90宽，调整至84/86宽，树冠高度超过成人；足底靠边并留出完整树冠。
    // 花果各一簇、低透明度，无闪烁或跳动；复用林带素材，仅树干底部参与寻路阻挡。
    // 花树靠城墙内侧，前侧工位与民房屋顶分开，避免人虽在树前仍被民房遮住。
    { id: "tree:corner-blossom", frame: "deco_tree_oak", x: 38, y: 836, size: 84, footprint: { left: 27, top: 821, right: 49, bottom: 836 }, canopyDetails: [
        { frame: "deco_blossom_ivory", x: .55, y: .28, size: .12, alpha: .78 }
    ] },
    { id: "tree:corner-fruit", frame: "deco_tree_oak", x: 677, y: 998, size: 86, footprint: { left: 666, top: 983, right: 688, bottom: 998 }, canopyDetails: [
        { frame: "deco_pear_pair", x: .25, y: .33, size: .12, alpha: .8 }
    ] },
    // 松树使用88宽，与圆树同一量级、树形稍高；根部仍在行走横向边界外，左右错位保留活动区。
    { id: "tree:corner-pine-left", frame: "deco_tree_pine", x: 43, y: 976, size: 88, footprint: { left: 32, top: 961, right: 54, bottom: 976 } },
    { id: "tree:corner-pine-right", frame: "deco_tree_pine", x: 677, y: 880, size: 88, footprint: { left: 666, top: 865, right: 688, bottom: 880 } },
    { id: "deco:logs", frame: "deco_log_pile", x: 571, y: 1024, size: 60, footprint: null },
    ...[[279, 822], [441, 822]].map(([x, y], i): VillageProp => ({ id: `torch:${i}`, frame: "deco_torch", x, y, size: 62, footprint: null })),
    // 用户要求民居相对人物放大约20%；保留两栋足底(108,930)/(222,920)，高清底座按预制体112/128宽预留123/112，避免扩建后行人穿过墙脚。
    prop("building:house-a", "hd_house_body_0", 38, 798.75, 140, 123, 33),
    prop("building:house-b", "hd_house_body_0", 158, 800, 128, 112, 32),
    // 田地是可站立地面，用农田自身源pivot；不加入建筑排序/导航障碍，人物真正走入垄沟。
    { id: "building:farm", frame: "hd_farm_body_0", x: 546, y: 954, size: 202, footprint: null, ground: true },
    prop("building:logging", "hd_logging_body_0", 467, 922.625, 106, 87, 28),
    prop("building:hearth", "building_hearth_lit", 321, 891, 78, 44, 15),
    prop(PATROL_PROP, "patrol_booth_0", 482, 766, 100, 69, 29),
    prop("building:gate", "hd_gate_body_0", 282, 684, 156, 132, 30),
    ...PADS.map((p, i) => prop(`tower:${i}`, "building_tower_pad", p.x - TOWER_VIEW.size / 2, p.y + TOWER_VIEW.top, TOWER_VIEW.size, TOWER_VIEW.footprintWidth, TOWER_VIEW.footprintDepth))
];
export const farm = VILLAGE_PROPS.find(p => p.id === "building:farm")!;
const wheel = FARM_WHEEL_FOOTPRINT, farmScale = farm.size / 128;
/** 林带合并为 2 个固定块，墙体合并为左右两段；城门两边保留 40px 侧道，扣除足底间距后仍可通行。 */
export const LANDSCAPE_FOOTPRINTS: Footprint[] = [
    { left: 0, top: 260, right: 154, bottom: 764 }, { left: 566, top: 260, right: 720, bottom: 764 },
    { left: -7, top: 817, right: 254, bottom: 830 }, { left: 466, top: 817, right: 727, bottom: 830 },
    // 独立水车底座，升级前后统一预留。屋顶与水轮上半部不参与阻挡。
    { left: farm.x + (wheel.x - 64) * farmScale, top: farm.y + (wheel.y - 120) * farmScale,
        right: farm.x + (wheel.x + wheel.width - 64) * farmScale, bottom: farm.y + (wheel.y + wheel.height - 120) * farmScale }
];
/** 纯表现参数：逻辑像素/秒与秒；调整只改变行走节奏、驻足时间和离建筑的距离，不参与生产/战斗结算。 */
export const MOTION = {
    adultSpeed: 40, childSpeed: 31, clearance: 7, cornerGap: 1,
    // 摇椅只围绕接地点轻摆，座位及寿命不被动画推进。
    elderRock: { periodSeconds: 2.8, angleDegrees: 3 },
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
    // 高清人物头顶距足底约38~43px；红心下缘放在48px处，最多上浮3px，不挡脸。
    // 保留52px红心，位置与精英/屏幕人物缩放同步，不改变成家时序与持续时间。
    heartSeconds: 2.4, heartSize: 52, headOffset: 48, rise: 3, fadeIn: .2, fadeOut: .5,
    pulse: .08, pulseSeconds: .8
} as const;
/** 站点均在占地之外。工作点对应现有最大岗位数，家门仅为表现站点，不新增住宅归属规则。 */
export const VILLAGE_STOPS = {
    // 家门与火堆/休息点跨集合留出间距，避免一个回家、另一个休息时仍站在一起。
    homes: [
        // 右下闲逛点向左上挪开，避免与果树前侧新工位重叠；只改变驻足位置。
        ...[[58, 950], [146, 950], [194, 950], [238, 950], [182, 986], [216, 986],
            [50, 1022], [182, 1022], [230, 1022], [586, 1018], [614, 986], [674, 1018], [644, 970], [674, 932], [630, 850]].map(([x, y]) => ({ x, y })),
        // 左侧两个家门点避开花树前的新工位，保留至少24像素的停留间距。
        ...[58, 98, 140, 182, 224].map(x => ({ x, y: x <= 98 ? 878 : 874 }))
    ],
    farm: [{ x: 486, y: 879 }, { x: 546, y: 879 }, { x: 606, y: 879 }, { x: 486, y: 924 }, { x: 546, y: 924 }, { x: 606, y: 924 }],
    // 足底比树脚靠下14~16，使真实足底排序将伐木者画在树前。
    // 横向距离统一为39，按普通/精英落刃的实际屏幕坐标校验，让刃口落入树干宽度。
    logging: [
        { treeId: "tree:logging", treeX: 164, x: 125, y: 1026 },
        { treeId: "tree:corner-blossom", treeX: 38, x: 77, y: 852 },
        { treeId: "tree:corner-fruit", treeX: 677, x: 638, y: 1014 },
        { treeId: "tree:corner-pine-left", treeX: 43, x: 82, y: 992 },
        { treeId: "tree:corner-pine-right", treeX: 677, x: 638, y: 896 }
    ] as LoggingStop[],
    // 有意包含屋后与屋前的休息点，行人绕过墙基后会自然发生遮挡切换。
    rest: CAMP_STOPS,
    children: CAMP_STOPS,
    // 火堆下方两排供待命村民驻足。中心优先，实时排除建筑与已用站位，满员仍保留安全间距。
    waiting: Array.from({ length: 32 }, (_, i) => ({ x: 68 + 38 * (i % 16), y: i < 16 ? 1022 : 988 }))
        .filter(({ x }) => x < 486 || x > 562)
        .sort((a, b) => b.y - a.y || Math.abs(a.x - 360) - Math.abs(b.x - 360)),
    // 篝火前的双人会合点，与所有家门/工作点共用导航和足底遮挡；不新增建筑或家庭归属。
    wedding: [{ x: 330, y: 990 }, { x: 370, y: 990 }],
    towers: PADS.map(p => ({ x: p.x, y: p.y + 54 }))
};
