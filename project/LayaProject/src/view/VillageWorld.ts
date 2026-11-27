import { CombatPresentation } from "./CombatPresentation";
import { SewingVisual } from "./SewingVisual";
import { EnemyVisuals, enemyImpactLift } from "./EnemyVisuals";
import { EssenceFeedback, GameSession } from "../game/GameSession";
import { LIANG_ESSENCE } from "../config/ShopConfig";
import { GameState } from "../game/GameState";
import { RULE } from "../game/GameConfig";
import { BattleSimulation } from "../game/BattleSimulation";
import { enemyPoint } from "../game/BattleRoad";
import { deliveryEnemySlow } from "../game/DeliverySortie";
import { gateCapacity } from "../game/Growth";
import { SpriteFrames } from "./SpriteFrames";
import { compareDepth, layoutVillage, MOTION, TOWER_VIEW, VillageNavigation, WEDDING } from "./VillageScene";
import { GameLayout } from "./GameLayout";
import { RESIDENT_DISPLAY } from "./VisibleResidents";
import { VillagerMotion } from "./VillagerMotion";
import { villagerModel } from "./VillagerAppearance";
import { WalkAnimation } from "./WalkAnimation";
import { ProjectileMotion } from "./ProjectileMotion";
import { C } from "./UiTheme";
import { AnchoredTip } from "./AnchoredTip";
import { VillagerThought, VillagerThoughts } from "./VillagerThoughts";
import { CRY, NewbornCry } from "./NewbornCry";
import { SPEECH } from "./config/VillagerSpeechConfig";
import { BuildingLook, BuildingVisuals } from "./BuildingVisuals";
import { UiWidgets } from "./UiWidgets";
import { HOUSE_TIP_NAMES } from "./config/AnchoredTipConfig";
import { HUD, LAYOUT } from "./config/HudConfig";
import { WORLD_ART } from "./config/WorldArtConfig";
import { TowerRageEffects } from "./TowerRageEffects";
import { GateShieldEffects } from "./GateShieldEffects";
import { WorldInteraction, WorldItem } from "./WorldInteraction";
import { ProjectileVisuals } from "./ProjectileVisuals";
import { SummonChargeVisuals } from "./SummonChargeVisuals";
import { PatrolVisuals } from "./PatrolVisuals";
import { FACTORY_PROP, HERO_COMMITTEE_PROP, PATROL_PROP } from "./config/VillageSceneConfig";
import { PATROL } from "../config/PatrolConfig";
import { TimedBlastVisuals } from "./TimedBlastVisuals";
import { HeroVisuals } from "./HeroVisuals";
import { SONGLEI } from "../config/HeroConfig";
import { paralyzed } from "../game/HeroSortie";
import { DeliveryHeroVisuals } from "./DeliveryHeroVisuals";
import { towerFlag } from "../game/EnemySeed";
import type { TowerFlag } from "../config/DefenseConfig";
/** 动效先播放上箭头，再交给常规两秒气泡；单位为前台表现秒。 */
const ESSENCE_CUE = { riseSeconds: .72, arrowSize: 64, riseDistance: 55 } as const;
/** 英雄的白天台词独立于村民。触发间隔按前台表现秒，仅在村内南侧驻足说话，给城门血条留空。 */
const HERO_SPEECH = {
    first: 1.8, interval: 12, variance: 7, clearOfGateY: 928,
    lines: ["白天巡村，晚上守门。", "这对瓶子可不能拿去卖。", "城门挺牢靠，我再转一圈。", "绕完这一圈，就该等天黑了。"]
} as const;
/** 右侧巡村的外卖大王独立选词，跟其他气泡错开。 */
const DELIVERY_SPEECH = {
    first: 7, interval: 14, variance: 6,
    lines: ["村东头，还有一单。", "门口就好，我不歇脚。", "这单算村里建设费。", "汤没洒，我先走了。"]
} as const;
// 守夜及最后击飞期间收起日间生产设施，给淡紫儿留出操作空间；建筑状态和占地仍由原系统维护。
const DAY_ONLY_PROPS = new Set(["building:house-a", FACTORY_PROP, HERO_COMMITTEE_PROP]);
/** 地图、人物、建筑与战斗表现的唯一所有者。视觉时钟不推进 GameSession/业务随机数。 */
export class VillageWorld {
    readonly scenery = new Laya.Sprite();
    readonly world = new Laya.Sprite();
    readonly shots = new Laya.Sprite();
    readonly bellAura = new Laya.Sprite();
    readonly speechTip = new AnchoredTip(this.art, SPEECH.width, SPEECH.height, SPEECH.font, true);
    readonly heroTip = new AnchoredTip(this.art, SPEECH.width, SPEECH.height, SPEECH.font, true, SPEECH.seconds);
    readonly deliveryTip = new AnchoredTip(this.art, SPEECH.width, SPEECH.height, SPEECH.font, true, SPEECH.seconds);
    private nextHeroSpeech: number = HERO_SPEECH.first;
    private nextDeliverySpeech: number = DELIVERY_SPEECH.first;
    private heroSpeechPoint = new Laya.Point();
    readonly essenceArrow = new Laya.Sprite();
    readonly essenceTip = new AnchoredTip(this.art, SPEECH.width, SPEECH.height, SPEECH.font, true, SPEECH.seconds);
    private essence: (EssenceFeedback & { elapsed: number; spoken: boolean }) | null = null;
    private essencePoint = new Laya.Point();
    readonly cryIcon = new Laya.Sprite();
    readonly blast = new TimedBlastVisuals(this.game, this.art, this.ui, this.layout);
    private people: Laya.Sprite[] = [];
    private enemies: Laya.Sprite[] = [];
    private actorShadows: Laya.Sprite[] = [];
    private qualityRings: { plane: Laya.Sprite; disc: Laya.Sprite }[] = [];
    private enemyVisuals: EnemyVisuals[] = [];
    private hearts: Laya.Sprite[] = [];
    private props: WorldItem[] = [];
    private interaction = new WorldInteraction(() => this.game.state, () => this.motion);
    private freshBuildingVillage = true;
    scene = layoutVillage(this.layout);
    private patrolVisuals = new PatrolVisuals(this.world, this.art, this.game);
    private heroVisuals = new HeroVisuals(this.world, this.art);
    private songLeiVisuals = new HeroVisuals(this.world, this.art, SONGLEI);
    private deliveryVisuals = new DeliveryHeroVisuals(this.world, this.art);
    private patrolTimer: Laya.Text | undefined;
    private patrolGlow: Laya.Sprite | undefined;
    private walkNavigation = this.navigation();
    private motion = new VillagerMotion(this.walkNavigation, this.scene.stops);
    private navigation(scene = this.scene) {
        return new VillageNavigation(scene.props, scene.landscape, scene.bounds);
    }
    private thoughts = new VillagerThoughts();
    private crying = new NewbornCry();
    private cryPoint = new Laya.Point();
    private residentCuesBlocked = false;
    private shownThought: VillagerThought | null = null;
    private walkAnimation = new WalkAnimation(this.art);
    private feedback = new CombatPresentation();
    // 结算会同步刷新；同一 Laya 帧随后收到的旧 delta 不得跳过刚出现的接触/红闪。
    private feedbackFrame = -1;
    private sewing: SewingVisual[] = [];
    private projectiles = new ProjectileMotion();
    private projectileVisuals: ProjectileVisuals;
    private rage: TowerRageEffects;
    private shield: GateShieldEffects;
    private summon: SummonChargeVisuals;
    private lastBattle: BattleSimulation | null = null;
    private lastBattleTick = 0;
    /** 城门受击时的营火警戒动作，时间用场景时钟，不写入战斗或存档。 */
    private backgroundKey = "";
    private renderDelta = 0;
    private sceneSeconds = 0;
    private villageMotionSeconds = 0;
    private hitTop = new Laya.Point();
    private hitBottom = new Laya.Point();
    get hasPatrolImpact() { return this.feedback.hasPatrolImpact || !!this.patrolVisuals?.hasLanding || this.deliveryVisuals.hasImpact; }
    get hasEnemyDeaths() { return this.feedback.deaths.size > 0; }
    constructor(private game: GameSession, private art: SpriteFrames, private ui: UiWidgets, private layout: GameLayout,
        houseClicked: (name: string, visual: BuildingVisuals) => void, personClicked: (id: string) => void, private playDefeat?: () => void,
        patrolClicked?: () => void, committeeClicked?: (heroId?: string) => void, factoryClicked?: () => void) {
        this.world.name = "VillageWorld";
        this.rage = new TowerRageEffects(this.world, art);
        this.shield = new GateShieldEffects(this.world, art);
        this.summon = new SummonChargeVisuals(this.world, art);
        const clickNodes: Laya.Sprite[] = [this.heroVisuals.body, this.deliveryVisuals.body, this.songLeiVisuals.body];
        for (const p of this.scene.props) {
            const node = new Laya.Sprite();
            node.name = p.id;
            node.mouseEnabled = false;
            node.stackingRoot = true;
            this.art.applyFrame(node, p.frame, p.size);
            node.pos(p.x, p.y);
            this.world.addChild(node);
            const upgradeable = p.id !== FACTORY_PROP && p.id !== HERO_COMMITTEE_PROP && (p.id.startsWith("tower:") || p.id.startsWith("building:"));
            this.props.push({ id: p.id, y: p.ground ? -1 : p.y, node, ground: p.ground, visual: upgradeable ? new BuildingVisuals(node, art) : undefined });
            if (p.id === HERO_COMMITTEE_PROP || p.id === FACTORY_PROP) {
                node.visible = false;
                node.hitArea = new Laya.Rectangle(0, 0, node.width, node.height);
                clickNodes.push(node);
            }
            if (p.id === PATROL_PROP) {
                node.visible = false;
                node.hitArea = new Laya.Rectangle(0, 0, p.size, p.size);
                this.patrolTimer = this.ui.label(node, "", 0, -26, p.size, 21, "#fff2d9", true, 28);
                this.patrolTimer.name = "PatrolCountdown";
                this.patrolTimer.align = "center";
                this.patrolTimer.stroke = 2;
                this.patrolTimer.strokeColor = "#743345";
                this.patrolTimer.mouseEnabled = false;
                this.patrolGlow = node.addChild(new Laya.Sprite());
                this.patrolGlow.mouseEnabled = false;

                clickNodes.push(node);
            }
            if (HOUSE_TIP_NAMES[p.id]) {
                node.hitArea = new Laya.Rectangle();
                clickNodes.push(node);
            }
            if (p.signText) {
                const sign = p.id === "deco:friendship-road-sign" ? WORLD_ART.friendshipSign : WORLD_ART.sign;
                const title = this.ui.label(node, p.signText, p.size * sign.x, p.size * sign.y, p.size * sign.width, sign.font, "#59391e", true, p.size * sign.height);
                title.fontSize = sign.font;
                title.stroke = .7;
                title.strokeColor = "#f8d79c";
                title.align = "center";
                title.valign = "middle";
                title.wordWrap = false;
                title.overflow = Laya.Text.SHRINK;
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
        this.reserveEnemies(WORLD_ART.enemyPoolReserve);
        this.projectileVisuals = new ProjectileVisuals(this.shots, art);
        // 此池仅绘制村民地影；怪物接地影已纳入自己的原生动画，不能再用独立世界节点重复绘制。
        for (let i = 0; i < this.people.length; i++) {
            const shadow = new Laya.Sprite(); shadow.texture = this.art.get("shadow_actor");
            shadow.name = "ContactShadow:" + i; shadow.mouseEnabled = false; shadow.visible = false;
            shadow.alpha = WORLD_ART.shadow.alpha; this.world.addChild(shadow); this.actorShadows.push(shadow);
            const plane = new Laya.Sprite(), disc = new Laya.Sprite();
            plane.name = "QualityFootRing:" + i; plane.visible = false;
            plane.mouseEnabled = disc.mouseEnabled = false;
            plane.addChild(disc); this.world.addChild(plane); this.qualityRings.push({ plane, disc });
        }
        this.interaction.bind(clickNodes, this.ui, houseClicked, personClicked, patrolClicked, committeeClicked, factoryClicked);
    }
    /** 高清 HUD 沿用像素塔足底下方的标签位置，与塔的左右镜像无关。 */
    towerAnchor(index: number) {
        const at = this.scene.pads[index];
        return { x: at.x, y: at.y + HUD.tower.top };
    }
    /** 已就座村民头顶的世界层坐标，用于已入账批次的飞币。进厂途中或未在场的工人没有可见起点。 */
    sewingAnchor(id: string): { x: number; y: number } | null {
        const actor = this.people.find(node => node.visible && node.name === "person:" + id);
        if (!actor || !this.motion.visiblePeople.some(p => p.id === id) || this.motion.get(id).clip !== "sewing") return null;
        return { x: actor.x, y: actor.y - (actor.pivotY + 2) * actor.scaleY };
    }
    /** 返回血条下边沿，复用原2D城门上方布局，不依赖上一帧建筑是否已绘制。 */
    gateAnchor() {
        return { x: HUD.gate.x + HUD.gate.width / 2, y: this.layout.gateY + (this.game.battle?.patrol?.rapid ? HUD.gate.rapidBarBottom : HUD.gate.barTop + HUD.gate.barHeight) };
    }
    destroy() {
        this.patrolVisuals.destroy();
        this.interaction.cancelPresses();
    }
    /** 尸体停留时活怪仍会入场；池只增长到实际峰值，随后复用，禁止按原容量静默漏画死亡动画。 */
    private reserveEnemies(count: number) {
        while (this.enemies.length < count) {
            const node = new Laya.Sprite(); node.mouseEnabled = false; node.visible = false;
            this.world.addChild(node); this.enemies.push(node); this.enemyVisuals.push(new EnemyVisuals(node, this.art));
        }
    }
    reset() {
        this.essence = null; this.essenceArrow.visible = false; this.essenceTip.hide();
        this.shield.reset();
        this.summon.reset();
        this.interaction.cancelPresses();
        this.interaction.clearDepth();
        this.motion = new VillagerMotion(this.walkNavigation, this.scene.stops);
        this.heroVisuals.stroll.reset();
        this.deliveryVisuals.stroll.reset();
        this.songLeiVisuals.stroll.reset();
        this.heroTip.hide();
        this.deliveryTip.hide();
        this.nextHeroSpeech = HERO_SPEECH.first;
        this.nextDeliverySpeech = DELIVERY_SPEECH.first;
        this.thoughts = new VillagerThoughts(); this.crying = new NewbornCry(); this.cryIcon.visible = false;
        this.hideSpeech(); this.walkAnimation = new WalkAnimation(this.art);
        this.projectiles = new ProjectileMotion();
        this.feedback = new CombatPresentation();
        this.feedbackFrame = -1;
        this.lastBattle = null;
        this.lastBattleTick = 0;
        this.renderDelta = 0;
        this.sceneSeconds = 0;
        this.villageMotionSeconds = 0;
        this.freshBuildingVillage = true;
    }
    relayout(next: GameLayout) {
        const previous = this.layout, scene = layoutVillage(next);
        this.walkNavigation = this.navigation(scene);
        this.motion.relayout(this.walkNavigation, scene.stops, p => ({ x: p.x, y: next.worldY(previous.referenceY(p.y)) }));
        for (const visual of [this.heroVisuals, this.deliveryVisuals, this.songLeiVisuals])
            visual.stroll.relayout(previous, next, this.walkNavigation);
        this.layout = next;
        this.scene = scene;
        this.backgroundKey = "";
        this.props.forEach((p, i) => {
            const at = scene.props[i];
            p.y = at.ground ? -1 : at.y;
            p.node.pos(at.x, at.y);
        });
    }
    sync(s: GameState, preserveOverlay: boolean) {
        if (!preserveOverlay)
            this.motion.sync(s, this.game.battle ? this.game.battle.base.towers : s.towers, s.phase === "DAY" ? this.essence?.person : undefined);
        this.thoughts.sync(s);
        this.crying.sync(s.people);
    }
    showEssence(effect: EssenceFeedback) {
        this.essence = { ...effect, elapsed: 0, spoken: false };
        this.hideSpeech(); this.essenceTip.hide();
    }
    hideSpeech() { this.thoughts.current = this.shownThought = null; this.speechTip.hide(); }
    drawScenery(night: boolean) {
        const sign = this.scene.friendshipSign;
        if (sign) {
            const fifth = this.game.state?.towers[4].kind;
            const at = !night && (!fifth || fifth === "STONE") ? sign.resting : sign.active;
            const item = this.props.find(p => p.id === sign.prop.id)!;
            sign.prop.x = at.x; sign.prop.y = item.y = at.y;
            item.node.pos(at.x, at.y);
        }
        const key = night ? "night" : "day";
        if (this.backgroundKey === key)
            return;
        this.backgroundKey = key;
        this.scenery.destroyChildren();
        this.scenery.graphics.clear();
        const { mapTop, gateY, footerTop, height } = this.layout;
        const tint = night ? WORLD_ART.nightTint : WORLD_ART.dayTint;
        const texture = this.art.get(WORLD_ART.terrain), terrain = this.art.contentBounds(WORLD_ART.terrain);
        const uv = texture.uv, wallV = uv[1] + (uv[5] - uv[1]) * (terrain.pivot.y / terrain.sourceSize.h);
        const graphics = this.scenery.graphics;
        graphics.drawRect(0, 0, LAYOUT.width, height, C.grass);
        // 同一不旋转图集帧的两段共享墙脚像素和屏幕坐标，保持土路与动态对象在所有比例下对齐。
        graphics.drawTexture(texture, 0, mapTop, LAYOUT.width, gateY - mapTop, null, 1, tint, null,
            [uv[0], uv[1], uv[2], uv[3], uv[4], wallV, uv[6], wallV]);
        graphics.drawTexture(texture, 0, gateY, LAYOUT.width, footerTop - gateY, null, 1, tint, null,
            [uv[0], wallV, uv[2], wallV, uv[4], uv[5], uv[6], uv[7]]);
        const shadow = WORLD_ART.shadow;
        for (const prop of this.scene.props) {
            if (night && DAY_ONLY_PROPS.has(prop.id)) continue;
            if (prop.ground || prop.id.startsWith("wall:") || prop.id.startsWith("deco:")) continue;
            const tree = prop.id.startsWith("tree:");
            const width = prop.size * (tree ? shadow.treeWidth : shadow.buildingWidth);
            const image = this.ui.image(this.scenery, tree ? "shadow_tree" : "shadow_actor", prop.x - width * shadow.centerX + shadow.x, prop.y - width * shadow.centerY + shadow.y, width, width, false);
            image.alpha = shadow.alpha;
        }
    }
    advance(delta: number, frozen: boolean): boolean {
        const s = this.game.state;
        const advancing = !frozen && !this.game.pauses.size;
        // 清晨结算期间，村民已切回白天路线，继续走完回村路径并触发过门动画。
        const daylight = s?.phase === "DAY" || s?.phase === "DAWN";
        const visualTime = Math.min(RULE.frameCap, Math.max(0, delta)) * (this.game.patrolAiming ? PATROL.spin.aimSpeedRatio : 1);
        if (advancing) {
            if (s?.phase === "DAY" || s?.phase === "NIGHT") this.villageMotionSeconds += visualTime;
            const gateTraffic = daylight ? this.motion.crossingGate(this.layout.gateY)
                : this.game.battle?.hero?.atGate === true || this.game.battle?.delivery?.atGate === true;
            this.props.forEach(p => p.visual?.advance(visualTime, s?.phase === "NIGHT",
                p.id === "building:gate" && gateTraffic));
        }
        const battle = this.game.battle;
        if (battle !== this.lastBattle) {
            this.lastBattle = battle;
            this.lastBattleTick = 0;
        }
        const visualDelta = battle ? Math.max(0, battle.tick - this.lastBattleTick) * RULE.step : Math.min(RULE.frameCap, Math.max(0, delta));
        this.lastBattleTick = battle ? battle.tick : 0;
        if (advancing && this.feedbackFrame !== Laya.timer.currFrame)
            this.feedback.advance(visualTime);
        if (s && advancing && (daylight || s.phase === "NIGHT")) {
            this.sceneSeconds += visualDelta;
            if (this.motion.update(visualDelta)) this.motion.sync(s, battle ? battle.base.towers : s.towers, s.phase === "DAY" ? this.essence?.person : undefined);
            if (s.phase === "DAY" && !this.residentCuesBlocked) {
                this.heroVisuals.stroll.advance(visualDelta, this.layout, this.walkNavigation);
                this.heroTip.advance(visualDelta);
                this.nextHeroSpeech = Math.max(0, this.nextHeroSpeech - visualDelta);
                if (s.deliveryUnlocked) {
                    this.deliveryVisuals.stroll.advance(visualDelta, this.layout, this.walkNavigation);
                    this.deliveryTip.advance(visualDelta);
                    this.nextDeliverySpeech = Math.max(0, this.nextDeliverySpeech - visualDelta);
                }
                if (s.songLeiUnlocked) this.songLeiVisuals.stroll.advance(visualDelta, this.layout, this.walkNavigation);
                const visible = (id: string) => {
                    if (!this.motion.visiblePeople.some(p => p.id === id)) return false;
                    const pose = this.motion.get(id);
                    return !pose.insideTower && pose.y > this.layout.worldY(840) && pose.heartElapsed === null;
                };
                if (this.essence) {
                    this.essence.elapsed += visualDelta;
                    this.essenceTip.advance(visualDelta);
                    if (this.essence.spoken && !this.essenceTip.visible) this.essence = null;
                } else {
                    const speaking = this.heroTip.visible || this.deliveryTip.visible;
                    this.crying.advance(visualDelta, !this.thoughts.current && !speaking, visible);
                    if (!this.crying.current && !speaking) this.thoughts.update(s, visualDelta, visible);
                    this.speechTip.advance(visualDelta);
                    if (!speaking && !this.thoughts.current && !this.crying.current) {
                        if (!this.nextHeroSpeech && this.heroVisuals.stroll.standing && this.showHeroSpeech(this.heroVisuals.body, this.heroTip, HERO_SPEECH.lines))
                            this.nextHeroSpeech = HERO_SPEECH.interval + Math.random() * HERO_SPEECH.variance;
                        else if (s.deliveryUnlocked && !this.nextDeliverySpeech && this.deliveryVisuals.stroll.standing &&
                            this.showHeroSpeech(this.deliveryVisuals.body, this.deliveryTip, DELIVERY_SPEECH.lines))
                            this.nextDeliverySpeech = DELIVERY_SPEECH.interval + Math.random() * DELIVERY_SPEECH.variance;
                    }
                }
            }
        }
        this.renderDelta += delta;
        if (this.renderDelta < 1 / 30)
            return false;
        // Keep the fractional frame so 16/17 ms host updates do not alternate between two and three updates per draw.
        this.renderDelta %= 1 / 30;
        return true;
    }
    /** 两位英雄使用同一套头顶锚点和遮挡规则，屋后和城门血条附近延后显示。 */
    private showHeroSpeech(body: Laya.Sprite, tip: AnchoredTip, lines: readonly string[]) {
        if (!body.visible || body.y < this.layout.worldY(HERO_SPEECH.clearOfGateY)) return false;
        const bounds = body.hitArea as Laya.Rectangle;
        const point = body.localToGlobal(this.heroSpeechPoint.setTo(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2));
        if (this.interaction.pickAt(point.x, point.y)?.node !== body) return false;
        tip.show(lines[Math.floor(Math.random() * lines.length)], () => ({ node: body, bounds }));
        return true;
    }
    /** 同帧绘制战斗反馈，并将献纳成功信号交给上层提示。 */
    render(panelOpen: boolean, houseTipOpen = false) {
        this.feedbackFrame = Laya.timer.currFrame;
        const s = this.game.state, battle = this.game.battle;
        const night = this.backgroundKey === "night";
        const presentation = this.game.presentationBattle;
        const events = this.game.takeCombatFeedback();
        this.feedback.sync(presentation, events);
        this.blast.update(this.layout, presentation, events, this.feedback.time, panelOpen);
        this.bellAura.visible = false;
        this.bellAura.graphics.clear();
        this.people.forEach(n => n.visible = false);
        this.enemies.forEach(n => n.visible = false);
        this.actorShadows.forEach(n => n.visible = false);
        this.qualityRings.forEach(({ plane }) => plane.visible = false);
        this.projectileVisuals.clear();
        this.hearts.forEach(n => { n.visible = false; n.alpha = 1; n.scale(1, 1); n.pos(0, 0); });
        this.cryIcon.visible = false;
        this.essenceArrow.visible = false;
        this.residentCuesBlocked = night || panelOpen || houseTipOpen || this.game.pauses.size > 0 || s?.phase !== "DAY";
        if (this.residentCuesBlocked) { this.hideSpeech(); this.heroTip.hide(); this.deliveryTip.hide(); this.crying.dismiss(); }
        if (s?.phase !== "DAY" && this.essence) { this.essence = null; this.essenceTip.hide(); }
        const depth = this.props.slice();
        const booth = this.props.find(item => item.id === PATROL_PROP)!;
        booth.node.visible = !!s;
        booth.node.mouseEnabled = !!s && !panelOpen;
        if (!s) {
            this.patrolVisuals.update(null, this.layout);
            this.heroVisuals.update(null, this.layout, []);
            this.deliveryVisuals.update(null, this.layout, [], 0, 0, false, false);
            this.songLeiVisuals.update(null, this.layout, []);
            this.rage.update(null, []);
            this.shield.reset();
            depth.sort(compareDepth).forEach((p, i) => p.node.zIndex = i);
            this.interaction.clearDepth();
            return false;
        }
        for (const p of this.props) {
            if (DAY_ONLY_PROPS.has(p.id)) p.node.visible = !night;
            if (p.id === HERO_COMMITTEE_PROP || p.id === FACTORY_PROP) p.node.mouseEnabled = s.phase === "DAY" && !panelOpen;
            let kind: BuildingLook | null = null, level = 0, damaged = false, facing = 1;
            let flag: TowerFlag | undefined;
            if (p.id === PATROL_PROP) {
                kind = "PATROL";
                level = s.patrol.level;
                const size = p.node.width;
                const timer = this.patrolTimer!, glow = this.patrolGlow!, patrol = battle?.patrol;
                timer.visible = !!battle && !battle.patrol?.rapid;
                timer.text = patrol?.spin?.canGather ? "按住后拉" : patrol?.spin?.flying ? "出击中" :
                    patrol ? `${Math.ceil(patrol.secondsUntil(battle!.tick))} 秒` : "待任命";
                glow.visible = !!battle;
                if (glow.visible) {
                    glow.graphics.clear();
                    glow.graphics.drawEllipse(size * .37, size * .51, size * .22, size * .19, "rgba(255,151,175,0.20)", null, 0);
                }
                glow.alpha = .55 + .45 * Math.sin(this.sceneSeconds * 4);

            }
            if (p.id === "building:gate") {
                damaged = (battle ? battle.gate : s.gate) / gateCapacity(s) < .35;
                kind = "GATE";
                level = s.gateLevel;
            }
            else if (p.id.startsWith("tower:")) {
                const index = Number(p.id.split(":")[1]), t = (battle ? battle.base.towers : s.towers)[index];
                p.node.texture = t.kind ? null : this.art.get("building_tower_pad");
                const scale = this.scene.towerScale * (t.kind ? 1 : TOWER_VIEW.emptyScale);
                p.node.scale(scale, scale);
                facing = TOWER_VIEW.facing[index];
                kind = t.kind ? "CANNON" : null;
                level = t.level;
                if (t.kind) flag = t.flag ?? towerFlag(s.run, index);
            }
            else if (p.id.startsWith("building:house-")) {
                kind = "HOUSE";
                level = s.houses;
            }
            p.visual?.sync(kind, level, this.freshBuildingVillage, damaged, facing);
            if (p.id.startsWith("tower:")) p.visual!.syncPennant(flag, facing);
            if (!panelOpen && !this.game.pauses.size) p.visual?.beginVisibleUpgrade();
            if (HOUSE_TIP_NAMES[p.id]) {
                const { node, bounds } = p.visual!.bodyRegion();
                node.localToGlobal(this.hitTop.setTo(bounds.x, bounds.y), false, p.node);
                node.localToGlobal(this.hitBottom.setTo(bounds.x + bounds.width, bounds.y + bounds.height), false, p.node);
                (p.node.hitArea as Laya.Rectangle).setTo(this.hitTop.x, this.hitTop.y, this.hitBottom.x - this.hitTop.x, this.hitBottom.y - this.hitTop.y);
            }
            const extra = p.visual?.occluder();
            if (extra) {
                // 分离到世界层的建筑部件也要随主体切换显隐。
                extra.node.visible = p.node.visible;
                if (extra.node.visible) depth.push(extra);
            }
        }
        for (const p of this.props)
            if (p.id.startsWith("tower:"))
                p.visual!.updateAttack(presentation, Number(p.id.split(":")[1]), this.feedback.shots.keys(), this.feedback.presentationTick * RULE.step, y => this.layout.worldY(y));
        this.projectiles.update(presentation, this.layout, this.scene.pads, index => this.props.find(p => p.id === `tower:${index}`)!.visual!.launchPoint(), this.feedback, enemy => enemyImpactLift(this.art, enemy));
        if (this.feedback.takeDefeatCue() && !this.game.pauses.size) this.playDefeat?.();
        this.freshBuildingVillage = false;
        this.walkAnimation.retain(new Set(this.motion.visiblePeople.map(p => p.id)));
        const gate = this.props.find(p => p.id === "building:gate")!;
        if (!night && this.art.ready("village")) this.motion.visiblePeople.forEach((p, i) => {
            const n = this.people[i], pose = this.motion.get(p.id);
            n.visible = !pose.insideTower && !pose.insideFactory;
            n.name = `person:${p.id}`;
            const model = villagerModel(p), walkingClip = pose.clip.endsWith("_walk");
            const seated = model === "elder", sewing = pose.clip === "sewing";
            const facing = walkingClip ? this.art.walk(model, pose.direction) : { clip: pose.clip, mirror: false };
            const scale = this.layout.personScale;
            const size = p.adult ? 56 : p.growth === 0 ? 42 : 48;
            if (sewing) {
                this.art.applyFrame(n, "sew_station", size);
                const machine = this.sewing[i] || (this.sewing[i] = new SewingVisual(n, this.art));
                machine.draw(model, p.quality, pose.elapsed, i, size);
                // 岗位的头、手、踏板是分层贴图，点击区域按完整的工位轮廓设置。
                (n.hitArea as Laya.Rectangle).setTo(size * .19, size * .03, size * .66, size * .93);
            } else {
                if (this.sewing[i]) this.sewing[i].parts.visible = false;
                const frame = seated ? facing.clip : walkingClip ? this.walkAnimation.frame(pose, facing.clip, size * scale) : this.art.frameId(facing.clip, pose.elapsed, pose.animated);
                this.art.applyFrame(n, frame, size);
                n.getGraphicBounds(false, n.hitArea as Laya.Rectangle);
            }
            const rock = MOTION.elderRock;
            n.rotation = seated ? rock.angleDegrees * Math.sin(pose.elapsed * Math.PI * 2 / rock.periodSeconds) : 0;
            n.pos(pose.x, pose.y);
            n.scale((facing.mirror ? -1 : 1) * scale, scale);
            if (p.quality !== "COMMON" && n.visible) {
                const { plane, disc } = this.qualityRings[i], ring = WORLD_ART.qualityRing, width = ring.width * scale;
                const ringFrame = ring.frames[p.quality];
                if (disc.name !== ringFrame) {
                    disc.texture = this.art.get(ringFrame);
                    disc.name = ringFrame;
                }
                disc.size(width, width).pivot(width / 2, width / 2);
                disc.rotation = this.sceneSeconds / ring.turnSeconds * 360 % 360;
                plane.pos(pose.x, pose.y + 1).scale(1, ring.heightRatio);
                plane.alpha = ring.alpha; plane.visible = true;
                depth.push({ id: plane.name, y: pose.y - .003, node: plane, ground: true });
            }
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
            if (n.visible) depth.push({ id: n.name, y: pose.y, node: n, personId: p.id });
        });
        const essence = this.essence;
        this.essenceTip.alpha = this.residentCuesBlocked ? 0 : 1;
        if (essence && !this.residentCuesBlocked) {
            const actor = this.people.find(node => node.visible && node.name === `person:${essence.person}`);
            if (actor) {
                const bounds = actor.hitArea as Laya.Rectangle;
                if (essence.elapsed < ESSENCE_CUE.riseSeconds) {
                    const t = essence.elapsed / ESSENCE_CUE.riseSeconds, arrow = this.essenceArrow;
                    actor.localToGlobal(this.essencePoint.setTo(bounds.x + bounds.width / 2, bounds.y + bounds.height * .68), false, arrow.parent as Laya.Sprite);
                    if (!arrow.texture) this.art.applyFrame(arrow, "fx_rage_up", ESSENCE_CUE.arrowSize);
                    arrow.pos(this.essencePoint.x, this.essencePoint.y - ESSENCE_CUE.riseDistance * t);
                    arrow.alpha = Math.min(1, t * 7, (1 - t) * 4);
                    arrow.scale(.75 + t * .45, .75 + t * .45);
                    arrow.visible = true;
                } else if (!essence.spoken) {
                    essence.spoken = true;
                    this.essenceTip.show(LIANG_ESSENCE.line, () => ({ node: actor, bounds: actor.hitArea as Laya.Rectangle }));
                }
            }
        }
        const thought = this.thoughts.current;
        const speaker = thought && this.people.find(node => node.visible && node.name === `person:${thought.id}`);
        if (!speaker || !thought) this.hideSpeech();
        else if (thought !== this.shownThought) {
            this.shownThought = thought;
            this.speechTip.show(thought.text, () => ({ node: speaker, bounds: speaker.hitArea as Laya.Rectangle }));
        } else this.speechTip.advance(0);
        const baby = this.crying.current && this.people.find(n => n.visible && n.name === `person:${this.crying.current}`);
        if (baby && this.cryIcon.parent) {
            if (!this.cryIcon.texture) this.art.applyFrame(this.cryIcon, "icon_baby_cry", CRY.size);
            const bounds = baby.hitArea as Laya.Rectangle, age = this.crying.elapsed;
            baby.localToGlobal(this.cryPoint.setTo(bounds.x + bounds.width / 2, bounds.y), false, this.cryIcon.parent as Laya.Sprite);
            this.cryIcon.pos(this.cryPoint.x, this.cryPoint.y - 5 - 2 * Math.sin(age * 10));
            this.cryIcon.alpha = Math.min(1, age / .1, (CRY.duration - age) / .16);
            this.cryIcon.visible = true;
        }
        if (battle && this.art.ready("night")) {
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
        }
        if (presentation && this.art.ready("night")) {
            const mindTime = presentation.mindLocked ? presentation.tick * RULE.step : undefined;
            const living = presentation.outcome ? presentation.enemies.filter(enemy => this.feedback.patrolImpactAge(enemy.seq) !== undefined) : presentation.enemies;
            const visibleEnemies = [...living.map(enemy => ({ enemy, mindTime })),
                ...Array.from(this.feedback.deaths.values(), ({ enemy }) => ({ enemy, mindTime: undefined as number | undefined }))];
            this.reserveEnemies(visibleEnemies.length);
            visibleEnemies.forEach(({ enemy: e, mindTime }, i) => {
                const n = this.enemies[i], at = enemyPoint(e);
                const y = this.layout.worldY(at.y), verticalScale = this.layout.worldY(at.y + 1) - y;
                const heroImpact = this.feedback.heroImpact(e.seq, verticalScale);
                const electric = { paralyzed: e.hp > 0 && paralyzed(e, presentation.tick), age: heroImpact?.electric ? heroImpact.age : undefined };
                n.visible = true;
                n.name = `enemy:${e.seq}`;
                this.enemyVisuals[i].draw(e.kind, e.appearanceSeed, e.walkDistance,
                    this.art.enemyMirror(e.kind, enemyPoint({ ...e, progress: e.progress + 1 }).x - at.x),
                    this.feedback.flashing(e.seq), this.feedback.deathPose(e.seq), this.feedback.hitShake(e.seq), mindTime,
                    this.feedback.zhouLoveCue(e.seq), e.hp > 0 && presentation.isPoisoned(e.seq), this.feedback.burstAge(e.seq),
                    e.hp > 0 && (deliveryEnemySlow(e, presentation.tick) > 0 || (e.slowTicks > 0 && this.feedback.frosted(e.seq))),
                    this.feedback.patrolImpactAge(e.seq), this.feedback.patrolAir(e.seq),
                    heroImpact?.delivery || heroImpact?.electric ? undefined : heroImpact?.age,
                    electric.paralyzed || electric.age !== undefined ? electric : undefined);
                const recoil = this.feedback.patrolRecoil(e.seq, verticalScale);
                n.pos(at.x + (recoil?.x ?? 0) + (heroImpact?.x ?? 0), y + (recoil?.y ?? 0) + (heroImpact?.y ?? 0));
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
        const shieldDepth = this.shield.update(battle, { node: gate.node, visual: gate.visual! }, this.layout, events);
        const summonDepth = this.summon.update(presentation, this.layout, events, this.feedback.time);
        const patrolDepth = this.patrolVisuals.update(presentation, this.layout, events, this.feedback.time, panelOpen);
        const dayHero = s.phase === "DAY" && !night;
        const heroDepth = this.heroVisuals.update(presentation, this.layout, events, this.feedback.time, dayHero, !this.residentCuesBlocked);
        const deliveryDepth = this.deliveryVisuals.update(presentation, this.layout, events, this.feedback.time,
            this.feedback.presentationTick, dayHero && s.deliveryUnlocked === true, !this.residentCuesBlocked);
        const songLeiDepth = this.songLeiVisuals.update(presentation, this.layout, events, this.feedback.time,
            dayHero && s.songLeiUnlocked === true, !this.residentCuesBlocked);
        [...depth, ...rageDepth, ...shieldDepth, ...summonDepth, ...patrolDepth, ...heroDepth, ...deliveryDepth, ...songLeiDepth]
            .sort(compareDepth).forEach((p, i) => p.node.zIndex = i);
        this.interaction.update((dayHero ? [...depth, ...heroDepth, ...deliveryDepth, ...songLeiDepth] : depth).sort(compareDepth));
        return events.some(event => event.type === "mercy");
    }
}
