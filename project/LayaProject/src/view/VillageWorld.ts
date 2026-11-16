import { CombatPresentation } from "./CombatPresentation";
import { LoggingFeedback } from "./LoggingFeedback";
import { EnemyVisuals } from "./EnemyVisuals";
import { GameSession } from "../game/GameSession";
import { person } from "../game/VillageRules";
import { GameState, isElder } from "../game/GameState";
import { ELITE, RULE } from "../game/GameConfig";
import { BattleSimulation } from "../game/BattleSimulation";
import { enemyPoint } from "../game/BattleRoad";
import { gateCapacity } from "../game/Growth";
import { SpriteFrames } from "./SpriteFrames";
import { compareDepth, layoutVillage, TOWER_VIEW, VillageNavigation, WEDDING } from "./VillageScene";
import { GameLayout } from "./GameLayout";
import { RESIDENT_DISPLAY } from "./VisibleResidents";
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
import { TowerRageEffects } from "./TowerRageEffects";
import { GateShieldEffects } from "./GateShieldEffects";
import { WorldInteraction, WorldItem } from "./WorldInteraction";
import { ProjectileVisuals } from "./ProjectileVisuals";
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
    private interaction = new WorldInteraction(() => this.game.state, () => this.motion);
    private freshBuildingVillage = true;
    scene = layoutVillage(this.layout);
    private motion = new VillagerMotion(new VillageNavigation(this.scene.props, this.scene.landscape, this.scene.bounds), this.scene.stops);
    private emotes = new VillagerEmotes();
    private walkAnimation = new WalkAnimation(this.art);
    private feedback = new CombatPresentation();
    private logging = new LoggingFeedback();
    private projectiles = new ProjectileMotion();
    private projectileVisuals: ProjectileVisuals;
    private rage: TowerRageEffects;
    private shield: GateShieldEffects;
    private lastBattle: BattleSimulation | null = null;
    private lastBattleTick = 0;
    private backgroundKey = "";
    private renderDelta = 0;
    private sceneSeconds = 0;
    private hitTop = new Laya.Point();
    private hitBottom = new Laya.Point();
    constructor(private game: GameSession, private art: SpriteFrames, private ui: UiWidgets, private layout: GameLayout,
        houseClicked: (name: string, visual: BuildingVisuals) => void, personClicked: (id: string) => void) {
        this.world.name = "VillageWorld";
        this.rage = new TowerRageEffects(this.world, art);
        this.shield = new GateShieldEffects(this.world, art);
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
                this.ui.image(node, frame, p.size * .22, p.size * .37, p.size * .19, p.size * .19, false);
                this.ui.image(node, frame, p.size * .59, p.size * .24, p.size * .17, p.size * .17, false);
            }
            if (p.canopyDetails) for (const detail of p.canopyDetails)
                this.ui.image(node, detail.frame, p.size * detail.x, p.size * detail.y, p.size * detail.size, p.size * detail.size, false).alpha = detail.alpha;
        }
        for (let i = 0; i < RESIDENT_DISPLAY.limit; i++) {
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
        this.projectileVisuals = new ProjectileVisuals(this.shots, art);
        // 此池仅绘制村民地影；怪物接地影已纳入自己的原生动画，不能再用独立世界节点重复绘制。
        for (let i = 0; i < this.people.length; i++) {
            const shadow = new Laya.Sprite(); shadow.texture = this.art.get("shadow_actor");
            shadow.name = "ContactShadow:" + i; shadow.mouseEnabled = false; shadow.visible = false;
            shadow.alpha = WORLD_ART.shadow.alpha; this.world.addChild(shadow); this.actorShadows.push(shadow);
        }
        this.interaction.bind(clickNodes, this.ui, houseClicked, personClicked);
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
        this.interaction.cancelPresses();
    }
    reset() {
        this.shield.reset();
        this.interaction.cancelPresses();
        this.interaction.clearDepth();
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
        // 门口横路在地面层，随墙脚定位；墙、门槛、路牌和行人继续按原足底顺序盖在路上。
        const lane = WORLD_ART.gateLane;
        this.scenery.graphics.drawImage(this.art.get("map_gate_lane"), lane.x, y(lane.anchorY) + lane.top, lane.width, lane.height, tint);
        const shadow = WORLD_ART.shadow;
        for (const prop of this.scene.props) {
            if (prop.ground || prop.id.startsWith("wall:") || prop.id.startsWith("deco:")) continue;
            const tree = prop.id.startsWith("forest:") || prop.id.startsWith("tree:");
            const width = prop.size * (tree ? shadow.treeWidth : shadow.buildingWidth);
            const image = this.ui.image(this.scenery, tree ? "shadow_tree" : "shadow_actor", prop.x - width * shadow.centerX + shadow.x, prop.y - width * shadow.centerY + shadow.y, width, width, false);
            image.alpha = shadow.alpha;
        }
        for (const rock of WORLD_ART.rocks.placements) {
            const image = this.ui.image(this.scenery, "deco_rocks", rock.x + WORLD_ART.rocks.referenceSize / 2,
                y(rock.y) + WORLD_ART.rocks.referenceSize, rock.size, rock.size, false);
            image.pivot(rock.size / 2, rock.size);
            image.scaleX = rock.scaleX;
        }
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
            if (this.motion.update(visualDelta)) this.motion.sync(s, battle ? battle.base.towers : s.towers);
            for (const p of this.motion.visiblePeople) { const pose = this.motion.get(p.id); this.logging.sample(p.id, pose.clip, pose.elapsed, pose.animated && !pose.walking && s.phase === "DAY", pose.loggingTree); }
            this.logging.retain(new Set(this.motion.visiblePeople.map(p => p.id)));
            this.logging.advance(visualDelta);
            for (const tree of this.props) if (tree.id.startsWith("tree:")) tree.node.rotation = this.logging.rotation(tree.id);
            this.emotes.update(s, Math.min(RULE.frameCap, Math.max(0, delta)), id => { if (!this.motion.visiblePeople.some(p => p.id === id)) return false; const pose = this.motion.get(id); return !pose.insideTower && pose.y > this.layout.worldY(840) && pose.heartElapsed === null; });
        }
        this.renderDelta += delta;
        if (this.renderDelta < 1 / 30)
            return false;
        this.renderDelta = 0;
        return true;
    }
    render(panelOpen: boolean) {
        const s = this.game.state, battle = this.game.battle;
        const events = this.game.takeCombatFeedback();
        this.feedback.sync(battle, events);
        this.bellAura.visible = false;
        this.bellAura.graphics.clear();
        this.people.forEach(n => n.visible = false);
        this.enemies.forEach(n => n.visible = false);
        this.actorShadows.forEach(n => n.visible = false);
        this.projectileVisuals.clear();
        this.hearts.forEach(n => { n.visible = false; n.alpha = 1; n.scale(1, 1); n.pos(0, 0); });
        this.emote.visible = false;
        const depth = this.props.slice();
        if (!s) {
            this.rage.update(null, []);
            this.shield.reset();
            depth.sort(compareDepth).forEach((p, i) => p.node.zIndex = i);
            this.interaction.clearDepth();
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
        this.walkAnimation.retain(new Set(this.motion.visiblePeople.map(p => p.id)));
        if (this.art.ready("characters")) this.motion.visiblePeople.forEach((p, i) => {
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
        if (this.art.ready("characters") && emote && this.motion.visiblePeople.some(p => p.id === emote.id) && !panelOpen && !this.game.pauses.size && (s.phase === "DAY" || s.phase === "NIGHT")) {
            const pose = this.motion.get(emote.id);
            if (!pose.insideTower) {
                const owner = person(s, emote.id), scale = (owner.elite ? ELITE.visualScale : 1) * this.layout.personScale;
                const elapsed = EMOTE.seconds - emote.remaining;
                this.emote.visible = true;
                this.art.applyFrame(this.emote, emote.frameId, EMOTE.size);
                // 高清人物四向头顶距足底约成人38~43/孩子34~37；偏移各缩短8，保留头顶间距及3px轻微上浮。
                // 挂点继续随屏幕与精英缩放，调整只影响表情位置，不改变触发或显示时长。
                const headOffset = owner.adult ? 44 : 38;
                this.emote.pos(Math.max(EMOTE.size / 2, Math.min(720 - EMOTE.size / 2, pose.x)), pose.y - headOffset * scale - Math.sin(Math.min(1, elapsed / .25) * Math.PI / 2) * 3);
                this.emote.alpha = Math.min(1, elapsed / .16, emote.remaining / .25);
            }
        }
        if (battle && this.art.ready("battle")) {
            const ringing = !battle.outcome && battle.bellTicks > 0 && (battle.tactic.effect === "ATTACK_SPEED" || battle.tactic.effect === "MULTI_TARGET");
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
            const visibleEnemies = [...battle.enemies.map(enemy => ({ enemy })), ...Array.from(this.feedback.deaths.values())];
            visibleEnemies.slice(0, this.enemies.length).forEach(({ enemy: e }, i) => {
                const n = this.enemies[i], at = enemyPoint(e);
                n.visible = true;
                n.name = `enemy:${e.seq}`;
                this.enemyVisuals[i].draw(e.kind, e.appearanceSeed, e.walkDistance, this.art.enemyMirror(e.kind, enemyPoint({ ...e, progress: e.progress + 1 }).x - at.x), this.feedback.flashing(e.seq));
                n.pos(at.x, this.layout.worldY(at.y));
                depth.push({ id: n.name, y: n.y, node: n });
            });
            this.projectileVisuals.draw(this.projectiles.poses);
        }
        let shadowIndex = 0;
        this.people.forEach(actor => { if (actor.visible) {
            const shadow = this.actorShadows[shadowIndex++], spec = WORLD_ART.shadow;
            const width = actor.width * Math.abs(actor.scaleX) * spec.actorWidth;
            shadow.visible = true;
            shadow.size(width, width).pivot(width * spec.centerX, width * spec.centerY);
            shadow.alpha = spec.alpha;
            shadow.pos(actor.x + spec.x, actor.y + spec.y);
            depth.push({ id: shadow.name, y: actor.y - .01, node: shadow, ground: true });
        } });
        // Laya 3.4 的 zIndex 决定渲染顺序；world 为 stackingRoot，不让深度排序覆盖 HUD/弹窗。
        const rageDepth = this.rage.update(battle, this.props.filter(p => p.id.startsWith("tower:")).map(p => ({ node: p.node, visual: p.visual! })));
        const gate = this.props.find(p => p.id === "building:gate")!;
        const shieldDepth = this.shield.update(battle, { node: gate.node, visual: gate.visual! }, this.layout, events);
        [...depth, ...rageDepth, ...shieldDepth].sort(compareDepth).forEach((p, i) => p.node.zIndex = i);
        depth.sort(compareDepth);
        this.interaction.update(depth);
    }
}
