/** GameLayout 的 720 逻辑像素布局参数。
 * 只决定屏幕映射、阅读尺寸和居民区高度，不修改 PATH/PADS、射程或生长速度。
 * 日期行避让微信胶囊，资源紧随其下；回收的顶部间距全部交给地图，调整须复查短屏站点。
 */
export const LAYOUT = {
    width: 720, dateTop: 64, menuGap: 10, resourcesGap: 34, mapGap: 92,
    footerHeight: 242, battleMax: 700, villageMin: 260, battleMin: 440, battleRatio: .68,
    personMin: 64, personMax: 68, personBase: 56, personGrowthHeight: 300, personGrowthStep: 40,
    referenceTop: 246, referenceGate: 830, referenceBattleHeight: 584, referenceVillageHeight: 208
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
    // 资源图标按截图反馈上移8设计像素，让图形视觉重心贴齐文字，并与顶部面板底框留出间距。
    resource: { x: 28, step: 226, width: 212, textY: 4, textWidth: 154, font: 30, minFont: 20, height: 44, icon: 44, iconY: -4, gap: 6, textPadding: 4 },
    gate: { x: 304, top: -162, width: 112, font: 22, height: 28, stroke: 1.5, barX: 316, barTop: -130, barWidth: 88, barHeight: 7, barInset: 2, fillWidth: 84, fillHeight: 3, dangerRatio: .35 },
    // 四塔说明贴近足底（pad.y-80+108*15/16），统一居中且不按塔位左右偏移。
    // 20号字、2px行距和轻描边让长精英名也与短屏城门分开；144宽保持两行，不改变点击区。
    tower: { hitX: -58, hitY: -80, hitWidth: 116, hitHeight: 134, labelWidth: 144, top: 24, font: 20, leading: 2, stroke: 1.5, occupiedHeight: 44, emptyHeight: 28 },
    navigation: [
        { title: "村民", panel: "people", icon: "icon_population" },
        { title: "家庭", panel: "families", icon: "icon_family" },
        { title: "建设", panel: "build", icon: "icon_build" },
        { title: "家谱", panel: "history", icon: "icon_view" }
    ]
} as const;
