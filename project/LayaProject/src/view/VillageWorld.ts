import { CombatPresentation } from "./CombatPresentation";
import { LoggingFeedback } from "./LoggingFeedback";
import { EnemyVisuals } from "./EnemyVisuals";
import { GameSession } from "../game/GameSession";
import { person } from "../game/VillageRules";
import { GameState, isElder } from "../game/GameState";
import { ELITE, RULE } from "../game/GameConfig";
import { BattleSimulation, pointAt } from "../game/BattleSimulation";
import { gateCapacity } from "../game/Growth";
import { SpriteFrames } from "./SpriteFrames";
import { compareDepth, layoutVillage, TOWER_VIEW, VillageNavigation, WEDDING } from "./VillageScene";
import { GameLayout } from "./GameLayout";
import { VillagerMotion } from "./VillagerMotion";
import { WalkAnimation } from "./WalkAnimation";
import { ProjectileMotion } from "./ProjectileMotion";
import { C } from "./UiTheme";
import { EMOTE, VillagerEmotes } from "./VillagerEmotes";
import { BuildingLook, BuildingVisuals } from "./BuildingVisuals";
import { houseRooms } from "./BuildingLayout";
import { UiWidgets } from "./UiWidgets";
import { HOUSE_TIP_NAMES } from "./config/AnchoredTipConfig";
import { HUD } from "./config/HudConfig";
import { WORLD_ART } from "./config/WorldArtConfig";
/** 同一份绘制深度同时用于地图点选；人物身份随当前帧写入，不能绑定到精灵池下标。 */
interface WorldItem {
    id: string; y: number; node: Laya.Sprite;
    visual?: BuildingVisuals; ground?: boolean; personId?: string;
}
/** 地图、人物、建筑与战斗表现的唯一所有者。视觉时钟不推进 GameSession/业务随机数。 */
export class VillageWorld {
    readonly scenery = new Laya.Sprite();
    readonly world = new Laya.Sprite();
    readonly shots = new Laya.Sprite();
    readonly bellAura = new Laya.Sprite();
    readonly emote = new Laya.Sprite();
    private people: Laya.Sprite[] = [];
    private enemies: Laya.Sprite[] = [];
    private actorShadows: Laya.Sprite[] = [];
    private enemyVisuals: EnemyVisuals[] = [];
    private hearts: Laya.Sprite[] = [];
    private props: WorldItem[] = [];
    private pickDepth: WorldItem[] = [];
    private pressedTargets = new Map<number, { source: Laya.Sprite; sourceId: string; target: WorldItem }>();
    private pickPoint = new Laya.Point();
    private pickBounds = new Laya.Rectangle();
    private freshBuildingVillage = true;
    scene = layoutVillage(this.layout);
    private motion = new VillagerMotion(new VillageNavigation(this.scene.props, this.scene.landscape, this.scene.bounds), this.scene.stops);
    private emotes = new VillagerEmotes();
    private walkAnimation = new WalkAnimation(this.art);
    private feedback = new CombatPresentation();
    private logging = new LoggingFeedback();
    private projectiles = new ProjectileMotion();
    private projectileNodes: Laya.Sprite[] = [];
    private lastBattle: BattleSimulation | null = null;
    private lastBattleTick = 0;
    private backgroundKey = "";
    private renderDelta = 0;
    private sceneSeconds = 0;
    private hitTop = new Laya.Point();
    private hitBottom = new Laya.Point();
    constructor(private game: GameSession, private art: SpriteFrames, private ui: UiWidgets, private layout: GameLayout,
        private houseClicked: (name: string, visual: BuildingVisuals) => void, private personClicked: (id: string) => void) {
        this.world.name = "VillageWorld";
        const clickNodes: Laya.Sprite[] = [];
        for (const p of this.scene.props) {
            const node = new Laya.Sprite();
            node.name = p.id;
            node.mouseEnabled = false;
            node.stackingRoot = true;
            this.art.applyFrame(node, p.frame, p.size);
            node.pos(p.x, p.y);
            this.world.addChild(node);
            const upgradeable = p.id.startsWith("tower:") || (p.id.startsWith("building:") && p.id !== "building:hearth");
            this.props.push({ id: p.id, y: p.ground ? -1 : p.y, node, ground: p.ground, visual: upgradeable ? new BuildingVisuals(node, art) : undefined });
            if (HOUSE_TIP_NAMES[p.id]) {
                node.hitArea = new Laya.Rectangle();
                clickNodes.push(node);
            }
            if (p.signText) {
                const sign = WORLD_ART.sign;
                const title = this.ui.label(node, p.signText, p.size * sign.x, p.size * sign.y, p.size * sign.width, sign.font, "#59391e", true, p.size * sign.height);
                title.fontSize = sign.font;
                title.stroke = .7;
                title.strokeColor = "#f8d79c";
                title.align = "center";
                title.valign = "middle";
                title.wordWrap = false;
                title.overflow = Laya.Text.SHRINK;
            }
            if (p.id.startsWith("forest:") && Number(p.id.split(":")[1]) % 2 === 1) {
                const index = Number(p.id.split(":")[1]);
                const frame = ["deco_apple_pair", "deco_blossom_pink", "deco_pear_pair", "deco_blossom_ivory"][Math.floor(index / 2) % 4];
                // 花果在树冠内，作为树的子节点一起遮挡；不漂在更近的树或角色前面。
                this.ui.image(node, frame, p.size * .22, p.size * .37, p.size * .19);
                this.ui.image(node, frame, p.size * .59, p.size * .24, p.size * .17);
            }
            if (p.canopyDetails) for (const detail of p.canopyDetails)
                this.ui.image(node, detail.frame, p.size * detail.x, p.size * detail.y, p.size * detail.size).alpha = detail.alpha;
        }
        for (let i = 0; i < RULE.populationCap; i++) {
            const s = new Laya.Sprite();
            s.mouseEnabled = false;
            s.stackingRoot = true;
            this.world.addChild(s);
            this.people.push(s);
            s.hitArea = new Laya.Rectangle();
            clickNodes.push(s);
            // 红心与人物共用足底排序，屋顶仍可遮住他们；固定池随人物销毁，不在逐帧更新中创建节点。
            const heart = new Laya.Sprite();
            heart.name = "WeddingHeart";
            heart.mouseEnabled = false;
            heart.visible = false;
            s.addChild(heart);
            this.hearts.push(heart);
        }
        for (let i = 0; i < RULE.enemyCap * 2; i++) {
            const s = new Laya.Sprite();
            s.mouseEnabled = false;
            this.world.addChild(s);
            this.enemies.push(s); this.enemyVisuals.push(new EnemyVisuals(s, art));
        }
        for (let i = 0; i < RULE.effectCap; i++) {
            const s = new Laya.Sprite();
            s.mouseEnabled = false;
            s.visible = false;
            this.shots.addChild(s);
            this.projectileNodes.push(s);
        }
        // 软投影是普通图片，不是粒子。与人物/敌人共用固定池，脚底排序让农田地面上的阴影仍可见。
        for (let i = 0; i < this.people.length + this.enemies.length; i++) {
            const shadow = new Laya.Sprite(); shadow.texture = this.art.get("shadow_actor");
            shadow.name = "ContactShadow:" + i; shadow.mouseEnabled = false; shadow.visible = false;
            shadow.alpha = WORLD_ART.shadow.alpha; this.world.addChild(shadow); this.actorShadows.push(shadow);
        }
        for (const node of clickNodes) {
            node.on(Laya.Event.MOUSE_DOWN, this, (event: Laya.Event) => {
                const target = this.pickAt(event.stageX, event.stageY);
                if (target) this.pressedTargets.set(event.touchId, { source: node, sourceId: node.name, target });
                else { this.pressedTargets.delete(event.touchId); Laya.InputManager.cancelClick(event.touchId); }
            });
            this.ui.bindClick(node, event => {
                const down = this.pressedTargets.get(event.touchId);
                this.pressedTargets.delete(event.touchId);
                const target = this.pickAt(event.stageX, event.stageY);
                if (!down || !target || !down.source.visible || down.source.name !== down.sourceId || target.id !== down.target.id || target.node !== down.target.node) return;
                if (target.personId) this.personClicked(target.personId);
                else this.houseClicked(HOUSE_TIP_NAMES[target.id], target.visual!);
            });
            node.on(Laya.Event.MOUSE_OUT, this, (event?: Laya.Event) => {
                if (event) this.pressedTargets.delete(event.touchId);
            });
            node.on(Laya.Event.UNDISPLAY, this, () => {
                for (const [touchId, down] of this.pressedTargets)
                    if (down.source === node || down.target.node === node) {
                        Laya.InputManager.cancelClick(touchId); this.pressedTargets.delete(touchId);
                    }
            });
        }
    }
    /** 输入遍历不服从zIndex；逆序复用绘制深度，前景实体挡住后景，农田地面仍可点到农夫。 */
    private pickAt(stageX: number, stageY: number): WorldItem | null {
        const state = this.game.state;
        if (!state) return null;
        for (let i = this.pickDepth.length - 1; i >= 0; i--) {
            const item = this.pickDepth[i], node = item.node;
            if (item.ground || !node.visible || node.destroyed) continue;
            if (item.personId && (!state.people.some(p => p.id === item.personId) || this.motion.get(item.personId).insideTower)) continue;
            node.globalToLocal(this.pickPoint.setTo(stageX, stageY));
            // 人物只取自身贴图，红心不扩大点击范围；建筑/树木包含自己的可见部件。
            const bounds = item.personId ? node.getGraphicBounds(false, this.pickBounds) : node.getSelfBounds(this.pickBounds, true);
            if (bounds.contains(this.pickPoint.x, this.pickPoint.y))
                return item.personId || HOUSE_TIP_NAMES[item.id] ? item : null;
        }
        return null;
    }
    /** 高清 HUD 沿用像素塔足底下方的标签位置，与塔的左右镜像无关。 */
    towerAnchor(index: number) {
        const at = this.scene.pads[index];
        return { x: at.x, y: at.y + HUD.tower.top };
    }
    /** 返回血条下边沿，复用原2D城门上方布局，不依赖上一帧建筑是否已绘制。 */
    gateAnchor() {
        return { x: HUD.gate.x + HUD.gate.width / 2, y: this.layout.gateY + HUD.gate.barTop + HUD.gate.barHeight };
    }
    destroy() {
        for (const touchId of this.pressedTargets.keys()) Laya.InputManager.cancelClick(touchId);
        this.pressedTargets.clear();
    }
    reset() {
        for (const touchId of this.pressedTargets.keys()) Laya.InputManager.cancelClick(touchId);
        this.pressedTargets.clear(); this.pickDepth = [];
        this.motion = new VillagerMotion(new VillageNavigation(this.scene.props, this.scene.landscape, this.scene.bounds), this.scene.stops);
        this.emotes = new VillagerEmotes(); this.walkAnimation = new WalkAnimation(this.art);
        this.projectiles = new ProjectileMotion();
        this.feedback = new CombatPresentation(); this.logging = new LoggingFeedback();
        this.lastBattle = null;
        this.lastBattleTick = 0;
        this.renderDelta = 0;
        this.sceneSeconds = 0;
        this.freshBuildingVillage = true;
    }
    relayout(next: GameLayout) {
        const previous = this.layout, scene = layoutVillage(next);
        this.motion.relayout(new VillageNavigation(scene.props, scene.landscape, scene.bounds), scene.stops, p => ({ x: p.x, y: next.worldY(previous.referenceY(p.y)) }));
        this.layout = next;
        this.scene = scene;
        this.backgroundKey = "";
        this.props.forEach((p, i) => { const at = scene.props[i]; p.y = at.ground ? -1 : at.y; p.node.pos(at.x, at.y); });
    }
    sync(s: GameState, preserveOverlay: boolean) {
        if (!preserveOverlay)
            this.motion.sync(s, this.game.battle ? this.game.battle.base.towers : s.towers);
        this.emotes.sync(s);
    }
    drawScenery(night: boolean) {
        const key = night ? "night" : "day";
        if (this.backgroundKey === key)
            return;
        this.backgroundKey = key;
        this.scenery.destroyChildren();
        this.scenery.graphics.clear();
        const y = (value: number) => this.layout.worldY(value);
        const tint = night ? WORLD_ART.nightTint : WORLD_ART.dayTint;
        this.scenery.graphics.drawRect(0, 0, 720, this.layout.height, C.grass);
        const tile = WORLD_ART.grassTile;
        for (let top = 0; top < this.layout.footerTop; top += tile) for (let left = 0; left < 720; left += tile)
            this.scenery.graphics.drawImage(this.art.get("tile_ground_grass"), left, top, tile, tile, tint);
        // 路面可见部分全部在城墙之前；按战场段同一比例映射，不能拿含居民区的高度混合缩放。
        const battleScale = (y(830) - y(246)) / (830 - 246);
        this.scenery.graphics.drawImage(this.art.get("map_road"), 0, y(0), WORLD_ART.roadWidth, WORLD_ART.roadHeight * battleScale, tint);
        const shadow = WORLD_ART.shadow;
        for (const prop of this.scene.props) {
            if (prop.ground || prop.id.startsWith("wall:") || prop.id.startsWith("deco:")) continue;
            const tree = prop.id.startsWith("forest:") || prop.id.startsWith("tree:");
            const width = prop.size * (tree ? shadow.treeWidth : shadow.buildingWidth);
            const image = this.ui.image(this.scenery, tree ? "shadow_tree" : "shadow_actor", prop.x - width * shadow.centerX + shadow.x, prop.y - width * shadow.centerY + shadow.y, width);
            image.alpha = shadow.alpha;
        }
        for (const [x, at] of [[182, 399], [530, 470], [173, 591], [560, 643], [297, 628], [411, 356]])
            this.ui.image(this.scenery, "deco_rocks", x, y(at), 36);
    }
    advance(delta: number): boolean {
        if (!this.game.pauses.size) {
            const visualTime = Math.min(RULE.frameCap, Math.max(0, delta));
            this.props.forEach(p => p.visual?.advance(visualTime));
        }
        const battle = this.game.battle, s = this.game.state;
        if (battle !== this.lastBattle) {
            this.lastBattle = battle;
            this.lastBattleTick = 0;
        }
        const visualDelta = battle ? Math.max(0, battle.tick - this.lastBattleTick) * RULE.step : Math.min(RULE.frameCap, Math.max(0, delta));
        this.lastBattleTick = battle ? battle.tick : 0;
        if (!this.game.pauses.size) this.feedback.advance(Math.min(RULE.frameCap, Math.max(0, delta)));
        if (s && !this.game.pauses.size && (s.phase === "DAY" || s.phase === "NIGHT")) {
            this.sceneSeconds += visualDelta;
            this.motion.update(visualDelta);
            for (const p of s.people) { const pose = this.motion.get(p.id); this.logging.sample(p.id, pose.clip, pose.elapsed, pose.animated && !pose.walking && s.phase === "DAY"); }
            this.logging.retain(new Set(s.people.map(p => p.id)));
            const tree = this.props.find(p => p.id === "tree:logging");
            if (tree) tree.node.rotation = this.logging.advance(visualDelta);
            this.emotes.update(s, Math.min(RULE.frameCap, Math.max(0, delta)), id => { const pose = this.motion.get(id); return !pose.insideTower && pose.y > this.layout.worldY(840) && pose.heartElapsed === null; });
        }
        this.renderDelta += delta;
        if (this.renderDelta < 1 / 30)
            return false;
        this.renderDelta = 0;
        return true;
    }
    render(panelOpen: boolean) {
        const s = this.game.state, battle = this.game.battle;
        this.feedback.sync(battle, this.game.takeCombatFeedback());
        this.bellAura.visible = false;
        this.bellAura.graphics.clear();
        this.people.forEach(n => n.visible = false);
        this.enemies.forEach(n => n.visible = false);
        this.actorShadows.forEach(n => n.visible = false);
        this.projectileNodes.forEach(n => n.visible = false);
        this.hearts.forEach(n => { n.visible = false; n.alpha = 1; n.scale(1, 1); n.pos(0, 0); });
        this.emote.visible = false;
        const depth = this.props.slice();
        if (!s) {
            depth.sort(compareDepth).forEach((p, i) => p.node.zIndex = i);
            this.pickDepth = [];
            return;
        }
        for (const p of this.props) {
            let kind: BuildingLook | null = null, level = 0, rooms = 1, damaged = false, facing = 1;
            if (p.id === "building:gate") {
                damaged = (battle ? battle.gate : s.gate) / gateCapacity(s) < .35;
                kind = "GATE";
                level = s.gateLevel;
            }
            else if (p.id.startsWith("tower:")) {
                const index = Number(p.id.split(":")[1]), t = (battle ? battle.base.towers : s.towers)[index];
                p.node.texture = t.kind ? null : this.art.get("building_tower_pad");
                p.node.scale(t.kind ? 1 : TOWER_VIEW.emptyScale, t.kind ? 1 : TOWER_VIEW.emptyScale); facing = TOWER_VIEW.facing[index];
                kind = t.kind;
                level = t.level;
            }
            else if (p.id.startsWith("building:house-")) {
                kind = "HOUSE";
                level = s.housing;
                rooms = houseRooms(s.houses, p.id === "building:house-b");
            }
            else if (p.id === "building:farm") {
                kind = "FARM";
                level = s.farm;
            }
            else if (p.id === "building:logging") {
                kind = "LOGGING";
                level = s.logging;
            }
            p.visual?.sync(kind, level, this.freshBuildingVillage, rooms, damaged, facing);
            if (p.id === "building:hearth") p.node.texture = this.art.get(this.art.frameId("hearth_burn", this.sceneSeconds));
            if (!panelOpen && !this.game.pauses.size) p.visual?.beginVisibleUpgrade();
            if (HOUSE_TIP_NAMES[p.id]) {
                const { node, bounds } = p.visual!.bodyRegion();
                node.localToGlobal(this.hitTop.setTo(bounds.x, bounds.y), false, p.node);
                node.localToGlobal(this.hitBottom.setTo(bounds.x + bounds.width, bounds.y + bounds.height), false, p.node);
                (p.node.hitArea as Laya.Rectangle).setTo(this.hitTop.x, this.hitTop.y, this.hitBottom.x - this.hitTop.x, this.hitBottom.y - this.hitTop.y);
            }
            const extra = p.visual?.occluder();
            if (extra)
                depth.push(extra);
        }
        for (const p of this.props)
            if (p.id.startsWith("tower:"))
                p.visual!.updateAttack(battle, Number(p.id.split(":")[1]));
        this.projectiles.update(battle, this.layout, this.scene.pads, index => this.props.find(p => p.id === `tower:${index}`)!.visual!.launchPoint(), this.feedback);
        this.freshBuildingVillage = false;
        this.walkAnimation.retain(new Set(s.people.map(p => p.id)));
        if (this.art.ready("characters")) s.people.forEach((p, i) => {
            const n = this.people[i], pose = this.motion.get(p.id);
            n.visible = !pose.insideTower;
            n.name = `person:${p.id}`;
            const identity = isElder(p) ? `elder_${p.sex === "MALE" ? "male" : "female"}` : p.adult ? p.appearance : p.sex === "MALE" ? "boy" : "girl";
            const facing = pose.clip.endsWith("_walk") ? this.art.walk(identity, pose.direction) : /_(chop|care)$/.test(pose.clip) ? this.art.labor(pose.clip, pose.mirror) : { clip: pose.clip, mirror: false };
            const scale = (p.elite ? ELITE.visualScale : 1) * this.layout.personScale;
            const size = p.adult ? 56 : p.growth === 0 ? 42 : 48;
            const frame = pose.clip.endsWith("_walk") ? this.walkAnimation.frame(pose, facing.clip, size * scale) : this.art.frameId(facing.clip, pose.elapsed, pose.animated);
            this.art.applyFrame(n, frame, size);
            n.getGraphicBounds(false, n.hitArea as Laya.Rectangle);
            n.pos(pose.x, pose.y);
            n.scale((facing.mirror ? -1 : 1) * scale, scale);
            if (pose.heartElapsed !== null && n.visible) {
                const heart = this.hearts[i], elapsed = pose.heartElapsed;
                if (!heart.texture) this.art.applyFrame(heart, "fx_hearts", WEDDING.heartSize);
                heart.visible = true;
                heart.alpha = Math.min(1, elapsed / WEDDING.fadeIn, (WEDDING.heartSeconds - elapsed) / WEDDING.fadeOut);
                const pulse = 1 + WEDDING.pulse * Math.sin(elapsed / WEDDING.pulseSeconds * Math.PI * 2);
                // 局部坐标以人物原画布为基准，减去足底 pivot 后正好位于头顶；反镜像保持红心构图一致。
                heart.pos(n.pivotX, n.pivotY - WEDDING.headOffset - WEDDING.rise * elapsed / WEDDING.heartSeconds);
                heart.scale((facing.mirror ? -1 : 1) * pulse, pulse);
            }
            depth.push({ id: n.name, y: pose.y, node: n, personId: p.id });
        });
        const emote = this.emotes.current;
        if (this.art.ready("characters") && emote && !panelOpen && !this.game.pauses.size && (s.phase === "DAY" || s.phase === "NIGHT")) {
            const pose = this.motion.get(emote.id);
            if (!pose.insideTower) {
                const owner = person(s, emote.id), scale = (owner.elite ? ELITE.visualScale : 1) * this.layout.personScale;
                const elapsed = EMOTE.seconds - emote.remaining;
                this.emote.visible = true;
                this.art.applyFrame(this.emote, emote.frameId, EMOTE.size);
                // 依人物原画布挂点，同时应用屏幕与精英缩放，只上浮3px，保持贴近头顶。
                const headOffset = owner.adult ? 52 : 46;
                this.emote.pos(Math.max(EMOTE.size / 2, Math.min(720 - EMOTE.size / 2, pose.x)), pose.y - headOffset * scale - Math.sin(Math.min(1, elapsed / .25) * Math.PI / 2) * 3);
                this.emote.alpha = Math.min(1, elapsed / .16, emote.remaining / .25);
            }
        }
        if (battle && this.art.ready("battle")) {
            const ringing = !battle.outcome && battle.bellTicks > 0;
            if (ringing) {
                this.bellAura.visible = true;
                // 相位只跟随战斗tick，暂停和打开面板时冻结；最多四圈，不新增图片、计时器或逐帧节点。
                const pulse = Math.sin(battle.tick * RULE.step * Math.PI * 2);
                battle.base.towers.forEach((tower, i) => {
                    const pad = this.scene.pads[i];
                    if (tower.kind && tower.operator)
                        this.bellAura.graphics.drawCircle(pad.x, pad.y - 40, 46 + pulse * 4, "rgba(246,207,114,0.12)", "#f6cf72", 3);
                });
            }
            const visibleEnemies = [...battle.enemies.map(enemy => ({ enemy, seconds: battle.tick * RULE.step + enemy.seq * .13 })), ...Array.from(this.feedback.deaths.values())];
            visibleEnemies.slice(0, this.enemies.length).forEach(({ enemy: e, seconds }, i) => {
                const n = this.enemies[i], at = pointAt(e.progress);
                n.visible = true;
                n.name = `enemy:${e.seq}`;
                this.enemyVisuals[i].draw(e.kind, e.appearanceSeed, seconds, this.art.enemyMirror(e.kind, pointAt(e.progress + 1).x - at.x), this.feedback.flashing(e.seq));
                n.pos(at.x, this.layout.worldY(at.y));
                depth.push({ id: n.name, y: n.y, node: n });
            });
            this.projectiles.poses.forEach((p, i) => {
                const n = this.projectileNodes[i];
                n.name = `projectile:${p.shot.kind}:${p.shot.tower}:${p.shot.tick}`;
                n.visible = !p.impacted;
                this.art.applyFrame(n, p.frame, p.size);
                n.pos(p.x, p.y);
                n.rotation = p.rotation + (p.shot.kind === "ARROW" && !p.impacted ? WORLD_ART.arrowAngleOffset : 0);
                n.alpha = p.alpha;
            });
        }
        let shadowIndex = 0;
        for (const actor of [...this.people, ...this.enemies]) if (actor.visible) {
            const shadow = this.actorShadows[shadowIndex++], spec = WORLD_ART.shadow;
            const width = actor.width * Math.abs(actor.scaleX) * spec.actorWidth;
            shadow.visible = true; shadow.size(width, width).pivot(width * spec.centerX, width * spec.centerY);
            shadow.pos(actor.x + spec.x, actor.y + spec.y);
            depth.push({ id: shadow.name, y: actor.y - .01, node: shadow, ground: true });
        }
        // Laya 3.4 的 zIndex 决定渲染顺序；world 为 stackingRoot，不让深度排序覆盖 HUD/弹窗。
        depth.sort(compareDepth).forEach((p, i) => p.node.zIndex = i);
        this.pickDepth = depth;
        // 一帧内先隐藏再填充整个池，因此在最终可见性/身份确定后取消失效按下记录。
        for (const [touchId, down] of this.pressedTargets)
            if (!down.source.visible || down.source.name !== down.sourceId || !depth.some(p => p.id === down.target.id && p.node === down.target.node && p.node.visible)) {
                Laya.InputManager.cancelClick(touchId); this.pressedTargets.delete(touchId);
            }
    }
}
