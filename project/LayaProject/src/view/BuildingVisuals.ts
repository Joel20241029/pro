import { SpriteFrames } from "./SpriteFrames";
import { BuildingLook, BuildingNode, buildingLayoutId } from "./BuildingLayout";
import { BattleSimulation, Shot } from "../game/BattleSimulation";
import { RULE } from "../game/GameConfig";
import { GroundPoint } from "./VillageScene";
import { BuildingAmbient } from "./BuildingAmbient";
import { TipTarget } from "./AnchoredTip";
export { BuildingLook } from "./BuildingLayout";

/** 图稿按原地图足点等比放大25%。这个比例只用于贴图、局部动效和挂点。 */
const BUILDING_ART_SCALE = 1.25;

/** 原生编辑器部件与局部帧共用同一地图足点。 */
export class BuildingVisuals {
    private key = ""; private level = 0; private rooms = 1;
    private parts = new Laya.Sprite(); private badge = new Laya.Text();
    private body: Laya.Sprite | null = null; private muzzle: Laya.Sprite | null = null;
    private upgrades: Laya.AnimatorClip2D[] = [];
    private attack: { node: Laya.Sprite; clip: string }[] = [];
    private above: Laya.Sprite | null = null; private aboveSort: GroundPoint | null = null;
    private upgradePending = 0;
    private expansion = 0;
    private gateFlare = 0;
    private ambient: BuildingAmbient;
    private elapsed = 0; private upgrading = false;
    private battle: BattleSimulation | null = null; private latestShot: Shot | null = null;
    private cachedBodyRegion: TipTarget | null = null;
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
        if (data.name.startsWith("Attack:")) this.attack.push({ node, clip: data.name.slice("Attack:".length) });
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
    sync(kind: BuildingLook | null, level: number, freshVillage: boolean, rooms = 1, damaged = false, facing = 1, expansion = 0) {
        const key = `${kind}:${damaged}:${facing}`;
        if (freshVillage) {
            this.upgradePending = 0; this.upgrading = false; this.gateFlare = 0; this.ambient.reset();
            this.upgrades.forEach(a => a.gotoAndStop(1)); this.latestShot = null;
        } else if (kind && this.level > 0) {
            const gains = Math.max(level - this.level, expansion - this.expansion, rooms - this.rooms, 0);
            if (kind === "HOUSE" || kind === "FARM" || kind === "LOGGING" || kind === "GATE") this.upgradePending += gains;
            else if (gains) this.upgradePending = 1;
        }
        this.expansion = expansion;
        this.level = level; this.rooms = rooms;
        if (key === this.key) {
            this.updateBadge(level, this.owner.width / 128);
            return;
        }
        this.key = key;
        this.parts.destroyChildren(); this.above?.destroy(true); this.above = null; this.aboveSort = null;
        this.body = this.muzzle = null; this.upgrades = []; this.attack = []; this.ambient.clear();
        this.cachedBodyRegion = null;
        this.latestShot = null; this.badge.visible = false;
        if (!kind) { this.upgradePending = 0; this.upgrading = false; return; }
        this.owner.texture = null;
        const layout = this.art.buildingLayouts[buildingLayoutId(kind)];
        if (!layout) throw new Error("缺少编辑器建筑布局:" + key);
        const root = this.create(layout, this.parts), scale = this.owner.width / 128;
        this.owner.size(this.owner.width, this.owner.width).pivot(layout.sort.x * scale, layout.sort.y * scale);
        this.parts.size(128, 128).pivot(layout.sort.x, layout.sort.y).pos(layout.sort.x * scale, layout.sort.y * scale);
        this.parts.scale(scale * BUILDING_ART_SCALE, scale * BUILDING_ART_SCALE);
        this.body = root.getChildByName("Body") as Laya.Sprite;
        if (kind === "ARROW") {
            // 左右武器各自预渲染；只切换武器组，主体与固定光照不随塔位镜像。
            const weapon = this.body.getChildByName("Weapon") as Laya.Sprite;
            const right = weapon.getChildByName("FacingRight") as Laya.Sprite, left = weapon.getChildByName("FacingLeft") as Laya.Sprite;
            right.visible = facing > 0; left.visible = facing < 0;
            this.muzzle = (facing > 0 ? right : left).getChildByName("Muzzle") as Laya.Sprite;
        }
        const upper = root.getChildByName("AboveGround") as Laya.Sprite;
        if (upper) {
            this.above = new Laya.Sprite(); this.above.name = this.owner.name + ":above";
            this.above.mouseEnabled = false; this.above.stackingRoot = true;
            this.owner.parent.addChild(this.above); this.above.addChild(upper);
            this.aboveSort = { x: upper.x, y: upper.y };
        }
        if (damaged) {
            // 沿用城门低于35%血量的损坏档；裂缝附着门板，不改变碰撞/遮挡根。
            const door = this.body.getChildByName("GateDoors") as Laya.Sprite;
            door.alpha = .68; door.rotation = 6;
            door.graphics.drawLines(door.width * .45, 2, [0, 0, -5, 8, 2, 13, -3, 22], "#41251e", 2);
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
    /** 面板完全关闭后按每次升级依次播放，动画仍附在各自的部件上。 */
    beginVisibleUpgrade(): boolean {
        if (!this.upgradePending || this.upgrading || !this.upgrades.length) return false;
        this.upgradePending--; this.elapsed = 0; this.upgrading = true;
        this.upgrades.forEach(a => a.gotoAndStop(0)); return true;
    }
    advance(delta: number, night = false, working = false) {
        let progress = 1;
        if (this.upgrading) {
            this.elapsed += delta;
            progress = Math.min(1, this.elapsed / this.upgrades[0].clip.duration());
            this.upgrades.forEach(a => a.gotoAndStop(progress)); this.upgrading = progress < 1;
        }
        this.gateFlare = this.upgrading ? Math.sin(Math.PI * progress) : 0;
        this.ambient.advance(delta, night, working);
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
    updateAttack(battle: BattleSimulation | null, tower: number, shots: Iterable<Shot>, time: number) {
        if (battle !== this.battle) { this.battle = battle; this.latestShot = null; }
        if (!this.attack.length) return;
        if (battle) for (const shot of shots)
            if (shot.tower === tower && (!this.latestShot || shot.tick > this.latestShot.tick)) this.latestShot = shot;
        const age = this.latestShot ? Math.max(0, time - (this.latestShot.tick + 1) * RULE.step) : Infinity;
        for (const { node, clip } of this.attack) {
            const animation = this.art.animation(clip);
            const index = Math.floor(age * animation.fps);
            const active = index < animation.frameIds.length;
            node.texture = this.art.get(active ? animation.frameIds[index] : animation.restFrame);
            if (clip === "motion_slow_attack") {
                node.visible = active;
                this.ambient.showFrostIdle(!active);
            }
        }
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
        const point = weapon.localToGlobal(new Laya.Point(weapon.width / 2, weapon.height), false, parent);
        return { x: point.x, y: point.y, scale: this.parts.scaleX * Math.abs(this.owner.scaleX) };
    }
}
