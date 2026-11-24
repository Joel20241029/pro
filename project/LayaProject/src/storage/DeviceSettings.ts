import { RULE } from "../config/RuleConfig";
import type { GameState } from "../game/GameState";
import type { StoragePort } from "./SaveStore";

/** 本机声音独立保存，新开村时保留。沿用旧版记录格式以读取已有声音设置。 */
const KEY = "daidai_village.device_settings";
/** 完成过一次发射的操作记录属于设备，新开村不重新教。 */
const PATROL_LAUNCHED_KEY = "daidai_village.patrol_launched";
/** 城门连发首发独立于旋甩，只有实际扣弹后才完成教学；与已有首发记录同属设备。 */
const PATROL_RAPID_FIRED_KEY = "daidai_village.patrol_rapid_fired";
type Settings = GameState["settings"];

export class DeviceSettings {
    private current: Settings | null = null;
    private readonly firstShots = new Map<string, boolean>();
    constructor(private storage: StoragePort) {}

    get hasLaunchedPatrol() { return this.firstShotRecorded(PATROL_LAUNCHED_KEY); }
    get hasFiredPatrolRapid() { return this.firstShotRecorded(PATROL_RAPID_FIRED_KEY); }

    private firstShotRecorded(key: string) {
        if (!this.firstShots.has(key)) {
            try { this.firstShots.set(key, this.storage.read(key) === "1"); }
            catch (error) {
                this.firstShots.set(key, false);
                console.warn("[淡紫儿] 读取首发记录失败", error);
            }
        }
        return this.firstShots.get(key) === true;
    }

    markPatrolLaunched() { this.recordFirstShot(PATROL_LAUNCHED_KEY); }
    markPatrolRapidFired() { this.recordFirstShot(PATROL_RAPID_FIRED_KEY); }

    private recordFirstShot(key: string) {
        if (this.firstShotRecorded(key)) return;
        // 发射已经成功，设备标记写入失败时不反转战斗操作。
        this.firstShots.set(key, true);
        try { this.storage.write(key, "1"); }
        catch (error) { console.warn("[淡紫儿] 保存首发记录失败", error); }
    }

    resolve(previous: Settings): Settings {
        if (!this.current) {
            this.current = { speed: RULE.battleSpeed, music: previous.music };
            try {
                const raw = this.storage.read(KEY);
                if (raw !== null) {
                    const saved: Settings = JSON.parse(raw);
                    if (!saved || typeof saved.music !== "boolean" ||
                        (saved.speed !== RULE.legacySlowSpeed && saved.speed !== RULE.battleSpeed))
                        throw new Error("设备设置数据无效");
                    this.current = { speed: RULE.battleSpeed, music: saved.music };
                }
            } catch (error) { console.warn("[设备设置] 使用存档中的有效设置", error); }
        }
        return { ...this.current };
    }

    write(settings: Settings) {
        const current = { speed: RULE.battleSpeed, music: settings.music };
        const raw = JSON.stringify(current);
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
        this.current = current;
    }
}
