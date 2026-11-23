import { PATROL } from "../../config/PatrolConfig";
import { clone, GameState, isWorkingAdult } from "../../game/GameState";
import { patrolUpgradeReason, patrolCaptain, patrolCost, patrolSpinStats } from "../../game/PatrolRules";
import { applyCommand } from "../../game/VillageRules";
import { ScrollList } from "../ScrollList";
import { C, UI } from "../UiTheme";
import { PATROL_BOOTH_FRAME } from "../BuildingLayout";
import { amount, coloredName } from "../ViewText";
import { Panel, PanelContext } from "./PanelContext";
import { actionHintsBlocked } from "../ActionHints";

export function drawPatrolPanel(ctx: PanelContext, s: GameState, panel: Panel) {
    const current = patrolCaptain(s), level = s.patrol.level;
    const day = s.phase === "DAY";
    const canManage = day && !actionHintsBlocked(ctx.game);
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
        ctx.ui.button(box, "确认任命", 263, footerY, 254, () => ctx.send({ type: "PATROL_CAPTAIN", id: candidate.id }), C.gold, UI.action.pairHeight, day);
        return;
    }
    if (panel.type === "patrolCandidates") {
        const adults = s.people.filter(isWorkingAdult), towers = new Set(s.towers.map(t => t.operator));
        const rank = (q: typeof adults[number]) => {
            const stats = patrolSpinStats(level, q);
            return stats.damage / stats.seconds;
        };
        const baseline = patrolSpinStats(level);
        adults.sort((a, b) => Number(towers.has(a.id)) - Number(towers.has(b.id)) || rank(b) - rank(a) || b.nights - a.nights);
        const box = ctx.modal(current ? `更换${PATROL.role}` : PATROL.appoint, "", true, undefined, "白天工作照常。队长不能同时驻塔，换走塔手前会显示补位结果。");
        const backButton = ctx.ui.button(box, "", 30, 32, 54, back, C.muted, 54);
        backButton.name = "PatrolCandidatesBack";
        ctx.ui.image(backButton.getChildByName("buttonFace") as Laya.Sprite, "icon_back", 10, 10, 34);
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
            const damage = stats.damage > baseline.damage ? "伤害较高" : "伤害一般";
            const interval = stats.ticks < baseline.ticks ? "出征较快" : "常规出征";
            const button = ctx.ui.listItem(row, `${coloredName(q)} · ${status}\n${damage} · ${interval} · 剩 ${q.nights} 夜`,
                ctx.art.portraitId(q), 0, () => {
                    if (stationed) ctx.open({ type: "patrolConfirm", id: q.id, back: panel });
                    else ctx.send({ type: "PATROL_CAPTAIN", id: q.id });
                }, canManage && q !== current);
            if (!stationed && q !== current && (stats.damage > baseline.damage || stats.ticks < baseline.ticks)) {
                ctx.ui.personRibbon(button, "tag_recommended", true);
                const label = button.getChildByName("buttonFace").getChildByName("buttonText") as Laya.Text;
                label.wordWrap = true;
            }
        });
        return;
    }
    const appointY = 772, appointHeight = 82;
    const box = ctx.modal(PATROL.building, `${amount(level)} 级`, true,
        { width: UI.panelWidth, height: appointY + appointHeight + UI.action.bottom }, "村里有成年村民时会自动补任队长，也可以手动更换。守夜时两名淡紫儿从之家出发，按住任一人后拉，参考落点圈，松手发射。升级提高伤害并加快补员。队长品质和天赋也有加成。");
    if (panel.back) ctx.ui.button(box, "返回", 34, 108, 120, back, C.muted, 54);
    ctx.ui.image(box, PATROL_BOOTH_FRAME, 50, 171, 140);
    const ration = s.patrol.rationReady || s.night?.patrolRation;
    const stats = patrolSpinStats(level, current, ration);
    ctx.ui.label(box, current ? `队长 · ${coloredName(current)}` : `${PATROL.role}待任命`, 214, 174, 408, 30, C.cream, true, 46);
    ctx.ui.label(box, current ? `伤害 ${amount(stats.damage)} · 约 ${Math.round(stats.seconds)} 秒补一批` : "任命队长后，守夜时出征",
        214, 226, 408, 26, C.cream, false, 46);
    if (ration) ctx.ui.label(box, s.night?.patrolRation ? "口粮加成 · 本夜生效" : "口粮加成 · 下场守夜生效",
        214, 270, 408, 25, C.cream, false, 42);
    const row = new Laya.Sprite(); row.pos(34, 320); box.addChild(row);
    const build = ctx.ui.buildRow(row, 0, PATROL_BOOTH_FRAME, `升级至 ${amount(level + 1)} 级`,
        "伤害提升 · 补员更快",
        s, patrolCost(s), patrolUpgradeReason(s), () => ctx.send({ type: "PATROL_UPGRADE" }), "升级");
    build.name = "PatrolUpgradeAction";
    const guide = new Laya.Sprite();
    guide.pos(34, 520);
    box.addChild(guide);
    ctx.art.panel(guide, "panel_card", 600, 230);
    ctx.ui.label(guide, PATROL.spin.name, 20, 10, 560, 30, C.ink, true, 40);
    ctx.ui.label(guide, "守夜时按住任一淡紫儿，后拉松手发射。\n落点范围内的敌人受到同样伤害。", 20, 52, 560, 25, C.green, false, 70);
    ctx.ui.label(guide, "村中传闻", 20, 124, 560, 25, C.timber, true, 32);
    ctx.ui.label(guide, "起初两人比谁甩衣服甩得远。\n比到最后，衣服还在，人先飞了。", 20, 157, 560, 24, C.ink, false, 68);
    const alternatives = s.people.filter(p => p !== current && isWorkingAdult(p));
    const appoint = ctx.ui.centerButton(box, current ? `更换${PATROL.role}` : PATROL.appoint, appointY,
        () => ctx.open({ type: "patrolCandidates", back: panel }), C.gold, canManage && alternatives.length > 0, 312, appointHeight);
    const operators = new Set(s.towers.map(t => t.operator));
    if (canManage && alternatives.some(p => {
        if (operators.has(p.id)) return false;
        const candidate = patrolSpinStats(level, p, ration);
        return !current || candidate.damage * stats.ticks > stats.damage * candidate.ticks;
    })) ctx.ui.actionBadge(appoint, "PatrolCaptainActionHint");
}
