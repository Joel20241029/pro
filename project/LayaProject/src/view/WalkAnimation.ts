import { SpriteFrames } from "./SpriteFrames";
import { VillagerPose } from "./VillagerMotion";

/** 行走相位跟随实际路程，和劳动计时分离；保留规范化周期，换屏/成长/精英缩放不跳帧。
 * stridePixels 为离线模型一整轮左右脚的侧向步幅；四向共享节奏，避免俯视压缩造成前后向碎步。
 * 倍速已经包含在路程里，不能在此再乘一次。 */
export class WalkAnimation {
    private cycles = new Map<string, { distance: number; phase: number }>();
    constructor(private art: SpriteFrames) {}
    frame(pose: Readonly<VillagerPose>, clipId: string, displayWidth: number) {
        const clip = this.art.animation(clipId);
        if (!(clip.stridePixels > 0)) throw new Error("行走动画缺少完整周期步幅：" + clipId);
        let cycle = this.cycles.get(pose.id);
        if (!cycle) { cycle = { distance: 0, phase: 0 }; this.cycles.set(pose.id, cycle); }
        const moved = pose.walkDistance - cycle.distance;
        if (moved < 0) throw new Error("行走累计路程倒退：" + pose.id);
        cycle.phase = (cycle.phase + moved / (clip.stridePixels / clip.canvas.w * displayWidth)) % 1;
        cycle.distance = pose.walkDistance;
        return pose.walking ? clip.frameIds[Math.floor(cycle.phase * clip.frameIds.length)] : clip.restFrame;
    }
    retain(ids: ReadonlySet<string>) { for (const id of this.cycles.keys()) if (!ids.has(id)) this.cycles.delete(id); }
}
