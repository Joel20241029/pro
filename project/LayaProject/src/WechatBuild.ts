import { RANKING_CANVAS, supportsNativeRankingSdk } from "./config/RankingConfig";
/** 构建插件在 Node 进程运行，fs 仅用于修改已生成的启动入口，不进入游戏包。 */
declare function require(name: "fs"): { readFileSync(path: string, encoding: "utf8"): string; writeFileSync(path: string, value: string): void };
/** 仅在编辑器构建进程运行。开放域由项目制作源维护，禁止打入 IDE 的示例头像与假榜模板。
 * Laya 3.4 默认保留旧开放域目录；此项目改为每次按制作源重建，避免旧示例文件残留。
 * API 依据 engine/types/editor-env.d.ts 与官方插件开发文档；负优先级在微信内置设置后执行。
 */
@IEditorEnv.regBuildPlugin("wxgame", -100)
export class WechatBuild implements IEditorEnv.IBuildPlugin {
    onSetup(task: IEditorEnv.IBuildTask) {
        task.config.keepFilesDuringCleaning = task.config.keepFilesDuringCleaning.filter(path => path !== "openDataContext");
        task.config.ignoreFilesInBuildTemplate.push("openDataContext/avatar.png", "openDataContext/render/**/*");
    }
    onCreateManifest(task: IEditorEnv.IBuildTask) {
        const fs = require("fs"), path = `${task.destPath}/game.js`;
        const entry = fs.readFileSync(path, "utf8");
        // 原生模式必须先于 weapp-adapter，不能等主场景创建后再选。仅添加启动段，保留引擎自动生成的库与分包入口。
        const marker = "// daidai-native-ranking-startup\n";
        if (entry.startsWith(marker)) return;
        if (!entry.startsWith('require("weapp-adapter.js");')) throw new Error("微信启动模板已变化，请重新核对原生排行榜初始化顺序");
        const policy = JSON.stringify(RANKING_CANVAS);
        const startup = `(function () {
    const policy = ${policy};
    const supported = ${supportsNativeRankingSdk.toString()};
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
})();\n`;
        fs.writeFileSync(path, marker + startup + entry);
    }
}
