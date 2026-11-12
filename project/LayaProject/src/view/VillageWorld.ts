import { GameSession } from "../game/GameSession";
import { person } from "../game/VillageRules";
import { GameState, isElder } from "../game/GameState";
import { ELITE, PATH, RULE } from "../game/GameConfig";
import { BattleSimulation, pointAt } from "../game/BattleSimulation";
import { gateCapacity } from "../game/Growth";
import { SpriteFrames } from "./SpriteFrames";
import { compareDepth, layoutVillage, TOWER_VIEW, VillageNavigation, WEDDING } from "./VillageScene";
import { GameLayout } from "./GameLayout";
import { VillagerMotion } from "./VillagerMotion";
import { ProjectileMotion } from "./ProjectileMotion";
import { C } from "./UiTheme";
import { EMOTE, VillagerEmotes } from "./VillagerEmotes";
import { BuildingLook, BuildingVisuals } from "./BuildingVisuals";
import { houseRooms } from "./BuildingLayout";
import { UiWidgets } from "./UiWidgets";
/** 地图、人物、建筑与战斗表现的唯一所有者。视觉时钟不推进 GameSession/业务随机数。 */
export class VillageWorld {
    readonly scenery = new Laya.Sprite();
    readonly world = new Laya.Sprite();
    readonly shots = new Laya.Sprite();
    readonly bellAura = new Laya.Sprite();
    readonly emote = new Laya.Sprite();
    private people: Laya.Sprite[] = [];
    private enemies: Laya.Sprite[] = [];
    private hearts: Laya.Sprite[] = [];
    private props: {
        id: string;
        y: number;
        node: Laya.Sprite;
        visual?: BuildingVisuals;
    }[] = [];
    private freshBuildingVillage = true;
    scene = layoutVillage(this.layout);
    private motion = new VillagerMotion(new VillageNavigation(this.scene.props, this.scene.landscape, this.scene.bounds), this.scene.stops);
    private emotes = new VillagerEmotes();
    private projectiles = new ProjectileMotion();
    private projectileNodes: Laya.Sprite[] = [];
    private lastBattle: BattleSimulation | null = null;
    private lastBattleTick = 0;
    private backgroundKey = "";
    private renderDelta = 0;
    constructor(private game: GameSession, private art: SpriteFrames, private ui: UiWidgets, private layout: GameLayout) {
        this.world.name = "VillageWorld";
        for (const p of this.scene.props) {
            const node = new Laya.Sprite();
            node.name = p.id;
            node.mouseEnabled = false;
            node.stackingRoot = true;
            this.art.applyFrame(node, p.frame, p.size);
            node.pos(p.x, p.y);
            this.world.addChild(node);
            const upgradeable = p.id.startsWith("tower:") || (p.id.startsWith("building:") && p.id !== "building:hearth");
            this.props.push({ id: p.id, y: p.ground ? -1 : p.y, node, visual: upgradeable ? new BuildingVisuals(node, art) : undefined });
            if (p.signText) {
                // 88×52源画布：牌面横向留10%，文字框顶边为宽度的13.75%；避开两端铆钉。
                // 文字只在牌面居中，不含下方木桩；与路牌共用足底遮挡。
                const title = this.ui.label(node, p.signText, p.size * .1, p.size * .1375, p.size * .8, 22, "#59391e", true, p.size * .2);
                title.fontSize = 22;
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
            // 红心与人物共用足底排序，屋顶仍可遮住他们；固定池随人物销毁，不在逐帧更新中创建节点。
            const heart = new Laya.Sprite();
            heart.name = "WeddingHeart";
            heart.mouseEnabled = false;
            heart.visible = false;
            this.art.applyFrame(heart, "fx_hearts", WEDDING.heartSize);
            s.addChild(heart);
            this.hearts.push(heart);
        }
        for (let i = 0; i < RULE.enemyCap; i++) {
            const s = new Laya.Sprite();
            s.mouseEnabled = false;
            this.world.addChild(s);
            this.enemies.push(s);
        }
        for (let i = 0; i < RULE.effectCap; i++) {
            const s = new Laya.Sprite();
            s.mouseEnabled = false;
            s.visible = false;
            this.shots.addChild(s);
            this.projectileNodes.push(s);
        }
    }
    reset() {
        this.motion = new VillagerMotion(new VillageNavigation(this.scene.props, this.scene.landscape, this.scene.bounds), this.scene.stops);
        this.emotes = new VillagerEmotes();
        this.projectiles = new ProjectileMotion();
        this.lastBattle = null;
        this.lastBattleTick = 0;
        this.renderDelta = 0;
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
        this.scenery.graphics.drawRect(0, 0, 720, this.layout.height, night ? C.night : C.grass);
        this.scenery.graphics.drawRect(0, y(780), 720, this.layout.footerTop - y(780), night ? "#6d785e" : "#b5bd86");
        for (const tree of this.scene.props.filter(p => p.id.startsWith("forest:")))
            this.scenery.graphics.drawEllipse(tree.x - tree.size * .38, tree.y - tree.size * .28, tree.size * .76, tree.size * .35, night ? "#304c45" : "#829956", null, 0);
        // 先完成全部路沿，再铺完整路面，避免后一段路沿覆盖前一段路面形成尖刺接缝。
        for (const surface of [{ width: 80, color: night ? "#696f5e" : "#a99867" }, { width: 68, color: night ? "#8d8976" : "#d3bc8a" }])
            for (let i = 1; i < PATH.length; i++) {
                this.scenery.graphics.drawLine(PATH[i - 1].x, y(PATH[i - 1].y), PATH[i].x, y(PATH[i].y), surface.color, surface.width);
                this.scenery.graphics.drawCircle(PATH[i].x, y(PATH[i].y), surface.width / 2, surface.color);
            }
        // 固定点缀不消费业务 RNG；森林阴影、草簇与小石头为道路提供边缘层次。
        for (const [x, at] of [[182, 399], [530, 470], [173, 591], [560, 643], [297, 628], [411, 356]])
            this.ui.image(this.scenery, "deco_rocks", x, y(at), 36);
        for (let i = 0; i < 26; i++) {
            const x = i % 2 ? 560 + i % 5 * 17 : 105 + i % 5 * 16, at = y(298 + Math.floor(i / 2) * 35);
            this.scenery.graphics.drawLine(x, at, x - 3, at - 8, night ? "#577451" : "#668445", 3);
            this.scenery.graphics.drawLine(x, at, x + 4, at - 6, night ? "#577451" : "#668445", 3);
        }
        // 美术仅提供地块拼片，不将未验证接缝的地块铺满地图。
    }
    advance(delta: number): boolean {
        if (!this.game.pauses.has("BACKGROUND") && !this.game.pauses.has("DISABLED")) {
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
        if (s && !this.game.pauses.size && (s.phase === "DAY" || s.phase === "NIGHT")) {
            this.motion.update(visualDelta);
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
        this.bellAura.visible = false;
        this.bellAura.graphics.clear();
        this.people.forEach(n => n.visible = false);
        this.enemies.forEach(n => n.visible = false);
        this.projectileNodes.forEach(n => n.visible = false);
        this.hearts.forEach(n => { n.visible = false; n.alpha = 1; n.scale(1, 1); n.pos(0, 0); });
        this.emote.visible = false;
        const depth = this.props.slice();
        if (!s) {
            depth.sort(compareDepth).forEach((p, i) => p.node.zIndex = i);
            return;
        }
        for (const p of this.props) {
            let kind: BuildingLook | null = null, level = 0, rooms = 1, damaged = false;
            if (p.id === "building:gate") {
                damaged = (battle ? battle.gate : s.gate) / gateCapacity(s) < .35;
                kind = "GATE";
                level = s.gateLevel;
            }
            else if (p.id.startsWith("tower:")) {
                const index = Number(p.id.split(":")[1]), t = (battle ? battle.base.towers : s.towers)[index];
                p.node.texture = t.kind ? null : this.art.get("building_tower_pad");
                p.node.scaleX = t.kind === "ARROW" || t.kind === "STONE" ? TOWER_VIEW.facing[index] : 1;
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
            p.visual?.sync(kind, level, this.freshBuildingVillage, rooms, damaged);
            const extra = p.visual?.occluder();
            if (extra)
                depth.push(extra);
        }
        for (const p of this.props)
            if (p.id.startsWith("tower:"))
                p.visual!.updateAttack(battle, Number(p.id.split(":")[1]));
        this.projectiles.update(battle, this.layout, this.scene.pads, index => this.props.find(p => p.id === `tower:${index}`)!.visual!.launchPoint());
        this.freshBuildingVillage = false;
        s.people.forEach((p, i) => {
            const n = this.people[i], pose = this.motion.get(p.id);
            n.visible = !pose.insideTower;
            n.name = `person:${p.id}`;
            const identity = isElder(p) ? `elder_${p.sex === "MALE" ? "male" : "female"}` : p.adult ? p.appearance : p.sex === "MALE" ? "boy" : "girl";
            const facing = pose.clip.endsWith("_walk") ? this.art.walk(identity, pose.direction) : { clip: pose.clip, mirror: pose.mirror };
            this.art.applyFrame(n, this.art.frameId(facing.clip, pose.elapsed, pose.animated), p.adult ? 56 : p.growth === 0 ? 42 : 48);
            const scale = (p.elite ? ELITE.visualScale : 1) * this.layout.personScale;
            n.pos(pose.x, pose.y);
            n.scale((facing.mirror ? -1 : 1) * scale, scale);
            if (pose.heartElapsed !== null && n.visible) {
                const heart = this.hearts[i], elapsed = pose.heartElapsed;
                heart.visible = true;
                heart.alpha = Math.min(1, elapsed / WEDDING.fadeIn, (WEDDING.heartSeconds - elapsed) / WEDDING.fadeOut);
                const pulse = 1 + WEDDING.pulse * Math.sin(elapsed / WEDDING.pulseSeconds * Math.PI * 2);
                // 局部坐标以人物原画布为基准，减去足底 pivot 后正好位于头顶；反镜像保持红心构图一致。
                heart.pos(n.pivotX, n.pivotY - WEDDING.headOffset - WEDDING.rise * elapsed / WEDDING.heartSeconds);
                heart.scale((facing.mirror ? -1 : 1) * pulse, pulse);
            }
            depth.push({ id: n.name, y: pose.y, node: n });
        });
        const emote = this.emotes.current;
        if (emote && !panelOpen && !this.game.pauses.size && (s.phase === "DAY" || s.phase === "NIGHT")) {
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
        if (battle) {
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
            battle.enemies.forEach((e, i) => {
                const n = this.enemies[i], at = pointAt(e.progress);
                n.visible = true;
                n.name = `enemy:${e.seq}`;
                this.art.applyFrame(n, this.art.frameId(`${e.kind}_walk`, battle.tick * RULE.step + e.seq * .13), e.kind === "enemy_chief" ? 82 : 64);
                n.pos(at.x, this.layout.worldY(at.y));
                n.scale(this.art.enemyMirror(e.kind, pointAt(e.progress + 1).x - at.x) ? -1 : 1, 1);
                depth.push({ id: n.name, y: n.y, node: n });
            });
            this.projectiles.poses.forEach((p, i) => {
                const n = this.projectileNodes[i];
                n.name = `projectile:${p.shot.kind}:${p.shot.tower}:${p.shot.tick}`;
                n.visible = true;
                this.art.applyFrame(n, p.frame, p.size);
                n.pos(p.x, p.y);
                n.rotation = p.rotation;
                n.alpha = p.alpha;
            });
        }
        // Laya 3.4 的 zIndex 决定渲染顺序；world 为 stackingRoot，不让深度排序覆盖 HUD/弹窗。
        depth.sort(compareDepth).forEach((p, i) => p.node.zIndex = i);
    }
}
