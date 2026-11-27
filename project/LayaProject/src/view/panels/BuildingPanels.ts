import { STARTER_AMMO, TOWER_AMMO, TOWER_BUILD_WOOD } from "../../config/DefenseConfig";
import { towerStats } from "../../game/TowerStats";
import { patrolCaptain, patrolCost } from "../../game/PatrolRules";
import { PATROL } from "../../config/PatrolConfig";
import { HERO } from "../../config/HeroConfig";
import { capacity, person } from "../../game/VillageRules";
import { replacementOperators } from "../../game/VillageJobs";
import { GameState, ownsTowerAmmo } from "../../game/GameState";
import { RULE, TOWERS, TowerKind } from "../../game/GameConfig";
import { gateCapacity, gateRepairQuote, laborSlots, laborYield, levelPower, repairCost, residentialCost, residentialUpgradeReason, storageCapacity, UpgradeKind, upgradeCost, upgradeUnavailableReason } from "../../game/Growth";
import { C, UI } from "../UiTheme";
import { PATROL_BOOTH_FRAME } from "../BuildingLayout";
import { HERO_COMMITTEE_FRAME } from "../config/VillageSceneConfig";
import { HUD } from "../config/HudConfig";
import { ScrollList } from "../ScrollList";
import { Panel, PanelContext } from "./PanelContext";
import { amount, coloredName, growthPreview } from "../ViewText";
import { actionHintsBlocked, constructionHints, towerActionHints, towerAmmoActionHints } from "../ActionHints";
import { orderPanelRows } from "./PanelListOrder";
import type { MaterialCost } from "../UiWidgets";

/** 弹药单列卡片承载大图和操作，比较区独立于列表滚动。单位为逻辑像素。 */
const AMMO_LAYOUT = { top: 116, row: 140, step: 152, listMax: 368, gap: 14, compare: 190, safeMargin: 32 } as const;

export function drawBuildingPanel(ctx: PanelContext, s: GameState, p: Panel, availableHeight: number) {
    const day = s.phase === "DAY";
    const blocked = actionHintsBlocked(ctx.game);
    if (p.type === "towerConfirm") {
        const index = p.index!, change = p.towerChange!, tower = s.towers[index];
        const { from, level, to } = change;
        const verb = to ? "建造" : "升级";
        const kind = to ?? from!;
        const cost = to ? { wood: TOWER_BUILD_WOOD, food: 0 } : upgradeCost("TOWER", level);
        const reason = !tower || tower.kind !== from || tower.level !== level ? "塔位状态已变化，请返回重选"
            : upgradeUnavailableReason(s, cost);
        const footer = to ? 300 : 352;
        const box = ctx.modal(to ? "建造石炮塔" : "升级塔身", "", false, { width: 586, height: footer + UI.action.pairHeight + UI.action.bottom });
        const description = `第 ${index + 1} 塔位\n${to ? `初始弹药 · ${TOWER_AMMO[kind].name}` : `${amount(level)} → ${amount(level + 1)} 级`}`;
        ctx.ui.image(box, "cannon_portrait", 61, 110, 104);
        const details = ctx.ui.label(box, description, 175, 111, 355, 30, C.cream, true, 92);
        details.align = "center";
        if (!to) {
            const damage = TOWERS[kind].damage;
            ctx.ui.label(box, `基础伤害 ${growthPreview(Math.floor(damage * levelPower(level)), Math.floor(damage * levelPower(level + 1)))}`,
                34, 213, 518, 26, C.green, true, 40).align = "center";
        }
        if (cost.wood || cost.food) ctx.ui.materialCosts(box, s, cost, 101, footer - 86, 384, 50);
        if (reason) ctx.ui.label(box, reason, 34, footer - 36, 518, 23, C.red, false, 29).align = "center";
        ctx.ui.button(box, "取消", 69, footer, 170, () => ctx.open(p.back!, true), C.muted, UI.action.pairHeight);
        const canConfirm = day && !blocked && !reason && !change.submitted;
        const confirm = ctx.ui.button(box, `确认${verb}`, 263, footer, 254, () => {
            if (change.submitted || ctx.game.saves.pending || reason) return;
            change.submitted = true;
            ctx.send(to ? { type: "TOWER", index, kind: to } : { type: "UPGRADE", index });
        }, C.gold, UI.action.pairHeight, canConfirm);
        if (canConfirm) ctx.ui.actionBadge(confirm, "TowerConfirmActionHint");
        return;
    }
    if (p.type === "build") {
        const height = Math.min(UI.panelHeight, availableHeight - 32);
        const box = ctx.modal("建设村落", "", true, { width: UI.panelWidth, height },
            "费用标红表示对应材料不足。扩建民居可增加住房和仓储。");
        const hints = constructionHints(s, blocked);
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
            return { id: kind as string, icon, title: `${title} · ${amount(level)} 级`, effect,
                cost: cost as MaterialCost | null, reason: upgradeUnavailableReason(s, cost), verb: "升级",
                action: () => ctx.confirmSpend({
                    title: `升级${title === "城门加固" ? "城门" : title}`, actionText: "确认升级", image: icon, detail: effect,
                    wood: cost.wood, food: cost.food, showBadge: true
                }, () => ctx.send({ type: "BUILD", kind: kind as "FARM" | "LOGGING" | "GATE" })) };
        });
        const level = s.patrol.level, captain = patrolCaptain(s);
        entries.unshift({
            id: "PATROL", icon: PATROL_BOOTH_FRAME,
            title: `${PATROL.building} · ${amount(level)} 级`,
            effect: captain ? `队长 · ${coloredName(captain)}` : `${PATROL.role}待任命`,
            cost: patrolCost(s), reason: null, verb: "去查看", action: () => ctx.open({ type: "patrol", back: p })
        });
        entries.unshift({ id: "HERO_COMMITTEE", icon: HERO_COMMITTEE_FRAME, title: HERO.committeeName,
            effect: HERO.name + " · 自动出战", cost: null, reason: null, verb: "去查看",
            action: () => ctx.open({ type: "heroCommittee", back: p }) });
        const houseCost = residentialCost(s.houses), repair = gateRepairQuote(s);
        const houseEffect = `${capacity(s) < RULE.populationCap ? "住房 +1 · " : ""}仓储 +${amount(storageCapacity({ houses: s.houses + 1 }) - storageCapacity(s))}`;
        const confirmRepair = (full: boolean) => {
            const restored = full ? repair.maximum : Math.min(repair.maximum, s.gate + repair.perRepair);
            ctx.confirmSpend({
                title: full ? "修满城门" : "修复城门", actionText: full ? "确认修满" : "确认修复",
                image: "motion_gate_body", detail: `耐久 ${growthPreview(s.gate, restored)}`,
                wood: full ? repair.fullCost : repairCost(s), showBadge: true
            }, () => ctx.send({ type: "REPAIR", full }));
        };
        entries.push(
            { id: "HOUSE", icon: "motion_house_body", title: `民居扩建 · ${amount(s.houses)} 级`,
                effect: houseEffect, cost: houseCost,
                reason: residentialUpgradeReason(s), verb: "增建", action: () => ctx.confirmSpend({
                    title: "增建民居", actionText: "确认增建", image: "motion_house_body", detail: houseEffect,
                    wood: houseCost.wood, food: houseCost.food, showBadge: true
                }, () => ctx.send({ type: "BUILD", kind: "HOUSE" })) },
            { id: "REPAIR", icon: "motion_gate_body", title: "修复城门", effect: `当前耐久 ${amount(s.gate)}/${amount(gateCapacity(s))}`, cost: s.gate >= gateCapacity(s) ? null : { wood: repairCost(s) },
                reason: !day ? "请在白天修门" : s.gate >= gateCapacity(s) ? "城门完好，无需修复" : s.wood < repairCost(s) ? "材料不足" : null, verb: "修复", action: () => confirmRepair(false) }
        );
        const priority = (id: string) => id === "REPAIR" && hints.REPAIR && s.gate / gateCapacity(s) < HUD.gate.dangerRatio ? 3
            : id === "HOUSE" && hints.HOUSE && s.people.length >= capacity(s) && capacity(s) < RULE.populationCap ? 2 : 0;
        entries.sort((a, b) => priority(b.id) - priority(a.id));
        const step = UI.buildRowHeight + UI.buildRowGap;
        const top = 119;
        const rows = new ScrollList(UI.contentWidth, height - top - 41, entries.length * step - UI.buildRowGap, p.scroll, offset => p.scroll = offset);
        rows.pos(UI.inset, top); box.addChild(rows);
        orderPanelRows(p, entries, row => row.id, row => row.reason === null).forEach((row, i) => {
            const fullRepair = row.id === "REPAIR" && repair.count > 1 ? {
                wood: repair.fullCost, enabled: day && s.wood >= repair.fullCost,
                action: () => confirmRepair(true)
            } : undefined;
            const button = ctx.ui.buildRow(rows.content, i * step, row.icon, row.title, row.effect, s, row.cost, row.reason, row.action, row.verb, fullRepair);
            if (row.id === "PATROL") button.name = "PatrolConstructionCard";
            if (hints[row.id as keyof typeof hints]) {
                if (fullRepair) {
                    const repairButton = button.getChildByName(fullRepair.enabled ? "RepairFull" : "button:修一次") as Laya.Sprite;
                    ctx.ui.actionBadge(repairButton, fullRepair.enabled ? "RepairFullActionHint" : "RepairActionHint");
                }
                else {
                    const action = button.getChildByName("buttonFace").getChildByName("BuildAction") as Laya.Sprite;
                    ctx.ui.actionBadge(action, row.id === "PATROL" ? "PatrolActionDot" : "BuildActionHint");
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
        const hints = towerActionHints(state, index, blocked);
        const box = ctx.modal(equipped ? "石炮塔" : "空塔位", "", true,
            { width: UI.panelWidth, height: equipped ? 720 : 480 }, "建成后自动补上可用成年人。白天可换装已拥有的弹药。升级塔身只强化本塔，同种弹药的等级全村共享。每秒攻击按战斗时间计算。");
        if (p.back) ctx.ui.backButton(box, () => ctx.open(p.back!, true));
        const profile = card(box, 115, equipped ? 157 : 250);
        ctx.ui.image(profile, "cannon_portrait", 18, 10, equipped ? 133 : 222);
        const profileTextX = equipped ? 178 : 258;
        ctx.ui.label(profile, `第 ${index + 1} 塔位`, profileTextX, 20, 310, 24, C.muted, false, 39);
        ctx.ui.label(profile, equipped ? `${amount(tower.level)} 级` : "建造石炮塔", profileTextX, 66, 318, 38, C.ink, true, 64);
        if (!equipped) {
            ctx.ui.label(profile, "初始弹药 · 弓箭", 258, 133, 310, 26, C.ink, false, 46);
            ctx.ui.iconValue(profile, "icon_wood", s.wood < TOWER_BUILD_WOOD ? `${s.wood}/${TOWER_BUILD_WOOD}` : String(TOWER_BUILD_WOOD), 257, 185, 200, 48, C.timber);
            const button = ctx.ui.centerButton(box, "建造石炮塔", 382, () => ctx.open({ type: "towerConfirm", index, back: p,
                towerChange: { from: null, level: tower.level, to: STARTER_AMMO[0] } }), C.gold, hints.build, UI.action.width, 68);
            if (hints.build) ctx.ui.actionBadge(button, "TowerBuildActionHint");
            return;
        }
        const ammo = TOWER_AMMO[equipped];
        const ammoRow = card(box, 283, 76);
        ctx.ui.image(ammoRow, ammo.icon, 17, 10, 56);
        ctx.ui.label(ammoRow, `${ammo.name} · ${state.ammoLevels[equipped]} 级`, 91, 10, 320, 29, C.ink, true, 56);
        const ammoButton = ctx.ui.button(ammoRow, day ? "换弹" : "查看弹药", 421, 12, 153,
            () => ctx.open({ type: "towerAmmo", index, id: equipped, back: p }), C.muted, 52);
        if (hints.ammo) ctx.ui.actionBadge(ammoButton, "TowerAmmoActionHint");
        const garrison = card(box, 370, 91);
        if (operator) ctx.ui.image(garrison, ctx.art.portraitId(operator), 16, 8, 74);
        ctx.ui.label(garrison, operator ? coloredName(operator) : "无人驻守", 104, 5, 300, 30, C.ink, true, 43);
        ctx.ui.label(garrison, operator ? "驻塔" : "停火", 104, 48, 300, 24, operator ? C.muted : C.red, false, 35);
        const garrisonButton = ctx.ui.button(garrison, "选村民", 421, 17, 153,
            () => ctx.open({ type: "operators", index, back: p }), C.muted, 56,
            !blocked && replacementOperators(state, index).length > 0);
        if (hints.staff) ctx.ui.actionBadge(garrisonButton, "TowerStaffActionHint");
        const stats = towerStats(state, equipped, tower.level, operator), combat = card(box, 472, 115);
        const entries = [["单发伤害", Math.floor(stats.damage)], ["每秒攻击", (operator ? stats.speed / stats.interval : 0).toFixed(2)], ["射程", Math.round(stats.range)]];
        entries.forEach(([name, value], i) => {
            ctx.ui.label(combat, String(name), i * 194 + 9, 10, 190, 25, C.muted, false, 40).align = "center";
            ctx.ui.label(combat, String(value), i * 194 + 9, 51, 190, 33, C.green, true, 48).align = "center";
        });
        if (operator && stats.speed !== 1) {
            const bonus = Math.round((stats.speed - 1) * 100);
            ctx.ui.label(box, `${coloredName(operator)} · 攻速 ${bonus > 0 ? "+" : ""}${bonus}%`, UI.inset, 594, UI.contentWidth, 24, C.green, true, 37).align = "center";
        }
        const upgrade = ctx.ui.centerButton(box, "升级塔身", 636, () => ctx.open({ type: "towerConfirm", index, back: p,
            towerChange: { from: equipped, level: tower.level } }), C.gold, day && !blocked, 258, 58);
        if (hints.upgrade) ctx.ui.actionBadge(upgrade, "TowerUpgradeActionHint");
        return;
    }
    const selected = p.id as TowerKind, ammo = TOWER_AMMO[selected], level = state.ammoLevels[selected];
    const selectedHints = towerAmmoActionHints(state, selected, blocked);
    if (p.type === "ammoUpgrade") {
        const cost = upgradeCost("TOWER", level);
        const box = ctx.modal("升级弹药", "", false, { width: UI.panelWidth, height: 425 });
        ctx.ui.image(box, ammo.icon, 63, 123, 92);
        ctx.ui.label(box, `${ammo.name}  ${level} → ${level + 1} 级`, 184, 119, 435, 32, C.ink, true, 52);
        ctx.ui.label(box, "全村使用此弹药的塔同步提升", 184, 173, 435, 25, C.muted, false, 50);
        ctx.ui.materialCosts(box, s, cost, 120, 235, 420, 50);
        const reason = upgradeUnavailableReason(s, cost);
        if (reason) ctx.ui.label(box, reason, UI.inset, 282, UI.contentWidth, 23, C.red, false, 36).align = "center";
        ctx.ui.button(box, "取消", 91, 326, 191, () => ctx.open(p.back!, true), C.muted, 60);
        const confirm = ctx.ui.button(box, "确认升级", 328, 326, 242, () => {
            if (ctx.current !== p || ctx.game.saves.pending) return;
            p.pendingChoice = { accepted: next => next.ammoLevels[selected] === level + 1, back: p.back! };
            ctx.send({ type: "UPGRADE_AMMO", kind: selected, level });
        }, C.gold, 60, selectedHints.upgrade);
        if (selectedHints.upgrade) ctx.ui.actionBadge(confirm, "AmmoConfirmActionHint");
        return;
    }
    const kinds = (Object.keys(TOWER_AMMO) as TowerKind[]).filter(kind => ownsTowerAmmo(state, kind));
    const layout = AMMO_LAYOUT;
    const rowWidth = UI.contentWidth - UI.scrollGutter;
    const showSlow = selected === "SLOW" || equipped === "SLOW";
    const comparing = selected !== equipped;
    const fullListHeight = kinds.length * layout.step - (layout.step - layout.row);
    const fixedHeight = layout.top + UI.action.bottom;
    const previewHeight = layout.compare + layout.gap;
    // 为最长的换装预览预留相同视口，选中另一弹种或取消升级时列表位置不跳动。
    const listHeight = Math.min(fullListHeight, layout.listMax, Math.max(layout.row, availableHeight - fixedHeight - previewHeight - layout.safeMargin));
    const box = ctx.modal("选择弹药", "", true,
        { width: UI.panelWidth, height: listHeight + fixedHeight + (comparing ? previewHeight : 0) });
    if (p.back) ctx.ui.backButton(box, () => ctx.open(p.back!, true));
    const inventory = new ScrollList(UI.contentWidth, listHeight, fullListHeight, p.scroll, offset => p.scroll = offset);
    inventory.pos(UI.inset, layout.top); box.addChild(inventory);
    inventory.setVirtualRows(kinds.length, layout.step, (rowIndex, row) => {
        const kind = kinds[rowIndex], active = selected === kind, item = TOWER_AMMO[kind];
        const tile = ctx.ui.button(row, "", 0, 0, rowWidth, () => {
            if (ctx.current !== p || ctx.game.saves.pending || p.towerChange?.submitted || p.id === kind) return;
            p.id = kind; ctx.refresh();
        }, C.muted, layout.row, true, true);
        tile.name = "ammo:" + kind;
        const face = tile.getChildByName("buttonFace") as Laya.Sprite, equippedHere = equipped === kind;
        const hints = towerAmmoActionHints(state, kind, blocked);
        const actionX = rowWidth - 170, copyWidth = actionX - 151;
        ctx.ui.choiceState(tile, active);
        ctx.ui.image(face, item.icon, 14, 15, 110, 110);
        const title = ctx.ui.label(face, `${item.name} · ${amount(state.ammoLevels[kind])} 级`, 137, 18, copyWidth, 29, C.ink, true, 43);
        const effect = ctx.ui.label(face, item.effect, 137, 65, copyWidth, 24, C.muted, false, 36);
        for (const text of [title, effect]) { text.wordWrap = false; text.overflow = Laya.Text.SHRINK; }
        if (equippedHere) ctx.ui.label(face, "✓ 已装备", 137, 104, copyWidth, 22, C.green, true, 31);
        if (day) {
            const upgrade = ctx.ui.button(tile, "升级" + item.name, actionX, equippedHere ? 43 : 77, 154,
                () => ctx.open({ type: "ammoUpgrade", index, id: kind, back: p }), equippedHere ? C.gold : C.muted, 50, !blocked);
            if (hints.upgrade && !hints.equip) ctx.ui.actionBadge(upgrade, "AmmoUpgradeActionHint");
            if (!equippedHere) {
                const equip = ctx.ui.button(tile, "装备" + item.name, actionX, 13, 154, () => {
                    if (ctx.current !== p || ctx.game.saves.pending || p.towerChange?.submitted) return;
                    p.towerChange = { from: equipped, to: kind, level: tower.level, submitted: true };
                    ctx.send({ type: "TOWER", index, kind });
                }, C.gold, 50, !blocked);
                if (hints.equip) ctx.ui.actionBadge(equip, "AmmoEquipActionHint");
            }
        }
    });
    const comparisonY = layout.top + listHeight + layout.gap;
    if (comparing) {
        const comparison = card(box, comparisonY, layout.compare);
        ctx.ui.label(comparison, "换装预览", 24, 6, 182, 27, C.ink, true, 38);
        ctx.ui.label(comparison, "当前", 239, 6, 128, 23, C.muted, true, 38).align = "right";
        ctx.ui.label(comparison, "换装后", 443, 6, 121, 23, C.ink, true, 38).align = "right";
        const current = towerStats(state, equipped!, tower.level, operator), next = towerStats(state, selected, tower.level, operator);
        const entries: [string, string, string][] = [
            ["单发伤害", String(Math.floor(current.damage)), String(Math.floor(next.damage))],
            ["每秒攻击", (operator ? current.speed / current.interval : 0).toFixed(2), (operator ? next.speed / next.interval : 0).toFixed(2)],
            ["射程", String(Math.round(current.range)), String(Math.round(next.range))]
        ];
        if (showSlow) entries.push(["命中减速", Math.round(current.slow * 100) + "%", Math.round(next.slow * 100) + "%"]);
        else entries.push(["溅射半径", String(TOWERS[equipped!].splash), String(TOWERS[selected].splash)]);
        entries.forEach(([label, before, after], i) => {
            const y = 44 + i * 34, delta = parseFloat(after) - parseFloat(before);
            ctx.ui.label(comparison, label, 25, y, 207, 25, C.ink, false, 33);
            ctx.ui.label(comparison, before, 239, y, 128, 26, C.muted, false, 33).align = "right";
            ctx.ui.label(comparison, "→", 378, y, 48, 23, C.muted, false, 33).align = "center";
            ctx.ui.label(comparison, after, 434, y, 130, 26, delta > 0 ? C.green : delta < 0 ? C.red : C.ink, true, 33).align = "right";
        });
    }
}
