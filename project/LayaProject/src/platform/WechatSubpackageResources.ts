import { NATIVE_RESOURCE_ROOTS, ResourceStage } from "../config/ResourceConfig";
import { AssetAttempt, AssetDiagnostics } from "./AssetDiagnostics";
import type { RankingLogPlatform } from "./RankingDiagnostics";
import { UnsupportedResourceDevice } from "./ResourcePreparation";

declare const wx: RankingLogPlatform;

/** 资源阶段与帧表沿用原合同，微信原生包只用 ASTC 图页。 */
export class WechatSubpackageResources {
    readonly diagnostics = new AssetDiagnostics(wx);
    private readonly loaded = new Set<ResourceStage>();

    async prepare(stage: ResourceStage, progress: (ratio: number) => void, attempt?: AssetAttempt) {
        if (!Laya.LayaGL.renderEngine.getCapable(Laya.RenderCapable.COMPRESS_TEXTURE_ASTC))
            throw new UnsupportedResourceDevice("当前设备不支持 ASTC 纹理");
        if (this.loaded.has(stage)) { progress(1); return; }
        const root = NATIVE_RESOURCE_ROOTS[stage];
        if (attempt) this.diagnostics.record(attempt, "subpackage", { root });
        progress(0);
        let high = 0;
        // 微信回报百分比。随后读取 fileconfig 可能回报较小的归一化进度，忽略回退。
        const success = await Laya.loader.loadPackage(root, percent => {
            if (!Number.isFinite(percent)) return;
            const next = Math.min(1, percent / 100);
            if (next > high) progress(high = next);
        });
        if (!success) throw new Error("微信分包加载失败：" + root);
        this.loaded.add(stage);
        progress(1);
    }

    async load(stage: ResourceStage, file: string, options: Laya.ILoadOptions) {
        const image = options.type === Laya.Loader.IMAGE;
        const relative = image ? file.replace(/\.(png|jpg)$/, ".ktx") : file;
        const url = NATIVE_RESOURCE_ROOTS[stage] + "/" + relative;
        if (options.type === Laya.Loader.JSON) {
            const cached = !options.ignoreCache && Laya.loader.getRes(url, options.type);
            if (cached) return cached;
            // 元数据以 .bin 打进原生分包，内容是 UTF-8 JSON，直接读取包内文件名。
            const text = await Laya.PAL.fs.readFile(url, "utf8") as string;
            const key = Laya.URL.formatURL(url);
            Laya.Loader.preLoadedMap[key] = JSON.parse(text);
            try { return await Laya.loader.load(url, options); }
            finally { delete Laya.Loader.preLoadedMap[key]; }
        }
        // KTX 编码前已预乘 alpha，采样范围限制在图页边界。
        return Laya.loader.load(url, image ? { ...options, propertyParams: {
            premultiplyAlpha: false, wrapModeU: Laya.WrapMode.Clamp, wrapModeV: Laya.WrapMode.Clamp
        } } : options);
    }
}
