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

/** 屋顶枪架与小人弹道共用模拟坐标。展示层只补后坐、弹迹和余弹牌。 */
export class PatrolRapidView {
    readonly root = new Laya.Sprite();
    private gun = new Laya.Sprite();
    private fx = new Laya.Sprite();
    private ammo = new Laya.Text();
    private hint: AnchoredTip;
    private hintBounds = new Laya.Rectangle();
    private bullets: Laya.Sprite[] = [];
    private shots = 0;
    private flash = 0;
    private clock = 0;

    constructor(private art: SpriteFrames) {
        this.root.name = "PatrolRapidMount";
        this.root.mouseEnabled = this.fx.mouseEnabled = this.gun.mouseEnabled = this.ammo.mouseEnabled = false;
        this.root.addChild(this.gun);
        this.root.addChild(this.fx);
        this.root.addChild(this.ammo);
        // 图集登记的支点 (54,130) 到可见枪口 (54,5)，保留实际旋转轴。
        this.art.applyFrame(this.gun, "patrol_rapid_gun", PATROL.rapid.muzzleDistance * 128 / 125);
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
        this.flash = this.shots = this.clock = 0;
    }

    update(layout: GameLayout, rapid: Gun, aim: RoadPoint | null, time: number, showHint: boolean) {
        this.root.visible = true;
        this.root.width = PATROL.spin.map.width;
        const x = PATROL.rapid.origin.x, y = layout.gateY - RAPID_ROOF_LIFT;
        const dt = this.clock ? Math.max(0, time - this.clock) : 0;
        this.clock = time;
        this.flash = rapid.shotsFired > this.shots ? 1 : Math.max(0, this.flash - dt * 8);
        this.shots = rapid.shotsFired;
        const dx = rapid.direction.x, dy = layout.worldY(rapid.direction.y + PATROL.rapid.origin.y) - layout.worldY(PATROL.rapid.origin.y);
        const length = Math.hypot(dx, dy);
        const ux = aim ? aim.x : dx / length, uy = aim ? aim.y : dy / length;
        const mx = x + ux * PATROL.rapid.muzzleDistance, my = y + uy * PATROL.rapid.muzzleDistance;
        this.gun.rotation = Math.atan2(ux, -uy) * 180 / Math.PI;
        this.gun.pos(x - ux * this.flash * 3, y - uy * this.flash * 3);
        const g = this.fx.graphics; g.clear();
        const foot = this.root.graphics; foot.clear();
        foot.drawEllipse(x, y + 3, 32, 9, "#8c5660", "#5c3b49", 3);
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
        if (this.flash > 0) {
            const rays: number[] = [], r = 8 + this.flash * 11;
            for (let i=0; i<14; i++) {
                const angle = i * Math.PI / 7, size = i % 2 ? r*.43 : r;
                rays.push(Math.cos(angle)*size,Math.sin(angle)*size);
            }
            g.drawPoly(mx,my,rays,"#ffce76","#f6a35d",2);
            g.drawCircle(mx,my,r*.26,"#fff3cb");
        }
        for (let i=0; i<rapid.projectiles.length; i++) {
            const shot = rapid.projectiles[i], ax = shot.at.x, ay = layout.worldY(shot.at.y);
            const by = layout.worldY(shot.at.y - 32*shot.direction.y);
            const bx = ax - 32*shot.direction.x;
            g.drawLine(bx,by,ax,ay,TRACERS[shot.index % TRACERS.length],6);
            const body = this.bullets[i] ?? (this.bullets[i]=this.root.addChild(new Laya.Sprite()));
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
        g.drawRoundRect(rx,ry,122,31,12,12,12,12,"#71465a","#f5cf91",2);
        this.ammo.pos(rx,ry);
        this.ammo.text = rapid.reloadRemaining > 0 ? `补弹 ${Math.ceil(rapid.reloadRemaining)} 秒` : `余弹 ${rapid.ammo} / ${rapid.capacity}`;
        if (showHint) {
            this.hintBounds.setTo(x, y - PATROL.rapid.muzzleDistance - 8, 0, 0);
            if (!this.hint.visible) this.hint.show("按住枪架后拉，拉住扫射", () => ({ node: this.root, bounds: this.hintBounds }));
            this.hint.advance(dt);
        } else if (this.hint.visible) this.hint.hide();
    }
}
