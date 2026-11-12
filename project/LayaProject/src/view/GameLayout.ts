/** 微信窗口使用逻辑屏幕像素；safeArea/胶囊为屏幕坐标，screenTop为窗口起点。
 * 字段依据官方 minigame-api-typings；部分设备不返回 safeArea。
 */
export interface WindowMetrics {
    windowWidth: number; windowHeight: number; screenTop?: number; statusBarHeight: number;
    safeArea?: { top: number; bottom: number; left: number; right: number };
}
export interface MenuBounds { top: number; bottom: number; left: number; right: number; width: number; height: number; }

/** 固定720宽、动态高度的纯表现布局，不修改PATH/PADS、射程或战斗推进速度。
 * 基准地图的顶边246、城墙足底830、底边1038来自原VillageScene；只映射位置，图片不拉伸。
 */
export class GameLayout {
    readonly height: number;
    readonly safeTop: number;
    readonly safeBottom: number;
    readonly settingsY: number;
    readonly resourcesY: number;
    readonly mapTop: number;
    readonly gateY: number;
    readonly footerTop: number;
    readonly personScale: number;
    constructor(window: WindowMetrics, menu: MenuBounds) {
        const scale = 720 / window.windowWidth;
        this.height = window.windowHeight * scale;
        // 本游戏为showStatusBar:false的全屏窗口；screenTop缺失时顶部起点为0。
        // 只补缺失字段，保留平台提供的有效偏移；三处屏幕到窗口换算必须共用同一起点，避免NaN使整屏不可见。
        const screenTop = window.screenTop === undefined ? 0 : window.screenTop;
        // 无safeArea时按真实状态栏/窗口边界布局，不猜刘海型号或固定底部手势高度。
        this.safeTop = Math.max(0, (window.safeArea ? window.safeArea.top : window.statusBarHeight) - screenTop) * scale;
        this.safeBottom = Math.min(window.windowHeight, window.safeArea ? window.safeArea.bottom - screenTop : window.windowHeight) * scale;
        const menuBottom = menu.width > 0 && menu.height > 0 ? (menu.bottom - screenTop) * scale : this.safeTop;
        this.settingsY = Math.max(this.safeTop + 64, menuBottom + 10);
        this.resourcesY = this.settingsY + 70;
        this.mapTop = this.resourcesY + 123;
        // 操作区沿用242高；地图按战场68%、居民区32%分配，进一步收紧居民区高度。
        // 战场上限700、居民区至少260逻辑像素，保持短屏站点可走；仅调整显示区域，不改逻辑塔位/射程。
        this.footerTop = this.safeBottom - 242;
        const mapHeight = this.footerTop - this.mapTop;
        const battleHeight = Math.min(700, mapHeight - 260, Math.max(440, mapHeight * .68));
        this.gateY = this.mapTop + battleHeight;
        // 成人64～68（原56）；短屏也保留可辨识尺寸，长屏不无限放大。
        this.personScale = Math.min(68, 64 + Math.max(0, this.footerTop - this.gateY - 300) / 40) / 56;
    }
    worldY(y: number): number {
        return y <= 830 ? this.mapTop + (y - 246) / 584 * (this.gateY - this.mapTop)
            : this.gateY + (y - 830) / 208 * (this.footerTop - this.gateY);
    }
    /** 换窗口时把现有行人位置转换回基准地图，随后映射到新区域；不重建游戏状态。 */
    referenceY(y: number): number {
        return y <= this.gateY ? 246 + (y - this.mapTop) / (this.gateY - this.mapTop) * 584
            : 830 + (y - this.gateY) / (this.footerTop - this.gateY) * 208;
    }
}
