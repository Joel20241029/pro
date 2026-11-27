import { DELIVERY_HERO as C } from "../config/DeliveryHeroConfig";
import { RULE } from "../config/RuleConfig";
import type { BattleSimulation, CombatFeedback } from "../game/BattleSimulation";
import type { DeliverySortie } from "../game/DeliverySortie";
import type { GameLayout } from "./GameLayout";
import type { SpriteFrames } from "./SpriteFrames";
import { HeroStroll } from "./HeroStroll";
import type { WorldItem } from "./WorldInteraction";

/** 路线沿村内右侧空地，与智卓的南侧停留点错开。显示尺寸仅影响地图表现。 */
const WALK = [{ x: 501, y: 860 }, { x: 548, y: 875 }, { x: 516, y: 949 }, { x: 498, y: 977 }] as const;
const LOOK = { width: 127.5, bag: 41, word: 138, scooter: 74, arc: 111, arm: 38, seconds: .68 } as const;
/** 按四方向投掷帧的手部位置放出外卖，落点仍由模拟决定。 */
const RELEASE_X = { UP: -27, DOWN: 27, LEFT: -30, RIGHT: 30 } as const;
type Landing = { hit: Extract<CombatFeedback, { type: "deliveryHit" }>; time: number };

export class DeliveryHeroVisuals {
    readonly body: Laya.Sprite;
    readonly stroll = new HeroStroll(WALK);
    private scooter: Laya.Sprite;
    private shadow: Laya.Sprite;
    private bag: Laya.Sprite;
    private splash: Laya.Sprite;
    private word: Laya.Sprite;
    private battle: BattleSimulation | null = null;
    private landing: Landing | null = null;

    constructor(world: Laya.Sprite, private art: SpriteFrames) {
        const create = (name: string) => {
            const node = new Laya.Sprite();
            node.name = name;
            node.visible = node.mouseEnabled = false;
            world.addChild(node);
            return node;
        };
        this.body = create(C.actorId);
        this.body.hitArea = new Laya.Rectangle();
        this.scooter = create("DeliveryParkedScooter");
        this.shadow = create("DeliveryShadow");
        this.shadow.graphics.drawEllipse(0, 1, 18, 5, "rgba(48,29,31,.38)", null, 0);
        this.bag = create("DeliveryBag");
        this.splash = create("DeliveryFoodSplash");
        this.word = create("DeliveryArrived");
    }

    get hasImpact() { return this.landing !== null; }

    update(battle: BattleSimulation | null, layout: GameLayout, events: readonly CombatFeedback[], clock: number,
        tick: number, day: boolean, pickable: boolean): WorldItem[] {
        if (this.battle !== battle || !battle) this.landing = null;
        this.battle = battle;
        const delivery = this.art.ready("night") ? battle?.delivery : null;
        for (const hit of events) if (delivery && hit.type === "deliveryHit") this.landing = { hit, time: clock };
        if (this.landing && clock - this.landing.time >= LOOK.seconds) this.landing = null;
        const active = delivery && !battle?.outcome && delivery.phase !== "resting" ? delivery : null;
        const strolling = day && this.art.ready("village");
        const depth: WorldItem[] = [];
        this.body.visible = this.shadow.visible = !!active || strolling;
        this.body.mouseEnabled = strolling && pickable;
        if (this.body.visible) {
            const root = `${C.spritePrefix}_${(active?.direction ?? this.stroll.direction).toLowerCase()}`;
            const frame = active ? this.battleFrame(active, root, tick) : this.stroll.walking
                ? this.art.frameId(root + "_walk", this.stroll.elapsed) : root + "_idle";
            const at = active ? { x: active.position.x, y: layout.worldY(active.position.y) } : this.stroll.position(layout);
            const wobble = active?.phase === "ridingOut" || active?.phase === "ridingBack" ? Math.sin(tick * .66) * 1.15 : 0;
            this.art.applyFrame(this.body, frame, LOOK.width);
            this.body.pos(at.x, at.y + wobble);
            if (strolling) this.body.getGraphicBounds(false, this.body.hitArea as Laya.Rectangle);
            this.shadow.pos(at.x, at.y);
            depth.push({ id: this.shadow.name, node: this.shadow, y: at.y - .02, ground: true },
                { id: this.body.name, node: this.body, y: at.y });
        }
        const parkedOnRoad = active?.phase === "fighting" || active?.phase === "dismount" ||
            active?.phase === "mounting" || active?.phase === "walkingBack";
        this.scooter.visible = strolling || parkedOnRoad;
        if (this.scooter.visible) {
            this.art.applyFrame(this.scooter, "delivery_bike", LOOK.scooter);
            const spot = parkedOnRoad && active
                ? active.roaming ? active.parked : { x: active.parked.x - 42, y: active.parked.y - 4 }
                : C.garage;
            this.scooter.pos(spot.x, layout.worldY(spot.y));
            depth.push({ id: this.scooter.name, node: this.scooter, y: this.scooter.y });
        }
        const flight = battle?.outcome ? null : delivery?.flight;
        this.bag.visible = !!flight;
        if (flight && delivery) {
            const p = Math.max(0, Math.min(1, (tick - flight.start) / (flight.landing - flight.start)));
            const start = { x: flight.from.x + RELEASE_X[flight.direction], y: layout.worldY(flight.from.y) - LOOK.arm };
            const end = { x: flight.at.x, y: layout.worldY(flight.at.y) - 12 };
            const x = start.x + (end.x - start.x) * p;
            const y = start.y + (end.y - start.y) * p - LOOK.arc * 4 * p * (1 - p);
            this.art.applyFrame(this.bag, "delivery_bag", LOOK.bag);
            this.bag.pos(x, y);
            this.bag.rotation = (end.x < start.x ? -1 : 1) * (25 - 285 * p);
            depth.push({ id: this.bag.name, node: this.bag, y: layout.worldY(flight.at.y) + 3 });
        }
        this.word.visible = this.splash.visible = !!this.landing;
        if (this.landing) {
            const { at, radius } = this.landing.hit;
            const age = Math.max(0, clock - this.landing.time);
            const t = age / LOOK.seconds, x = at.x, y = layout.worldY(at.y), expand = 1 - (1 - t) ** 3;
            const gold = (alpha: number) => `rgba(255,197,92,${alpha})`;
            const cream = (alpha: number) => `rgba(255,240,174,${alpha})`;
            const g = this.splash.graphics;
            g.clear();
            const r = radius * (.2 + .8 * expand);
            g.drawEllipse(x, y, r, r * .32, gold((1 - t) * .38), cream(1 - t), 2.5);
            for (let i = 0; i < 9; i++) {
                const angle = Math.PI * 2 * i / 9, scatter = r * (.58 + i % 3 * .17);
                g.drawEllipse(x + Math.cos(angle) * scatter,
                    y + Math.sin(angle) * scatter * .34 - Math.sin(Math.PI * t) * (26 + i % 3 * 6),
                    2 + (1 - t) * (3 + i % 3), 2 + (1 - t) * 3, i % 2 ? gold(1 - t) : cream(1 - t), null, 0);
            }
            if (t < .65) {
                const lift = Math.sin(t / .65 * Math.PI) * 45;
                g.drawRoundRect(x + 18 * t - 15, y - lift - 12, 31, 17, 3, 3, 3, 3, "#ffb268", "#8d4734", 2);
                g.drawRoundRect(x - 31 * t - 13, y - lift * 1.17 - 17, 28, 8, 2, 2, 2, 2, "#fff1af", "#ad643c", 2);
            }
            this.art.applyFrame(this.word, "fx_delivery_arrived", LOOK.word);
            const scale = .72 + .38 * Math.sin(Math.min(1, t / .26) * Math.PI / 2) - .1 * t;
            this.word.scale(scale, scale);
            this.word.alpha = Math.min(1, (1 - t) * 2.5);
            const halfWidth = this.word.width * scale / 2, halfHeight = this.word.height * scale / 2;
            this.word.pos(Math.max(halfWidth, Math.min(720 - halfWidth, x + 13)),
                Math.max(layout.mapTop + halfHeight, Math.min(layout.footerTop - halfHeight, y - 96 - 25 * t)));
            depth.push({ id: this.splash.name, node: this.splash, y: y + 1 }, { id: this.word.name, node: this.word, y: y + 124 });
        }
        return depth;
    }

    private battleFrame(delivery: DeliverySortie, root: string, tick: number) {
        if (delivery.phase === "ridingOut") return C.spritePrefix + "_up_ride";
        if (delivery.phase === "ridingBack") return C.spritePrefix + "_down_ride";
        if (delivery.walking) {
            const clip = this.art.animation(root + "_walk");
            const stride = clip.stridePixels! / clip.canvas.w * LOOK.width;
            return this.art.frameId(clip.id, delivery.walkDistance / stride * (clip.frameIds.length / clip.fps));
        }
        if (delivery.phase !== "fighting") return root + "_idle";
        if (delivery.attackAt === null) return root + "_idle";
        if (!delivery.flight) return root + "_windup";
        return (tick - delivery.flight.start) * RULE.step < .16 ? root + "_throw" : root + "_recover";
    }
}
