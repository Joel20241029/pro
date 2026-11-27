import { VillagerQuality } from "../config/VillagerQuality";
import { SpriteFrames } from "./SpriteFrames";

/** 第三版动效稿以每秒0.95圈为基准；各品质只改变踏板、送布、手轮的表现速度。 */
const SEWING_SPEED: Record<VillagerQuality, number> = { COMMON: 1, ELITE: 1.2, HERO: 1.45, LEGENDARY: 1.7 };
/** 1254px工位原稿内的手轮轴心和内轮半径。外轮固定，内轮在椭圆投影内自转。 */
const RIG = { source: 1254, wheelX: 949, wheelY: 659, radiusX: 67, radiusY: 81,
    frames: 8, cyclesPerSecond: .95, headBob: 4.2, smilePeriod: 4.5, smileSeconds: .42 } as const;

/** 各外观复用踏板、双手、针杆和布料的八张局部动作层，头部和内轮单独变换。 */
export class SewingVisual {
    readonly parts = new Laya.Sprite();
    private motion = this.parts.addChild(new Laya.Sprite());
    private head = this.parts.addChild(new Laya.Sprite());
    private wheelPlane = this.parts.addChild(new Laya.Sprite());
    private wheel = this.wheelPlane.addChild(new Laya.Sprite());
    constructor(parent: Laya.Sprite, private art: SpriteFrames) {
        parent.addChild(this.parts);
        this.parts.name = "SewingMachineParts";
        for (const n of [this.parts, this.motion, this.head, this.wheelPlane, this.wheel]) n.mouseEnabled = false;
        this.wheel.texture = art.get("sew_wheel");
        this.wheel.size(2, 2).pivot(1, 1);
        this.wheelPlane.rotation = .075 * 180 / Math.PI;
    }
    draw(model: string, quality: VillagerQuality, seconds: number, sequence: number, size: number) {
        const cycle = seconds * RIG.cyclesPerSecond * SEWING_SPEED[quality] + sequence * .31;
        const phase = cycle * Math.PI * 2;
        const happy = (seconds + sequence * .53) % RIG.smilePeriod < RIG.smileSeconds;
        this.parts.visible = true;
        this.motion.texture = this.art.get("sew_motion_" + (Math.floor(cycle * RIG.frames) % RIG.frames));
        this.motion.size(size, size);
        this.head.texture = this.art.get("sew_" + model + (happy ? "_smile" : ""));
        this.head.size(size, size).pos(0, (1 - Math.cos(phase)) * .5 * RIG.headBob * size / RIG.source);
        const u = size / RIG.source;
        this.wheelPlane.pos(RIG.wheelX * u, RIG.wheelY * u).scale(RIG.radiusX * u, RIG.radiusY * u);
        this.wheel.rotation = (phase * .72 + .14 * Math.sin(phase)) * 180 / Math.PI % 360;
    }
}
