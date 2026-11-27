import { CANNON_MUZZLES } from "./config/CannonArt";
import { SpriteFrames } from "./SpriteFrames";
import { BuildingLook, BuildingNode, buildingLayoutId } from "./BuildingLayout";
import { BattleSimulation, Shot } from "../game/BattleSimulation";
import { RULE } from "../game/GameConfig";
import { GroundPoint } from "./VillageScene";
import { BuildingAmbient } from "./BuildingAmbient";
import { TipTarget } from "./AnchoredTip";
import type { TowerFlag } from "../config/DefenseConfig";
import { TowerPennant } from "./TowerPennant";
export { BuildingLook } from "./BuildingLayout";

/** 图稿按原地图足点等比放大25%。这个比例只用于贴图、局部动效和挂点。 */
const BUILDING_ART_SCALE = 1.25;
/** 以占地足点为支点，整塔先长高，再统一回弹。单位为表现秒。 */
const TOWER_GROWTH = { seconds: .6, stretchAt: .65, overshoot: .12 } as const;

/** 原生编辑器部件与局部帧共用同一地图足点。 */
export class BuildingVisuals {
    private key = ""; private level = 0;
    private parts = new Laya.Sprite(); private badge = new Laya.Text();
    private body: Laya.Sprite | null = null; private muzzle: Laya.Sprite | null = null;
    private upgrades: Laya.AnimatorClip2D[] = [];
    private barrel: { rest: Laya.Sprite; aimed: Laya.Sprite; restX: number; restY: number; x: number; y: number } | null = null;
    private above: Laya.Sprite | null = null; private aboveSort: GroundPoint | null = null;
    private upgradePending = 0;
    private gateFlare = 0;
    private ambient: BuildingAmbient;
    private elapsed = 0; private upgrading = false;
    private tower = false;
    private bodyScale = 1;
    private battle: BattleSimulation | null = null; private latestShot: Shot | null = null;
    private cachedBodyRegion: TipTarget | null = null;
    private pennant: TowerPennant | null = null;
    constructor(private owner: Laya.Sprite, private art: SpriteFrames) {
        this.ambient = new BuildingAmbient(art);
        this.parts.name = "EditorBuilding"; this.parts.mouseEnabled = false; owner.addChild(this.parts);
        this.badge.name = "UpgradeLevel"; this.badge.mouseEnabled = false;
        this.badge.wordWrap = false; this.badge.overflow = Laya.Text.SHRINK; this.badge.bold = true;
        this.badge.color = "#fff0ac"; this.badge.strokeColor = "#493420"; this.badge.align = "center"; this.badge.valign = "middle";
        owner.addChild(this.badge); this.badge.visible = false;
    }
    private create(data: BuildingNode, parent: Laya.Sprite): Laya.Sprite {
        const node = new Laya.Sprite(); node.name = data.name; node.mouseEnabled = false;
        if (data.frame) node.texture = this.art.get(data.frame);
        // 省略属性使用 Sprite 自身默认值，与原生 .lh 解码语义一致。
        for (const property of ["x", "y", "width", "height", "anchorX", "anchorY", "scaleX", "scaleY", "rotation", "alpha", "visible"] as const)
            if (data[property] !== undefined) (node as any)[property] = data[property];
        parent.addChild(node);
        this.ambient.bind(node);
        if (data.name === "Muzzle") this.muzzle = node;
        for (const child of data.children || []) this.create(child, node);
        if (data.clip) {
            const animator = node.addComponent(Laya.AnimatorClip2D); animator.autoPlay = false;
            animator.clip = this.art.buildingUpgrade;
            this.upgrades.push(animator);
            animator.gotoAndStop(1);
        }
        return node;
    }
    sync(kind: BuildingLook | null, level: number, freshVillage: boolean, damaged = false, facing = 1) {
        const key = `${kind}:${damaged}:${facing}`;
        this.tower = kind === "CANNON";
        if (freshVillage) {
            this.upgradePending = 0; this.upgrading = false; this.gateFlare = 0; this.ambient.reset();
            this.upgrades.forEach(a => a.gotoAndStop(1)); this.latestShot = null;
            this.parts.scale(this.bodyScale, this.bodyScale);
        } else if (kind && this.level > 0) {
            const gains = Math.max(level - this.level, 0);
            if (kind === "HOUSE" || kind === "GATE") this.upgradePending += gains;
            else if (gains) this.upgradePending = 1;
        }
        this.level = level;
        if (key === this.key) {
            this.updateBadge(level, this.owner.width / 128);
            return;
        }
        this.key = key;
        this.upgrading = false;
        this.parts.destroyChildren(); this.above?.destroy(true); this.above = null; this.aboveSort = null;
        this.body = this.muzzle = null; this.upgrades = []; this.barrel = null; this.ambient.clear();
        this.cachedBodyRegion = null;
        this.latestShot = null; this.badge.visible = false;
        if (!kind) { this.upgradePending = 0; this.upgrading = false; return; }
        this.owner.texture = null;
        const layout = this.art.buildingLayouts[buildingLayoutId(kind)];
        if (!layout) throw new Error("缺少编辑器建筑布局:" + key);
        const root = this.create(layout, this.parts), scale = this.owner.width / 128;
        this.owner.size(this.owner.width, this.owner.width).pivot(layout.sort.x * scale, layout.sort.y * scale);
        this.parts.size(128, 128).pivot(layout.sort.x, layout.sort.y).pos(layout.sort.x * scale, layout.sort.y * scale);
        this.bodyScale = scale * BUILDING_ART_SCALE;
        this.parts.scale(this.bodyScale, this.bodyScale);
        this.body = root.getChildByName("Body") as Laya.Sprite;
        if (kind === "CANNON") {
            this.body.scaleX = facing;
            const weapon = this.body.getChildByName("Weapon") as Laya.Sprite;
            const aimed = weapon.getChildByName("AimedBarrel") as Laya.Sprite;
            this.barrel = { rest: weapon.getChildByName("RestBarrel") as Laya.Sprite, aimed,
                x: aimed.x, y: aimed.y, restX: this.muzzle!.x, restY: this.muzzle!.y };
        }
        const upper = root.getChildByName("AboveGround") as Laya.Sprite;
        if (upper) {
            this.above = new Laya.Sprite(); this.above.name = this.owner.name + ":above";
            this.above.mouseEnabled = false; this.above.stackingRoot = true;
            this.owner.parent.addChild(this.above); this.above.addChild(upper);
            this.aboveSort = { x: upper.x, y: upper.y };
        }
        if (damaged) {
            // 低血量时门板暗淡，裂纹固定在左门柱上，开门时仍贴在木头上。
            const door = this.body.getChildByName("GateDoors") as Laya.Sprite;
            const post = this.body.getChildByName("Structure") as Laya.Sprite;
            door.alpha = .68;
            post.graphics.drawLines(post.width * .13, post.height * .35, [0, 0, -4, 7, 1, 11, -3, 18], "#41251e", 2);
        }
        this.updateBadge(level, scale);
    }
    private updateBadge(level: number, scale: number) {
        this.badge.visible = level >= 13;
        if (this.badge.visible) {
            this.badge.visible = true; this.badge.text = String(level); this.badge.fontSize = 19 * scale; this.badge.stroke = 2 * scale;
            this.badge.size(64 * scale, 24 * scale).pivot(32 * scale, 0).pos(64 * scale, 93 * scale);
            this.badge.scaleX = this.owner.scaleX;
        }
    }
    syncPennant(flag: TowerFlag | undefined, facing: number) {
        if (flag) this.pennant ??= new TowerPennant(this.owner);
        this.pennant?.sync(flag, facing, this.bodyScale);
    }
    /** 面板收起后再播。塔的整套表现共用足点，其他建筑沿用本地部件动画。 */
    beginVisibleUpgrade(): boolean {
        if (!this.upgradePending || this.upgrading || (!this.tower && !this.upgrades.length)) return false;
        this.upgradePending--; this.elapsed = 0; this.upgrading = true;
        if (this.tower) this.parts.scale(this.bodyScale * .76, this.bodyScale * .58);
        else this.upgrades.forEach(a => a.gotoAndStop(0));
        return true;
    }
    advance(delta: number, night = false, working = false) {
        let progress = 1;
        if (this.upgrading) {
            this.elapsed += delta;
            progress = Math.min(1, this.elapsed / (this.tower ? TOWER_GROWTH.seconds : this.upgrades[0].clip.duration()));
            if (this.tower && progress === 1) this.parts.scale(this.bodyScale, this.bodyScale);
            else if (this.tower) {
                const { stretchAt, overshoot } = TOWER_GROWTH;
                const rise = 1 - (1 - Math.min(1, progress / stretchAt)) ** 3;
                const settle = Math.max(0, (progress - stretchAt) / (1 - stretchAt));
                this.parts.scale(this.bodyScale * (.76 + (.24 + overshoot / 2) * rise - overshoot / 2 * settle),
                    this.bodyScale * (.58 + (.42 + overshoot) * rise - overshoot * settle));
            } else this.upgrades.forEach(a => a.gotoAndStop(progress));
            this.upgrading = progress < 1;
        }
        this.gateFlare = this.upgrading ? Math.sin(Math.PI * progress) : 0;
        this.ambient.advance(delta, night, working);
        this.pennant?.advance(delta);
    }
    upgradeFlare() { return this.gateFlare; }
    /** 实际贴图范围用于民房点击和屋顶提示；编辑器bounds含安全留白，不能作为屋顶。
     * 只缓存Body本地范围；坐标换算仍取当前缩放，升级动画与窗口重排不会留下旧挂点。
     */
    bodyRegion(): TipTarget {
        if (!this.body) throw new Error("当前建筑没有可交互主体");
        if (!this.cachedBodyRegion) {
            const node = this.body.getChildByName("Structure") as Laya.Sprite;
            this.cachedBodyRegion = { node, bounds: node.getSelfBounds(new Laya.Rectangle(), true) };
        }
        return this.cachedBodyRegion;
    }
    /** 水车从地面农田分离，只按自己的足底与人物排序；重排时从owner当前坐标重算。 */
    occluder(): { id: string; y: number; node: Laya.Sprite } | null {
        if (!this.above || !this.aboveSort) return null;
        const parent = this.owner.parent as Laya.Sprite;
        const origin = this.parts.localToGlobal(new Laya.Point(0, 0), false, parent);
        const foot = this.parts.localToGlobal(new Laya.Point(this.aboveSort.x, this.aboveSort.y), false, parent);
        this.above.pos(origin.x, origin.y).scale(this.parts.scaleX * this.owner.scaleX, this.parts.scaleY * this.owner.scaleY);
        this.above.rotation = this.owner.rotation;
        return { id: this.above.name, y: foot.y, node: this.above };
    }
    /** 齐射共用一次局部动画。表现时钟和弹道共用，结算时最后一发也能播完。 */
    updateAttack(battle: BattleSimulation | null, tower: number, shots: Iterable<Shot>, time: number, screenY: (y: number) => number) {
        if (battle !== this.battle) { this.battle = battle; this.latestShot = null; }
        const barrel = this.barrel;
        if (!barrel || !this.muzzle) return;
        if (battle) for (const shot of shots)
            if (shot.tower === tower && (!this.latestShot || shot.tick > this.latestShot.tick)) this.latestShot = shot;
        const shot = this.latestShot;
        barrel.rest.visible = !shot;
        barrel.aimed.visible = !!shot;
        if (!shot) { this.muzzle.pos(barrel.restX, barrel.restY); return; }
        const pivot = this.weaponAnchor();
        const dx = Math.max(0, (shot.x - pivot.x) * this.body!.scaleX);
        const angle = Math.atan2(pivot.y - screenY(shot.y), dx);
        const index = Math.round((angle / Math.PI + .5) * (CANNON_MUZZLES.length - 1));
        const tip = CANNON_MUZZLES[index];
        const age = Math.max(0, time - (shot.tick + 1) * RULE.step);
        // 炮管在发射后沿自身方向后坐，0.16 秒内回到炮架。
        const recoil = 3 * Math.max(0, 1 - age / .16);
        const rx = -Math.cos(angle) * recoil, ry = Math.sin(angle) * recoil;
        barrel.aimed.texture = this.art.get(`cannon_yaw_${index}`);
        barrel.aimed.pos(barrel.x + rx, barrel.y + ry);
        this.muzzle.pos(tip.x + rx, tip.y + ry);
    }
    /** 编辑器 Muzzle 挂点应用结构缩放和左右镜像；弹道在发射时保存此坐标。 */
    launchPoint(): GroundPoint {
        if (!this.muzzle || !this.body) throw new Error("当前建筑没有发射口");
        const point = this.muzzle.localToGlobal(new Laya.Point(0, 0), false, this.owner.parent as Laya.Sprite);
        return { x: point.x, y: point.y };
    }
    /** 光环绕武器基部，不能使用偏向箭尖的Muzzle。跟随编辑器等级、后坐与当前塔缩放。 */
    weaponAnchor(): GroundPoint & { scale: number } {
        const weapon = this.body!.getChildByName("Weapon") as Laya.Sprite;
        const parent = this.owner.parent as Laya.Sprite;
        // Weapon 的 x/y 就是编辑器设置的安装支点，部件放大不改变狂怒光环大小。
        const point = this.body!.localToGlobal(new Laya.Point(weapon.x, weapon.y), false, parent);
        return { x: point.x, y: point.y, scale: this.parts.scaleX * Math.abs(this.owner.scaleX) };
    }
}
