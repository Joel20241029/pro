import { patrolUpgradeReason, patrolCaptain, patrolCost } from "../../game/PatrolRules";
import { PATROL } from "../../config/PatrolConfig";
import { capacity, person } from "../../game/VillageRules";
import { GameState, isWorkingAdult } from "../../game/GameState";
import { RESIDENTIAL, RULE, TOWERS, TowerKind } from "../../game/GameConfig";
import { gateCapacity, laborSlots, laborYield, levelPower, repairCost, residentialCost, storageCapacity, UpgradeKind, upgradeCost, upgradeUnavailableReason } from "../../game/Growth";
import { C, UI } from "../UiTheme";
import { PATROL_BOOTH_FRAME } from "../BuildingLayout";
import { ScrollList } from "../ScrollList";
import { Panel, PanelContext } from "./PanelContext";
import { amount, coloredName, growthPreview } from "../ViewText";
import { orderPanelRows } from "./PanelListOrder";
import type { MaterialCost } from "../UiWidgets";
export function drawBuildingPanel(ctx: PanelContext, s: GameState, p: Panel) {
    const day = s.phase === "DAY";
    if (p.type === "towerConfirm") {
        const index = p.index!, change = p.towerChange!, tower = s.towers[index];
        const { from, level, to } = change;
        const verb = to ? from ? "转型" : "建造" : "升级";
        const kind = to ?? from!;
        const cost = to ? { wood: from ? RULE.towerConvert : TOWERS[to].cost, food: 0 } : upgradeCost("TOWER", level);
        const reason = !tower || tower.kind !== from || tower.level !== level ? "塔位状态已变化，请返回重选"
            : upgradeUnavailableReason(s, cost);
        const footer = 300;
        const box = ctx.modal(`确认${verb}`, "", false, { width: 586, height: footer + UI.action.pairHeight + UI.action.bottom });
        const description = `第 ${index + 1} 塔位 · ${TOWERS[kind].name}\n${to ? from ? `保留 ${amount(level)} 阶` : "建成后为 1 阶" : `升至 ${amount(level + 1)} 阶`}`;
        const details = ctx.ui.label(box, description, 34, 111, 518, 30, C.cream, true, 92);
        details.align = "center";
        ctx.ui.materialCosts(box, s, cost, 101, 214, 384, 50);
        if (reason) ctx.ui.label(box, reason, 34, 264, 518, 23, C.red, false, 29).align = "center";
        ctx.ui.button(box, "取消", 69, footer, 170, () => ctx.open(p.back!, true), C.muted, UI.action.pairHeight);
        ctx.ui.button(box, `确认${verb}`, 263, footer, 254, () => {
            if (change.submitted || ctx.game.saves.pending || reason) return;
            change.submitted = true;
            ctx.send(to ? { type: "TOWER", index, kind: to } : { type: "UPGRADE", index });
        }, C.gold, UI.action.pairHeight, day && !reason && !change.submitted);
        return;
    }
    if (p.type === "build") {
        const box = ctx.modal("建设村落", "", true, undefined,
            "上方是现有库存／仓储。卡片上显示本次费用，红字为现有／所需。修缮增加仓储，扩建增加住房。上下滑动查看更多。");
        const stock = new Laya.Sprite(); stock.pos(34, 115); ctx.art.panel(stock, "panel_card", 600, 62); box.addChild(stock);
        ctx.ui.label(stock, "库存", 22, 8, 102, 27, C.ink, true, 46);
        const cap = amount(storageCapacity(s), true);
        ctx.ui.iconValue(stock, "icon_food", `${amount(s.food, true)}/${cap}`, 134, 6, 214, 50, C.green);
        ctx.ui.iconValue(stock, "icon_wood", `${amount(s.wood, true)}/${cap}`, 362, 6, 216, 50, C.timber);
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
        const level = s.patrol.level, captain = patrolCaptain(s);
        entries.unshift({
            id: "PATROL", icon: PATROL_BOOTH_FRAME,
            title: `${PATROL.building} · ${amount(level)} 级`,
            effect: captain ? `队长 · ${coloredName(captain)}` : `${PATROL.role}待任命`,
            cost: patrolCost(s), reason: null, verb: "去查看", action: () => ctx.open({ type: "patrol", back: p })
        });
        const houseCost = residentialCost(s.houses);
        entries.push(
            { id: "HOUSE", icon: "icon_build", title: `住宅扩建 · ${s.houses}/${RULE.houseMax} 级`, effect: `住房 ${capacity(s)} → ${Math.min(RULE.populationCap, capacity(s) + RESIDENTIAL.capacityPerLevel)} 人`, cost: s.houses >= RULE.houseMax ? null : houseCost,
                reason: s.houses >= RULE.houseMax ? `已达 ${RULE.houseMax} 级；修缮可继续扩仓储` : upgradeUnavailableReason(s, houseCost), verb: "增建", action: () => ctx.send({ type: "BUILD", kind: "HOUSE" }) },
            { id: "REPAIR", icon: "icon_shield", title: "修复城门", effect: `当前耐久 ${amount(s.gate)}/${amount(gateCapacity(s))}`, cost: s.gate >= gateCapacity(s) ? null : { wood: repairCost(s) },
                reason: !day ? "请在白天修门" : s.gate >= gateCapacity(s) ? "城门完好，无需修复" : s.wood < repairCost(s) ? "材料不足" : null, verb: "修复", action: () => ctx.send({ type: "REPAIR" }) }
        );
        const step = UI.buildRowHeight + UI.buildRowGap;
        const top = 199;
        const rows = new ScrollList(UI.contentWidth, UI.panelHeight - top - 41, entries.length * step - UI.buildRowGap, p.scroll, offset => p.scroll = offset);
        rows.pos(UI.inset, top); box.addChild(rows);
        orderPanelRows(p, entries, row => row.id, row => row.reason === null).forEach((row, i) => {
            const button = ctx.ui.buildRow(rows.content, i * step, row.icon, row.title, row.effect, s, row.cost, row.reason, row.action, row.verb);
            if (row.id === "PATROL") {
                button.name = "PatrolConstructionCard";
                const canAppoint = !s.patrol.captain && s.people.some(isWorkingAdult);
                if (day && (canAppoint || patrolUpgradeReason(s) === null)) {
                    const badge = ctx.ui.actionBadge(button, "PatrolActionDot");
                    badge.pos(button.width - badge.width - 8, 8);
                }
            }
        });
        return;
    }
    if (p.type === "tower") {
        const i = p.index!, t = ctx.game.battle?.base.towers[i] || s.towers[i];
        const help = "箭楼单体快攻，石塔范围破甲，寒塔减速控场。转型保留等级。建塔后自动补上可用成年人，选择其他塔的驻守者会直接对调。";
        const towerOptionsY = 174, towerOptionHeight = 108, dutyY = 526;
        const towerHeight = t.kind ? day ? dutyY + UI.action.height + UI.action.bottom : 716 : towerOptionsY + towerOptionHeight + UI.action.bottom;
        const box = ctx.modal(`第 ${i + 1} 塔位${t.kind ? " · " + TOWERS[t.kind].name : " · 空地"}`, t.kind ? `${amount(t.level)} 阶 · 驻守 ${t.operator ? coloredName(person(s, t.operator)) : "成年村民不足"}` : "选择要建造的防塔", true,
            { width: UI.panelWidth, height: towerHeight }, help);
        (Object.keys(TOWERS) as TowerKind[]).forEach((k, j) => {
            const cost = t.kind ? RULE.towerConvert : TOWERS[k].cost;
            const button = ctx.ui.button(box, `${t.kind && t.kind !== k ? "转为" : ""}${TOWERS[k].name}`, 34 + j * 204, towerOptionsY, 192,
                () => ctx.open({ type: "towerConfirm", index: i, towerChange: { from: t.kind, level: t.level, to: k }, back: p }),
                C.muted, towerOptionHeight, day && t.kind !== k && s.wood >= cost);
            const face = button.getChildByName("buttonFace") as Laya.Sprite, text = face.getChildByName("buttonText") as Laya.Text;
            text.y = 9; text.height = 43;
            if (t.kind === k || !day) ctx.ui.label(face, t.kind === k ? "已建成" : "白天可建", 10, 55, 172, 25, C.muted, false, 40).align = "center";
            else ctx.ui.iconValue(face, "icon_wood", s.wood >= cost ? String(cost) : `${amount(s.wood, true)}/${cost}`, 10, 55, 172, 40, s.wood >= cost ? C.timber : C.red, 26);
        });
        if (t.kind) {
            const cost = upgradeCost("TOWER", t.level), rowParent = new Laya.Sprite();
            rowParent.pos(34, 305);
            box.addChild(rowParent);
            ctx.ui.buildRow(rowParent, 0, t.kind === "ARROW" ? "icon_arrow" : t.kind === "STONE" ? "icon_stone" : "icon_slow", `升级至 ${amount(t.level + 1)} 阶`, `基础伤害 ${growthPreview(Math.floor(TOWERS[t.kind].damage * levelPower(t.level)), Math.floor(TOWERS[t.kind].damage * levelPower(t.level + 1)))}`, s, cost, upgradeUnavailableReason(s, cost),
                () => ctx.open({ type: "towerConfirm", index: i, towerChange: { from: t.kind, level: t.level }, back: p }));
        }
        if (t.kind) {
            const canAssign = s.people.some(q => isWorkingAdult(q) && q.id !== s.patrol.captain);
            if (!canAssign) ctx.ui.label(box, "暂无可驻塔的成年人", UI.inset, 492, UI.contentWidth, 26, C.muted, false, 30).align = "center";
            ctx.ui.centerButton(box, t.operator ? "更换驻守村民" : "安排驻守村民", dutyY, () => ctx.open({ type: "operators", index: i }), C.green, canAssign);
        }
        if (!day && t.kind)
            ctx.ui.label(box, ctx.game.pauses.has("USER") ? "已手动暂停。关闭后点“继续守夜”。" : "调任期间暂停，关闭后自动继续。", 34, 636, 600, 28, C.muted, false, 52).align = "center";
        return;
    }
}
