/** GameLayout 的 720 逻辑像素布局参数。
 * 只决定屏幕映射、阅读尺寸和居民区高度，不修改 PATH/PADS、射程或生长速度。
 * 日期行避让微信胶囊，资源紧随其下；回收的顶部间距全部交给地图，调整须复查短屏站点。
 */
export const LAYOUT = {
    width: 720, dateTop: 64, menuGap: 10, resourcesGap: 34, mapGap: 92,
    footerHeight: 242, battleMax: 700, villageMin: 260, battleMin: 440, battleRatio: .68,
    // 高清共同画布含完整四向动作留白；按2026-11-13反馈再放大约7%，足点/速度不变，步幅随显示尺寸换算。
    personMin: 86, personMax: 90, personBase: 56, personGrowthHeight: 300, personGrowthStep: 40,
    // 390逻辑宽对照后确定：地图村民放大5%，保留足点及行走目标。砍树接触检查覆盖6个成年模型和5棵树。
    personDisplayScale: 1.05,
    // 战场北端多露出86逻辑像素草地，给首塔12级武器及升级回弹留顶边空隙；居民区和总地图高度不变。
    // 第五塔在道路北段，北端多留20逻辑单位以容纳最高寒塔；仍固定城墙830，保持地图/寻路同一映射。
    referenceTop: 140, referenceGate: 830, referenceBattleHeight: 690, referenceVillageHeight: 208
} as const;
/** 常驻 HUD 的坐标、尺寸与图文间距，单位为逻辑像素。
 * 只管理显示和点击区域；塔标签偏移不得用于战斗或寻路，城门血量始终按同一中心对齐。
 * 标题与日期文本框对称于屏幕中心360，小记留在左侧；标题32号为短屏右侧原生按钮保留空间。
 * 标题与小记的top相对日期行，紧凑组合为一块，避免胶囊避让后标题和日期被拉远。
 */
export const HUD = {
    statusHeight: 37,
    title: { x: 240, top: -48, width: 240, font: 32, height: 44 },
    settings: { x: 28, top: -36, width: 126, height: 60 },
    date: { x: 232, top: 0, width: 256, font: 26, height: 34 },
    // 高清图标按可见裁框居中后与文字同高；44px图文区及8px间距避免透明留白造成错位。
    resource: { x: 28, step: 226, width: 212, textY: 0, textWidth: 154, font: 30, minFont: 20, height: 44, icon: 44, iconY: 4, gap: 8, textPadding: 4 },
    gate: { x: 304, top: -162, width: 112, font: 22, height: 28, stroke: 1.5, barX: 316, barTop: -130, barWidth: 88, barHeight: 7, barInset: 2, fillWidth: 84, fillHeight: 3, dangerRatio: .35 },
    // 四塔说明贴近足底（pad.y-95+124*15/16），统一居中且不按塔位左右偏移。
    // 20号字、2px行距和轻描边让长精英名也与短屏城门分开；144宽保持两行，点击区另按放大后的塔身配置。
    tower: { hitX: -68, hitY: -98, hitWidth: 136, hitHeight: 152, labelWidth: 144, top: 24, font: 20, leading: 2, stroke: 1.5, occupiedHeight: 44, emptyHeight: 28 },
    // 加号挂在空底座中心，较明显的呼吸帮助找出可建位置。命中区域仍用固定矩形。
    towerBuildHint: { size: 42, centerAbovePad: 29, hitHeight: 176, seconds: 1.65, amplitude: .16 },
    // 按钮右上角28px矢量红点，圆心内缩7px，约14px手机显示；随 buttonFace 按压，不遮图文。
    // 仅底部村务按钮使用，地图防塔不再放红点。
    // 所有可操作和新战技红点共用放大 1.5 倍后的尺寸；内收重定中心以保留边框留白。
    actionDot: { size: 42, inset: 14 },
    /** 已确认的圆形居中底栏（720×242）：白天两侧各两个村务入口，主按钮整图等比显示。
     * 字号/颜色由同一配置与 C 控制；按钮按下仍整体下移3px，底边保留至少13px安全留白。
     * 仅改变HUD布局，不调整地图高度、守夜确认、下载重试或战斗操作。
     */
    footer: {
        info: { x: 28, y: 12, width: 474, height: 36, font: 24 },
        wave: { x: 536, y: 0, width: 156, height: 60, font: 24 },
        start: { x: 274, y: 54, size: 172, icon: 62, iconY: 26, textX: 12, textY: 94, textWidth: 148, textHeight: 42, font: 32, stroke: 1.4 },
        navigation: { xs: [28, 148, 468, 588], y: 92, width: 104, height: 112, icon: 48, iconY: 12, textX: 8, textY: 68, textHeight: 34, font: 28 }
    },
    /** 2026-11-14已确认的守夜三按钮；沿用白天圆钮中心和242高底栏，地图不重排。
     * 环外径184，含3px按压后下沿235，保留7px安全留白；状态行截至40，避开环顶48。
     * 数值均为720宽的逻辑像素，只影响表现。冷却环用灰绿色与金色生效环区分。
     */
    night: {
        status: { x: 28, y: 8, width: 664, height: 32, font: 24 },
        side: { xs: [72, 504], y: 92, width: 144, height: 112, icon: 44, iconY: 12, textY: 68, textHeight: 34, font: 28 },
        // 三枚战技居中等距，左右为暂停和倍速；下面保留安全区留白。
        multi: { sideXs: [18, 602], sideWidth: 100, center: 360, pitch: 138, size: 124, y: 72 },
        heart: { icon: 60, iconY: 20, textY: 86, textHeight: 40, noteY: 128, noteHeight: 28, noteFont: 22, stroke: 1.4 },
        ring: { radius: 90, width: 4, segments: 64, color: "#fff0a3", track: "#a76b26", cooldownColor: "#e6eddb", cooldownTrack: "#80916e" }
    },
    navigation: [
        { title: "村民", panel: "people", icon: "icon_population" },
        { title: "家庭", panel: "families", icon: "icon_family" },
        { title: "建设", panel: "build", icon: "icon_build" },
        { title: "家谱", panel: "history", icon: "icon_view" }
    ]
} as const;
