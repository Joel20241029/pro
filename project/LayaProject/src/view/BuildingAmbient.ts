import { SpriteFrames } from "./SpriteFrames";

const GATE_DOOR_CLIP = "motion_gate_doors";
const SAW_CLIP = "motion_logging_saw";
const FROST_IDLE_CLIP = "motion_slow_idle";

/** Local clips only replace the sprite attached to the moving component. */
export class BuildingAmbient {
    private time = 0;
    private night = false;
    private gateElapsed: number | null = null;
    private nodes: { node: Laya.Sprite; clip: string }[] = [];
    constructor(private readonly art: SpriteFrames) {}
    clear() { this.nodes.length = 0; }
    reset() { this.time = 0; this.night = false; this.gateElapsed = null; }
    bind(node: Laya.Sprite) {
        const clip = node.name === "GateDoors" ? GATE_DOOR_CLIP :
            node.name.startsWith("Loop:") ? node.name.slice("Loop:".length) : null;
        if (clip) this.nodes.push({ node, clip });
    }
    advance(delta: number, night: boolean, working: boolean) {
        this.time += delta;
        if (this.night && !night) this.gateElapsed = 0;
        this.night = night;
        if (night) this.gateElapsed = null;
        for (const { node, clip } of this.nodes) {
            if (clip === GATE_DOOR_CLIP) {
                const doors = this.art.animation(clip);
                const openTime = (doors.frameIds.length - 1) / (2 * doors.fps);
                if (working && !night) {
                    // 局部帧前半展开、后半合拢。有人通过时停在全开帧，连续来人从当前开度接续。
                    if (this.gateElapsed === null) this.gateElapsed = 0;
                    if (this.gateElapsed > openTime)
                        this.gateElapsed = Math.max(0, 2 * openTime - this.gateElapsed);
                }
                const index = this.gateElapsed === null ? -1 : Math.floor(this.gateElapsed * doors.fps);
                const frame = index < 0 ? doors.restFrame : doors.frameIds[index] ?? doors.restFrame;
                node.texture = this.art.get(frame);
                if (index >= doors.frameIds.length) this.gateElapsed = null;
                if (this.gateElapsed !== null) this.gateElapsed = working && !night ?
                    Math.min(openTime, this.gateElapsed + delta) : this.gateElapsed + delta;
            } else {
                node.texture = this.art.get(this.art.frameId(clip, this.time, clip !== SAW_CLIP || working));
            }
        }
    }
    showFrostIdle(visible: boolean) {
        for (const { node, clip } of this.nodes)
            if (clip === FROST_IDLE_CLIP) node.visible = visible;
    }
}
