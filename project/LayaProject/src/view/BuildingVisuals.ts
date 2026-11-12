import { SpriteFrames } from "./SpriteFrames";

export type BuildingLook = "HOUSE" | "FARM" | "LOGGING" | "GATE" | "ARROW" | "STONE" | "SLOW";
export interface BuildingPart { frame: string; x: number; y: number; w: number; h: number; }
/** 所有挂点以128方形源画布为基准，只覆盖基座/檐口，不改变足底、射口、碰撞或射程。
 * 每4级形成木作/加固/金饰三档，1～12级逐级变化；13级起保持轮廓，每4级轮换左侧徽饰，等级牌逐级更新。
 */
export function buildingParts(kind: BuildingLook, level: number): BuildingPart[] {
    const stage = Math.min(12, level) - 1, tier = Math.floor(stage / 4), step = stage % 4;
    const parts: BuildingPart[] = [];
    const add = (frame: string, x: number, y: number, w: number, h: number) => parts.push({ frame, x, y, w, h });
    const house = kind === "HOUSE" || kind === "LOGGING" || kind === "GATE";
    if (level <= 1) return parts;
    if (tier > 0 || step >= 2) add("part_foundation", 27, 103, 74, 15);
    if (house) {
        if (kind === "HOUSE" && tier === 2) add("part_gold_roof", 15, 27, 98, 25);
        // 城门的瓦饰和金饰放在原茅草檐口内，保留完整屋顶轮廓。
        if (kind === "GATE" && tier > 0) add(tier === 2 ? "part_gold_roof" : "part_tile_roof", 36, 38, 56, 10);
        if (kind === "LOGGING" && tier > 0) add(tier === 2 ? "part_crest" : "part_timbers", 76, 84, 24, 27);
        const feature = kind === "HOUSE" ? "part_window" : kind === "LOGGING" ? "part_tools" : "part_brace";
        if (step >= 1 || tier > 0) add(feature, kind === "GATE" ? 52 : 27, 76, 24, 26);
    } else if (kind === "FARM") {
        if (step >= 1 || tier > 0) add("part_grain", 12, 83, 24, 28);
        if (tier > 0) add(tier === 2 ? "part_timbers" : "part_tools", 91, 83, 26, 26);
    } else {
        // 器械保留完整：所有加固件在下半部，左右箭塔随同一根节点镜像。
        if (step >= 1 || tier > 0) add(tier === 2 ? "part_crest" : "part_brace", 48, 80, 28, 28);
        if (tier > 0) add(kind === "SLOW" ? "part_crystal" : "part_iron", 28, 83, 18, 26);
    }
    if (tier === 1 && step >= 1) add("part_iron", 84, 80, 15, 23);
    if (tier === 2 && step >= 1 && house) add(kind === "LOGGING" ? "part_iron" : "part_crest", kind === "LOGGING" ? 15 : 81, 73, 19, 23);
    if (tier === 2 && step >= 1 && kind === "FARM") add("part_crest", 51, 94, 19, 22);
    if (tier === 2 && step >= 1 && !house && kind !== "FARM") add("part_iron", 81, 83, 17, 26);
    if (step >= (tier ? 2 : 3)) add("part_banner", 96, house ? 62 : 86, 16, 23);
    const crestStage = level >= 13 && Math.floor((level - 13) / 4) % 2 === 0;
    if (tier > 0 && step === 3) add(tier === 1 || crestStage ? "part_crest" : "part_banner", 13, house ? 64 : 87, 16, 23);
    return parts;
}

/** 部件只在等级/种类变化时重建；升级光点复用原图集，不注册额外计时器。 */
export class BuildingVisuals {
    private key = "";
    private level = 0;
    private parts = new Laya.Sprite();
    private flash = new Laya.Sprite();
    private elapsed = 1;
    constructor(private owner: Laya.Sprite, private art: SpriteFrames) {
        this.parts.name = "UpgradeParts"; this.parts.mouseEnabled = false; owner.addChild(this.parts);
        this.flash.name = "UpgradeFlash"; this.flash.mouseEnabled = false; this.flash.visible = false; owner.addChild(this.flash);
    }
    sync(kind: BuildingLook | null, level: number, freshVillage: boolean) {
        const key = `${kind}:${level}`;
        if (freshVillage) { this.elapsed = 1; this.flash.visible = false; }
        if (this.key === key) return;
        this.key = key; this.parts.destroyChildren();
        const scale = this.owner.width / 128;
        if (kind) for (const part of buildingParts(kind, level)) {
            const node = new Laya.Sprite(); node.name = part.frame; node.texture = this.art.get(part.frame);
            node.pos(part.x * scale, part.y * scale); node.size(part.w * scale, part.h * scale); node.mouseEnabled = false; this.parts.addChild(node);
        }
        if (kind && level >= 13) {
            const badge = new Laya.Text(); badge.name = "UpgradeLevel"; badge.text = String(level);
            badge.wordWrap = false; badge.overflow = Laya.Text.SHRINK;
            badge.fontSize = 23 * scale; badge.bold = true; badge.color = "#fff0ac"; badge.stroke = 2 * scale; badge.strokeColor = "#493420";
            badge.align = "center"; badge.valign = "middle"; badge.size(70 * scale, 28 * scale); badge.pivot(35 * scale, 0);
            badge.pos(64 * scale, 88 * scale); badge.scaleX = this.owner.scaleX; badge.mouseEnabled = false; this.parts.addChild(badge);
        }
        if (!freshVillage && kind && this.level > 0 && level > this.level) { this.elapsed = 0; this.flash.visible = true; }
        this.level = level;
    }
    advance(delta: number) {
        if (this.elapsed >= 1) return;
        this.elapsed = Math.min(1, this.elapsed + delta);
        // 约一秒的金色十字光点，沿屋顶两侧升起；固定轮廓外不增加常驻体积。
        const size = this.owner.width, t = this.elapsed;
        this.flash.texture = null; this.flash.graphics.clear(); this.flash.alpha = 1 - t;
        for (const x of [.22, .78]) {
            const y = size * (.5 - t * .2), px = size * x;
            this.flash.graphics.drawLine(px - 4, y, px + 4, y, "#fff0ac", 3);
            this.flash.graphics.drawLine(px, y - 6, px, y + 6, "#fff0ac", 3);
        }
        this.flash.visible = t < 1;
    }
}
