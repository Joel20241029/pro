import type { BattleSimulation, CombatFeedback } from "../game/BattleSimulation";
import type { GameLayout } from "./GameLayout";
import type { SpriteFrames } from "./SpriteFrames";
import type { WorldItem } from "./WorldInteraction";
import { HeroStroll } from "./HeroStroll";
import { HERO, SONGLEI } from "../config/HeroConfig";

type HeroStrike = Extract<CombatFeedback, { type: "heroHit" }>;
export const HERO_ACTOR_ID = HERO.actorId;
/** 智卓沿原巡村站点走动，保持与大王的右侧路线分开。 */
const STROLL = [{ x: 454, y: 950 }, { x: 467, y: 884 }, { x: 360, y: 854 }, { x: 305, y: 901 }, { x: 360, y: 968 }] as const;
/** 宋磊在村内左侧绕行，避开右侧大王和城门中线。 */
const SONGLEI_STROLL = [{ x: 268, y: 920 }, { x: 224, y: 975 }, { x: 331, y: 982 }, { x: 313, y: 917 }] as const;
const AIM = { UP: -Math.PI / 2, RIGHT: 0, DOWN: Math.PI / 2, LEFT: Math.PI } as const;
/** 地图显示尺寸和挥击余光按渲染像素及表现秒计算，伤害仍由战斗接触帧决定。 */
const ART = {
    size: 127.5, armY: 30, shadowWidth: 16.875, shadowHeight: 4.92,
    arcRadius: 66, arcHeight: .72, arcTime: .19, arcSamples: 16, arcHalfSweep: 1.17, bladeWidth: 19
} as const;

export class HeroVisuals {
    readonly body = new Laya.Sprite();
    private shadow = new Laya.Sprite();
    private effects = new Laya.Sprite();
    private battle: BattleSimulation | null = null;
    private strikes: { hit: HeroStrike; since: number }[] = [];
    readonly stroll: HeroStroll;

    constructor(world: Laya.Sprite, private art: SpriteFrames, private readonly model: typeof HERO | typeof SONGLEI = HERO) {
        this.stroll = new HeroStroll(model === SONGLEI ? SONGLEI_STROLL : STROLL);
        this.body.name = model.actorId;
        this.body.hitArea = new Laya.Rectangle();
        this.shadow.name = model === SONGLEI ? "HeroShadow:songlei" : "HeroShadow:zhizhuo";
        this.effects.name = model === SONGLEI ? "HeroElectricSwings" : "HeroBottleSwings";
        for (const node of [this.shadow, this.body, this.effects]) {
            node.mouseEnabled = node.visible = false;
            world.addChild(node);
        }
        this.shadow.graphics.drawEllipse(0, 1, ART.shadowWidth, ART.shadowHeight, "rgba(48,29,31,.38)", null, 0);
    }

    update(battle: BattleSimulation | null, layout: GameLayout, events: readonly CombatFeedback[], time = 0, day = false, pickable = false): WorldItem[] {
        if (this.battle !== battle) this.strikes = [];
        this.battle = battle;
        const hero = battle?.hero?.actorId === this.model.actorId ? battle.hero : null;
        if (hero) for (const hit of events) if (hit.type === "heroHit") this.strikes.push({ hit, since: time });
        this.strikes = this.strikes.filter(strike => time - strike.since < ART.arcTime);
        const ready = this.art.ready("village");
        const show = !!hero && ready;
        const strolling = day && ready;
        const nightPose = show && hero.phase !== "resting" && !battle!.outcome ? hero : null;
        this.shadow.visible = this.body.visible = strolling || !!nightPose;
        this.body.mouseEnabled = strolling && pickable;
        this.effects.visible = show && this.strikes.length > 0;
        const depth: WorldItem[] = [];
        if (this.body.visible) {
            const direction = nightPose?.direction ?? this.stroll.direction;
            const motion = nightPose?.motion ?? (this.stroll.walking ? "walk" : "idle");
            const root = `${this.model.spritePrefix}_${direction.toLowerCase()}`;
            const frame = motion === "idle" ? root + "_idle" : this.art.frameId(root + "_" + motion, nightPose?.motionSeconds ?? this.stroll.elapsed);
            const at = nightPose ? { x: nightPose.position.x, y: layout.worldY(nightPose.position.y) }
                : this.stroll.position(layout);
            this.art.applyFrame(this.body, frame, ART.size);
            this.body.pos(at.x, at.y);
            if (strolling) this.body.getGraphicBounds(false, this.body.hitArea as Laya.Rectangle);
            this.shadow.pos(this.body.x, this.body.y);
            depth.push({ id: this.shadow.name, node: this.shadow, y: this.body.y - .01, ground: true },
                { id: this.body.name, node: this.body, y: this.body.y });
        }
        const g = this.effects.graphics;
        g.clear();
        if (this.effects.visible) {
            let top = 0;
            for (const { hit, since } of this.strikes) {
                const progress = (time - since) / ART.arcTime, fade = 1 - progress * progress;
                const x = hit.at.x, y = layout.worldY(hit.at.y) - ART.armY;
                const sweep = hit.strike === 0 ? 1 : -1;
                const angle = AIM[hit.direction] + sweep * (progress - .5) * .46;
                const radius = ART.arcRadius * (.82 + .36 * progress);
                const outer: number[] = [], inner: number[] = [];
                // 弧的内外边在两端合拢成尖，剑气随挥动向外展开并退光。
                for (let i = 0; i <= ART.arcSamples; i++) {
                    const t = i / ART.arcSamples, a = angle + sweep * (2 * t - 1) * ART.arcHalfSweep;
                    const dx = Math.cos(a), dy = Math.sin(a) * ART.arcHeight;
                    const width = ART.bladeWidth * Math.sin(Math.PI * t) ** 1.3 * (.55 + .45 * t);
                    outer.push(dx * radius, dy * radius);
                    inner.unshift(dx * (radius - width), dy * (radius - width));
                }
                const hue = hit.electric ? "89,208,255" : hit.strike === 0 ? "255,180,44" : "255,219,75";
                const edge = hit.electric ? "222,252,255" : "255,249,199";
                // 外沿亮、内沿留金色；保持薄刃轮廓，从正背四向都能看出挥动。
                g.drawPoly(x, y, outer.concat(inner.slice(2, -2)), `rgba(${hue},${fade * .95})`);
                g.drawLines(x, y, outer.slice(2, -2), `rgba(${edge},${fade})`, 2.8 * fade);
                top = Math.max(top, layout.worldY(hit.at.y) + radius);
            }
            depth.push({ id: this.effects.name, y: top, node: this.effects });
        }
        return depth;
    }
}
