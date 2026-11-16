import { StoragePort } from "../storage/SaveStore";
import { MenuBounds, WindowMetrics } from "../view/GameLayout";
import { RankingDiagnostics, RankingLogPlatform } from "./RankingDiagnostics";
/** 精简声明仅列本游戏直接使用的微信 API；依据官方 minigame-api-typings。没有浏览器兼容分支。 */
declare const wx: RankingLogPlatform & {
    getStorageInfoSync(): { keys: string[] };
    getStorageSync(key: string): unknown;
    setStorageSync(key: string, value: string): void;
    getWindowInfo(): WindowMetrics;
    getMenuButtonBoundingClientRect(): MenuBounds;
    onHide(listener: () => void): void; offHide(listener: () => void): void;
    onShow(listener: () => void): void; offShow(listener: () => void): void;
    getOpenDataContext(): { postMessage(message: object): void };
    requirePrivacyAuthorize(options: { success(): void; fail(error: { errMsg: string }): void }): void;
    authorize(options: { scope: string; success(): void; fail(error: { errMsg: string }): void }): void;
};
/** 微信官方朋友信息权限；仅用户打开好友榜时请求，不用于个人成绩同步。 */
const FRIEND_SCOPE = "scope.WxFriendInteraction";
/** 微信 3.17.6 实测的隐私声明缺失错误；由开发者后台处理，不能误导玩家反复授权。 */
const PRIVACY_DECLARATION_ERROR = "please go to mp to announce your privacy usage";
export class WechatPlatform implements StoragePort {
    readonly rankingDiagnostics = new RankingDiagnostics(wx);
    get window() { return wx.getWindowInfo(); }
    get menu() { return wx.getMenuButtonBoundingClientRect(); }
    private notifiedBest = 0;
    read(key: string): string | null {
        if (!wx.getStorageInfoSync().keys.includes(key)) return null;
        const value = wx.getStorageSync(key);
        if (typeof value !== "string") throw new Error("微信存储返回了非字符串内容，已保留原数据");
        return value;
    }
    write(key: string, value: string) { wx.setStorageSync(key, value); }
    bind(hide: () => void, show: () => void) { wx.onHide(hide); wx.onShow(show); }
    unbind(hide: () => void, show: () => void) { wx.offHide(hide); wx.offShow(show); }
    /** 网络能力与本地提交隔离：同步失败保留本地纪录，重开榜单或产生新纪录再尝试，不逐帧重试。 */
    syncBestNight(bestNight: number) {
        if (bestNight <= this.notifiedBest) return;
        this.notifiedBest = bestNight;
        this.postRanking({ bestNight });
    }
    postRanking(message: object, request: string | null = null): void {
        try {
            wx.getOpenDataContext().postMessage(message);
            // 仅说明主域调用返回；不是开放域已绘制、成绩已上传或好友数据已读取的确认。
            const kind = "showRanking" in message ? "show" : "refreshRanking" in message ? "refresh" : "authorizationError" in message ? "authorization" : (message as { type?: string }).type === "close" ? "close" : "type" in message ? "viewport" : "score";
            this.rankingDiagnostics.record("message_returned", request, { message: kind });
        }
        catch (error) { this.rankingDiagnostics.failure("message_error", request, error); console.error("[好友榜] 开放域消息发送失败", error); }
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
