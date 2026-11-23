import { PATROL } from "../config/PatrolConfig";
import type { BattleSimulation, CombatFeedback } from "../game/BattleSimulation";
import type { RoadPoint } from "../game/BattleRoad";
import type { GameSession } from "../game/GameSession";
import { patrolArc } from "../game/PatrolSpin";
import type { GameLayout } from "./GameLayout";
import type { SpriteFrames } from "./SpriteFrames";

// 手势、箭头和轨迹共用逻辑屏幕像素，地图只在提交目标时换回参考坐标。
const LOOK = { dragThreshold: 12, arrowGap: 43, arrowMin: 66, arrowGrowth: 130,
    // 旋甩角色放大后，起手区仍覆盖头顶和两侧留白；松手后此矩形不再拦截屏幕。
    hitPaddingX: 76, hitAbove: 108, hitBelow: 35,
    dustCount: 10, cueSeconds: .72, wordWidth: 173 } as const;
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
    private angle = 0;
    private orbitStarted = 0;
    impact: { at: RoadPoint; actor: number; started: number } | null = null;
    private readonly p = new Laya.Point();

    constructor(private world: Laya.Sprite, private game: GameSession, private art: SpriteFrames) {
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
        if (!layout || !spin || !this.game.patrolDragReady || this.press) return;
        const point = this.world.globalToLocal(this.p.setTo(event.stageX, event.stageY));
        this.placeHitRegion(layout, spin.actors);
        if (!this.touchRegion.contains(point.x, point.y) || !spin.gather()) return;
        this.press = { id: event.touchId, x: point.x, y: point.y };
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
        if (!this.game.patrolDragReady || event.nativeEvent?.type === "touchcancel") { this.cancel(); return; }
        const layout = this.layout!, center = this.battle!.patrol!.spin!.center;
        const point = this.world.globalToLocal(this.p.setTo(event.stageX, event.stageY));
        const preview = patrolPull(this.press, point, { x: center.x, y: layout.worldY(center.y) }, layout);
        if (preview && !this.preview) { this.orbitStarted = this.battle!.tick; this.angle = 0; }
        this.preview = preview;
        Laya.InputManager.cancelClick(event.touchId);
        event.stopPropagation();
    }
    private up(event: Laya.Event) {
        if (!this.press || event.touchId !== this.press.id) return;
        this.move(event);
        const at = this.preview, angle = this.angle;
        this.cancel();
        if (at) {
            const map = PATROL.spin.map;
            this.game.throwPatrol({ x: Math.max(0, Math.min(map.width, at.x)),
                y: Math.max(map.top, Math.min(map.bottom, this.layout!.referenceY(at.y))) }, angle);
        }
    }
    get aimHorizontal() { return this.preview?.ux; }
    get orbitAngle() { return this.preview ? this.angle : null; }

    dispose() { this.cancel(); this.aim.removeSelf(); }

    cancel() {
        if (!this.press) return;
        Laya.InputManager.cancelClick(this.press.id);
        this.press = this.preview = null;
        this.capture.removeSelf();
        this.touchSurface?.removeEventListener("touchcancel", this.onTouchCancel);
        this.touchSurface = null;
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
        for (const event of events)
            if (event.type === "patrolLanding") this.impact = { at: event.at, actor: event.actor, started: time };
        const spin = battle?.patrol?.spin, enabled = !blocked && this.game.patrolDragReady;
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
        if (!this.impact) return;
        const age = time - this.impact.started;
        if (age >= LOOK.cueSeconds) { this.impact = null; return; }
        const t = bound(age / LOOK.cueSeconds), at = this.impact.at;
        g.save();
        g.alpha(1 - t);
        const radius = PATROL.spin.radius;
        if (t < .42) this.circle(at, radius, "#fff1a3", "rgba(255,175,100,.19)", 4);
        this.circle(at, 12 + (radius - 12) * Math.sin(t * Math.PI / 2), "#ffc4a5", null, 6);
        this.circle(at, 8 + radius * .62 * t, "#ee8794", null, 4);
        for (let i = 0; i < LOOK.dustCount; i++) {
            const a = i * Math.PI * 2 / LOOK.dustCount, d = 13 + radius * .87 * t;
            const x = at.x + Math.cos(a) * d, y = layout.worldY(at.y + Math.sin(a) * d) - Math.sin(Math.PI * t) * (7 + i % 3 * 4);
            g.drawEllipse(x, y, 3 + (1 - t) * 7, 3 + (1 - t) * 4, i % 2 === 0 ? "#ffd8a6" : "#ffac96", null, 0);
        }
        g.restore();
        if (!this.art.ready("night")) return;
        if (!this.word) {
            this.word = this.aim.addChild(new Laya.Sprite());
            this.word.name = "PatrolBang";
            this.word.mouseEnabled = false;
            this.art.applyFrame(this.word, "fx_patrol_bang", LOOK.wordWidth);
        }
        const scale = .7 + .45 * Math.sin(Math.PI / 2 * bound(t / .22)) - .15 * bound((t - .22) / .30);
        this.word.visible = true;
        this.word.scale(scale, scale);
        this.word.alpha = 1 - bound((t - .62) / .31);
        this.word.pos(Math.min(PATROL.spin.map.width - 70, Math.max(70, at.x + 9)), Math.max(layout.mapTop + 24, layout.worldY(at.y) - 72 - 28 * t));
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
