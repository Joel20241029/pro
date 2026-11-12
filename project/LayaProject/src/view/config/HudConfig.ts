/** 原 GameLayout 的 720 逻辑像素布局参数，原值迁移。
 * 只决定屏幕映射、阅读尺寸和居民区高度，不修改 PATH/PADS、射程或生长速度。
 * 顶部紧凑布局尚未实施；以后调整此表须复查安全区、短屏和人物站点。
 */
export const LAYOUT = {
    width: 720, settingsTop: 64, menuGap: 10, resourcesGap: 70, mapGap: 123,
    footerHeight: 242, battleMax: 700, villageMin: 260, battleMin: 440, battleRatio: .68,
    personMin: 64, personMax: 68, personBase: 56, personGrowthHeight: 300, personGrowthStep: 40,
    referenceTop: 246, referenceGate: 830, referenceBattleHeight: 584, referenceVillageHeight: 208
} as const;
/** 常驻 HUD 的原始坐标、尺寸与图文间距，单位为逻辑像素。
 * 只管理显示和点击区域；塔标签偏移不得用于战斗或寻路，城门血量始终按同一中心对齐。
 */
export const HUD = {
    statusHeight: 37,
    title: { x: 34, top: 8, width: 310, font: 36, height: 50 },
    settings: { x: 558, width: 126, height: 60 },
    date: { x: 34, top: 10, width: 290, font: 27, height: 40 },
    score: { x: 324, top: 14, width: 214, font: 25, height: 32 },
    resource: { x: 28, step: 226, width: 212, textY: 13, textWidth: 154, font: 30, minFont: 20, height: 48, icon: 44, iconY: 15, gap: 6, textPadding: 4 },
    gate: { x: 304, top: -162, width: 112, font: 22, height: 28, stroke: 1.5, barX: 316, barTop: -130, barWidth: 88, barHeight: 7, barInset: 2, fillWidth: 84, fillHeight: 3, dangerRatio: .35 },
    tower: { hitX: -58, hitY: -80, hitWidth: 116, hitHeight: 134, labelHalfWidth: 116, labelWidth: 232, leftLowerX: -70, rightLowerX: 24, top: 27, rightLowerTop: 19, font: 24, occupiedHeight: 64, emptyHeight: 40 },
    navigation: [
        { title: "村民", panel: "people", icon: "icon_population" },
        { title: "家庭", panel: "families", icon: "icon_family" },
        { title: "建设", panel: "build", icon: "icon_build" },
        { title: "家谱", panel: "history", icon: "icon_view" }
    ]
} as const;
