import { ECONOMY } from "../../config/RuleConfig";
import { VILLAGER_QUALITY } from "../../config/VillagerQuality";
import { TRAITS } from "../../game/GameConfig";
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
    text("村民天赋", 26, 14, 300, 43, 33, C.ink, true);
    const effect = (title: string, description: string, row: number, resource?: { icon: string; value: string }) => {
        text(title, 28, row, 100, 40, 28, C.green, true);
        const copyX = 143, right = card.width - 28, resourceWidth = 116, gap = 12;
        const copyWidth = right - copyX - (resource ? resourceWidth + gap : 0);
        const line = text(description, copyX, row, copyWidth, 40, 27);
        if (resource) ctx.ui.iconValue(card, resource.icon, resource.value,
            copyX + Math.min(copyWidth, Math.ceil(line.textWidth)) + gap, row, resourceWidth, 40, C.timber, 27, "left");
    };
    person.traits.forEach((id, i) => {
        const [title, description] = TRAITS[id], y = (compact ? 63 : 70) + i * 44;
        if (id === "trait_diligent" || id === "trait_woodwise") {
            const farming = id === "trait_diligent";
            effect(title, "个人产量", y, { icon: farming ? "icon_food" : "icon_wood",
                value: `+${Math.round((farming ? ECONOMY.diligentFood : ECONOMY.woodwiseWood) * 100)}%` });
        } else if (id === "trait_frugal") {
            effect(title, "成人每日基础口粮", y, { icon: "icon_food", value: String(ECONOMY.frugalRation) });
        } else effect(title, description, y);
    });

}

export function drawResidentQuality(ctx: PanelContext, card: Laya.Sprite, quality: typeof VILLAGER_QUALITY[Person["quality"]], compact = false) {
    const text = residentCardText.bind(null, ctx, card), effectsY = compact ? 57 : 65;
    text(`${quality.label}加成`, 26, 14, 300, 43, 33, C.ink, true);
    text(`耕伐 +${Math.round((quality.production - 1) * 100)}%`, 27, effectsY, 176, 40, 28, C.green, true);
    text(`塔伤 +${Math.round((quality.damage - 1) * 100)}%`, 221, effectsY, 178, 40, 28, C.green, true);
    text(`劳作 ${quality.adultNights} 夜 · 养老 ${quality.elderNights} 夜`, 28, compact ? 101 : 110, 520, 32, 24, C.muted);
}
