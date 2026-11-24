import { PATROL } from "../config/PatrolConfig";
import type { BattleSimulation, CombatFeedback } from "../game/BattleSimulation";
import type { RoadPoint } from "../game/BattleRoad";
import type { GameSession } from "../game/GameSession";
import { patrolArc } from "../game/PatrolSpin";
import type { GameLayout } from "./GameLayout";
import type { SpriteFrames } from "./SpriteFrames";

// 门楼贴图在长短屏上均等比展示。转盘距门脚 110 逻辑像素，和枪口保持同一视觉长度。
export const RAPID_ROOF_LIFT = 110;
/** 触点和枪口先在画面中对齐，再转换成战斗使用的地图单位。 */
export function rapidProjection(layout: GameLayout, ux: number, uy: number) {
    const y = layout.gateY - RAPID_ROOF_LIFT, refY = layout.referenceY(y);
    const dx = ux * PATROL.rapid.muzzleDistance;
    const dy = layout.referenceY(y + uy * PATROL.rapid.muzzleDistance) - refY;
    const muzzleDistance = Math.hypot(dx, dy);
    return { origin: { x: PATROL.rapid.origin.x, y: refY }, direction: { x: dx / muzzleDistance, y: dy / muzzleDistance }, muzzleDistance };
}

// 手势、箭头和轨迹共用逻辑屏幕像素，地图只在提交目标时换回参考坐标。
const LOOK = { dragThreshold: 12, arrowGap: 43, arrowMin: 66, arrowGrowth: 130,
    // 旋甩角色放大后，起手区仍覆盖头顶和两侧留白；松手后此矩形不再拦截屏幕。
    hitPaddingX: 76, hitAbove: 108, hitBelow: 35,
    // 连发单独扩大门楼起手区；离开此区域后仍由最初按下的触点控制。
    rapidHalfWidth: 124, rapidAbove: 124, rapidBelow: 124,
    // 落地沿用 .72 表现秒；空砸沿用十颗小尘粒。群怪共用一团命中尘土。
    dustCount: 10, cueSeconds: .72, wordWidth: 173 } as const;
// 单团尘云的手绘轮廓，按命中半径记录横向位置、地面纵深、扬起高度和两轴半径。
// 较高的中央烟柱和较低的两翼共用底部阴影；调整只影响守夜落地表现。
const DUST_CROWN = [
    { x: -.76, depth: .05, rise: .12, rx: .24, ry: .16 },
    { x: -.58, depth: -.02, rise: .29, rx: .27, ry: .22 },
    { x: -.35, depth: -.07, rise: .49, rx: .28, ry: .26 },
    { x: -.10, depth: -.05, rise: .63, rx: .31, ry: .29 },
    { x: .17, depth: -.08, rise: .76, rx: .25, ry: .25 },
    { x: .37, depth: -.03, rise: .48, rx: .29, ry: .24 },
    { x: .64, depth: .03, rise: .30, rx: .25, ry: .21 },
    { x: .81, depth: .08, rise: .11, rx: .19, ry: .14 }
] as const;
// 前沿是脚下扑向镜头的低矮土浪。两翼的碎尘可飘出伤害半径，中央压低，保留怪物头身轮廓。
const DUST_FRONT = [
    { x: -1.20, depth: .04, rise: .16, rx: .24, ry: .17 },
    { x: -.91, depth: .13, rise: .20, rx: .30, ry: .25 },
    { x: -.54, depth: .20, rise: .11, rx: .34, ry: .20 },
    { x: -.12, depth: .22, rise: .04, rx: .35, ry: .16 },
    { x: .30, depth: .19, rise: .08, rx: .32, ry: .19 },
    { x: .72, depth: .13, rise: .18, rx: .32, ry: .24 },
    { x: 1.11, depth: .08, rise: .24, rx: .28, ry: .21 }
] as const;
const bound = (value: number) => Math.max(0, Math.min(1, value));

function edgeDistance(at: RoadPoint, ux: number, uy: number, top: number, bottom: number) {
    const side = ux === 0 ? Infinity : ((ux > 0 ? PATROL.spin.map.width : 0) - at.x) / ux;
    const vertical = uy === 0 ? Infinity : ((uy > 0 ? bottom : top) - at.y) / uy;
    return Math.min(side, vertical);
}

/** 手指拉到画面边缘为满力，从双人中心沿反向飞到可玩地图的边缘。 */
export function patrolPull(press: RoadPoint, touch: RoadPoint, center: RoadPoint,
    layout: Pick<GameLayout, "height" | "mapTop" | "footerTop">) {
    // Laya 的触点取整，画布底边可能是小数。把最后半个逻辑像素对齐到真实边界。
    const touchY = Math.abs(layout.height - touch.y) <= .5 ? layout.height : touch.y;
    const dx = touch.x - press.x, dy = touchY - press.y;
    const length = Math.hypot(dx, dy);
    if (length < LOOK.dragThreshold) return null;
    const ux = -dx / length, uy = -dy / length;
    // 力度包含底栏在内的整个触控画布，落点只使用可玩地图。
    const fullPull = edgeDistance(press, -ux, -uy, 0, layout.height);
    if (fullPull < LOOK.dragThreshold) return null;
    const power = bound(length / fullPull);
    const reach = power * edgeDistance(center, ux, uy, layout.mapTop, layout.footerTop);
    return { power, ux, uy, x: center.x + ux * reach, y: center.y + uy * reach };
}

/** 手势只在待命双人身上开始。箭头、轨迹点和尘粒共用绘图层。 */
export class PatrolThrowCue {
    private aim = new Laya.Sprite();
    private dust = new Laya.Sprite();
    private touchRegion = new Laya.Rectangle();
    private capture = new Laya.Sprite();
    private word?: Laya.Sprite;
    private layout: GameLayout | null = null;
    private battle: BattleSimulation | null = null;
    private press: { id: number; x: number; y: number } | null = null;
    private preview: ReturnType<typeof patrolPull> = null;
    private touchSurface: EventTarget | null = null;
    private readonly onTouchCancel = (event: Event) => {
        const id = this.press?.id;
        const touches = (event as TouchEvent).changedTouches;
        if (id !== undefined && Array.from(touches).some(touch => touch.identifier === id)) this.cancel();
    };
    rapidAim: RoadPoint | null = null;
    private angle = 0;
    private orbitStarted = 0;
    impact: { at: RoadPoint; actor: number; radius: number; started: number; hit: boolean } | null = null;
    private readonly p = new Laya.Point();

    constructor(private world: Laya.Sprite, private game: GameSession, private art: SpriteFrames) {
        // 尘冠在所有角色后方；低矮土浪单独绘在瞄准层，密集怪群中也能看见着地的一瞬。
        this.dust.name = "PatrolLandingDust";
        this.dust.zIndex = -1;
        this.dust.mouseEnabled = this.dust.visible = false;
        this.world.addChild(this.dust);
        this.aim.name = "PatrolThrowCue";
        this.aim.mouseEnabled = false;
        this.aim.hitArea = this.touchRegion;
        this.world.addChild(this.aim);
        // 与 HUD 同属画面根节点，起手区优先于地图上的建筑和村民。
        this.aim.zIndex = 4;
        this.aim.stackingRoot = true;
        this.aim.on(Laya.Event.MOUSE_DOWN, this, this.down);
        // Laya 会沿按下时的目标派发拖拽，即使触点已经移动到 HUD 上。
        this.aim.on(Laya.Event.MOUSE_DRAG, this, this.move);
        this.aim.on(Laya.Event.MOUSE_UP, this, this.up);
        this.aim.on(Laya.Event.MOUSE_DRAG_END, this, this.up);
        this.capture.name = "PatrolDragCapture";
        this.capture.mouseEnabled = true;
        this.capture.zIndex = 100;
        this.capture.stackingRoot = true;
        this.capture.on(Laya.Event.MOUSE_UP, this, this.up);
        this.capture.on(Laya.Event.MOUSE_DOWN, this, (event: Laya.Event) => {
            Laya.InputManager.cancelClick(event.touchId);
            event.stopPropagation();
        });
    }

    private down(event: Laya.Event) {
        const spin = this.battle?.patrol?.spin, layout = this.layout;
        const rapid = this.battle?.patrol?.rapid;
        if (!layout || this.press || !(rapid ? this.game.patrolRapidReady : this.game.patrolDragReady)) return;
        const point = this.world.globalToLocal(this.p.setTo(event.stageX, event.stageY));
        if (rapid) this.placeRapidHitRegion(layout);
        else if (spin) this.placeHitRegion(layout, spin.actors);
        if (!this.touchRegion.contains(point.x, point.y) || (!rapid && !spin?.gather())) return;
        this.press = { id: event.touchId, x: point.x, y: point.y };
        if (!rapid) this.game.setPatrolAiming(true);
        const root = this.world.parent as Laya.Sprite;
        this.capture.size(root.width, root.height);
        root.addChild(this.capture);
        // 系统取消未移动的触点时，Laya 不会向起手节点派发拖拽结束。
        this.touchSurface = event.nativeEvent?.type === "touchstart" ? event.nativeEvent.target : null;
        this.touchSurface?.addEventListener("touchcancel", this.onTouchCancel);
        Laya.InputManager.cancelClick(event.touchId);
        event.stopPropagation();
    }
    private move(event: Laya.Event) {
        if (!this.press || event.touchId !== this.press.id) return;
        const rapid = this.battle?.patrol?.rapid;
        if (!(rapid ? this.game.patrolRapidReady : this.game.patrolDragReady) || event.nativeEvent?.type === "touchcancel") { this.cancel(); return; }
        const layout = this.layout!;
        const point = this.world.globalToLocal(this.p.setTo(event.stageX, event.stageY));
        if (rapid) {
            const dx = this.press.x - point.x, dy = this.press.y - point.y, distance = Math.hypot(dx, dy);
            // 扫过起点时没有稳定的方向，保留上一发朝向直到手指移出中心。
            if (distance >= LOOK.dragThreshold) {
                this.rapidAim = { x: dx / distance, y: dy / distance };
                const ray = rapidProjection(layout, this.rapidAim.x, this.rapidAim.y);
                this.game.aimPatrolRapid(ray.direction, ray.origin, ray.muzzleDistance);
            }
            Laya.InputManager.cancelClick(event.touchId);
            event.stopPropagation();
            return;
        }
        const center = this.battle!.patrol!.spin!.center;
        const preview = patrolPull(this.press, point, { x: center.x, y: layout.worldY(center.y) }, layout);
        if (preview && !this.preview) { this.orbitStarted = this.battle!.tick; this.angle = 0; }
        this.preview = preview;
        Laya.InputManager.cancelClick(event.touchId);
        event.stopPropagation();
    }
    private up(event: Laya.Event) {
        if (!this.press || event.touchId !== this.press.id) return;
        if (this.battle?.patrol?.rapid) {
            this.cancel();
            event.stopPropagation();
            return;
        }
        this.move(event);
        const at = this.landingTarget(), angle = this.angle;
        this.cancel();
        if (at) this.game.throwPatrol(at, angle);
    }
    private landingTarget(): RoadPoint | null {
        if (!this.preview) return null;
        const map = PATROL.spin.map;
        return { x: Math.max(0, Math.min(map.width, this.preview.x)),
            y: Math.max(map.top, Math.min(map.bottom, this.layout!.referenceY(this.preview.y))) };
    }
    get aimHorizontal() { return this.preview?.ux; }
    get orbitAngle() { return this.preview ? this.angle : null; }

    dispose() { this.cancel(); this.aim.removeSelf(); this.dust.destroy(); }

    cancel() {
        if (!this.press) return;
        Laya.InputManager.cancelClick(this.press.id);
        this.press = this.preview = null;
        if (this.rapidAim) this.game.stopPatrolRapid();
        this.rapidAim = null;
        this.game.setPatrolAiming(false);
        this.capture.removeSelf();
        this.touchSurface?.removeEventListener("touchcancel", this.onTouchCancel);
        this.touchSurface = null;
    }

    private placeRapidHitRegion(layout: GameLayout) {
        const origin = PATROL.rapid.origin;
        this.touchRegion.setTo(origin.x - LOOK.rapidHalfWidth, layout.gateY - RAPID_ROOF_LIFT - LOOK.rapidAbove,
            LOOK.rapidHalfWidth * 2, LOOK.rapidAbove + LOOK.rapidBelow);
    }

    private placeHitRegion(layout: GameLayout, actors: readonly { at: RoadPoint }[]) {
        const [first, second] = actors;
        const left = Math.min(first.at.x, second.at.x), right = Math.max(first.at.x, second.at.x);
        const firstY = layout.worldY(first.at.y), secondY = layout.worldY(second.at.y);
        const top = Math.min(firstY, secondY), bottom = Math.max(firstY, secondY);
        this.touchRegion.setTo(left - LOOK.hitPaddingX, top - LOOK.hitAbove,
            right - left + 2 * LOOK.hitPaddingX, bottom - top + LOOK.hitAbove + LOOK.hitBelow);
    }

    update(layout: GameLayout, battle: BattleSimulation | null, events: CombatFeedback[], time: number, blocked: boolean) {
        this.layout = layout;
        const root = this.world.parent as Laya.Sprite | null;
        if (root && this.aim.parent === this.world) root.addChild(this.aim);
        if (battle !== this.battle) { this.battle = battle; this.impact = null; this.cancel(); }
        for (const event of events) {
            if (event.type !== "patrolLanding") continue;
            // 追帧时同批可含不同战斗步。命中取这次旋甩的实际结算，怪物此时可能已经被击飞或移除。
            const hit = events.some(other => other.type === "patrol" && other.tick === event.tick && other.index === event.actor);
            this.impact = { at: event.at, actor: event.actor, radius: event.radius, started: time, hit };
        }
        const spin = battle?.patrol?.spin, rapid = battle?.patrol?.rapid;
        const enabled = !blocked && (rapid ? this.game.patrolRapidReady : this.game.patrolDragReady);
        if (rapid && enabled) this.placeRapidHitRegion(layout);
        if (!enabled) this.cancel();
        this.aim.mouseEnabled = enabled || !!this.press;
        if (this.press && this.capture.parent) {
            const root = this.capture.parent as Laya.Sprite;
            this.capture.size(root.width, root.height);
        }
        const g = this.aim.graphics;
        g.clear();
        if (this.word) this.word.visible = false;
        if ((enabled || this.press) && spin) {
            const center = spin.center, y = layout.worldY(center.y), radius = PATROL.spin.shoulder;
            this.placeHitRegion(layout, spin.actors);
            if (this.preview) {
                const { power, ux, uy } = this.preview;
                const target = this.landingTarget()!;
                g.save();
                g.clipRect(0, layout.mapTop, PATROL.spin.map.width, layout.footerTop - layout.mapTop);
                this.circle(target, spin.radius, "#ffedb0", "rgba(255,175,100,.21)", 4);
                g.restore();
                this.angle -= (battle!.tick - this.orbitStarted) * (.23 + power * .24);
                this.orbitStarted = battle!.tick;
                const gap = LOOK.arrowGap, tip = gap + LOOK.arrowMin + power * LOOK.arrowGrowth;
                const neck = tip - (32 + 20 * power), head = 28 + 18 * power, shaft = 9 + 6 * power;
                const points = [[gap, -3], [neck, -shaft], [neck - 4, -head], [tip, 0],
                    [neck - 4, head], [neck, shaft], [gap, 3]];
                const vertices: number[] = [];
                for (const [along, across] of points) vertices.push(along * ux - across * uy, along * uy + across * ux);
                g.drawPoly(center.x, y - 14, vertices, "#ffbc35", "#5c2d44", 10);
                g.drawPoly(center.x, y - 14, vertices, "#ffbc35", "#fff4cf", 5);
                g.drawEllipse(center.x, y + 2, radius + 4, 17, null, "rgba(255,229,178,.73)", 3);
            } else if (spin.ready) {
                g.drawEllipse(center.x, y + 3, radius + 20, 15, "rgba(255,196,112,.12)", "#ffd593", 2.5);
            }
        }
        const selected = spin?.destination;
        if (spin && selected) {
            const flight = spin.flightProgress(battle!.tick);
            for (let i = 1; i <= 6; i++) {
                const progress = flight - i * .045;
                if (progress <= 0) continue;
                const point = patrolArc(spin.aimOrigin, selected, progress);
                g.drawCircle(point.x, layout.worldY(point.y) - point.lift - 13, 5 - i * .55,
                    `rgba(255,210,171,${1 - i * .12})`);
            }
        }
        if (this.dust.visible) { this.dust.graphics.clear(); this.dust.visible = false; }
        if (!this.impact) return;
        const age = time - this.impact.started;
        if (age >= LOOK.cueSeconds) { this.impact = null; return; }
        const t = bound(age / LOOK.cueSeconds), { at, hit, radius } = this.impact;
        const wave = 1 - (1 - t) ** 3;
        if (hit) {
            this.drawHitDust(at, t, wave, radius);
        } else {
            g.save();
            g.clipRect(0, layout.mapTop, PATROL.spin.map.width, layout.footerTop - layout.mapTop);
            g.alpha(1 - t);
            this.circle(at, radius * (.12 + .56 * wave), "#eabfa4", null, 3);
            for (let i = 0; i < LOOK.dustCount; i++) {
                const a = (i + .5) * Math.PI * 2 / LOOK.dustCount;
                const d = radius * (.14 + .40 * wave);
                const x = at.x + Math.cos(a) * d, y = layout.worldY(at.y + Math.sin(a) * d) - Math.sin(Math.PI * t) * (6 + i % 3 * 4);
                g.drawEllipse(x, y, 2 + (1 - t) * 5, 2 + (1 - t) * 3, i % 2 ? "#f7cb9a" : "#ddacbc", null, 0);
            }
            g.restore();
        }
        if (!this.art.ready("night")) return;
        if (!this.word) {
            this.word = this.aim.addChild(new Laya.Sprite());
            this.word.name = "PatrolBang";
            this.word.mouseEnabled = false;
            this.art.applyFrame(this.word, "fx_patrol_bang", LOOK.wordWidth);
        }
        const scale = (.7 + .45 * Math.sin(Math.PI / 2 * bound(t / .22)) - .15 * bound((t - .22) / .30)) * (hit ? .66 : .76);
        this.word.visible = true;
        this.word.scale(scale, scale);
        this.word.alpha = hit ? 1 - bound((t - .32) / .38) : 1 - bound((t - .62) / .31);
        const halfWidth = this.word.width * scale / 2, halfHeight = this.word.height * scale / 2;
        this.word.pos(Math.min(PATROL.spin.map.width - halfWidth, Math.max(halfWidth, at.x + (hit ? 39 : 9))),
            Math.min(layout.footerTop - halfHeight, Math.max(layout.mapTop + halfHeight, layout.worldY(at.y) - (hit ? 100 : 72) - 28 * t)));
    }

    private drawHitDust(at: RoadPoint, t: number, wave: number, r: number) {
        const layout = this.layout!, g = this.dust.graphics;
        // 尘从足点急速摊开，中央随后抬起。半秒后各瓣随余势漂开、缩小、变淡。
        const spread = .16 + .84 * wave, rise = 1 - (1 - t) ** 2;
        const drift = bound((t - .48) / .52), size = (.32 + .72 * Math.sin(Math.min(1, t / .40) * Math.PI / 2)) * (1 - .56 * drift);
        this.dust.visible = true;
        this.dust.alpha = 1 - drift;
        g.save();
        g.clipRect(0, layout.mapTop, PATROL.spin.map.width, layout.footerTop - layout.mapTop);
        const foot = layout.worldY(at.y);
        g.drawEllipse(at.x, foot + 4, r * .94 * spread, r * .12 * size, "rgba(91,58,41,.42)", null, 0);
        // 尘冠在角色背后升起；低矮前沿沿双脚外喷，并在后半段提早消散。
        // 两层沿用同一组绘图指令与表现时钟，每次落地各画一次。
        const front = this.aim.graphics;
        front.save();
        front.clipRect(0, layout.mapTop, PATROL.spin.map.width, layout.footerTop - layout.mapTop);
        front.alpha(.92 * (1 - bound((t - .44) / .48)));
        for (const lobes of [DUST_CROWN, DUST_FRONT] as const) {
            const forward = lobes === DUST_FRONT, ink = forward ? front : g;
            const reach = forward ? .32 + .68 * (1 - (1 - t) ** 5) : spread;
            const breadth = forward ? Math.max(.57, size) : size;
            for (const shade of ["shadow", "body", "light"] as const) {
                for (const [i, lobe] of lobes.entries()) {
                    const x = at.x + r * lobe.x * (reach + .17 * drift);
                    const y = layout.worldY(at.y + r * lobe.depth * reach) - r * lobe.rise * rise - (forward ? 7 : 20) * drift;
                    const rx = r * lobe.rx * breadth, ry = r * lobe.ry * breadth;
                    if (shade === "shadow") ink.drawEllipse(x, y, rx, ry, forward ? "#9d643d" : "#997049", null, 0);
                    else if (shade === "body") ink.drawEllipse(x - rx * .04, y - ry * .16, rx * .98, ry * .88,
                        forward ? "#e0aa73" : "#d5a571", null, 0);
                    else if (i % 3 === 1 || i === lobes.length - 1) {
                        ink.drawCurves(x, y, [-rx * .76, -ry * .23, -rx * .56, -ry * .86, -rx * .12, -ry * .73,
                            rx * .18, -ry * .70, rx * .24, -ry * .49], forward ? "#ffe0a8" : "#f2d1a0", Math.max(1, ry * .16));
                    }
                }
            }
        }
        // 五块小土屑先斜向迸出，再沿抛物线落回地面。
        for (let i = 0; i < 5; i++) {
            const side = i % 2 ? -1 : 1, x = at.x + side * r * (.78 + i * .15) * spread;
            const y = foot + (i % 3) * 3 - r * (.45 + (i % 3) * .19) * Math.sin(t * Math.PI);
            const chip = r * (.029 + (i % 2) * .013) * (1 - .55 * t);
            front.drawPoly(x, y, [-chip, 0, 0, -chip * 1.3, chip, -chip * .3, chip * .6, chip], "#b98552", null, 0);
        }
        front.restore();
        g.restore();
    }

    private circle(at: RoadPoint, radius: number, color: string, fill: string | null, line: number) {
        const points: number[] = [];
        for (let i = 0; i <= 36; i++) {
            const a = i * Math.PI / 18;
            points.push(at.x + radius * Math.cos(a), this.layout!.worldY(at.y + radius * Math.sin(a)));
        }
        if (fill) this.aim.graphics.drawPoly(0, 0, points, fill, color, line);
        else this.aim.graphics.drawLines(0, 0, points, color, line);
    }
}
