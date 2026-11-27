import { PATROL, PATROL_MODE } from "../../config/PatrolConfig";
import { clone, GameState, isAvailableAdult } from "../../game/GameState";
import { patrolUpgradeReason, patrolCaptain, patrolCost, patrolSpinStats } from "../../game/PatrolRules";
import { applyCommand } from "../../game/VillageRules";
import { patrolRapidCapacity, patrolRapidDamage, patrolReloadSeconds } from "../../game/PatrolRapid";
import { ScrollList } from "../ScrollList";
import { C, UI } from "../UiTheme";
import { PATROL_BOOTH_FRAME } from "../BuildingLayout";
import { amount, coloredName } from "../ViewText";
import { Panel, PanelContext } from "./PanelContext";
import { actionHintsBlocked, captainRecommendation, patrolOutput } from "../ActionHints";
import { patrolActionHints } from "../PatrolActionHints";

function modePicture(ctx: PanelContext, parent: Laya.Sprite, rapid: boolean, x: number, y: number) {
    if (rapid) ctx.ui.image(parent, "patrol_rapid_gun", x, y, 185, 132);
    else {
        ctx.ui.image(parent, "patrol_walk_0", x, y + 4, 97, 124);
        ctx.ui.image(parent, "patrol_walk_shuffle_0", x + 87, y + 8, 97, 120);
    }
}

export function drawPatrolPanel(ctx: PanelContext, s: GameState, panel: Panel, availableHeight: number = UI.panelHeight) {
    const current = patrolCaptain(s), level = s.patrol.level;
    const day = s.phase === "DAY";
    const mode = (s.night ? s.night.patrolMode : s.patrol.mode) ?? PATROL_MODE.spin;
    const rapid = mode === PATROL_MODE.rapid;
    const canManage = day && !actionHintsBlocked(ctx.game);
    const hints = patrolActionHints(s, !canManage);
    const back = () => ctx.open(panel.back ?? { type: "patrol" }, true);
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
        const appoint = ctx.ui.button(box, "确认任命", 263, footerY, 254, () => ctx.send({ type: "PATROL_CAPTAIN", id: candidate.id }), C.gold, UI.action.pairHeight, canManage);
        if (hints.appoint) {
            ctx.ui.actionBadge(appoint, "PatrolCaptainActionHint");
        }
        return;
    }
    if (panel.type === "patrolCandidates") {
        const recommendation = captainRecommendation(s, !canManage);
        const adults = s.people.filter(p => isAvailableAdult(s, p)), towers = new Set(s.towers.map(t => t.operator));
        const baseline = patrolSpinStats(level);
        adults.sort((a, b) => Number(towers.has(a.id)) - Number(towers.has(b.id)) || patrolOutput(level, mode, b) - patrolOutput(level, mode, a) || b.nights - a.nights);
        const height = Math.min(UI.panelHeight, availableHeight - 32);
        const box = ctx.modal(current ? `更换${PATROL.role}` : PATROL.appoint, "", true, { width: UI.panelWidth, height },
            "队长不能同时驻塔。若选择塔手，确认前会显示补位结果。");
        ctx.ui.backButton(box, back, "PatrolCandidatesBack");
        if (!adults.length) {
            ctx.ui.label(box, "暂无成年且未荣休的村民", 34, 316, 600, 30, C.cream, false, 76).align = "center";
            return;
        }
        const top = 122, step = UI.listStep + 8;
        const rows = new ScrollList(UI.contentWidth, box.height - top - UI.action.bottom, adults.length * step - 10, panel.scroll, offset => panel.scroll = offset);
        rows.pos(34, top);
        box.addChild(rows);
        rows.setVirtualRows(adults.length, step, (i, row) => {
            const q = adults[i], stats = patrolSpinStats(level, q), stationed = towers.has(q.id);
            const stronger = rapid ? patrolRapidDamage(stats.damage) > patrolRapidDamage(baseline.damage) : stats.damage > baseline.damage;
            const status = stationed ? `第 ${s.towers.findIndex(t => t.operator === q.id) + 1} 塔位` : stronger ? "伤害较高" : "常规伤害";
            const faster = rapid ? patrolReloadSeconds(q) < patrolReloadSeconds() : stats.ticks < baseline.ticks;
            const interval = faster ? rapid ? " · 补弹较快" : " · 出征较快" : "";
            const card = new Laya.Sprite(); card.size(UI.contentWidth - UI.scrollGutter, UI.listHeight + 8); row.addChild(card);
            card.name = `PatrolCaptain:${q.id}`;
            ctx.art.panel(card, "panel_card", card.width, card.height);
            ctx.ui.image(card, ctx.art.portraitId(q), 10, 5, 112, 112);
            const name = ctx.ui.label(card, coloredName(q), 135, 17, 269, 31, C.ink, true, 47);
            const detail = ctx.ui.label(card, `${status}${interval} · 剩 ${q.nights} 夜`, 135, 69, 279, 24, C.muted, false, 35);
            for (const text of [name, detail]) { text.wordWrap = false; text.overflow = Laya.Text.SHRINK; }
            if (q === current) {
                ctx.ui.choiceState(card, true, "已任命", false, card.width - 141);
            } else if (canManage) {
                ctx.ui.button(card, "任命队长", card.width - 158, q === recommendation ? 54 : 37, 143, () => {
                    if (ctx.current !== panel || panel.id || actionHintsBlocked(ctx.game)) return;
                    if (stationed) ctx.open({ type: "patrolConfirm", id: q.id, back: panel });
                    else ctx.send({ type: "PATROL_CAPTAIN", id: q.id });
                }, C.gold, 57);
                if (hints.appoint) ctx.ui.cellActionBadge(card, "PatrolCaptainActionHint");
            }
            if (q === recommendation)
                ctx.ui.image(card, "tag_recommended", card.width - 107 - UI.cellActionDot.clearRight, 7, 107, 32).name = "tag_recommended";
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
        const height = 553;
        const box = ctx.modal("选择守夜打法", "", true, { width: UI.panelWidth, height }, details);
        ctx.ui.backButton(box, back, "PatrolModesBack");
        for (const [i, choice] of [PATROL_MODE.spin, PATROL_MODE.rapid].entries()) {
            const gun = choice === PATROL_MODE.rapid, selected = mode === choice;
            const card = new Laya.Sprite(); card.pos(UI.inset, 120 + i * 192); card.size(UI.contentWidth, 174); box.addChild(card);
            card.name = `PatrolMode:${choice}`;
            ctx.art.panel(card, "panel_card", card.width, card.height);
            ctx.ui.choiceState(card, selected);
            modePicture(ctx, card, gun, 15, 20);
            ctx.ui.label(card, gun ? rapidName : spinName, 213, 20, 352, 32, C.ink, true, 47);
            ctx.ui.label(card, gun ? "后拉连发" : "松手砸击", 213, 75, 235, 25, C.muted, false, 41);
            if (selected) ctx.ui.label(card, "✓ 已选用", 432, 109, 142, 25, C.green, true, 40);
            else if (canManage) {
                ctx.ui.button(card, "选用", 432, 106, 142, () => {
                    if (ctx.current !== panel || panel.id || actionHintsBlocked(ctx.game)) return;
                    panel.id = choice;
                    ctx.send({ type: "PATROL_MODE", mode: choice });
                }, C.gold, 55);
                if (choice === PATROL_MODE.spin && hints.activateBuff) ctx.ui.cellActionBadge(card, "PatrolBuffActionHint");
            }
        }
        return;
    }
    if (panel.type === "patrolUpgrade") {
        const reason = patrolUpgradeReason(s);
        const box = ctx.modal(`升级${PATROL.building}`, "", true, { width: UI.panelWidth, height: reason ? 644 : 596 });
        ctx.ui.backButton(box, back, "PatrolUpgradeBack");
        ctx.ui.image(box, PATROL_BOOTH_FRAME, 103, 112, 145, 137);
        ctx.ui.label(box, `${amount(level)} 级 → ${amount(level + 1)} 级`, 268, 148, 342, 39, C.ink, true, 60);
        const gains = new Laya.Sprite(); gains.pos(UI.inset, 263); box.addChild(gains);
        ctx.art.panel(gains, "panel_card", UI.contentWidth, 135);
        ctx.ui.image(gains, "patrol_walk_0", 20, 6, 49, 54);
        ctx.ui.label(gains, "旋甩　伤害提升、补员更快", 89, 9, 490, 28, C.ink, true, 52);
        ctx.ui.image(gains, "patrol_rapid_gun", 12, 74, 65, 47);
        ctx.ui.label(gains, `连发　弹仓增加 ${PATROL.rapid.roundsPerLevel} 发`, 89, 74, 490, 28, C.ink, true, 50);
        ctx.ui.coinCost(box, s, patrolCost(s), 121, 415, 425, 54);
        if (reason) ctx.ui.label(box, reason, UI.inset, 472, UI.contentWidth, 25, C.red, true, 42).align = "center";
        const confirm = ctx.ui.centerButton(box, "确认升级", reason ? 532 : 484, () => {
            if (ctx.current !== panel || panel.pendingPatrolLevel !== undefined || s.patrol.level !== level) return;
            panel.pendingPatrolLevel = level + 1;
            ctx.send({ type: "PATROL_UPGRADE" });
        }, C.gold, canManage && !reason, 258, 68);
        if (canManage && !reason) ctx.ui.actionBadge(confirm, "PatrolUpgradeActionHint");
        return;
    }

    const buff = ration || wide;
    const box = ctx.modal(PATROL.building, "", true, { width: UI.panelWidth, height: buff ? 729 : 679 },
        "白天点「切换打法」选择下场守夜的招式。队长由村中成年人自动补任，也可手动更换。\n\n" + details +
        "\n\n村中传闻\n起初两人比谁甩衣服甩得远。比到最后，衣服还在，人先飞了。");
    if (panel.back) ctx.ui.backButton(box, back, "PatrolDetailBack");
    ctx.ui.image(box, PATROL_BOOTH_FRAME, 82, 113, 213, 193);
    ctx.ui.label(box, `${amount(level)} 级`, 338, 136, 237, 44, C.ink, true, 65);
    const upgrade = ctx.ui.button(box, "升级", 331, 216, 202, () => ctx.open({ type: "patrolUpgrade", back: panel }), C.gold, 65);
    if (hints.upgrade) ctx.ui.actionBadge(upgrade, "PatrolUpgradeActionHint");

    const captainRow = new Laya.Sprite().size(UI.contentWidth, 98); captainRow.pos(UI.inset, 315); box.addChild(captainRow);
    ctx.art.panel(captainRow, "panel_card", UI.contentWidth, 98);
    if (current) ctx.ui.image(captainRow, ctx.art.portraitId(current), 13, 8, 82);
    const label = ctx.ui.label(captainRow, current ? `队长 · ${coloredName(current)}` : "队长待任命",
        current ? 105 : 23, 21, current ? 310 : 380, 29, C.ink, true, 55);
    label.wordWrap = false; label.overflow = Laya.Text.SHRINK;
    const alternatives = s.people.filter(p => p !== current && isAvailableAdult(s, p));
    ctx.ui.button(captainRow, current ? "换人" : "任命", UI.contentWidth - 150 - UI.cellActionDot.clearRight, 17, 150,
        () => ctx.open({ type: "patrolCandidates", back: panel }), C.gold, 62, canManage && alternatives.length > 0);
    if (hints.appoint) ctx.ui.cellActionBadge(captainRow, "PatrolCaptainActionHint");

    const active = new Laya.Sprite().size(UI.contentWidth, buff ? 250 : 200); active.pos(UI.inset, 434); box.addChild(active);
    ctx.art.panel(active, "panel_card", active.width, active.height);
    modePicture(ctx, active, rapid, 16, 32);
    ctx.ui.label(active, "守夜打法", 221, 15, 350, 25, C.muted, false, 40);
    ctx.ui.label(active, rapid ? rapidName : spinName, 221, 58, 354, 32, C.ink, true, 50);
    ctx.ui.button(active, day ? "切换打法" : "查看打法", 221, 121, 226, () => ctx.open({ type: "patrolModes", back: panel }), C.gold, 60);
    if (hints.activateBuff) ctx.ui.cellActionBadge(active, "PatrolBuffActionHint");
    if (buff) {
        const effect = ration && wide ? "伤害、范围提升" : ration ? "伤害提升" : "范围提升";
        const applied = s.night?.patrolRation || s.night?.patrolWideImpact;
        ctx.ui.label(active, `${effect} · ${applied ? "本夜旋甩生效" : "下次旋甩生效"}`, 17, 194, 566, 25, C.timber, true, 40).align = "center";
    }
}
