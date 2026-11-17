import { ResourceStage } from "../config/ResourceConfig";
import { REMOTE_RESOURCE_MANIFEST } from "../config/RemoteResourceManifest";

interface RemoteFile { stage: ResourceStage; source: keyof typeof REMOTE_RESOURCE_MANIFEST.sources; bytes: number; sha256: string; }
interface DownloadError { errMsg: string; }
interface LocalImage { src: string; onload: () => void; onerror: (error: unknown) => void; }
interface CacheRelease { revision: string; files: string[]; }
interface FileSystem {
    accessSync(path: string): void;
    mkdirSync(path: string, recursive: boolean): void;
    readFileSync(path: string, encoding: "utf8"): string;
    writeFileSync(path: string, data: string, encoding: "utf8"): void;
    readdirSync(path: string): string[];
    unlinkSync(path: string): void;
    renameSync(from: string, to: string): void;
    getFileInfo(options: {
        filePath: string; digestAlgorithm: "sha256";
        success(info: { size: number; digest: string }): void; fail(error: DownloadError): void;
    }): void;
}
declare const wx: {
    env: { USER_DATA_PATH: string };
    getFileSystemManager(): FileSystem;
    createImage(): LocalImage;
    downloadFile(options: {
        url: string; filePath: string;
        success(result: { statusCode: number }): void; fail(error: DownloadError): void;
    }): { onProgressUpdate(callback: (result: { totalBytesWritten: number }) => void): void };
};

/** 沿用已验证的三文件并发，七类资源共享阶段队列。 */
const FILES_PER_BATCH = 3;
/** 新旧缓存目录隔离，避免 1.0.38 的按提交清理影响新版本。 */
const CACHE_DIRECTORY = "daidai-versioned-res";
/** 只清理这个目录里最近使用的两个清单都未引用的素材。 */
const RECENT_RELEASES = 2;

export class WechatRemoteResources {
    private readonly fs = wx.getFileSystemManager();
    private readonly cache = wx.env.USER_DATA_PATH + "/" + CACHE_DIRECTORY;
    private readonly files: Readonly<Record<string, RemoteFile>> = REMOTE_RESOURCE_MANIFEST.files;
    private readonly pending = new Map<string, Promise<void>>();

    path(file: string) {
        const item = this.files[file];
        if (!item) throw new Error("清单未声明素材：" + file);
        return this.cache + "/" + item.sha256 + file.slice(file.lastIndexOf("."));
    }

    /** IDE 的 http://usr 也走本地文件系统，避免解析同名清单时进入 HTTP 缓存。 */
    async load(url: string, options: Laya.ILoadOptions) {
        const cached = !options.ignoreCache && Laya.loader.getRes(url, options.type);
        if (cached) return cached;
        let data: unknown;
        if (options.type === Laya.Loader.IMAGE) {
            data = await new Promise<LocalImage>((resolve, reject) => {
                const image = wx.createImage();
                image.onload = () => resolve(image);
                image.onerror = () => reject(new Error("图集读取失败：" + url));
                image.src = url;
            });
        } else if (options.type === Laya.Loader.JSON) {
            data = JSON.parse(await Laya.PAL.fs.readFile(url, "utf8") as string);
        } else {
            data = await Laya.PAL.fs.readFile(this.physicalPath(url));
        }
        const key = Laya.URL.formatURL(url);
        Laya.Loader.preLoadedMap[key] = data;
        try { return await Laya.loader.load(url, options); }
        finally { delete Laya.Loader.preLoadedMap[key]; }
    }

    async prepare(stage: ResourceStage, progress: (value: number) => void) {
        if (!this.exists(this.cache)) this.fs.mkdirSync(this.cache, true);
        const entries = Object.entries(this.files).filter(([, file]) => file.stage === stage);
        if (!entries.length) throw new Error("缺少阶段资源：" + stage);
        const total = entries.reduce((sum, [, file]) => sum + file.bytes, 0);
        const transferred = await Promise.all(entries.map(async ([name, file]) =>
            await this.verified(this.physicalPath(this.path(name)), file) ? file.bytes : 0
        ));
        const report = () => progress(transferred.reduce((sum, loaded) => sum + loaded, 0) / total);
        report();
        const missing = entries.map(([name, file], index) => ({ name, file, index })).filter(({ index }) => !transferred[index]);
        for (let start = 0; start < missing.length; start += FILES_PER_BATCH) {
            const errors = await Promise.all(missing.slice(start, start + FILES_PER_BATCH).map(async ({ name, file, index }) => {
                try {
                    await this.ensureFile(name, file, bytes => {
                        if (!Number.isFinite(bytes)) return;
                        transferred[index] = Math.max(transferred[index], Math.min(file.bytes, bytes));
                        report();
                    });
                    transferred[index] = file.bytes;
                    report();
                    return undefined;
                } catch (error) {
                    transferred[index] = 0;
                    report();
                    return error;
                }
            }));
            // 已发请求都结束后，界面才开放重试。
            const failure = errors.find(error => error !== undefined);
            if (failure !== undefined) throw failure;
        }
    }

    /** 完整进入村庄后提交缓存引用，再回收其他版本留下的对象。 */
    rememberRelease() {
        const index = this.cache + "/releases.json";
        try {
            const previous: CacheRelease[] = this.exists(index) ? JSON.parse(this.fs.readFileSync(index, "utf8")) : [];
            const files = [...new Set(Object.keys(this.files).map(name => this.physicalPath(this.path(name)).split("/").pop()!))];
            const current = { revision: REMOTE_RESOURCE_MANIFEST.revision, files };
            const recent = [current, ...previous.filter(item => item.revision !== current.revision)].slice(0, RECENT_RELEASES);
            this.fs.writeFileSync(index + ".partial", JSON.stringify(recent), "utf8");
            this.fs.renameSync(index + ".partial", index);
            const keep = new Set<string>();
            for (const item of recent) for (const file of item.files) keep.add(file);
            for (const file of this.fs.readdirSync(this.cache)) {
                if (/^[a-f0-9]{64}\.(png|json|mp3|mc\.bin)$/.test(file) && !keep.has(file))
                    this.fs.unlinkSync(this.cache + "/" + file);
            }
        } catch (error) {
            console.warn("[资源缓存整理]", error);
        }
    }

    private exists(path: string) {
        try { this.fs.accessSync(path); return true; }
        catch { return false; }
    }

    private verified(path: string, file: RemoteFile) {
        return new Promise<boolean>(resolve => this.fs.getFileInfo({
            filePath: path, digestAlgorithm: "sha256",
            success: info => resolve(info.size === file.bytes && info.digest === file.sha256),
            fail: () => resolve(false)
        }));
    }

    // Laya 用逻辑 .mc 选解码器，微信缓存用实际 .mc.bin 文件。
    private physicalPath(url: string) { return url.endsWith(".mc") ? url + ".bin" : url; }

    private async ensureFile(name: string, file: RemoteFile, progress: (bytes: number) => void) {
        const target = this.physicalPath(this.path(name));
        if (await this.verified(target, file)) return;
        const running = this.pending.get(target);
        if (running) return running;
        const task = this.fetch(name, target, file, progress);
        this.pending.set(target, task);
        try { await task; }
        finally { this.pending.delete(target); }
    }

    private async fetch(name: string, target: string, file: RemoteFile, progress: (bytes: number) => void) {
        const staging = target + ".partial";
        if (this.exists(staging)) this.fs.unlinkSync(staging);
        const url = REMOTE_RESOURCE_MANIFEST.sources[file.source] + name;
        try {
            await new Promise<void>((resolve, reject) => {
                const task = wx.downloadFile({
                    url, filePath: staging,
                    success: result => result.statusCode === 200 ? resolve() : reject(new Error(name + " HTTP " + result.statusCode)),
                    fail: error => reject(new Error(name + " " + error.errMsg))
                });
                task.onProgressUpdate(result => progress(result.totalBytesWritten));
            });
            if (!await this.verified(staging, file)) throw new Error(name + " 文件校验失败");
            if (this.exists(target)) this.fs.unlinkSync(target);
            this.fs.renameSync(staging, target);
        } finally {
            if (this.exists(staging)) this.fs.unlinkSync(staging);
        }
    }
}
