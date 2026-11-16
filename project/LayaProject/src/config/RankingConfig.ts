/** 微信官方开放域 screenCanvas 模式（基础库 3.6.6 起）；全局单例首次初始化后不可切换。 */
export const RANKING_CANVAS = {
    mode: "screenCanvas", minimumSdk: [3, 6, 6],
    // 与既有开放域 render.js 的 600×680 排版一致；显示缩放只改 style，不清空画布。
    width: 600, height: 680,
    // 沿用官方隐藏示例：缩成 1px 并移出屏幕，避免覆盖主场景或拦截触摸。
    hiddenSize: "1px", hiddenPosition: "-100px",
    // 打开后两秒观察原生定位，仅用于排障；不是超时或重试阈值。
    sampleDelay: 2000,
    // 用户确认的旧微信处理：提示升级，保留本地进度，不回退 Laya 绘制。
    unsupportedText: "请升级微信后使用排行榜",
    // 沿用好友榜失败后手动关闭重开的处理，不自动重试。
    unavailableText: "好友榜暂时无法打开，请关闭后重试"
} as const;

/** 启动入口与运行端共用的数字版本比较；保持无外部依赖，构建插件会将函数原样写入原生启动段。 */
export function supportsNativeRankingSdk(version: string | undefined, minimum: readonly number[]): boolean {
    if (!version || !/^\d+\.\d+\.\d+$/.test(version)) return false;
    const parts = version.split(".").map(Number);
    const difference = parts.findIndex((part, i) => part !== minimum[i]);
    return difference < 0 || parts[difference] > minimum[difference];
}
