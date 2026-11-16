import { BattleSimulation } from "../game/BattleSimulation";
import { RULE, PADS } from "../game/GameConfig";
import { BuildingVisuals } from "./BuildingVisuals";
import { SpriteFrames } from "./SpriteFrames";
import { RAGE_VISUAL as V } from "./config/RageVisualConfig";

/** 四塔固定复用节点，前后光分属world同级层，永不进入建筑子树或点选范围。 */
export class TowerRageEffects {
    private pairs: { back: Laya.Sprite; front: Laya.Sprite; slices: { clip: Laya.Sprite; blade: Laya.Sprite }[] }[] = [];
    private battle: BattleSimulation | null = null;
    private active = false; private startedAt = -Infinity; private endedAt = -Infinity;
    constructor(world: Laya.Sprite, private art: SpriteFrames) {
        for (let i = 0; i < PADS.length; i++) {
            const back = new Laya.Sprite(), front = new Laya.Sprite();
            back.name = `RageBack:${i}`; front.name = `RageFront:${i}`;
            for (const node of [back, front]) {
                node.visible = false; node.mouseEnabled = false; node.stackingRoot = true; world.addChild(node);
            }
            const slices = [back, front].map((host, half) => {
                // 本版本Graphics.clipRect不执行裁切；原生scrollRect固定在屏幕水平面。
                const clip = new Laya.Sprite(), plane = new Laya.Sprite(), blade = new Laya.Sprite();
                host.addChild(clip); clip.addChild(plane); plane.addChild(blade);
                clip.mouseEnabled = plane.mouseEnabled = blade.mouseEnabled = false;
                clip.scrollRect = new Laya.Rectangle(0, 0, V.orbitCanvas, V.orbitCanvas * V.ringHeightRatio / 2);
                plane.pos(V.orbitCanvas / 2, half === 0 ? V.orbitCanvas * V.ringHeightRatio / 2 : 0).scale(1, V.ringHeightRatio);
                blade.size(V.orbitCanvas, V.orbitCanvas).pivot(V.orbitCanvas / 2, V.orbitCanvas / 2);
                return { clip, blade };
            });
            this.pairs.push({ back, front, slices });
        }
    }
    update(battle: BattleSimulation | null, towers: { node: Laya.Sprite; visual: BuildingVisuals }[]) {
        const depth: { id: string; y: number; node: Laya.Sprite }[] = [];
        this.pairs.forEach(p => { p.back.visible = p.front.visible = false; });
        if (battle !== this.battle) { this.battle = battle; this.active = false; this.startedAt = this.endedAt = -Infinity; }
        if (!battle || battle.outcome || battle.tactic.effect !== "ATTACK_DAMAGE" || !this.art.ready("battle")) return depth;
        const now = battle.tick * RULE.step, active = battle.bellTicks > 0;
        // 首次看见发动起算短闪，最高档（实际倍率3）追帧不能吞掉点击反馈；真实增伤时长仍读取bellTicks。
        if (!this.active && active) this.startedAt = now;
        if (this.active && !active) this.endedAt = now;
        this.active = active;
        const fade = active ? 1 : Math.max(0, 1 - (now - this.endedAt) / V.fadeSeconds);
        if (!fade) return depth;
        const pulse = Math.sin(now / V.pulseSeconds * Math.PI * 2);
        const cast = active ? Math.max(0, 1 - (now - this.startedAt) / V.castSeconds) : 0;
        const angle = (now - this.startedAt) / V.turnSeconds * 360;
        battle.base.towers.forEach((tower, i) => {
            if (!tower.kind || !tower.operator) return;
            const pair = this.pairs[i], host = towers[i], at = host.visual.weaponAnchor();
            const width = V.ringWidth[tower.kind] * at.scale * (1 + pulse * V.pulseScale + cast * V.castScale), height = width * V.ringHeightRatio;
            for (const node of [pair.back, pair.front]) { node.visible = true; node.pos(at.x, at.y - V.centerTop[tower.kind] * at.scale); node.graphics.clear(); node.alpha = fade; }
            pair.slices.forEach(({ clip, blade }, half) => {
                clip.pos(-width / 2, half === 0 ? -height / 2 : 0).scale(width / V.orbitCanvas, width / V.orbitCanvas);
                // 先旋转圆形双刃，再由plane压成椭圆；轨道本身不跟着倾斜。
                blade.texture = this.art.get("fx_rage_orbit"); blade.rotation = angle;
                blade.alpha = V.ringAlpha + pulse * V.pulseAlpha;
            });
            const glow = V.glowSize * at.scale * (1 + cast * .15);
            pair.back.graphics.save();
            pair.back.graphics.alpha(V.glowAlpha + cast * .35);
            pair.back.graphics.drawImage(this.art.get("fx_rage_glow"), -glow / 2, -glow / 2 - V.glowTop * at.scale, glow, glow);
            pair.back.graphics.restore();
            const marker = V.markerSize * at.scale;
            pair.front.graphics.drawImage(this.art.get("fx_rage_up"), -marker / 2,
                -(V.markerTop[tower.kind] + V.markerRise * pulse) * at.scale - marker / 2, marker, marker);
            if (cast > 0) pair.front.graphics.drawImage(this.art.get("fx_rage_hit"), -glow / 2, -glow / 2 - V.glowTop * at.scale, glow, glow);
            // 相邻于同一塔排序，仍允许更靠前的树/人物遮住光；不改变塔和人物的实际顺序。
            depth.push({ id: pair.back.name, y: host.node.y - .001, node: pair.back }, { id: pair.front.name, y: host.node.y + .001, node: pair.front });
        });
        return depth;
    }
}
