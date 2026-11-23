// daidai-native-ranking-startup
(function () {
    const policy = {"mode":"screenCanvas","minimumSdk":[3,6,6],"width":600,"height":680,"hiddenSize":"1px","hiddenPosition":"-100px","sampleDelay":2000,"unsupportedText":"请升级微信后使用排行榜","unavailableText":"好友榜暂时无法打开，请关闭后重试"};
    const supported = function supportsNativeRankingSdk(version, minimum) {
    if (!version || !/^\d+\.\d+\.\d+$/.test(version)) return false;
    const parts = version.split(".").map(Number);
    const difference = parts.findIndex((part, i) => part !== minimum[i]);
    return difference < 0 || parts[difference] > minimum[difference];
  };
    const createCanvas = wx.createCanvas;
    function capture(mainCanvas) {
        const version = wx.getAppBaseInfo && wx.getAppBaseInfo().SDKVersion;
        if (!version) return { reason: "sdk_version_missing" };
        if (!supported(version, policy.minimumSdk))
            return { reason: /^\d+\.\d+\.\d+$/.test(version) ? "sdk_below_minimum" : "sdk_version_rejected" };
        if (typeof wx.getOpenDataContext !== "function") return { reason: "open_data_api_missing" };
        const context = wx.getOpenDataContext({ sharedCanvasMode: policy.mode });
        const canvas = context && context.canvas;
        if (!canvas) return { reason: "canvas_missing" };
        if (canvas === mainCanvas) return { reason: "canvas_is_main" };
        const style = canvas.style;
        if (!style) return { reason: "canvas_style_missing" };
        style.width = policy.hiddenSize; style.height = policy.hiddenSize;
        style.left = policy.hiddenPosition; style.top = policy.hiddenPosition;
        canvas.width = policy.width; canvas.height = policy.height;
        return { context, canvas, style };
    }
    GameGlobal.daidaiNativeRanking = { reason: "startup_hook_unavailable" };
    function firstCanvas() {
        // 恢复工厂后再取榜单，避免榜单初始化调用工厂时进入包装。
        wx.createCanvas = createCanvas;
        const mainCanvas = createCanvas.apply(this, arguments);
        try { GameGlobal.daidaiNativeRanking = capture(mainCanvas); }
        catch (_) { GameGlobal.daidaiNativeRanking = { reason: "startup_capture_error" }; }
        return mainCanvas;
    }
    try {
        if (typeof createCanvas === "function") wx.createCanvas = firstCanvas;
    } catch (_) { /* 无法安装钩子时仍运行原适配器，并保留失败原因。 */ }
    try { require("weapp-adapter.js"); }
    finally {
        if (wx.createCanvas === firstCanvas) wx.createCanvas = createCanvas;
    }
    const captured = GameGlobal.daidaiNativeRanking;
    if (captured.canvas) {
        try { captured.styleRetainedAfterAdapter = captured.canvas.style === captured.style; }
        catch (_) { captured.styleRetainedAfterAdapter = false; }
    }
})();

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
