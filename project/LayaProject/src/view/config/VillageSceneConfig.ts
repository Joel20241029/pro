import { PADS } from "../../game/GameConfig";
import { PATROL_BOOTH_FRAME } from "../BuildingLayout";
export interface GroundPoint {
    x: number;
    y: number;
}
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
 * 左侧1/3塔向右、右侧2/4/5塔向左。石塔抛兜在后方，备用起点的横向偏移与箭塔相反。
 */
export const TOWER_VIEW = {
    // 三种塔按反馈统一从108放大到124（约15%），top同步上移15以保留原地面足点；空石圈仍约78宽。
    // 最大占地84×34与放大后的底座一致，三种塔共用可行走边界，实际攻击范围由 DefenseConfig 定义。
    size: 124, top: -95, canvas: 128, emptyScale: .63, footprintWidth: 84, footprintDepth: 34, facing: [1, -1, 1, -1, -1],
    // 放大后的武器最高轮廓与顶栏之间预留空间。
    hudClearance: 176, hudEdgePadding: 8,
    // 塔脚离逻辑路边的余量含美术加宽的土路外沿及底座可见宽度。
    roadClearance: 38, upperLeftRoadClearance: 32, upperRightRoadClearance: 33, compactLowerLeftRoadClearance: 34,
    // 第五塔靠近内侧弯道，保留 25 像素草地余量，避免占地伸到土路。
    lowerRightRoadClearance: 25,
    // 定稿炮管静止姿态，由 Weapon 与 Muzzle 相加，围绕足点放大 25%。
    muzzle: { x: 64 + (70.16 + 31.36 - 64) * 1.25, y: 120 + (57.28 - 29.12 - 120) * 1.25 }
} as const;
/** 显示塔位沿用存档塔位编号。战斗索敌使用常规高度基准，短屏绘制按下方各档避让。 */
export const TOWER_DISPLAY_PADS: readonly GroundPoint[] = PADS;
/** points 保留原五塔在基准地图上的锚点。rightTowerLift 按第四、第五塔顺序给出沿路向北的基准像素数。
 * 常规屏采用确认稿的 32、60；短屏依据三种塔的攻击轮廓、驻守标签和路牌位置收紧上移量。
 * 常规、长屏的 restingSign 是日间第五位为空或石塔时的原牌位；高武器和守夜动作使用 friendshipSign 避让。
 * 这些值只影响显示、交互及驻塔站点；改动时须核对道路净距与相邻塔、路牌的遮挡。
 */
export const TOWER_SCREEN_LAYOUTS = [
    { height: 492, friendshipSign: [660, 435], rightTowerLift: [32, 22], scale: .80, points: [[214,351], [538,353], [268,667], [439,533], [545,690]] },
    { height: 523, friendshipSign: [660, 430], rightTowerLift: [14, 7], scale: .88, points: [[226,348], [540,356], [210,653], [401,509], [530,671]] },
    { height: 593, friendshipSign: [650, 489], rightTowerLift: [32, 38], scale: .88, points: [[228,362], [543,331], [219,643], [413,531], [530,682]] },
    { height: 650, friendshipSign: [598, 470], restingSign: [575,499], rightTowerLift: [32, 60], scale: .88, points: [...PADS.slice(0, 4).map(p => [p.x, p.y]), [523,694]] },
    { height: 700, friendshipSign: [575, 477], restingSign: [575,499], rightTowerLift: [32, 60], scale: .88, points: [[238,360], [543,302], [193,606], [396,522], [514,698]] }
] as const;
/** 既有固定地图与高清母画布足底（中心、15/16 高度）。占地仅覆盖底座，屋顶/树冠可以遮住行人。 */
function prop(id: string, frame: string, left: number, top: number, size: number, baseWidth: number, baseDepth: number): VillageProp {
    const x = left + size / 2, y = top + size * 15 / 16;
    return { id, frame, x, y, size, footprint: { left: x - baseWidth / 2, top: y - baseDepth, right: x + baseWidth / 2, bottom: y } };
}
/** 村内西侧的巡防建筑，与佟楼正面错开。三档主体共用占地。 */
export const PATROL_PROP = "building:patrol";
/** 村委会放在村内中部，城门方向留出通行空间，与右侧制衣厂错开。 */
export const HERO_COMMITTEE_PROP = "building:hero-committee";
/** 制衣厂占用右侧原生产用地，牌匾已经绘入主体。前方三台机器只展示实际在岗村民。 */
export const FACTORY_PROP = "building:factory";
export const FACTORY_FRAME = "motion_factory_body";
export const HERO_COMMITTEE_FRAME = "hero_committee";
// 128×62 的矮木门按等比画在原村口中心，足点稍前于木栅以盖住接缝。
export const VILLAGE_GATE = prop("building:gate", "motion_gate_body", 307, 730.875, 106, 108, 14);
export const VILLAGE_PROPS: VillageProp[] = [
    // 两个内段搭接矮寨门的门柱，栅栏和门石共用同一条地面基线。
    ...[28, 92, 156, 220, 500, 564, 628, 692, 274, 446].map((x, i): VillageProp => ({ id: `wall:${i}`, frame: "building_palisade", x, y: 830, size: 78, footprint: null })),
    // 村名牌靠左城墙，底座落在已有墙体安全边内；牌面与火把分开，不增加通行障碍。
    { id: "deco:village-sign", frame: "deco_village_sign", x: 153, y: 836, size: 140, footprint: null, signText: "文明里村" },
    { id: "deco:friendship-road-sign", frame: "deco_village_sign", x: 575, y: 499, size: 120, footprint: null, signText: "友谊路" },
    // 下方圆树与左侧松树横向错开66，保留两棵树各自的树冠轮廓；仍保留原高度/尺寸。
    { id: "tree:logging", frame: "deco_tree_oak", x: 164, y: 1012, size: 90, footprint: { left: 153, top: 997, right: 175, bottom: 1012 }, canopyDetails: [
        { frame: "deco_apple_pair", x: .22, y: .37, size: .14, alpha: .85 },
        { frame: "deco_apple_pair", x: .59, y: .24, size: .12, alpha: .8 }
    ] },
    // 角落圆树参考原伐木树90宽，调整至84/86宽，树冠高度超过成人；足底靠边并留出完整树冠。
    // 花果各一簇、低透明度，无闪烁或跳动；复用林带素材，仅树干底部参与寻路阻挡。
    // 花树靠城墙内侧，与民房屋顶错开。
    { id: "tree:corner-blossom", frame: "deco_tree_oak", x: 38, y: 836, size: 84, footprint: { left: 27, top: 821, right: 49, bottom: 836 }, canopyDetails: [
        { frame: "deco_blossom_ivory", x: .55, y: .28, size: .12, alpha: .78 }
    ] },
    { id: "tree:corner-fruit", frame: "deco_tree_oak", x: 677, y: 998, size: 86, footprint: { left: 666, top: 983, right: 688, bottom: 998 }, canopyDetails: [
        { frame: "deco_pear_pair", x: .25, y: .33, size: .12, alpha: .8 }
    ] },
    // 松树使用88宽，与圆树同一量级、树形稍高；根部仍在行走横向边界外，左右错位保留活动区。
    { id: "tree:corner-pine-left", frame: "deco_tree_pine", x: 43, y: 976, size: 88, footprint: { left: 32, top: 961, right: 54, bottom: 976 } },
    { id: "tree:corner-pine-right", frame: "deco_tree_pine", x: 677, y: 861, size: 88, footprint: { left: 666, top: 846, right: 688, bottom: 861 } },
    // 保留佟楼的 140px 外观，底座按满级厢房宽度预留，扩建时村民仍能绕开墙脚。
    prop("building:house-a", "motion_house_body", 38, 794.75, 140, 123, 33),
    // 足点仍在原田地中心，窄底座给前排机器和绕行留出通道。
    prop(FACTORY_PROP, FACTORY_FRAME, 495, 768.375, 198, 110, 24),
    prop(PATROL_PROP, PATROL_BOOTH_FRAME, 152, 801.25, 148, 102, 43),
    // Larger roof and facade still stand on the existing foundation, protecting nearby compact-screen waiting positions.
    prop(HERO_COMMITTEE_PROP, HERO_COMMITTEE_FRAME, 286, 817.25, 148, 76, 24),
    VILLAGE_GATE,
    ...TOWER_DISPLAY_PADS.map((p, i) => prop(`tower:${i}`, "building_tower_pad", p.x - TOWER_VIEW.size / 2, p.y + TOWER_VIEW.top, TOWER_VIEW.size, TOWER_VIEW.footprintWidth, TOWER_VIEW.footprintDepth))
];
/** 林带合并为两个固定块。左右栅栏一直阻挡到门柱内侧，中央双扇门洞供村民通行。 */
export const LANDSCAPE_FOOTPRINTS: Footprint[] = [
    { left: 0, top: 260, right: 154, bottom: 764 }, { left: 566, top: 260, right: 720, bottom: 764 },
    { left: -7, top: 817, right: 319, bottom: 830 }, { left: 401, top: 817, right: 727, bottom: 830 },

];
/** 纯表现参数：逻辑像素/秒与秒；调整只改变行走节奏、驻足时间和离建筑的距离，不参与生产/战斗结算。 */
export const MOTION = {
    adultSpeed: 40, childSpeed: 31, clearance: 7, cornerGap: 1,
    // 门前接近区略宽于门洞，纵向预留开门所需的步行距离。只驱动门扇表现。
    gateApproachWidth: 62, gateApproachDepth: 36,
    // 摇椅只围绕接地点轻摆，座位及寿命不被动画推进。
    elderRock: { periodSeconds: 2.8, angleDegrees: 3 },
    restSeconds: 1.8,
    // 每批到账后在散步目的地驻足。只控制动作节奏，制衣计时和收入仍按会话经济规则结算。
    sewingBreakSeconds: 3,
    bounds: { left: 44, top: 275, right: 676, bottom: 1028 }
} as const;
/** 村中央的20个足底站点，避开建筑和厂房；新生儿从出生起使用其中的育儿位置。
 * 只作表现，不增加人口容量。按存活人物保留分配，不能以永久人口编号取模复用占位。
 */
export const CAMP_STOPS: GroundPoint[] = [
    { x: 286, y: 872 }, { x: 334, y: 872 }, { x: 382, y: 872 }, { x: 430, y: 872 },
    { x: 286, y: 912 }, { x: 334, y: 912 }, { x: 382, y: 912 }, { x: 430, y: 912 },
    { x: 286, y: 952 }, { x: 430, y: 952 }, { x: 286, y: 988 }, { x: 430, y: 988 },
    { x: 286, y: 1024 }, { x: 334, y: 1024 }, { x: 382, y: 1024 }, { x: 430, y: 1024 },
    { x: 334, y: 988 }, { x: 382, y: 988 }, { x: 244, y: 984 }, { x: 472, y: 972 }
];
/** 夜间把城门内的八个休息席位挪到两侧，给淡紫儿集合与后拉留出空间。 */
export const NIGHT_CAMP_STOPS = [
    ...[[72, 852], [116, 852], [178, 860], [222, 858],
        [68, 950], [112, 950], [156, 960], [201, 978]].map(([x, y]) => ({ x, y })),
    ...CAMP_STOPS.slice(8)
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
    // 家门与中央休息点跨集合留出间距，避免一个回家、另一个休息时仍站在一起。
    homes: [
        // 左侧站位沿佟楼与巡防建筑前缘排布，右侧避开厂房底座。
        ...[[58, 950], [107, 950], [151, 950], [193, 968], [238, 968], [188, 989],
            [50, 1022], [182, 1022], [230, 1022], [519, 995], [590, 978], [674, 1018], [644, 970], [674, 932], [630, 850]].map(([x, y]) => ({ x, y })),
        // 左侧两个家门点避开花树，保留至少24像素的停留间距。
        ...[58, 98, 140, 182, 224].map(x => ({ x, y: x <= 98 ? 878 : 874 }))
    ],
    // 三台展示工位沿厂门前排列，80像素的工作台彼此错开。生产容量由制衣厂规则独立决定。
    factoryDoor: [{ x: 594, y: 966 }],
    sewing: [{ x: 498, y: 985 }, { x: 579, y: 985 }, { x: 650, y: 985 }],
    // 有意包含屋后与屋前的休息点，行人绕过墙基后会自然发生遮挡切换。
    rest: CAMP_STOPS,
    nightRest: NIGHT_CAMP_STOPS,
    children: CAMP_STOPS,
    // 村中空地南侧两排供待命村民驻足。中心优先，实时排除建筑与已用站位，满员仍保留安全间距。
    waiting: Array.from({ length: 32 }, (_, i) => ({ x: 68 + 38 * (i % 16), y: i < 16 ? 1022 : 988 }))
        .filter(({ x }) => x < 558 || x > 642)
        .sort((a, b) => b.y - a.y || Math.abs(a.x - 360) - Math.abs(b.x - 360)),
    // 村中空地的双人会合点，与所有家门/工作点共用导航和足底遮挡；不新增建筑或家庭归属。
    wedding: [{ x: 330, y: 990 }, { x: 370, y: 990 }],
    towers: TOWER_DISPLAY_PADS.map(p => ({ x: p.x, y: p.y + 54 }))
};
