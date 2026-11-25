import { STARTER_AMMO, TOWER_AMMO } from "../../config/DefenseConfig";
import { featureUnlocked, FEATURE_WINS } from "../../config/DailyTaskConfig";
import { SHOP_PRODUCTS } from "../../config/ShopConfig";
import { ownsTowerAmmo } from "../../game/GameState";
import { towerStats } from "../../game/TowerStats";
import { patrolUpgradeReason, patrolCaptain, patrolCost } from "../../game/PatrolRules";
import { PATROL } from "../../config/PatrolConfig";
import { capacity, person } from "../../game/VillageRules";
import { GameState, isWorkingAdult } from "../../game/GameState";
import { RULE, TOWERS, TowerKind } from "../../game/GameConfig";
import { gateCapacity, gateRepairQuote, laborSlots, laborYield, levelPower, repairCost, residentialCost, residentialUpgradeReason, storageCapacity, UpgradeKind, upgradeCost, upgradeUnavailableReason } from "../../game/Growth";
import { C, UI } from "../UiTheme";
import { PATROL_BOOTH_FRAME } from "../BuildingLayout";
import { ScrollList } from "../ScrollList";
import { Panel, PanelContext } from "./PanelContext";
import { amount, coloredName, growthPreview } from "../ViewText";
import { orderPanelRows } from "./PanelListOrder";
import type { MaterialCost } from "../UiWidgets";
export function drawBuildingPanel(ctx: PanelContext, s: GameState, p: Panel, availableHeight: number) {
    const day = s.phase === "DAY";
    if (p.type === "towerConfirm") {
        const index = p.index!, change = p.towerChange!, tower = s.towers[index];
        const { from, level, to } = change;
        const verb = to ? "建造" : "升级";
        const kind = to ?? from!;
        const cost = to ? { wood: TOWERS[STARTER_AMMO[0]].cost, food: 0 } : upgradeCost("TOWER", level);
        const reason = !tower || tower.kind !== from || tower.level !== level ? "塔位状态已变化，请返回重选"
            : upgradeUnavailableReason(s, cost);
        const footer = 300;
        const box = ctx.modal(`确认${verb}`, "", false, { width: 586, height: footer + UI.action.pairHeight + UI.action.bottom });
        const description = `第 ${index + 1} 塔位 · 石炮塔 · ${TOWER_AMMO[kind].name}\n${to ? "建成后为 1 阶" : `升至 ${amount(level + 1)} 阶`}`;
        ctx.ui.image(box, "cannon_portrait", 61, 110, 104);
        const details = ctx.ui.label(box, description, 175, 111, 355, 30, C.cream, true, 92);
        details.align = "center";
        if (cost.wood || cost.food) ctx.ui.materialCosts(box, s, cost, 101, 214, 384, 50);
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
            "上方是现有库存／仓储。卡片上显示本次费用，红字为现有／所需。扩建民居可增加住房和仓储。上下滑动查看更多。");
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
            ["FARM", s.farm, "motion_farm_body", "农田", `人均产出 ${growthPreview(laborYield("FARM", s.farm), laborYield("FARM", s.farm + 1))} · ${laborSlots("FARM", s.farm + 1)} 岗`],
            ["LOGGING", s.logging, "motion_logging_body", "伐木场", `人均产出 ${growthPreview(laborYield("LOGGING", s.logging), laborYield("LOGGING", s.logging + 1))} · ${laborSlots("LOGGING", s.logging + 1)} 岗`],
            ["GATE", s.gateLevel, "motion_gate_body", "城门加固", `耐久上限 ${growthPreview(gateCapacity(s), gateCapacity({ ...s, gateLevel: s.gateLevel + 1 }))}`]
        ];
        const entries = definitions.map(([kind, level, icon, title, effect]) => {
            const cost = upgradeCost(kind, level);
            return { id: kind as string, icon, title: `${title} · ${amount(level)} 阶`, effect,
                cost: cost as MaterialCost | null, reason: upgradeUnavailableReason(s, cost), verb: "升级",
                action: () => ctx.send({ type: "BUILD", kind: kind as "FARM" | "LOGGING" | "GATE" }) };
        });
        const level = s.patrol.level, captain = patrolCaptain(s);
        entries.unshift({
            id: "PATROL", icon: PATROL_BOOTH_FRAME,
            title: `${PATROL.building} · ${amount(level)} 级`,
            effect: captain ? `队长 · ${coloredName(captain)}` : `${PATROL.role}待任命`,
            cost: patrolCost(s), reason: null, verb: "去查看", action: () => ctx.open({ type: "patrol", back: p })
        });
        const houseCost = residentialCost(s.houses), repair = gateRepairQuote(s);
        entries.push(
            { id: "HOUSE", icon: "motion_house_body", title: `民居扩建 · ${amount(s.houses)} 级`,
                effect: `${capacity(s) < RULE.populationCap ? "住房 +1 · " : ""}仓储 +${amount(storageCapacity({ houses: s.houses + 1 }) - storageCapacity(s))}`, cost: houseCost,
                reason: residentialUpgradeReason(s), verb: "增建", action: () => ctx.send({ type: "BUILD", kind: "HOUSE" }) },
            { id: "REPAIR", icon: "motion_gate_body", title: "修复城门", effect: `当前耐久 ${amount(s.gate)}/${amount(gateCapacity(s))}`, cost: s.gate >= gateCapacity(s) ? null : { wood: repairCost(s) },
                reason: !day ? "请在白天修门" : s.gate >= gateCapacity(s) ? "城门完好，无需修复" : s.wood < repairCost(s) ? "材料不足" : null, verb: "修复", action: () => ctx.send({ type: "REPAIR" }) }
        );
        const step = UI.buildRowHeight + UI.buildRowGap;
        const top = 199;
        const rows = new ScrollList(UI.contentWidth, UI.panelHeight - top - 41, entries.length * step - UI.buildRowGap, p.scroll, offset => p.scroll = offset);
        rows.pos(UI.inset, top); box.addChild(rows);
        orderPanelRows(p, entries, row => row.id, row => row.reason === null).forEach((row, i) => {
            const fullRepair = row.id === "REPAIR" && repair.count > 1 ? {
                wood: repair.fullCost, enabled: day && s.wood >= repair.fullCost,
                action: () => ctx.send({ type: "REPAIR", full: true })
            } : undefined;
            const button = ctx.ui.buildRow(rows.content, i * step, row.icon, row.title, row.effect, s, row.cost, row.reason, row.action, row.verb, fullRepair);
            if (row.id === "PATROL") {
                button.name = "PatrolConstructionCard";
                if (day && patrolUpgradeReason(s) === null) {
                    const badge = ctx.ui.actionBadge(button, "PatrolActionDot");
                    badge.pos(button.width - badge.width - 8, 8);
                }
            }
        });
        return;
    }
    const index = p.index!, state = ctx.game.battle?.base ?? s, tower = state.towers[index];
    const equipped = tower.kind, operator = tower.operator ? person(state, tower.operator) : undefined;
    const card = (box: Laya.Sprite, y: number, height: number) => {
        const node = new Laya.Sprite(); node.pos(UI.inset, y);
        ctx.art.panel(node, "panel_card", UI.contentWidth, height); box.addChild(node);
        return node;
    };
    if (p.type === "tower") {
        const box = ctx.modal(equipped ? "石炮塔" : "空塔位", "", true,
            { width: UI.panelWidth, height: equipped ? 691 + UI.buildRowHeight + UI.action.bottom : 480 }, "建成后自动补上可用成年人。白天可换装已拥有的弹药。升级塔身只强化本塔，同种弹药的等级全村共享。每秒攻击按战斗时间计算。");
        const profile = card(box, 117, 248);
        ctx.ui.image(profile, "cannon_portrait", 15, 12, 222);
        ctx.ui.label(profile, `第 ${index + 1} 塔位`, 258, 17, 310, 24, C.muted, false, 39);
        ctx.ui.label(profile, equipped ? `石炮塔 · ${amount(tower.level)} 级` : "建造石炮塔", 258, 62, 318, 34, C.ink, true, 48);
        if (!equipped) {
            ctx.ui.label(profile, "初始装配弓箭", 258, 132, 310, 26, C.ink, false, 55);
            ctx.ui.iconValue(profile, "icon_wood", s.wood < TOWERS.ARROW.cost ? `${s.wood}/${TOWERS.ARROW.cost}` : String(TOWERS.ARROW.cost), 257, 185, 200, 48, C.timber);
            ctx.ui.centerButton(box, "建造石炮塔", 383, () => ctx.open({ type: "towerConfirm", index, back: p,
                towerChange: { from: null, level: tower.level, to: STARTER_AMMO[0] } }), C.gold, day && s.wood >= TOWERS.ARROW.cost);
            return;
        }
        const ammo = TOWER_AMMO[equipped];
        ctx.ui.image(profile, ammo.icon, 253, 117, 48);
        ctx.ui.label(profile, `${ammo.name} · ${s.ammoLevels[equipped]} 级`, 313, 117, 240, 29, C.ink, true, 49);
        ctx.ui.button(profile, day ? "更换弹药" : "查看弹药", 256, 177, 260,
            () => ctx.open({ type: "towerAmmo", index, id: equipped, back: p }), C.gold, 57);
        const garrison = card(box, 380, 122);
        if (operator) ctx.ui.image(garrison, ctx.art.portraitId(operator), 15, 10, 96);
        ctx.ui.label(garrison, "驻塔村民", 122, 12, 237, 23, C.muted, false, 42);
        ctx.ui.label(garrison, operator ? coloredName(operator) : "待驻守", 122, 53, 260, 30, C.ink, true, 54);
        ctx.ui.button(garrison, "换人", 420, 33, 147, () => ctx.open({ type: "operators", index }), C.green, 58,
            s.people.some(q => isWorkingAdult(q) && q.id !== s.patrol.captain));
        const stats = towerStats(state, equipped, tower.level, operator), combat = card(box, 517, 161);
        ctx.ui.label(combat, "最终战力", 22, 9, 150, 29, C.ink, true, 42);
        if (operator && stats.speed !== 1) {
            const bonus = Math.round((stats.speed - 1) * 100);
            ctx.ui.label(combat, `攻速 ${bonus > 0 ? "+" : ""}${bonus}%`, 176, 12, 170, 23, C.green, true, 38);
        }
        ctx.ui.label(combat, operator ? "常态战力" : "无人驻守时停火", 310, 11, 266, 23, C.muted, false, 40).align = "right";
        const entries = [["单发伤害", Math.floor(stats.damage)], ["每秒攻击", (operator ? stats.speed / stats.interval : 0).toFixed(2)], ["射程", Math.round(stats.range)]];
        entries.forEach(([name, value], i) => {
            ctx.ui.label(combat, String(name), i * 194 + 9, 58, 190, 25, C.muted, false, 40).align = "center";
            ctx.ui.label(combat, String(value), i * 194 + 9, 99, 190, 33, C.green, true, 48).align = "center";
        });
        const cost = upgradeCost("TOWER", tower.level);
        ctx.ui.buildRow(box.addChild(new Laya.Sprite()).pos(UI.inset, 691) as Laya.Sprite, 0, "cannon_portrait",
            "升级塔身", `基础伤害 ${growthPreview(Math.floor(TOWERS[equipped].damage * levelPower(tower.level)), Math.floor(TOWERS[equipped].damage * levelPower(tower.level + 1)))}`,
            s, cost, upgradeUnavailableReason(s, cost), () => ctx.open({ type: "towerConfirm", index, back: p, towerChange: { from: equipped, level: tower.level } }));
        return;
    }
    const selected = p.id as TowerKind, ammo = TOWER_AMMO[selected], level = state.ammoLevels[selected];
    const cost = upgradeCost("TOWER", level), owned = ownsTowerAmmo(state, selected);
    if (p.type === "ammoUpgrade") {
        const box = ctx.modal("升级弹药", "", false, { width: UI.panelWidth, height: 425 });
        ctx.ui.image(box, ammo.icon, 63, 123, 92);
        ctx.ui.label(box, `${ammo.name}  ${level} → ${level + 1} 级`, 184, 119, 435, 32, C.ink, true, 52);
        ctx.ui.label(box, "全村使用此弹药的塔同步提升", 184, 173, 435, 25, C.muted, false, 50);
        ctx.ui.materialCosts(box, s, cost, 120, 235, 420, 50);
        const reason = upgradeUnavailableReason(s, cost);
        if (reason) ctx.ui.label(box, reason, UI.inset, 282, UI.contentWidth, 23, C.red, false, 36).align = "center";
        ctx.ui.button(box, "取消", 91, 326, 191, () => ctx.open(p.back!, true), C.muted, 60);
        ctx.ui.button(box, "确认升级", 328, 326, 242, () => {
            if (ctx.current !== p || ctx.game.saves.pending) return;
            ctx.open(p.back!, true);
            ctx.send({ type: "UPGRADE_AMMO", kind: selected, level });
        }, C.gold, 60, owned && !reason);
        return;
    }
    const kinds = Object.keys(TOWER_AMMO) as TowerKind[];
    const columns = 3, rowStep = 140;
    const rows = Math.ceil(kinds.length / columns);
    const showSlow = selected === "SLOW" || equipped === "SLOW";
    const compareHeight = 228;
    const fixedHeight = 116 + 14 + 118 + 14 + compareHeight + 20 + 68 + UI.action.bottom;
    const gridHeight = Math.min(rows * rowStep, 346, Math.max(90, availableHeight - fixedHeight - 32));
    const box = ctx.modal("选择弹药", "", true, { width: UI.panelWidth, height: gridHeight + fixedHeight });
    const back = ctx.ui.button(box, "", 30, 32, 54, () => ctx.open(p.back!, true), C.muted, 54);
    ctx.ui.image(back.getChildByName("buttonFace") as Laya.Sprite, "icon_back", 10, 10, 34);
    const inventory = new ScrollList(UI.contentWidth, gridHeight, rows * rowStep, p.scroll, offset => p.scroll = offset);
    inventory.pos(UI.inset, 116); box.addChild(inventory);
    inventory.setVirtualRows(rows, rowStep, (rowIndex, row) => {
        kinds.slice(rowIndex * columns, (rowIndex + 1) * columns).forEach((kind, col) => {
            const active = selected === kind;
            const tile = ctx.ui.button(row, "", 3 + col * 194, 2, 184, () => {
                if (p.towerChange?.submitted || p.id === kind) return;
                p.id = kind; ctx.refresh();
            }, active ? C.gold : C.muted, 132, true, !active);
            tile.name = "ammo:" + kind;
            const face = tile.getChildByName("buttonFace") as Laya.Sprite;
            ctx.ui.image(face, TOWER_AMMO[kind].icon, 63, 7, 58);
            ctx.ui.label(face, TOWER_AMMO[kind].name, 7, 65, 170, 26, C.ink, true, 32).align = "center";
            const status = equipped === kind ? "已装备" : !ownsTowerAmmo(state, kind) ? "商城获取" : active ? "已选中" : "已拥有";
            ctx.ui.label(face, status, 7, 96, 170, 21, C.muted, false, 29).align = "center";
        });
    });
    const detailY = 116 + gridHeight + 14;
    const detail = card(box, detailY, 118);
    ctx.ui.image(detail, ammo.icon, 23, 13, 88);
    ctx.ui.label(detail, owned ? `${ammo.name} · ${level} 级` : ammo.name, 135, 14, 435, 31, C.ink, true, 44);
    ctx.ui.label(detail, ammo.effect, 135, 61, 435, 25, C.muted, false, 42);
    const comparisonY = detailY + 132;
    const comparison = card(box, comparisonY, compareHeight);
    ctx.ui.label(comparison, "战力对比", 24, 12, 182, 28, C.ink, true, 40);
    ctx.ui.label(comparison, TOWER_AMMO[equipped!].name, 239, 12, 128, 25, C.muted, true, 40).align = "right";
    ctx.ui.label(comparison, "→", 378, 12, 48, 25, C.muted, false, 40).align = "center";
    ctx.ui.label(comparison, ammo.name, 443, 12, 121, 25, C.ink, true, 40).align = "right";
    const current = towerStats(state, equipped!, tower.level, operator), next = towerStats(state, selected, tower.level, operator);
    const entries: [string, string, string][] = [
        ["单发伤害", String(Math.floor(current.damage)), String(Math.floor(next.damage))],
        ["每秒攻击", (operator ? current.speed / current.interval : 0).toFixed(2), (operator ? next.speed / next.interval : 0).toFixed(2)],
        ["射程", String(Math.round(current.range)), String(Math.round(next.range))]
    ];
    if (showSlow) entries.push(["命中减速", Math.round(current.slow * 100) + "%", Math.round(next.slow * 100) + "%"]);
    else entries.push(["溅射半径", String(TOWERS[equipped!].splash), String(TOWERS[selected].splash)]);
    entries.forEach(([label, before, after], i) => {
        const y = 55 + i * 40, delta = parseFloat(after) - parseFloat(before);
        ctx.ui.label(comparison, label, 25, y, 207, 25, C.ink, false, 37);
        ctx.ui.label(comparison, before, 239, y, 128, 26, C.muted, false, 37).align = "right";
        ctx.ui.label(comparison, after, 434, y, 130, 26, delta > 0 ? C.green : delta < 0 ? C.red : C.ink, true, 37).align = "right";
    });
    const footer = comparisonY + compareHeight + 20;
    ctx.ui.button(box, "升级" + ammo.name, 46, footer, 244, () => ctx.open({ type: "ammoUpgrade", index, id: selected, back: p }), C.muted, 68, day && owned);
    const offer = SHOP_PRODUCTS.find(product => product.ammo === selected);
    const market = featureUnlocked(s.legacy.bestNight, "shop");
    const action = owned ? equipped === selected ? "已装备" : "装备" + ammo.name
        : !offer ? "未上架" : market ? "前往商城" : `守住 ${FEATURE_WINS.shop} 波开放`;
    ctx.ui.button(box, action, 313, footer, 304, () => {
        if (ctx.current !== p || ctx.game.saves.pending || p.towerChange?.submitted) return;
        if (!owned && offer) ctx.open({ type: "itemOffer", id: offer.id, back: p });
        else if (owned && equipped !== selected) {
            p.towerChange = { from: equipped, to: selected, level: tower.level, submitted: true };
            ctx.send({ type: "TOWER", index, kind: selected });
        }
    }, C.gold, 68, day && (owned ? equipped !== selected : market && !!offer));
}
