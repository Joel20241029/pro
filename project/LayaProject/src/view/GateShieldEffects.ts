import { BattleSimulation, CombatFeedback } from "../game/BattleSimulation";
import { RULE } from "../game/GameConfig";
import { BuildingVisuals } from "./BuildingVisuals";
import { GameLayout } from "./GameLayout";
import { SpriteFrames } from "./SpriteFrames";
import { SHIELD_VISUAL as V } from "./config/ShieldVisualConfig";

/** 护罩是独立世界层，不进入城门Body、人物遮挡框或点击列表。无粒子，固定复用节点。 */
export class GateShieldEffects {
    private back = new Laya.Sprite(); private front = new Laya.Sprite();
    private dome = new Laya.Sprite(); private sweep = new Laya.Sprite(); private emblem = new Laya.Sprite();
    private hits: { node: Laya.Sprite; at: number; tick: number; x: number; y: number }[] = [];
    private battle: BattleSimulation | null = null;
    private active = false; private startedAt = -Infinity; private endedAt = -Infinity; private nextHit = 0;
    constructor(private world: Laya.Sprite, private art: SpriteFrames) {
        this.back.name = "GateShieldBack"; this.front.name = "GateShieldFront";
        for (const node of [this.back, this.front]) {
            node.visible = false; node.mouseEnabled = false; node.stackingRoot = true; world.addChild(node);
        }
        this.dome.name = "ShieldDome"; this.sweep.name = "ShieldSweep"; this.emblem.name = "ShieldCast";
        for (const node of [this.dome, this.sweep, this.emblem]) { node.mouseEnabled = false; this.front.addChild(node); }
        for (let i = 0; i < V.hitPool; i++) {
            const node = new Laya.Sprite(); node.name = `ShieldHit:${i}`; node.mouseEnabled = false;
            this.front.addChild(node); this.hits.push({ node, at: -Infinity, tick: -1, x: 0, y: 0 });
        }
    }
    reset() {
        this.battle = null; this.active = false; this.startedAt = this.endedAt = -Infinity; this.nextHit = 0;
        this.back.visible = this.front.visible = false;
        for (const hit of this.hits) { hit.at = -Infinity; hit.node.visible = false; }
    }
    update(battle: BattleSimulation | null, gate: { node: Laya.Sprite; visual: BuildingVisuals } | null,
        layout: GameLayout, events: CombatFeedback[]) {
        const depth: { id: string; y: number; node: Laya.Sprite }[] = [];
        if (battle !== this.battle) { this.reset(); this.battle = battle; }
        this.back.visible = this.front.visible = false;
        if (!battle || battle.outcome || battle.tactic.effect !== "GATE_INVULNERABLE") { this.reset(); return depth; }
        if (!gate || !this.art.ready("battle")) return depth;
        const now = battle.tick * RULE.step, active = battle.gateProtected;
        if (!this.active && active) this.startedAt = now;
        if (this.active && !active) this.endedAt = now;
        this.active = active;
        for (const event of events) if (event.type === "gate" && event.blocked) {
            const hit = this.hits[this.nextHit++ % this.hits.length];
            // 保存事件逻辑坐标；首个可见帧起算短涟漪，追帧不能吞反馈，也不延长免伤。
            hit.at = now; hit.tick = event.tick; hit.x = event.x; hit.y = event.y;
        }
        const fade = active ? 1 : Math.max(0, 1 - (now - this.endedAt) / V.fadeSeconds);
        if (!fade) { for (const h of this.hits) h.node.visible = false; return depth; }
        const { node, bounds } = gate.visual.bodyRegion();
        const top = node.localToGlobal(new Laya.Point(bounds.x, bounds.y), false, this.world);
        const bottom = node.localToGlobal(new Laya.Point(bounds.x + bounds.width, bounds.y + bounds.height), false, this.world);
        const compact = layout.gateY - layout.mapTop < V.compactBattleHeight;
        const width = (bottom.x - top.x) * V.widthScale, height = (bottom.y - top.y) * (compact ? V.compactHeightScale : V.heightScale);
        const x = (top.x + bottom.x) / 2, y = bottom.y + V.footGap;
        const cast = Math.min(1, Math.max(0, now - this.startedAt) / V.castSeconds);
        const expand = active ? V.initialHeight + (1 - V.initialHeight) * (1 - Math.pow(1 - cast, 3)) : fade;
        for (const host of [this.back, this.front]) { host.visible = true; host.pos(x, y); host.alpha = fade; }
        this.back.size(width, width * V.ringHeight).pivot(width / 2, width * V.ringHeight / 2);
        // 显式尺寸绘制：Laya 3.4的Sprite.texture命令不会因后续size改变同步重建。
        // 罩体随城门换档、涟漪逐步放大，不能依赖纹理setter的旧尺寸缓存。
        this.back.graphics.clear(); this.back.graphics.drawImage(this.art.get("fx_shield_ring"), 0, 0, width, width * V.ringHeight);
        this.dome.size(width, height).pivot(width / 2, height * V.domeFoot).scale(1, expand);
        this.dome.graphics.clear(); this.dome.graphics.drawImage(this.art.get("fx_shield_dome"), 0, 0, width, height);
        this.dome.alpha = 1 - V.pulseAlpha + V.pulseAlpha * Math.cos(now / V.pulseSeconds * Math.PI * 2);
        const sweep = ((now - this.startedAt) % V.sweepSeconds) / V.sweepSeconds;
        const sweepWidth = width * Math.sqrt(Math.max(0, 1 - Math.pow(1 - sweep, 2)));
        this.sweep.size(sweepWidth, sweepWidth * V.ringHeight).pivot(sweepWidth / 2, sweepWidth * V.ringHeight / 2);
        this.sweep.graphics.clear(); this.sweep.graphics.drawImage(this.art.get("fx_shield_ring"), 0, 0, sweepWidth, sweepWidth * V.ringHeight);
        this.sweep.pos(0, -height * V.domeFoot * (1 - sweep) * expand); this.sweep.alpha = Math.sin(sweep * Math.PI) * V.sweepAlpha;
        const emblemSize = width * V.emblemScale;
        this.emblem.size(emblemSize, emblemSize).pivot(emblemSize / 2, emblemSize / 2).pos(0, -height * V.emblemHeight);
        this.emblem.graphics.clear(); this.emblem.graphics.drawImage(this.art.get("icon_tactic_shield"), 0, 0, emblemSize, emblemSize);
        this.emblem.alpha = 1 - cast; this.emblem.visible = active && cast < 1;
        for (const hit of this.hits) {
            const age = (now - hit.at) / V.hitSeconds; hit.node.visible = age >= 0 && age < 1;
            if (!hit.node.visible) continue;
            const size = width * V.hitWidth * (V.hitStartScale + (1 - V.hitStartScale) * age);
            hit.node.size(size, size).pivot(size / 2, size / 2);
            hit.node.graphics.clear(); hit.node.graphics.drawImage(this.art.get("fx_shield_hit"), 0, 0, size, size);
            // 到门足点投到同一护罩表面；逻辑坐标随布局换算，不伪造左右撞击方向。
            hit.node.pos(hit.x - x, Math.max(-height + size / 2, Math.min(-size / 2, layout.worldY(hit.y) - y)));
            hit.node.alpha = 1 - age;
        }
        depth.push({ id: this.back.name, y: gate.node.y - .001, node: this.back },
            { id: this.front.name, y: gate.node.y + .001, node: this.front });
        return depth;
    }
}
