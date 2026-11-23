import { NATIVE_RESOURCE_ROOTS } from "./config/ResourceConfig";
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
        const projectPath = `${task.destPath}/project.config.json`;
        const project = JSON.parse(fs.readFileSync(projectPath, "utf8"));
        // 发布包保留微信开发者工具的域名校验。
        project.setting.urlCheck = true;
        fs.writeFileSync(projectPath, JSON.stringify(project, null, 2) + "\n");
        const game = JSON.parse(fs.readFileSync(`${task.destPath}/game.json`, "utf8"));
        const roots: string[] = (game.subpackages ?? game.subPackages ?? []).map((pack: { root: string }) => pack.root.replace(/\/$/, ""));
        const nativeRoots: readonly string[] = Object.values(NATIVE_RESOURCE_ROOTS);
        if (roots.length !== nativeRoots.length || !nativeRoots.every(root => roots.includes(root)))
            throw new Error("村庄与守夜资源包必须一同声明，请使用 build-wechat-delivery.mjs 构建");
        const entry = fs.readFileSync(path, "utf8");
        // 微信原生榜单在主画布创建后取用一次，早于适配器改写画布原型。
        const marker = "// daidai-native-ranking-startup\n";
        if (entry.startsWith(marker)) return;
        const adapter = 'require("weapp-adapter.js");';
        if (!entry.startsWith(adapter)) throw new Error("微信启动模板已变化，请重新核对原生排行榜初始化顺序");
        const policy = JSON.stringify(RANKING_CANVAS);
        const startup = `(function () {
    const policy = ${policy};
    const supported = ${supportsNativeRankingSdk.toString()};
    const createCanvas = wx.createCanvas;
    function capture(mainCanvas) {
        const version = wx.getAppBaseInfo && wx.getAppBaseInfo().SDKVersion;
        if (!version) return { reason: "sdk_version_missing" };
        if (!supported(version, policy.minimumSdk))
            return { reason: /^\\d+\\.\\d+\\.\\d+$/.test(version) ? "sdk_below_minimum" : "sdk_version_rejected" };
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
    try { ${adapter} }
    finally {
        if (wx.createCanvas === firstCanvas) wx.createCanvas = createCanvas;
    }
    const captured = GameGlobal.daidaiNativeRanking;
    if (captured.canvas) {
        try { captured.styleRetainedAfterAdapter = captured.canvas.style === captured.style; }
        catch (_) { captured.styleRetainedAfterAdapter = false; }
    }
})();\n`;
        fs.writeFileSync(path, marker + startup + entry.slice(adapter.length));
    }
}
