/** GameLayout 的 720 逻辑像素布局参数。
 * 只决定屏幕映射、阅读尺寸和居民区高度，不修改 PATH/PADS、射程或生长速度。
 * 资源条避让微信胶囊，回收的顶部间距交给地图。
 */
export const LAYOUT = {
    width: 720, menuGap: 8, resourceBottomGap: 6,
    footerHeight: 228, battleMax: 700, villageMin: 260, battleMin: 440, battleRatio: .68,
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
 * 设置与左侧入口呼应，守夜时位于整夜效果框下方。
 */
export const HUD = {
    statusHeight: 32,
    settings: { right: 10, size: 94, gap: 10, icon: 46, iconTop: 8, captionTop: 57, font: 23 },
    // 高清图标按可见裁框居中后与文字同高；44px图文区及8px间距避免透明留白造成错位。
    resource: { x: 28, step: 226, width: 212, textY: 0, textWidth: 154, font: 30, minFont: 20, height: 44, icon: 44, iconY: 4, gap: 8, textPadding: 4 },
    // 白天将血条放在矮门顶端；连发时将整组读数放到门脚下方，为炮身转向留出空间。
    gate: { x: 304, width: 112, font: 22, height: 28, stroke: 1.5, barTop: -76, rapidBarBottom: 70, barWidth: 88, barHeight: 7, barInset: 2, fillWidth: 84, fillHeight: 3, dangerRatio: .35 },
    // 四塔说明贴近足底（pad.y-95+124*15/16），统一居中且不按塔位左右偏移。
    // 20号字、2px行距和轻描边让长精英名也与短屏城门分开；144宽保持两行，点击区另按放大后的塔身配置。
    tower: { hitX: -68, hitY: -98, hitWidth: 136, hitHeight: 152, labelWidth: 144, top: 24, font: 20, leading: 2, stroke: 1.5, occupiedHeight: 44, emptyHeight: 28 },
    // 加号挂在空底座中心，较明显的呼吸帮助找出可建位置。命中区域仍用固定矩形。
    towerBuildHint: { size: 42, centerAbovePad: 29, hitHeight: 176, seconds: 1.65, amplitude: .16 },
    // 按钮右上角28px矢量红点，圆心内缩7px，约14px手机显示；随 buttonFace 按压，不遮图文。
    // 仅底部村务按钮使用，地图防塔不再放红点。
    // 所有可操作和新战技红点共用放大 1.5 倍后的尺寸；内收重定中心以保留边框留白。
    actionDot: { size: 42, inset: 14 },
    // 白天开始守夜及夜间战技共用的圆钮底图。盾牌、战技图标及文字分别叠绘。
    roundButtonSkin: "button_heart_round",
    /** 白天两侧各两个村务入口，主按钮保持圆形并为底部手势留出净空。
     */
    footer: {
        info: { x: 28, y: 7, width: 474, height: 36, font: 24 },
        wave: { x: 536, y: 0, width: 156, height: 48, font: 24 },
        // 盾牌与四字按钮文案居中，保留圆钮边缘留白。
        start: { x: 274, y: 47, size: 172, icon: 70, iconY: 17, textX: 29, textY: 90, textWidth: 114, textHeight: 36, font: 28 },
        navigation: { xs: [28, 148, 468, 588], y: 83, width: 104, height: 112, icon: 57, iconY: 7, textX: 8, textY: 68, textHeight: 34, font: 28 }
    },
    /** 守夜底栏上方固定暂停，下一行按已装配数量居中。 */
    night: {
        // 夜况在退出和暂停之间缩排，两边热区与三战技圆钮保持间距。
        status: { x: 123, y: 17, width: 474, height: 54, font: 24 },
        exitX: 11,
        // 100 方形热区进入 320 宽屏仍有 44 点；奶油按钮的可见高度较小，给战技让出视觉空间。
        pause: { x: 609, y: 14, width: 100, height: 61, hitHeight: 100, icon: 33, iconX: 6, textX: 34, textWidth: 57, font: 23 },
        // 按一至三项战技排列。圆环、按钮弹性及地图高度沿用原值，第三枚的热区与暂停相隔 12 逻辑像素。
        rows: [
            { y: 47, size: 172, centers: [360] },
            { y: 58, size: 162, centers: [264, 456] },
            { y: 67, size: 148, centers: [197, 360, 523] }
        ],
        // 两行分别按圆皮在该高度的宽度留边，缩小到多槽时沿用同一比例。
        heart: { icon: 61, iconY: 15, textY: 79, textWidth: 118, textHeight: 32, textFont: 28,
            noteY: 108, noteWidth: 76, noteHeight: 28, noteFont: 19, stroke: 1.4 },
        ring: { radius: 90, width: 4, segments: 64, color: "#fff0a3", track: "#a76b26", cooldownColor: "#e6eddb", cooldownTrack: "#80916e" }
    },
    navigation: [
        { title: "村民", panel: "people", icon: "icon_population" },
        { title: "家庭", panel: "families", icon: "icon_family" },
        { title: "建设", panel: "build", icon: "icon_build" },
        { title: "家谱", panel: "history", icon: "icon_view" }
    ]
} as const;
