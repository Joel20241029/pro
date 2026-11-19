import { SpriteFrames } from "./SpriteFrames";

// 日常动作使用表现秒，升级进度只在主体的现有升级动作期间加强部件。
const WINDOW = { cycle: 3.4, day: .22, night: .44, drift: .16, flare: .55 };
const WORK = { idleHz: .55, workHz: 2.3, swing: 5, stroke: 12, flourish: 16, speed: 5 };
const WHEEL = { water: 18, saw: 55, upgrade: 155 };
const CLOTH = { lantern: 5, banner: 4, upgrade: 13 };
export class BuildingAmbient {
    private time = 0;
    private nodes: { node: Laya.Sprite; frame?: string }[] = [];
    constructor(private readonly art: SpriteFrames) {}
    clear() { this.nodes.length = 0; }
    reset() { this.time = 0; }
    bind(node: Laya.Sprite, frame?: string) {
        if (node.name.startsWith("Ambient") || ["PorchLantern", "WaterWheel", "SawWheel", "GateBanner"].includes(node.name)) this.nodes.push({node, frame});
    }
    advance(delta: number, progress: number, night: boolean, working: boolean) {
        this.time += delta;
        const time = this.time;
        const pulse = Math.sin(Math.PI * progress);
        for (const {node, frame} of this.nodes) {
            switch (node.name) {
                case "AmbientWindow":
                    node.alpha = Math.min(1, (night ? WINDOW.night : WINDOW.day) + WINDOW.drift * Math.sin(time * 2 * Math.PI / WINDOW.cycle) + pulse * WINDOW.flare);
                    break;
                case "AmbientCrop0": case "AmbientCrop1": case "AmbientCrop2": case "AmbientCrop3": {
                    const plot = Number(node.name.slice(-1));
                    const clip = frame!.slice(0,-2);
                    node.texture = this.art.get(this.art.frameId(clip, time + plot * .24 + progress * 1.6));
                    break;
                }
                case "AmbientWorkTool":
                    node.rotation = Math.sin(time * 2 * Math.PI * (working ? WORK.workHz : WORK.idleHz) + pulse * WORK.speed) *
                        ((working ? WORK.stroke : WORK.swing) + pulse * WORK.flourish);
                    break;
                case "WaterWheel":
                    node.rotation = (node.rotation + delta * (WHEEL.water + pulse * WHEEL.upgrade)) % 360;
                    break;
                case "SawWheel":
                    node.rotation = (node.rotation + delta * ((working ? WHEEL.saw : 0) + pulse * WHEEL.upgrade)) % 360;
                    break;
                case "PorchLantern": case "GateBanner":
                    node.rotation = Math.sin(time * 2.4) * ((node.name === "PorchLantern" ? CLOTH.lantern : CLOTH.banner) + pulse * CLOTH.upgrade);
                    break;
            }
        }
    }
}
