import { HUD, LAYOUT } from "./config/HudConfig";
/** 微信窗口使用逻辑屏幕像素；safeArea/胶囊为屏幕坐标，screenTop为窗口起点。
 * 字段依据官方 minigame-api-typings；部分设备不返回 safeArea。
 */
export interface WindowMetrics {
    windowWidth: number;
    windowHeight: number;
    screenTop?: number;
    statusBarHeight: number;
    safeArea?: {
        top: number;
        bottom: number;
        left: number;
        right: number;
    };
}
export interface MenuBounds {
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    height: number;
}
/** 固定720宽、动态高度的纯表现布局，不修改PATH/PADS、射程或战斗推进速度。
 * 地图北端140给高级塔顶部留白，城墙足底830、底边1038来自原VillageScene；只映射位置，图片不拉伸。
 */
export class GameLayout {
    readonly height: number;
    readonly safeTop: number;
    readonly safeBottom: number;
    readonly resourcesY: number;
    readonly mapTop: number;
    readonly gateY: number;
    readonly footerTop: number;
    readonly personScale: number;
    constructor(window: WindowMetrics, menu: MenuBounds) {
        const scale = LAYOUT.width / window.windowWidth;
        this.height = window.windowHeight * scale;
        // 本游戏为showStatusBar:false的全屏窗口；screenTop缺失时顶部起点为0。
        // 只补缺失字段，保留平台提供的有效偏移；三处屏幕到窗口换算必须共用同一起点，避免NaN使整屏不可见。
        const screenTop = window.screenTop === undefined ? 0 : window.screenTop;
        // 无safeArea时按真实状态栏/窗口边界布局，不猜刘海型号或固定底部手势高度。
        this.safeTop = Math.max(0, (window.safeArea ? window.safeArea.top : window.statusBarHeight) - screenTop) * scale;
        this.safeBottom = Math.min(window.windowHeight, window.safeArea ? window.safeArea.bottom - screenTop : window.windowHeight) * scale;
        const hasMenu = menu.width > 0 && menu.height > 0;
        const menuBottom = hasMenu ? (menu.bottom - screenTop) * scale : this.safeTop;
        // 微信「更多游戏」可在胶囊同一行向左展开，资源从这一行下方起排。
        this.resourcesY = Math.max(this.safeTop, menuBottom) + LAYOUT.menuGap;
        this.mapTop = this.resourcesY + HUD.resource.height + LAYOUT.resourceBottomGap + HUD.statusHeight;
        // 战场上限700、居民区至少260逻辑像素，保持短屏站点可走。
        this.footerTop = this.safeBottom - LAYOUT.footerHeight;
        const mapHeight = this.footerTop - this.mapTop;
        const battleHeight = Math.min(LAYOUT.battleMax, mapHeight - LAYOUT.villageMin, Math.max(LAYOUT.battleMin, mapHeight * LAYOUT.battleRatio));
        this.gateY = this.mapTop + battleHeight;
        // 基础成人画布86～90，再应用统一的村民显示倍率。
        const personWidth = Math.min(LAYOUT.personMax, LAYOUT.personMin + Math.max(0, this.footerTop - this.gateY - LAYOUT.personGrowthHeight) / LAYOUT.personGrowthStep);
        this.personScale = personWidth / LAYOUT.personBase * LAYOUT.personDisplayScale;
    }
    worldY(y: number): number {
        return y <= LAYOUT.referenceGate ? this.mapTop + (y - LAYOUT.referenceTop) / LAYOUT.referenceBattleHeight * (this.gateY - this.mapTop)
            : this.gateY + (y - LAYOUT.referenceGate) / LAYOUT.referenceVillageHeight * (this.footerTop - this.gateY);
    }
    /** 换窗口时把现有行人位置转换回基准地图，随后映射到新区域；不重建游戏状态。 */
    referenceY(y: number): number {
        return y <= this.gateY ? LAYOUT.referenceTop + (y - this.mapTop) / (this.gateY - this.mapTop) * LAYOUT.referenceBattleHeight
            : LAYOUT.referenceGate + (y - this.gateY) / (this.footerTop - this.gateY) * LAYOUT.referenceVillageHeight;
    }
}
