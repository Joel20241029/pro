import { ECONOMY } from "../../config/RuleConfig";
import { VILLAGER_QUALITY } from "../../config/VillagerQuality";
import { SKILLS, TRAITS } from "../../game/GameConfig";
import type { Person } from "../../game/GameState";
import { C } from "../UiTheme";
import type { PanelContext } from "./PanelContext";

export function residentCardText(ctx: PanelContext, node: Laya.Sprite, value: string, x: number, y: number,
    width: number, height: number, size: number, color = C.ink, bold = false) {
    const label = ctx.ui.label(node, value, x, y, width, size, color, bold, height);
    label.wordWrap = false;
    label.overflow = Laya.Text.SHRINK;
    label.valign = "middle";
    return label;
}

/** 村民详情与旅人预览共用数据和图标。旅人的卡片行距略紧，为固定操作区留空间。 */
export function drawResidentTalent(ctx: PanelContext, card: Laya.Sprite, person: Person, compact = false) {
    const text = residentCardText.bind(null, ctx, card);
    text("天赋与专长", 26, 14, 300, 43, 33, C.ink, true);
    const trait = TRAITS[person.trait], skill = person.skill ? SKILLS[person.skill] : null;
    const traitY = compact ? 63 : 70, skillY = compact ? 109 : 114;
    const effect = (title: string, description: string, row: number, resource?: { icon: string; value: string }) => {
        text(title, 28, row, 100, 40, 28, C.green, true);
        const line = text(description, 143, row, 425, 40, 27);
        if (resource) ctx.ui.iconValue(card, resource.icon, resource.value,
            143 + Math.ceil(line.textWidth) + 14, row, 116, 40, C.timber, 27, "left");
    };
    if (person.trait === "trait_frugal") effect(trait[0], "成人每日口粮", traitY, { icon: "icon_food", value: String(ECONOMY.frugalRation) });
    else effect(trait[0], person.trait === "trait_diligent" ? `耕作产出 +${Math.round(ECONOMY.diligentFood * 100)}%` : trait[1], traitY);
    if (person.skill === "skill_nurturing") effect(skill![0], "照料孩子时产出", skillY, { icon: "icon_food", value: String(ECONOMY.nurturingFood) });
    else if (person.skill === "skill_farming" || person.skill === "skill_logging") effect(skill![0], "产量", skillY, {
        icon: person.skill === "skill_farming" ? "icon_food" : "icon_wood",
        value: `+${Math.round((person.skill === "skill_farming" ? ECONOMY.farmingFood : ECONOMY.loggingWood) * 100)}%`
    });
    else effect(skill?.[0] ?? "专长", skill?.[1] ?? "成年后选择", skillY);
}

export function drawResidentQuality(ctx: PanelContext, card: Laya.Sprite, quality: typeof VILLAGER_QUALITY[Person["quality"]], compact = false) {
    const text = residentCardText.bind(null, ctx, card), effectsY = compact ? 57 : 65;
    text(`${quality.label}加成`, 26, 14, 300, 43, 33, C.ink, true);
    text(`耕伐 +${Math.round((quality.production - 1) * 100)}%`, 27, effectsY, 176, 40, 28, C.green, true);
    text(`塔伤 +${Math.round((quality.damage - 1) * 100)}%`, 221, effectsY, 178, 40, 28, C.green, true);
    text("照料", 404, effectsY, 68, 40, 27, C.green, true);
    ctx.ui.iconValue(card, "icon_food", `+${quality.careFood}`, 471, effectsY, 98, 40, C.green, 27, "left");
    text(`劳作 ${quality.adultNights} 夜 · 养老 ${quality.elderNights} 夜`, 28, compact ? 101 : 110, 520, 32, 24, C.muted);
}
