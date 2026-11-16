// daidai-native-ranking-startup
(function () {
    const policy = {"mode":"screenCanvas","minimumSdk":[3,6,6],"width":600,"height":680,"hiddenSize":"1px","hiddenPosition":"-100px","sampleDelay":2000,"unsupportedText":"请升级微信后使用排行榜","unavailableText":"好友榜暂时无法打开，请关闭后重试"};
    const supported = function supportsNativeRankingSdk(version, minimum) {
    if (!version || !/^\d+\.\d+\.\d+$/.test(version)) return false;
    const parts = version.split(".").map(Number);
    const difference = parts.findIndex((part, i) => part !== minimum[i]);
    return difference < 0 || parts[difference] > minimum[difference];
  };
    try {
        if (!supported(wx.getAppBaseInfo && wx.getAppBaseInfo().SDKVersion, policy.minimumSdk) || typeof wx.getOpenDataContext !== "function") return;
        const canvas = wx.getOpenDataContext({ sharedCanvasMode: policy.mode }).canvas;
        if (!canvas.style) return;
        canvas.style.width = policy.hiddenSize; canvas.style.height = policy.hiddenSize;
        canvas.style.left = policy.hiddenPosition; canvas.style.top = policy.hiddenPosition;
    } catch (error) {
        // 初始化异常不阻止单机开村；打开榜单时由运行端记录错误并显示提示，不改成默认离屏模式。
        console.warn("[ranking-startup] 原生画布尚未就绪");
    }
})();
require("weapp-adapter.js");
//
//
//
require("libs/laya.core.js");
//
require("libs/laya.webgl_2D.js");
//
require("libs/laya.adapter-weixin.js");
//
//

//
require("js/bundle.js");
//
require("js/index.js");
