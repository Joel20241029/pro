import { StoragePort } from "../storage/SaveStore";
import { MenuBounds, WindowMetrics } from "../view/GameLayout";
import { SHARE } from "../config/ShareConfig";
import { RankingDiagnostics, RankingLogPlatform } from "./RankingDiagnostics";
import { RankingCanvasApi, WechatRankingCanvas } from "./WechatRankingCanvas";
/** 精简声明仅列本游戏直接使用的微信 API；依据官方 minigame-api-typings。没有浏览器兼容分支。 */
declare const wx: RankingLogPlatform & RankingCanvasApi & {
    getStorageInfoSync(): { keys: string[] };
    getStorageSync(key: string): unknown;
    setStorageSync(key: string, value: string): void;
    removeStorageSync(key: string): void;
    getWindowInfo(): WindowMetrics;
    getMenuButtonBoundingClientRect(): MenuBounds;
    onHide(listener: () => void): void; offHide(listener: () => void): void;
    onShow(listener: () => void): void; offShow(listener: () => void): void;
    onShareAppMessage(listener: () => { title: string; imageUrl: string }): void;
    offShareAppMessage(listener: () => { title: string; imageUrl: string }): void;
    showShareMenu(options: { withShareTicket: boolean; menus: string[]; fail(error: unknown): void }): void;
    getPrivacySetting?(options: { success(result: { needAuthorization: boolean; privacyContractName: string }): void; fail(error: unknown): void }): void;
    getSetting?(options: { success(result: { authSetting: Record<string, boolean> }): void; fail(error: unknown): void }): void;
    requirePrivacyAuthorize(options: { success(): void; fail(error: { errMsg: string }): void }): void;
    authorize(options: { scope: string; success(): void; fail(error: { errMsg: string }): void }): void;
};
/** 微信官方朋友信息权限；仅用户打开好友榜时请求，不用于个人成绩同步。 */
const FRIEND_SCOPE = "scope.WxFriendInteraction";
/** 微信 3.17.6 实测的隐私声明缺失错误；由开发者后台处理，不能误导玩家反复授权。 */
const PRIVACY_DECLARATION_ERROR = "please go to mp to announce your privacy usage";
export class WechatPlatform implements StoragePort {
    readonly rankingDiagnostics = new RankingDiagnostics(wx);
    readonly rankingCanvas = new WechatRankingCanvas(wx, this.rankingDiagnostics);
    get window() { return wx.getWindowInfo(); }
    get menu() { return wx.getMenuButtonBoundingClientRect(); }
    private notifiedBest = 0;
    private shareRegistered = false;
    /** 稳定引用用于精确解绑；每次返回新对象，微信侧修改不会污染下一次分享。 */
    private readonly shareMessage = () => ({ title: SHARE.title, imageUrl: SHARE.imageUrl });
    read(key: string): string | null {
        if (!wx.getStorageInfoSync().keys.includes(key)) return null;
        const value = wx.getStorageSync(key);
        if (typeof value !== "string") throw new Error("微信存储返回了非字符串内容，已保留原数据");
        return value;
    }
    write(key: string, value: string) { wx.setStorageSync(key, value); }
    remove(key: string) {
        if (wx.getStorageInfoSync().keys.includes(key)) wx.removeStorageSync(key);
    }
    bind(hide: () => void, show: () => void) {
        wx.onHide(hide); wx.onShow(show);
        if (this.shareRegistered) return;
        // 菜单分享在分包下载前注册；微信接口异常只记录，不阻断启动或自动重试。
        try {
            wx.onShareAppMessage(this.shareMessage);
            this.shareRegistered = true;
            wx.showShareMenu({ withShareTicket: false, menus: [SHARE.menu], fail: error => console.error("[分享] 启用微信分享菜单失败", error) });
        } catch (error) { console.error("[分享] 初始化微信菜单分享失败", error); }
    }
    unbind(hide: () => void, show: () => void) {
        try {
            if (this.shareRegistered) {
                wx.offShareAppMessage(this.shareMessage);
                this.shareRegistered = false;
            }
        } catch (error) { console.error("[分享] 解绑微信菜单分享失败", error); }
        wx.offHide(hide); wx.offShow(show);
    }
    /** 网络能力与本地提交隔离：同步失败保留本地纪录，重开榜单或产生新纪录再尝试，不逐帧重试。 */
    syncBestNight(bestNight: number) {
        if (bestNight <= this.notifiedBest) return;
        this.notifiedBest = bestNight;
        this.postRanking({ bestNight });
    }
    postRanking(message: object, request: string | null = null): void {
        try {
            this.rankingCanvas.context.postMessage(request ? { ...message, diagnosticRequest: request } : message);
            // 仅说明主域调用返回；不是开放域已绘制、成绩已上传或好友数据已读取的确认。
            const kind = "showRanking" in message ? "show" : "refreshRanking" in message ? "refresh" : "authorizationError" in message ? "authorization" : (message as { type?: string }).type === "close" ? "close" : "type" in message ? "viewport" : "score";
            this.rankingDiagnostics.record("message_returned", request, { message: kind });
        }
        catch (error) { this.rankingDiagnostics.failure("message_error", request, error); console.error("[好友榜] 开放域消息发送失败", error); }
    }
    /** 旁路观察：不等待、不触发授权、不读取好友信息；晚到的结果仍属于原请求，不写面板或游戏状态。 */
    inspectRankingAuthorization(request: string) {
        const trace = this.rankingDiagnostics;
        try {
            if (!wx.getPrivacySetting) trace.record("privacy_snapshot", request, { result: "unsupported" });
            else wx.getPrivacySetting({
                success: result => {
                    try {
                        // false 也可能表示后台尚未声明收集类型；不推断成已同意，不据此跳过原授权。
                        trace.record("privacy_snapshot", request, { result: "ok", needAuthorization: typeof result.needAuthorization === "boolean" ? result.needAuthorization : undefined, contractPresent: typeof result.privacyContractName === "string" && result.privacyContractName.length > 0 });
                    } catch (error) { trace.failure("privacy_snapshot", request, error); }
                },
                fail: error => trace.failure("privacy_snapshot", request, error)
            });
        } catch (error) { trace.failure("privacy_snapshot", request, error); }
        try {
            if (!wx.getSetting) trace.record("friend_snapshot", request, { result: "unsupported" });
            else wx.getSetting({
                success: result => {
                    try {
                        const value = result.authSetting[FRIEND_SCOPE];
                        trace.record("friend_snapshot", request, { result: "ok", friendState: value === true ? "granted" : value === false ? "denied" : "unset" });
                    } catch (error) { trace.failure("friend_snapshot", request, error); }
                },
                fail: error => trace.failure("friend_snapshot", request, error)
            });
        } catch (error) { trace.failure("friend_snapshot", request, error); }
    }
    /** 点击排行榜时直接请求微信原生授权；不再提供单独权限按钮或主动跳转设置页。 */
    authorizeRanking(isCurrent: () => boolean, done: (error: string | null) => void, requestId: string | null = null) {
        const fail = (error: { errMsg: string }) => {
            this.rankingDiagnostics.failure("friend_result", requestId, error);
            console.warn("[好友榜] 授权未完成", error.errMsg);
            done(error.errMsg.includes(PRIVACY_DECLARATION_ERROR) ? "好友榜暂未开放，可继续守村" : "朋友信息未授权，可在微信设置中开启");
        };
        const request = () => {
            if (!isCurrent()) { this.rankingDiagnostics.record("authorization_stale", requestId); return; }
            this.rankingDiagnostics.record("privacy_result", requestId, { result: "ok" });
            this.rankingDiagnostics.record("friend_start", requestId);
            try {
                wx.authorize({ scope: FRIEND_SCOPE, success: () => { this.rankingDiagnostics.record("friend_result", requestId, { result: "ok" }); done(null); }, fail });
            } catch (error) { this.rankingDiagnostics.failure("friend_result", requestId, error); console.error("[好友榜] 权限接口异常", error); done("无法打开朋友授权，请稍后重试"); }
        };
        this.rankingDiagnostics.record("privacy_start", requestId);
        try { wx.requirePrivacyAuthorize({ success: request, fail: error => { this.rankingDiagnostics.failure("privacy_result", requestId, error); console.warn("[好友榜] 隐私授权未完成", error.errMsg); done("隐私授权未完成，可关闭榜单继续单机游玩"); } }); }
        catch (error) { this.rankingDiagnostics.failure("privacy_result", requestId, error); console.error("[好友榜] 隐私接口异常", error); done("无法完成隐私授权，请稍后重试"); }
    }
}
