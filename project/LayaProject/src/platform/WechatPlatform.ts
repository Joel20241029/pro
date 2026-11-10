import { StoragePort } from "../storage/SaveStore";
/** 精简声明仅列本游戏直接使用的微信 API；依据官方 minigame-api-typings。没有浏览器兼容分支。 */
declare const wx: {
    getStorageInfoSync(): { keys: string[] };
    getStorageSync(key: string): unknown;
    setStorageSync(key: string, value: string): void;
    getWindowInfo(): { windowWidth: number; windowHeight: number; safeArea: { top: number; bottom: number; left: number; right: number } };
    onHide(listener: () => void): void; offHide(listener: () => void): void;
    onShow(listener: () => void): void; offShow(listener: () => void): void;
};
export class WechatPlatform implements StoragePort {
    readonly window = wx.getWindowInfo();
    read(key: string): string | null {
        if (!wx.getStorageInfoSync().keys.includes(key)) return null;
        const value = wx.getStorageSync(key);
        if (typeof value !== "string") throw new Error("微信存储返回了非字符串内容，已保留原数据");
        return value;
    }
    write(key: string, value: string) { wx.setStorageSync(key, value); }
    bind(hide: () => void, show: () => void) { wx.onHide(hide); wx.onShow(show); }
    unbind(hide: () => void, show: () => void) { wx.offHide(hide); wx.offShow(show); }
}
