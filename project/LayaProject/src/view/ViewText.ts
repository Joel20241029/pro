import { Person } from "../game/GameState";
import { C } from "./UiTheme";
/** 同一姓名格式用于名册、家庭、详情与驻塔；只给名字上色，说明文字保持自身层级。 */
import { VILLAGER_QUALITY } from "../config/VillagerQuality";
const QUALITY_COLORS = { ELITE: C.green, HERO: C.heroName, LEGENDARY: C.legendaryName };
export function coloredName(p: Person, enabled = true) { return `${p.quality !== "COMMON" ? `<font color="${enabled ? QUALITY_COLORS[p.quality] : C.muted}">${VILLAGER_QUALITY[p.quality].label}·</font>` : ""}<font color="${!enabled ? C.muted : p.sex === "MALE" ? C.maleName : C.femaleName}" stroke="1" strokecolor="${C.lightEdge}">${p.name.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</font>`; }
/** 顶部窄栏用千进制缩写并向下截断，避免显示出尚未拥有的资源；其他说明沿用万/亿。只改变显示。 */
export function amount(value: number, compact = false) {
    if (compact) {
        for (const [unit, suffix] of [[1e15, "q"], [1e12, "t"], [1e9, "b"], [1e6, "m"], [1e3, "k"]] as const) {
            if (value >= unit)
                return `${Math.floor(value / unit * 10) / 10}${suffix}`;
        }
        return String(value);
    }
    return value >= 100000000 ? `${(value / 100000000).toFixed(1).replace(/\.0$/, "")}亿` : value >= 10000 ? `${(value / 10000).toFixed(1).replace(/\.0$/, "")}万` : String(value);
}
/** 紧凑显示将相邻等级舍入成相同数值时，改列实际增量，避免显示成“升级没收益”。 */
export function growthPreview(current: number, next: number) {
    const before = amount(current), after = amount(next);
    return before === after ? `${before}（+${amount(next - current)}）` : `${before} → ${after}`;
}
/** 费用行用红字标出不足的材料。保留其余资格、仓储和时段限制。 */
export function reasonBesideCost(reason: string | null) {
    return reason?.startsWith("还缺 ") || reason === "材料不足" ? null : reason;
}
