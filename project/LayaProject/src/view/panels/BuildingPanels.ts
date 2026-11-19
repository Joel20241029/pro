import { patrolBuildReason } from "../../game/PatrolRules";
import { PATROL } from "../../config/PatrolConfig";
import { capacity, person } from "../../game/VillageRules";
import { GameState, isWorkingAdult } from "../../game/GameState";
import { RESIDENTIAL, RULE, TOWERS, TowerKind } from "../../game/GameConfig";
import { gateCapacity, laborSlots, laborYield, levelPower, repairCost, residentialCost, storageCapacity, UpgradeKind, upgradeCost, upgradeUnavailableReason } from "../../game/Growth";
import { C, UI } from "../UiTheme";
import { ScrollList } from "../ScrollList";
import { Panel, PanelContext } from "./PanelContext";
import { amount, coloredName, growthPreview } from "../ViewText";
import { orderPanelRows } from "./PanelListOrder";
import type { MaterialCost } from "../UiWidgets";
export function drawBuildingPanel(ctx: PanelContext, s: GameState, p: Panel) {
    const day = s.phase === "DAY";
    if (p.type === "build") {
        const box = ctx.modal("建设村落", "", true, undefined,
            "上方是现有库存／仓储。卡片上显示本次费用，红字为现有／所需。修缮增加仓储，扩建增加住房。上下滑动查看更多。");
        const stock = new Laya.Sprite(); stock.pos(34, 115); ctx.art.panel(stock, "panel_card", 600, 62); box.addChild(stock);
        ctx.ui.label(stock, "库存", 22, 8, 102, 27, C.ink, true, 46);
        const cap = amount(storageCapacity(s), true);
        ctx.ui.iconValue(stock, "icon_food", `${amount(s.food, true)}/${cap}`, 134, 6, 214, 50, C.green);
        ctx.ui.iconValue(stock, "icon_wood", `${amount(s.wood, true)}/${cap}`, 362, 6, 216, 50, C.timber);
        const patrolOpen = s.completed >= PATROL.unlock;
        if (patrolOpen) {
            const button = ctx.ui.button(box, PATROL.building, 34, 187, 600,
                () => ctx.open({ type: "patrol" }), C.gold, 66);
            const canAppoint = s.patrol && !s.patrol.captain && s.people.some(isWorkingAdult);
            if (day && (canAppoint || patrolBuildReason(s) === null)) ctx.ui.actionBadge(button, "PatrolActionDot");
        }
        const definitions: [
            UpgradeKind,
            number,
            string,
            string,
            string
        ][] = [
            ["FARM", s.farm, "icon_food", "农田", `人均产出 ${growthPreview(laborYield("FARM", s.farm), laborYield("FARM", s.farm + 1))} · ${laborSlots("FARM", s.farm + 1)} 岗`],
            ["LOGGING", s.logging, "icon_logging", "伐木场", `人均产出 ${growthPreview(laborYield("LOGGING", s.logging), laborYield("LOGGING", s.logging + 1))} · ${laborSlots("LOGGING", s.logging + 1)} 岗`],
            ["HOUSING", s.housing, "icon_house", "民居修缮", `仓储 ${growthPreview(storageCapacity(s), storageCapacity({ ...s, housing: s.housing + 1 }))}`],
            ["GATE", s.gateLevel, "icon_shield", "城门加固", `耐久上限 ${growthPreview(gateCapacity(s), gateCapacity({ ...s, gateLevel: s.gateLevel + 1 }))}`]
        ];
        const entries = definitions.map(([kind, level, icon, title, effect]) => {
            const cost = upgradeCost(kind, level);
            return { id: kind as string, icon, title: `${title} · ${amount(level)} 阶`, effect,
                cost: cost as MaterialCost | null, reason: upgradeUnavailableReason(s, cost), verb: "升级",
                action: () => ctx.send({ type: "BUILD", kind: kind as "FARM" | "LOGGING" | "HOUSING" | "GATE" }) };
        });
        const houseCost = residentialCost(s.houses);
        entries.push(
            { id: "HOUSE", icon: "icon_build", title: `住宅扩建 · ${s.houses}/${RULE.houseMax} 级`, effect: `住房 ${capacity(s)} → ${Math.min(RULE.populationCap, capacity(s) + RESIDENTIAL.capacityPerLevel)} 人`, cost: s.houses >= RULE.houseMax ? null : houseCost,
                reason: s.houses >= RULE.houseMax ? `已达 ${RULE.houseMax} 级；修缮可继续扩仓储` : upgradeUnavailableReason(s, houseCost), verb: "增建", action: () => ctx.send({ type: "BUILD", kind: "HOUSE" }) },
            { id: "REPAIR", icon: "icon_shield", title: "修复城门", effect: `当前耐久 ${amount(s.gate)}/${amount(gateCapacity(s))}`, cost: s.gate >= gateCapacity(s) ? null : { wood: repairCost(s) },
                reason: !day ? "请在白天修门" : s.gate >= gateCapacity(s) ? "城门完好，无需修复" : s.wood < repairCost(s) ? "材料不足" : null, verb: "修复", action: () => ctx.send({ type: "REPAIR" }) }
        );
        const step = UI.buildRowHeight + UI.buildRowGap;
        const rows = new ScrollList(UI.contentWidth, patrolOpen ? 548 : 620, entries.length * step - UI.buildRowGap, p.scroll, offset => p.scroll = offset);
        rows.pos(34, patrolOpen ? 271 : 199); box.addChild(rows);
        orderPanelRows(p, entries, row => row.id, row => row.reason === null).forEach((row, i) =>
            ctx.ui.buildRow(rows.content, i * step, row.icon, row.title, row.effect, s, row.cost, row.reason, row.action, row.verb));
        return;
    }
    if (p.type === "tower") {
        const i = p.index!, t = ctx.game.battle?.base.towers[i] || s.towers[i];
        const help = "箭楼单体快攻，石塔范围破甲，寒塔减速控场。转型保留等级。建塔后自动补上可用成年人，选择其他塔的驻守者会直接对调。";
        const box = ctx.modal(`第 ${i + 1} 塔位${t.kind ? " · " + TOWERS[t.kind].name : " · 空地"}`, t.kind ? `${amount(t.level)} 阶 · 驻守 ${t.operator ? coloredName(person(s, t.operator)) : "成年村民不足"}` : "选择要建造的防塔", true,
            { width: UI.panelWidth, height: t.kind ? day ? 635 : 707 : 324 }, help);
        (Object.keys(TOWERS) as TowerKind[]).forEach((k, j) => {
            const cost = t.kind ? RULE.towerConvert : TOWERS[k].cost;
            const button = ctx.ui.button(box, `${t.kind && t.kind !== k ? "转为" : ""}${TOWERS[k].name}`, 34 + j * 204, 174, 192, () => ctx.send({ type: "TOWER", index: i, kind: k }), C.muted, 108, day && t.kind !== k && s.wood >= cost);
            const face = button.getChildByName("buttonFace") as Laya.Sprite, text = face.getChildByName("buttonText") as Laya.Text;
            text.y = 9; text.height = 43;
            if (t.kind === k || !day) ctx.ui.label(face, t.kind === k ? "已建成" : "白天可建", 10, 55, 172, 25, C.muted, false, 40).align = "center";
            else ctx.ui.iconValue(face, "icon_wood", s.wood >= cost ? String(cost) : `${amount(s.wood, true)}/${cost}`, 10, 55, 172, 40, s.wood >= cost ? C.timber : C.red, 26);
        });
        if (t.kind) {
            const cost = upgradeCost("TOWER", t.level), rowParent = new Laya.Sprite();
            rowParent.pos(34, 305);
            box.addChild(rowParent);
            ctx.ui.buildRow(rowParent, 0, t.kind === "ARROW" ? "icon_arrow" : t.kind === "STONE" ? "icon_stone" : "icon_slow", `升级至 ${amount(t.level + 1)} 阶`, `基础伤害 ${growthPreview(Math.floor(TOWERS[t.kind].damage * levelPower(t.level)), Math.floor(TOWERS[t.kind].damage * levelPower(t.level + 1)))}`, s, cost, upgradeUnavailableReason(s, cost), () => ctx.send({ type: "UPGRADE", index: i }));
        }
        if (t.kind) ctx.ui.button(box, t.operator ? "更换驻守村民" : "暂无可驻塔的成年人", 34, 526, 600, () => ctx.open({ type: "operators", index: i }), C.green, 78, s.people.some(q => isWorkingAdult(q) && q.id !== s.patrol?.captain));
        if (!day && t.kind)
            ctx.ui.label(box, ctx.game.pauses.has("USER") ? "已手动暂停。关闭后点“继续守夜”。" : "调任期间暂停，关闭后自动继续。", 34, 626, 600, 28, C.muted, false, 52).align = "center";
        return;
    }
}
