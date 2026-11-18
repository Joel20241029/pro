import { RULE } from "../config/RuleConfig";
import type { GameState } from "../game/GameState";
import type { StoragePort } from "./SaveStore";

/** 本机声音和守夜倍速共用独立记录，新开村或清理村庄双槽时保留。 */
const KEY = "daidai_village.device_settings";
type Settings = GameState["settings"];

export class DeviceSettings {
    private current: Settings | null = null;
    constructor(private storage: StoragePort) {}

    resolve(previous: Settings): Settings {
        if (!this.current) {
            this.current = { ...previous };
            try {
                const raw = this.storage.read(KEY);
                if (raw !== null) {
                    const saved: Settings = JSON.parse(raw);
                    if (!saved || typeof saved.music !== "boolean" ||
                        (saved.speed !== RULE.minSpeed && saved.speed !== RULE.maxSpeed))
                        throw new Error("设备设置数据无效");
                    this.current = saved;
                }
            } catch (error) { console.warn("[设备设置] 使用存档中的有效设置", error); }
        }
        return { ...this.current };
    }

    write(settings: Settings) {
        const raw = JSON.stringify({ speed: settings.speed, music: settings.music });
        try {
            if (this.storage.read(KEY) !== raw) {
                try { this.storage.write(KEY, raw); }
                catch (error) {
                    // 微信可能抛错但已完成写入，读回相同字节才确认成功。
                    if (this.storage.read(KEY) !== raw) throw error;
                }
                if (this.storage.read(KEY) !== raw) throw new Error("设备设置读回不一致");
            }
        } catch (error) {
            console.warn("[设备设置] 保存失败", error);
            throw new Error("本次设置未能保存，请重试");
        }
        this.current = { ...settings };
    }
}
