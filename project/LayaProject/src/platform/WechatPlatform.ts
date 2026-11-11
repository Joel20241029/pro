import { StoragePort } from "../storage/SaveStore";
/** 精简声明仅列本游戏直接使用的微信 API；依据官方 minigame-api-typings。没有浏览器兼容分支。 */
declare const wx: {
    getStorageInfoSync(): { keys: string[] };
    getStorageSync(key: string): unknown;
    setStorageSync(key: string, value: string): void;
    getWindowInfo(): { windowWidth: number; windowHeight: number; safeArea: { top: number; bottom: number; left: number; right: number } };
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
    readonly window = wx.getWindowInfo();
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
    postRanking(message: object): void {
        try { wx.getOpenDataContext().postMessage(message); }
        catch (error) { console.error("[好友榜] 开放域消息发送失败", error); }
    }
    /** 点击排行榜时直接请求微信原生授权；不再提供单独权限按钮或主动跳转设置页。 */
    authorizeRanking(isCurrent: () => boolean, done: (error: string | null) => void) {
        const fail = (error: { errMsg: string }) => {
            console.warn("[好友榜] 授权未完成", error.errMsg);
            done(error.errMsg.includes(PRIVACY_DECLARATION_ERROR) ? "好友榜暂未开放，可继续守村" : "朋友信息未授权，可在微信设置中开启");
        };
        const request = () => {
            if (!isCurrent()) return;
            try {
                wx.authorize({ scope: FRIEND_SCOPE, success: () => done(null), fail });
            } catch (error) { console.error("[好友榜] 权限接口异常", error); done("无法打开朋友授权，请稍后重试"); }
        };
        try { wx.requirePrivacyAuthorize({ success: request, fail: error => { console.warn("[好友榜] 隐私授权未完成", error.errMsg); done("隐私授权未完成，可关闭榜单继续单机游玩"); } }); }
        catch (error) { console.error("[好友榜] 隐私接口异常", error); done("无法完成隐私授权，请稍后重试"); }
    }
}
