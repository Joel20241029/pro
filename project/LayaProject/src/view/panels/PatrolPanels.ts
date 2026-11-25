import { PATROL, PATROL_MODE } from "../../config/PatrolConfig";
import { clone, GameState, isWorkingAdult } from "../../game/GameState";
import { patrolUpgradeReason, patrolCaptain, patrolCost, patrolSpinStats } from "../../game/PatrolRules";
import { applyCommand } from "../../game/VillageRules";
import { patrolRapidCapacity, patrolRapidDamage, patrolReloadSeconds } from "../../game/PatrolRapid";
import { ScrollList } from "../ScrollList";
import { C, UI } from "../UiTheme";
import { PATROL_BOOTH_FRAME } from "../BuildingLayout";
import { amount, coloredName } from "../ViewText";
import { Panel, PanelContext } from "./PanelContext";
import { actionHintsBlocked } from "../ActionHints";

function drawBack(ctx: PanelContext, box: Laya.Sprite, name: string, back: () => void) {
    const button = ctx.ui.button(box, "", 30, 32, 54, back, C.muted, 54);
    button.name = name;
    ctx.ui.image(button.getChildByName("buttonFace") as Laya.Sprite, "icon_back", 10, 10, 34);
}

function modePicture(ctx: PanelContext, parent: Laya.Sprite, rapid: boolean, x: number, y: number) {
    if (rapid) ctx.ui.image(parent, "patrol_rapid_gun", x, y, 154, 114);
    else {
        ctx.ui.image(parent, "patrol_walk_0", x, y + 4, 83, 106);
        ctx.ui.image(parent, "patrol_walk_shuffle_0", x + 75, y + 8, 83, 102);
    }
}

export function drawPatrolPanel(ctx: PanelContext, s: GameState, panel: Panel) {
    const current = patrolCaptain(s), level = s.patrol.level;
    const day = s.phase === "DAY";
    const mode = (s.night ? s.night.patrolMode : s.patrol.mode) ?? PATROL_MODE.spin;
    const rapid = mode === PATROL_MODE.rapid;
    const canManage = day && !actionHintsBlocked(ctx.game);
    const back = () => ctx.open(panel.back ?? { type: "patrol" }, true);
    // 同一打法的候选排序与换人红点共用持续输出，计入一仓连射和打空后的补弹时间。
    const rank = (q: typeof current) => {
        const stats = patrolSpinStats(level, q);
        if (!rapid) return stats.damage / stats.seconds;
        const capacity = patrolRapidCapacity(level);
        const cycle = (capacity - 1) / PATROL.rapid.shotsPerSecond + patrolReloadSeconds(q);
        return patrolRapidDamage(stats.damage) * capacity / cycle;
    };
    if (panel.type === "patrolConfirm") {
        const next = clone(s);
        applyCommand(next, { type: "PATROL_CAPTAIN", id: panel.id! });
        const i = s.towers.findIndex(t => t.operator === panel.id);
        const occupant = next.people.find(q => q.id === next.towers[i]?.operator);
        const candidate = patrolCaptain(next)!;
        const footerY = 250;
        const box = ctx.modal("确认调任", "", false, { width: 586, height: footerY + UI.action.pairHeight + UI.action.bottom });
        const text = ctx.ui.label(box, `${coloredName(candidate)} 改任${PATROL.role}\n第 ${i + 1} 塔位${occupant ? `由 ${coloredName(occupant)} 补位` : "将暂时空岗"}`,
            34, 116, 518, 30, C.cream, false, 108);
        text.align = "center";
        ctx.ui.button(box, "取消", 69, footerY, 170, back, C.muted, UI.action.pairHeight);
        ctx.ui.button(box, "确认任命", 263, footerY, 254, () => ctx.send({ type: "PATROL_CAPTAIN", id: candidate.id }), C.gold, UI.action.pairHeight, day);
        return;
    }
    if (panel.type === "patrolCandidates") {
        const adults = s.people.filter(isWorkingAdult), towers = new Set(s.towers.map(t => t.operator));
        const baseline = patrolSpinStats(level);
        adults.sort((a, b) => Number(towers.has(a.id)) - Number(towers.has(b.id)) || rank(b) - rank(a) || b.nights - a.nights);
        const box = ctx.modal(current ? `更换${PATROL.role}` : PATROL.appoint, "", true, undefined, "白天工作照常。队长不能同时驻塔，换走塔手前会显示补位结果。");
        drawBack(ctx, box, "PatrolCandidatesBack", back);
        if (!adults.length) {
            ctx.ui.label(box, "暂无成年且未荣休的村民", 34, 316, 600, 30, C.cream, false, 76).align = "center";
            return;
        }
        const top = 122;
        const rows = new ScrollList(600, UI.panelHeight - top - UI.action.bottom, adults.length * UI.listStep, panel.scroll, offset => panel.scroll = offset);
        rows.pos(34, top);
        box.addChild(rows);
        rows.setVirtualRows(adults.length, UI.listStep, (i, row) => {
            const q = adults[i], stats = patrolSpinStats(level, q), stationed = towers.has(q.id);
            const status = q === current ? "现任队长" : stationed ? `驻守第 ${s.towers.findIndex(t => t.operator === q.id) + 1} 塔位` : "夜间空闲";
            const stronger = rapid ? patrolRapidDamage(stats.damage) > patrolRapidDamage(baseline.damage) : stats.damage > baseline.damage;
            const damage = stronger ? "伤害较高" : "伤害一般";
            const faster = rapid ? patrolReloadSeconds(q) < patrolReloadSeconds() : stats.ticks < baseline.ticks;
            const interval = rapid ? faster ? " · 补弹较快" : "" : stats.ticks < baseline.ticks ? " · 出征较快" : " · 常规出征";
            const button = ctx.ui.listItem(row, `${coloredName(q)} · ${status}\n${damage}${interval} · 剩 ${q.nights} 夜`,
                ctx.art.portraitId(q), 0, () => {
                    if (stationed) ctx.open({ type: "patrolConfirm", id: q.id, back: panel });
                    else ctx.send({ type: "PATROL_CAPTAIN", id: q.id });
                }, canManage && q !== current);
            if (!stationed && q !== current && (stronger || faster)) {
                ctx.ui.personRibbon(button, "tag_recommended", true);
                const label = button.getChildByName("buttonFace").getChildByName("buttonText") as Laya.Text;
                label.wordWrap = true;
            }
        });
        return;
    }
    const ration = !!(s.patrol.rationReady || s.night?.patrolRation);
    const wide = !!(s.patrol.radiusReady || s.night?.patrolWideImpact);
    const stats = patrolSpinStats(level, current);
    const spinName = PATROL.spin.name, rapidName = "城门连发";
    const details = current
        ? `旋甩每次 ${amount(patrolSpinStats(level, current, ration).damage)} 伤害，约 ${Math.round(stats.seconds)} 秒补一批。落点圈内所有敌人受到相同伤害。\n连发每发 ${amount(patrolRapidDamage(stats.damage))} 伤害，${amount(patrolRapidCapacity(level))} 发/仓，每秒 ${PATROL.rapid.shotsPerSecond} 发。松手保留余弹，打空后 ${patrolReloadSeconds(current)} 秒补满。`
        : "任命队长后即可出征。";
    if (panel.type === "patrolModes") {
        const box = ctx.modal("选择守夜打法", "", true, { width: UI.panelWidth, height: 574 }, details);
        drawBack(ctx, box, "PatrolModesBack", back);
        for (const [i, choice] of [PATROL_MODE.spin, PATROL_MODE.rapid].entries()) {
            const gun = choice === PATROL_MODE.rapid, selected = mode === choice;
            const card = new Laya.Sprite(); card.pos(UI.inset, 120 + i * 213); box.addChild(card);
            ctx.art.panel(card, "panel_card", UI.contentWidth, 193);
            if (selected) card.graphics.drawRoundRect(3, 3, UI.contentWidth - 6, 187, 18, 18, 18, 18, null, C.gold, 4);
            modePicture(ctx, card, gun, 17, 40);
            ctx.ui.label(card, gun ? rapidName : spinName, 200, 16, 385, 32, C.ink, true, 48);
            ctx.ui.label(card, gun ? "按住后拉，持续连发" : "后拉松手，范围砸击", 200, 68, 381, 26, C.muted, false, 43);
            if (selected || !canManage) {
                ctx.ui.label(card, selected ? "✓ 已选用" : "本夜未选用", 200, 128, 370, 27, selected ? C.green : C.muted, true, 44);
            } else ctx.ui.button(card, "选用", 379, 119, 185, () => {
                if (ctx.current !== panel || panel.id) return;
                panel.id = choice;
                ctx.send({ type: "PATROL_MODE", mode: choice });
            }, C.gold, 59);
            card.name = `PatrolMode:${choice}`;
        }
        return;
    }
    if (panel.type === "patrolUpgrade") {
        const reason = patrolUpgradeReason(s);
        const box = ctx.modal(`升级${PATROL.building}`, "", true, { width: UI.panelWidth, height: reason ? 644 : 596 });
        drawBack(ctx, box, "PatrolUpgradeBack", back);
        ctx.ui.image(box, PATROL_BOOTH_FRAME, 103, 112, 145, 137);
        ctx.ui.label(box, `${amount(level)} 级 → ${amount(level + 1)} 级`, 268, 148, 342, 39, C.ink, true, 60);
        const gains = new Laya.Sprite(); gains.pos(UI.inset, 263); box.addChild(gains);
        ctx.art.panel(gains, "panel_card", UI.contentWidth, 135);
        ctx.ui.image(gains, "patrol_walk_0", 20, 6, 49, 54);
        ctx.ui.label(gains, "旋甩　伤害提升、补员更快", 89, 9, 490, 28, C.ink, true, 52);
        ctx.ui.image(gains, "patrol_rapid_gun", 12, 74, 65, 47);
        ctx.ui.label(gains, `连发　弹仓增加 ${PATROL.rapid.roundsPerLevel} 发`, 89, 74, 490, 28, C.ink, true, 50);
        ctx.ui.materialCosts(box, s, patrolCost(s), 121, 415, 425, 54);
        if (reason) ctx.ui.label(box, reason, UI.inset, 472, UI.contentWidth, 25, C.red, true, 42).align = "center";
        ctx.ui.centerButton(box, "确认升级", reason ? 532 : 484, () => {
            if (ctx.current !== panel || panel.pendingPatrolLevel !== undefined || s.patrol.level !== level) return;
            panel.pendingPatrolLevel = level + 1;
            ctx.send({ type: "PATROL_UPGRADE" });
        }, C.gold, canManage && !reason, 258, 68);
        return;
    }

    const buff = ration || wide;
    const box = ctx.modal(PATROL.building, "", true, { width: UI.panelWidth, height: buff ? 729 : 679 },
        "白天点「切换打法」选择下场守夜的招式。队长由村中成年人自动补任，也可手动更换。\n\n" + details +
        "\n\n村中传闻\n起初两人比谁甩衣服甩得远。比到最后，衣服还在，人先飞了。");
    if (panel.back) drawBack(ctx, box, "PatrolDetailBack", back);
    ctx.ui.image(box, PATROL_BOOTH_FRAME, 82, 113, 213, 193);
    ctx.ui.label(box, `${amount(level)} 级`, 338, 136, 237, 44, C.ink, true, 65);
    ctx.ui.button(box, "升级", 331, 216, 202, () => ctx.open({ type: "patrolUpgrade", back: panel }), C.gold, 65);

    const captainRow = new Laya.Sprite(); captainRow.pos(UI.inset, 315); box.addChild(captainRow);
    ctx.art.panel(captainRow, "panel_card", UI.contentWidth, 98);
    if (current) ctx.ui.image(captainRow, ctx.art.portraitId(current), 13, 8, 82);
    const label = ctx.ui.label(captainRow, current ? `队长 · ${coloredName(current)}` : "队长待任命",
        current ? 105 : 23, 21, current ? 310 : 380, 29, C.ink, true, 55);
    label.wordWrap = false; label.overflow = Laya.Text.SHRINK;
    const alternatives = s.people.filter(p => p !== current && isWorkingAdult(p));
    const appoint = ctx.ui.button(captainRow, current ? "换人" : "任命", 427, 17, 150,
        () => ctx.open({ type: "patrolCandidates", back: panel }), C.gold, 62, canManage && alternatives.length > 0);
    const operators = new Set(s.towers.map(t => t.operator));
    if (canManage && alternatives.some(p => !operators.has(p.id) && (!current || rank(p) > rank(current))))
        ctx.ui.actionBadge(appoint, "PatrolCaptainActionHint");

    const active = new Laya.Sprite(); active.pos(UI.inset, 434); box.addChild(active);
    ctx.art.panel(active, "panel_card", UI.contentWidth, buff ? 250 : 200);
    modePicture(ctx, active, rapid, 20, 42);
    ctx.ui.label(active, "守夜打法", 205, 13, 365, 25, C.muted, false, 40);
    ctx.ui.label(active, rapid ? rapidName : spinName, 205, 56, 380, 32, C.ink, true, 50);
    ctx.ui.button(active, day ? "切换打法" : "查看打法", 205, 120, 226, () => ctx.open({ type: "patrolModes", back: panel }), C.gold, 60);
    if (buff) {
        const effect = ration && wide ? "伤害、范围提升" : ration ? "伤害提升" : "范围提升";
        const applied = s.night?.patrolRation || s.night?.patrolWideImpact;
        ctx.ui.label(active, `${effect} · ${applied ? "本夜旋甩生效" : "下次旋甩生效"}`, 17, 194, 566, 25, C.timber, true, 40).align = "center";
    }
}
