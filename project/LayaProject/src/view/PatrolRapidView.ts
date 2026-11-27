import { PATROL } from "../config/PatrolConfig";
import type { BattleSimulation } from "../game/BattleSimulation";
import type { RoadPoint } from "../game/BattleRoad";
import { RAPID_ROOF_LIFT } from "./PatrolThrowCue";
import { AnchoredTip } from "./AnchoredTip";
import type { GameLayout } from "./GameLayout";
import type { SpriteFrames } from "./SpriteFrames";

type Gun = NonNullable<NonNullable<BattleSimulation["patrol"]>["rapid"]>;
const ACTOR_CLIPS = ["patrol_walk", "patrol_walk_shuffle", "patrol_walk_waddle"] as const;
const TRACERS = ["#ffd477", "#e8bcff", "#a7ebe2"] as const;
// Both 228px barrel views have the same pivot-to-bore distance. The rear view
// points vertically up like the previous battle sprite; the profile angles up-right.
// The flash, return stroke and smoke all finish within one normal firing interval.
const CANNON = {
    canvasWidth: 228, boreX: 88, boreY: -80,
    recoilDistance: 9, recoilSeconds: .16, flashSeconds: .075, smokeSeconds: .22
};
const PROFILE_ANGLE = Math.atan2(CANNON.boreY, CANNON.boreX);

/** 屋顶枪架按弹道转向。只在模拟扣弹后播放后坐、火光和烟。 */
export class PatrolRapidView {
    readonly root = new Laya.Sprite();
    private gun = new Laya.Sprite();
    private stand = new Laya.Sprite();
    private fx = new Laya.Sprite();
    private ammo = new Laya.Text();
    private hint: AnchoredTip;
    private hintBounds = new Laya.Rectangle();
    private bullets: Laya.Sprite[] = [];
    private showsRear = true;
    private shots = 0;
    private shotAge = Infinity;
    private shotX = 0;
    private shotY = -1;
    private clock = 0;

    constructor(private art: SpriteFrames) {
        this.root.name = "PatrolRapidMount";
        this.gun.name = "PatrolRapidBarrel";
        this.stand.name = "PatrolRapidStand";
        this.fx.name = "PatrolRapidEffects";
        this.root.mouseEnabled = this.fx.mouseEnabled = this.gun.mouseEnabled =
            this.stand.mouseEnabled = this.ammo.mouseEnabled = false;
        this.root.addChild(this.stand);
        this.root.addChild(this.gun);
        this.root.addChild(this.fx);
        this.root.addChild(this.ammo);
        const width = PATROL.rapid.muzzleDistance * CANNON.canvasWidth / Math.hypot(CANNON.boreX, CANNON.boreY);
        this.art.applyFrame(this.gun, "patrol_rapid_barrel_rear", width);
        this.art.applyFrame(this.stand, "patrol_rapid_mount", width);
        this.ammo.font = "sans-serif";
        this.ammo.fontSize = 19; this.ammo.bold = true; this.ammo.align = "center"; this.ammo.valign = "middle";
        this.ammo.wordWrap = false; this.ammo.overflow = Laya.Text.SHRINK;
        this.ammo.color = "#fff2cf"; this.ammo.size(122,31);
        this.hint = new AnchoredTip(art, 286, 46, 22, true, Infinity);
        this.root.addChild(this.hint);
    }

    hide() {
        this.root.visible = false;
        this.hint.hide();
        this.shotAge = Infinity;
        this.shots = this.clock = 0;
    }

    update(layout: GameLayout, rapid: Gun, aim: RoadPoint | null, time: number, showHint: boolean) {
        this.root.visible = true;
        this.root.width = PATROL.spin.map.width;
        const x = PATROL.rapid.origin.x, y = layout.gateY - RAPID_ROOF_LIFT;
        const dt = this.clock ? Math.max(0, time - this.clock) : 0;
        this.clock = time;
        const dx = rapid.direction.x, dy = layout.worldY(rapid.direction.y + PATROL.rapid.origin.y) - layout.worldY(PATROL.rapid.origin.y);
        const length = Math.hypot(dx, dy);
        const ux = aim ? aim.x : dx / length, uy = aim ? aim.y : dy / length;
        // Camera sits on the village side. Shots sent up the map show the closed breech.
        const rear = uy <= 0;
        if (rear !== this.showsRear) {
            this.showsRear = rear;
            this.gun.texture = this.art.get(rear ? "patrol_rapid_barrel_rear" : "patrol_rapid_barrel");
            this.root.setChildIndex(this.gun, rear ? 1 : 0);
        }
        const mx = x + ux * PATROL.rapid.muzzleDistance, my = y + uy * PATROL.rapid.muzzleDistance;
        this.shotAge += dt;
        if (rapid.shotsFired > this.shots) {
            this.shotAge = 0;
            this.shotX = ux;
            this.shotY = uy;
        }
        this.shots = rapid.shotsFired;
        const recoil = CANNON.recoilDistance * Math.max(0, 1 - this.shotAge / CANNON.recoilSeconds) ** 2;
        const artAngle = rear ? -Math.PI / 2 : PROFILE_ANGLE;
        this.gun.rotation = (Math.atan2(uy, ux) - artAngle) * 180 / Math.PI;
        this.gun.pos(x - ux * recoil, y - uy * recoil);
        this.stand.pos(x, y);
        const g = this.fx.graphics; g.clear();
        const foot = this.root.graphics; foot.clear();
        foot.drawEllipse(x, y + this.stand.height - this.stand.pivotY - 4, 43, 8, "rgba(62,34,41,.25)", null, 0);
        if (aim) {
            // 空心箭尖沿弹道指向前方，两翼从枪口闪光之外开始。
            const wing = 14, gap = 24, tip = 48;
            const chevron = [
                ux * gap - uy * wing, uy * gap + ux * wing,
                ux * tip, uy * tip,
                ux * gap + uy * wing, uy * gap - ux * wing
            ];
            g.drawLines(mx, my, chevron, "#673c49", 9);
            g.drawLines(mx, my, chevron, "#ffc453", 5);
        }
        const smoke = this.shotAge / CANNON.smokeSeconds;
        if (smoke < 1) {
            const distance = PATROL.rapid.muzzleDistance - CANNON.recoilDistance + 25 * smoke;
            const sx = x + this.shotX * distance, sy = y + this.shotY * distance;
            const r = 7 + 13 * smoke, spread = r * .58;
            const shade = `rgba(124,96,106,${.46 * (1 - smoke)})`;
            const pale = `rgba(255,222,175,${.72 * (1 - smoke)})`;
            g.drawCircle(sx, sy, r, shade);
            g.drawCircle(sx + this.shotY * spread, sy - this.shotX * spread, r * .7, pale);
            g.drawCircle(sx - this.shotY * spread, sy + this.shotX * spread, r * .57, pale);
        }
        const flash = 1 - this.shotAge / CANNON.flashSeconds;
        if (flash > 0) {
            const rays: number[] = [], r = 13 + flash * 20;
            for (let i=0; i<14; i++) {
                const angle = i * Math.PI / 7, size = i % 2 ? r*.43 : r;
                rays.push(Math.cos(angle)*size,Math.sin(angle)*size);
            }
            const fx = mx - ux * recoil, fy = my - uy * recoil;
            g.drawPoly(fx, fy, rays, "#ffce76", "#f6a35d", 2);
            g.drawCircle(fx, fy, r * .31, "#fff3cb");
        }
        for (let i=0; i<rapid.projectiles.length; i++) {
            const shot = rapid.projectiles[i], ax = shot.at.x, ay = layout.worldY(shot.at.y);
            const by = layout.worldY(shot.at.y - 32*shot.direction.y);
            const bx = ax - 32*shot.direction.x;
            g.drawLine(bx,by,ax,ay,TRACERS[shot.index % TRACERS.length],6);
            const body = this.bullets[i] ?? (this.bullets[i] = this.root.addChildAt(new Laya.Sprite(), this.root.getChildIndex(this.fx)));
            body.mouseEnabled = false; body.visible = true;
            const clip = ACTOR_CLIPS[shot.index % ACTOR_CLIPS.length];
            this.art.applyFrame(body,this.art.frameId(clip,time+shot.index*.13),96);
            body.pivot(body.width*.5,body.height*.53);
            body.pos(ax,ay);
            body.rotation = (time*420+shot.index*65) % 360;
        }
        for (let i=rapid.projectiles.length; i<this.bullets.length; i++) this.bullets[i].visible = false;
        // 向右瞄准时把余弹牌放在另一侧，给横向弹道留空。
        const badgeOffset = PATROL.rapid.muzzleDistance + 12;
        const rx = aim && ux > 0 ? x - badgeOffset - this.ammo.width : x + badgeOffset;
        const ry = y + 9;
        g.drawRoundRect(rx,ry,122,31,12,12,12,12,"#4e5f83","#f5cf91",2);
        this.ammo.pos(rx,ry);
        this.ammo.text = rapid.reloadRemaining > 0 ? `补弹 ${Math.ceil(rapid.reloadRemaining)} 秒` : `余弹 ${rapid.ammo} / ${rapid.capacity}`;
        if (showHint) {
            this.hintBounds.setTo(x, y - PATROL.rapid.muzzleDistance - 8, 0, 0);
            if (!this.hint.visible) this.hint.show("按住枪架后拉，拉住扫射", () => ({ node: this.root, bounds: this.hintBounds }));
            this.hint.advance(dt);
        } else if (this.hint.visible) this.hint.hide();
    }
}
