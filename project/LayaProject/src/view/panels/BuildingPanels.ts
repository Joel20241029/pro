import { preparationText } from "./ResourcePanel";
import { capacity, economy, person } from "../../game/VillageRules";
import { GameState, isElder, isWorkingAdult } from "../../game/GameState";
import { ENEMIES, PADS, RESIDENTIAL, RULE, TOWERS, TowerKind } from "../../game/GameConfig";
import { enemyPower, gateCapacity, laborSlots, laborYield, levelPower, repairCost, residentialCost, storageCapacity, UpgradeKind, upgradeCost, upgradeUnavailableReason } from "../../game/Growth";
import { C, UI } from "../UiTheme";
import { ScrollList } from "../ScrollList";
import { Panel, PanelContext } from "./PanelContext";
import { amount, coloredName, growthPreview, resourceCost } from "../ViewText";
import { orderPanelRows } from "./PanelListOrder";
import { tacticDefinition } from "../../config/TacticConfig";
export function drawBuildingPanel(ctx: PanelContext, s: GameState, p: Panel) {
    const day = s.phase === "DAY";
    if (p.type === "build") {
        const box = ctx.modal("建设村落", `木材 ${amount(s.wood)}   粮食 ${amount(s.food)}   仓储各 ${amount(storageCapacity(s))}\n红字表示材料不足，向上滑动查看更多。`);
        const rows = new ScrollList(UI.contentWidth, 560, 6 * 220 - 12, p.scroll, offset => p.scroll = offset);
        rows.pos(34, 222);
        box.addChild(rows);
        const definitions: [
            UpgradeKind,
            number,
            string,
            string,
            string
        ][] = [
            ["FARM", s.farm, "icon_food", "农田", `每人产粮 ${growthPreview(laborYield("FARM", s.farm), laborYield("FARM", s.farm + 1))} · ${laborSlots("FARM", s.farm + 1)} 岗`],
            ["LOGGING", s.logging, "icon_logging", "伐木场", `每人产木 ${growthPreview(laborYield("LOGGING", s.logging), laborYield("LOGGING", s.logging + 1))} · ${laborSlots("LOGGING", s.logging + 1)} 岗`],
            ["HOUSING", s.housing, "icon_house", "民居修缮", `仓储 ${growthPreview(storageCapacity(s), storageCapacity({ ...s, housing: s.housing + 1 }))}`],
            ["GATE", s.gateLevel, "icon_shield", "城门加固", `耐久上限 ${growthPreview(gateCapacity(s), gateCapacity({ ...s, gateLevel: s.gateLevel + 1 }))}`]
        ];
        const entries = definitions.map(([kind, level, icon, title, effect]) => {
            const cost = upgradeCost(kind, level);
            return { id: kind as string, icon, title: `${title} · ${amount(level)} 阶`, effect,
                cost: `木 ${resourceCost(s.wood, cost.wood)}  粮 ${resourceCost(s.food, cost.food)}`, reason: upgradeUnavailableReason(s, cost), verb: "升级",
                action: () => ctx.send({ type: "BUILD", kind: kind as "FARM" | "LOGGING" | "HOUSING" | "GATE" }) };
        });
        const houseCost = residentialCost(s.houses);
        entries.push(
            { id: "HOUSE", icon: "icon_build", title: `住宅扩建 · ${s.houses}/${RULE.houseMax} 级`, effect: `住房 ${capacity(s)} → ${Math.min(RULE.populationCap, capacity(s) + RESIDENTIAL.capacityPerLevel)} 人`, cost: `木 ${resourceCost(s.wood, houseCost.wood)}  粮 ${resourceCost(s.food, houseCost.food)}`,
                reason: s.houses >= RULE.houseMax ? `已达 ${RULE.houseMax} 级；修缮可继续扩仓储` : upgradeUnavailableReason(s, houseCost), verb: "增建", action: () => ctx.send({ type: "BUILD", kind: "HOUSE" }) },
            { id: "REPAIR", icon: "icon_shield", title: "修复城门", effect: `当前耐久 ${amount(s.gate)}/${amount(gateCapacity(s))}`, cost: `木 ${resourceCost(s.wood, repairCost(s))}`,
                reason: !day ? "请在白天修门" : s.gate >= gateCapacity(s) ? "城门完好，无需修复" : s.wood < repairCost(s) ? `还缺 ${repairCost(s) - s.wood} 木材` : null, verb: "修复", action: () => ctx.send({ type: "REPAIR" }) }
        );
        orderPanelRows(p, entries, row => row.id, row => row.reason === null).forEach((row, i) =>
            ctx.ui.buildRow(rows.content, i * 220, row.icon, row.title, row.effect, row.cost, row.reason, row.action, row.verb));
        ctx.ui.label(box, "点击地图防塔，可升级或调任驻守村民。", 34, 794, 600, 26, C.muted, false, 44).align = "center";
        return;
    }
    if (p.type === "tower") {
        const i = p.index!, t = ctx.game.battle?.base.towers[i] || s.towers[i];
        const box = ctx.modal(`第 ${i + 1} 塔位${t.kind ? " · " + TOWERS[t.kind].name : " · 空地"}`, t.kind ? `${amount(t.level)} 阶 · 驻守 ${t.operator ? coloredName(person(s, t.operator)) : "成年村民不足"}\n转型保留等级，选择驻守后直接返回村庄。` : "箭楼单体快攻，石塔范围破甲，寒塔减速控场。");
        (Object.keys(TOWERS) as TowerKind[]).forEach((k, j) => {
            const cost = t.kind ? RULE.towerConvert : TOWERS[k].cost;
            const detail = t.kind === k ? "已建成" : !day ? "白天可建" : s.wood < cost ? `还缺 ${cost - s.wood} 木` : "木 " + resourceCost(s.wood, cost);
            ctx.ui.button(box, `${t.kind && t.kind !== k ? "转为" : ""}${TOWERS[k].name}\n${detail}`, 34 + j * 204, 234, 192, () => ctx.send({ type: "TOWER", index: i, kind: k }), t.kind === k ? C.gold : C.green, 104, day && t.kind !== k && s.wood >= cost);
        });
        if (t.kind) {
            const cost = upgradeCost("TOWER", t.level), rowParent = new Laya.Sprite();
            rowParent.pos(34, 354);
            box.addChild(rowParent);
            ctx.ui.buildRow(rowParent, 0, t.kind === "ARROW" ? "icon_arrow" : t.kind === "STONE" ? "icon_stone" : "icon_slow", `升级至 ${amount(t.level + 1)} 阶`, `基础伤害 ${growthPreview(Math.floor(TOWERS[t.kind].damage * levelPower(t.level)), Math.floor(TOWERS[t.kind].damage * levelPower(t.level + 1)))}`, `木 ${resourceCost(s.wood, cost.wood)}  粮 ${resourceCost(s.food, cost.food)}`, upgradeUnavailableReason(s, cost), () => ctx.send({ type: "UPGRADE", index: i }));
        }
        ctx.ui.button(box, !t.kind ? "先建塔，再安排驻守" : t.operator ? "更换驻守村民" : "暂无可驻塔的成年人", 34, 566, 600, () => ctx.open({ type: "operators", index: i }), C.green, 78, !!t.kind && s.people.some(isWorkingAdult));
        ctx.ui.label(box, !t.kind ? "先在上方选择防塔\n建成后自动安排可用成年人" : "空位自动安排成年且未退休的村民\n选择其他塔的驻守者，两人直接对调", 34, 672, 600, 28, C.green, false, 82).align = "center";
        if (!day)
            ctx.ui.label(box, ctx.game.pauses.has("USER") ? "已手动暂停。关闭后点“继续守夜”。" : "调任期间暂停，关闭后自动继续。", 34, 774, 600, 28, C.muted, false, 66).align = "center";
        return;
    }
    if (p.type === "wave" || p.type === "start") {
        const e = economy(s), w = s.wave!;
        const box = ctx.modal(p.type === "start" ? "今夜，也要守住家" : "瞭望来报", `第 ${s.day} 夜 · ${w.entries.length} 名来敌 · ${({ NONE: "平常夜", FAST: "疾行来袭", STURDY: "坚韧来袭", GROUP: "结队来袭" })[w.affix]}`);
        const counts = Object.keys(ENEMIES).filter(k => w.entries.some(e => e.kind === k));
        if (p.type === "start") {
            const selected = tacticDefinition(s.tactics.equipped), strip = new Laya.Sprite(); strip.pos(34, 192);
            ctx.art.panel(strip, "panel_card", 600, 64); box.addChild(strip);
            ctx.ui.image(strip, selected.icon, 14, 12, 40);
            ctx.ui.label(strip, `今夜携带：${selected.name}`, 64, 10, 402, 27, C.ink, true, 44);
            ctx.ui.button(strip, "更换", 474, 8, 112, () => ctx.open({ type: "tactics", back: p }), C.green, 48, day);
        }
        const rows = new ScrollList(600, p.type === "start" ? 112 : 156, counts.length * 52, p.scroll, offset => p.scroll = offset);
        rows.pos(34, p.type === "start" ? 270 : 208); box.addChild(rows);
        counts.forEach((k, i) => {
            const data = ENEMIES[k as keyof typeof ENEMIES], count = w.entries.filter(e => e.kind === k).length;
            ctx.ui.label(rows.content, `${data.name}  ×${count}`, 18, i * 52, 310, 27, data.boss ? C.red : C.ink, true, 48);
            ctx.ui.label(rows.content, `${data.boss ? "首领 · " : ""}${data.brief}`, 330, i * 52, 252, 23, data.boss ? C.red : C.muted, false, 48).align = "right";
        });
        const summary = new Laya.Sprite();
        summary.pos(34, p.type === "start" ? 394 : 380);
        ctx.art.panel(summary, "panel_card", 600, p.type === "start" ? 184 : 202);
        box.addChild(summary);
        ctx.ui.label(summary, `粮食 ${amount(s.food)} + ${amount(e.food)} - ${e.rations} → ${amount(e.endFood)}\n木材 ${amount(s.wood)} + ${amount(e.wood)} → ${amount(e.endWood)}\n驻塔 ${s.towers.filter(t => t.operator).length}/${PADS.length}  ·  照料 ${s.people.filter(p => p.job === "CARE").length} 人\n养老 ${s.people.filter(isElder).length} 人 · 基础口粮 ${e.elderRations}（已计入）`, 22, 20, 556, 27, C.green, true, 174);
        ctx.ui.label(box, `${e.hungry ? "口粮不足：本夜攻速降至 70%。\n" : ""}${!s.towers.some(t => t.operator) ? "无人驻塔，城门将直接承受进攻。\n" : ""}敌军强度 ×${enemyPower(s.day).toFixed(2)} · 离开后暂停，重进从本夜开头守起`, 40, 596, 588, 26, e.hungry ? C.red : C.muted, false, 100);
        const state = ctx.resources.states.battle, ready = ctx.resources.ready("battle"), failed = state.phase === "FAILED";
        if (p.type === "start" && !ready) {
            ctx.ui.label(box, preparationText(state), 40, 694, 588, 25, failed ? C.red : C.muted, false, 54).align = "center";
            ctx.ui.button(box, failed ? "重试准备守夜" : "守夜资源准备中…", 34, 760, 600, () => { void ctx.resources.ensure("battle"); }, C.gold, 78, day && failed);
        } else ctx.ui.button(box, p.type === "start" ? "确认安排 · 开始守夜" : "准备守夜", 34, 760, 600, () => p.type === "start" ? ctx.send({ type: "NIGHT" }, false) : ctx.open({ type: "start" }), C.gold, 78, day);
        return;
    }
}
