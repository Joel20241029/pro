import { SpriteFrames } from "./SpriteFrames";
import { BuildingLook, BuildingNode, buildingLayoutId } from "./BuildingLayout";
import { BattleSimulation, Shot } from "../game/BattleSimulation";
import { RULE } from "../game/GameConfig";
import { GroundPoint } from "./VillageScene";
import { TipTarget } from "./AnchoredTip";
export { BuildingLook } from "./BuildingLayout";

/** 原生编辑器部件+共享 .mc；地图根的足底/排序不动，动画只作用于内部 Body/Weapon。 */
export class BuildingVisuals {
    private key = ""; private level = 0; private rooms = 1;
    private parts = new Laya.Sprite(); private badge = new Laya.Text();
    private body: Laya.Sprite | null = null; private muzzle: Laya.Sprite | null = null;
    private upgrades: Laya.AnimatorClip2D[] = []; private attack: Laya.AnimatorClip2D | null = null;
    private above: Laya.Sprite | null = null; private aboveSort: GroundPoint | null = null;
    private upgradePending = false;
    private elapsed = 0; private upgrading = false;
    private battle: BattleSimulation | null = null; private latestShot: Shot | null = null;
    private cachedBodyRegion: TipTarget | null = null;
    constructor(private owner: Laya.Sprite, private art: SpriteFrames) {
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
        if (data.name === "Muzzle") this.muzzle = node;
        for (const child of data.children || []) this.create(child, node);
        if (data.clip) {
            const animator = node.addComponent(Laya.AnimatorClip2D); animator.autoPlay = false;
            animator.clip = data.clip === "upgrade" ? this.art.buildingUpgrade : this.art.buildingAttack;
            if (data.clip === "upgrade") this.upgrades.push(animator); else this.attack = animator;
            animator.gotoAndStop(1);
        }
        return node;
    }
    sync(kind: BuildingLook | null, level: number, freshVillage: boolean, rooms = 1, damaged = false, facing = 1) {
        const key = `${kind}:${level}:${rooms}:${damaged}:${facing}`;
        if (freshVillage) { this.upgradePending = false; this.upgrading = false; this.upgrades.forEach(a => a.gotoAndStop(1)); this.latestShot = null; this.attack?.gotoAndStop(1); }
        if (key === this.key) return;
        const animate = !freshVillage && kind && this.level > 0 && (level > this.level || rooms > this.rooms);
        this.key = key; this.level = level; this.rooms = rooms;
        this.parts.destroyChildren(); this.above?.destroy(true); this.above = null; this.aboveSort = null;
        this.body = this.muzzle = null; this.upgrades = []; this.attack = null;
        this.cachedBodyRegion = null;
        this.latestShot = null; this.upgrading = false; this.badge.visible = false;
        // 空地已没有动画节点，同时撤销旧建筑待播动作；非空建筑的损坏/朝向重建仍保留待播升级。
        if (!kind) { this.upgradePending = false; return; }
        this.owner.texture = null;
        const layout = this.art.buildingLayouts[buildingLayoutId(kind, level, rooms)];
        if (!layout) throw new Error("缺少编辑器建筑布局:" + key);
        const root = this.create(layout, this.parts), scale = this.owner.width / 128;
        this.owner.size(this.owner.width, this.owner.width).pivot(layout.sort.x * scale, layout.sort.y * scale);
        this.parts.scale(scale, scale);
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
        if (level >= 13) {
            this.badge.visible = true; this.badge.text = String(level); this.badge.fontSize = 19 * scale; this.badge.stroke = 2 * scale;
            this.badge.size(64 * scale, 24 * scale).pivot(32 * scale, 0).pos(64 * scale, 93 * scale);
            this.badge.scaleX = this.owner.scaleX;
        }
        if (animate) this.upgradePending = true;
    }
    /** 面板关闭后开始已有建筑升级动作；同栋连续升级只消费一次。 */
    beginVisibleUpgrade(): boolean {
        if (!this.upgradePending) return false;
        this.upgradePending = false; this.elapsed = 0; this.upgrading = true; this.upgrades.forEach(a => a.gotoAndStop(0)); return true;
    }
    advance(delta: number) {
        if (!this.upgrading) return;
        this.elapsed += delta;
        const progress = Math.min(1, this.elapsed / this.upgrades[0].clip.duration());
        this.upgrades.forEach(a => a.gotoAndStop(progress)); this.upgrading = progress < 1;
    }
    /** 实际贴图范围用于民房点击和屋顶提示；编辑器bounds含安全留白，不能作为屋顶。
     * 只缓存Body本地范围；坐标换算仍取当前缩放，升级动画与窗口重排不会留下旧挂点。
     */
    bodyRegion(): TipTarget {
        if (!this.body) throw new Error("当前建筑没有可交互主体");
        if (!this.cachedBodyRegion)
            this.cachedBodyRegion = { node: this.body, bounds: this.body.getSelfBounds(new Laya.Rectangle(), true) };
        return this.cachedBodyRegion;
    }
    /** 水车从地面农田分离，只按自己的足底与人物排序；重排时从owner当前坐标重算。 */
    occluder(): { id: string; y: number; node: Laya.Sprite } | null {
        if (!this.above || !this.aboveSort) return null;
        const scale = this.owner.width / 128, parent = this.owner.parent as Laya.Sprite;
        const origin = this.owner.localToGlobal(new Laya.Point(0, 0), false, parent);
        const foot = this.owner.localToGlobal(new Laya.Point(this.aboveSort.x * scale, this.aboveSort.y * scale), false, parent);
        this.above.pos(origin.x, origin.y).scale(scale * this.owner.scaleX, scale * this.owner.scaleY);
        this.above.rotation = this.owner.rotation;
        return { id: this.above.name, y: foot.y, node: this.above };
    }
    /** 保存最后一发Shot，避免逻辑短队列移除时动作提前结束；暂停和倍速跟随战斗tick。 */
    updateAttack(battle: BattleSimulation | null, tower: number) {
        if (battle !== this.battle) { this.battle = battle; this.latestShot = null; this.attack?.gotoAndStop(1); }
        if (!this.attack) return;
        if (!battle || battle.outcome) { this.latestShot = null; this.attack.gotoAndStop(1); return; }
        for (const shot of battle.shots) if (shot.tower === tower && (!this.latestShot || shot.tick > this.latestShot.tick)) this.latestShot = shot;
        if (this.latestShot) {
            const age = (battle.tick - this.latestShot.tick - 1) * RULE.step;
            this.attack.gotoAndStop(Math.min(1, Math.max(0, age) / this.attack.clip.duration()));
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
        return { x: point.x, y: point.y, scale: this.owner.width / 128 * Math.abs(this.owner.scaleX) };
    }
}
