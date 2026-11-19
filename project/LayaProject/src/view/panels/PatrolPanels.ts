import { PATROL } from "../../config/PatrolConfig";
import { clone, GameState, isWorkingAdult } from "../../game/GameState";
import { patrolUpgradeReason, patrolCaptain, patrolCost, patrolStats } from "../../game/PatrolRules";
import { applyCommand } from "../../game/VillageRules";
import { ScrollList } from "../ScrollList";
import { C, UI } from "../UiTheme";
import { amount, coloredName } from "../ViewText";
import { Panel, PanelContext } from "./PanelContext";

export function drawPatrolPanel(ctx: PanelContext, s: GameState, panel: Panel) {
    const current = patrolCaptain(s), level = s.patrol.level;
    const day = s.phase === "DAY";
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
            const stats = patrolStats(level, q);
            return stats.count * stats.damage / stats.seconds;
        };
        const baseline = patrolStats(level);
        adults.sort((a, b) => Number(towers.has(a.id)) - Number(towers.has(b.id)) || rank(b) - rank(a) || b.nights - a.nights);
        const box = ctx.modal(PATROL.appoint, "", true, undefined, "白天工作照常。队长不能同时驻塔，换走塔手前会显示补位结果。");
        ctx.ui.button(box, "返回", 34, 108, 120, back, C.muted, 54);
        if (!adults.length) {
            ctx.ui.label(box, "暂无成年且未荣休的村民", 34, 316, 600, 30, C.cream, false, 76).align = "center";
            return;
        }
        const rows = new ScrollList(600, 610, adults.length * UI.listStep, panel.scroll, offset => panel.scroll = offset);
        rows.pos(34, 182);
        box.addChild(rows);
        rows.setVirtualRows(adults.length, UI.listStep, (i, row) => {
            const q = adults[i], stats = patrolStats(level, q), stationed = towers.has(q.id);
            const status = q === current ? "现任队长" : stationed ? `驻守第 ${s.towers.findIndex(t => t.operator === q.id) + 1} 塔位` : "夜间空闲";
            const damage = stats.damage > baseline.damage ? "伤害较高" : "伤害一般";
            const interval = stats.ticks < baseline.ticks ? "出征较快" : "常规出征";
            const button = ctx.ui.listItem(row, `${coloredName(q)} · ${status}\n${damage} · ${interval} · 剩 ${q.nights} 夜`,
                ctx.art.portraitId(q), 0, () => {
                    if (stationed) ctx.open({ type: "patrolConfirm", id: q.id, back: panel });
                    else ctx.send({ type: "PATROL_CAPTAIN", id: q.id });
                }, day && q !== current);
            if (!stationed && q !== current && (stats.damage > baseline.damage || stats.ticks < baseline.ticks)) {
                ctx.ui.personRibbon(button, "tag_recommended", true);
                const label = button.getChildByName("buttonFace").getChildByName("buttonText") as Laya.Text;
                label.wordWrap = true;
            }
        });
        return;
    }
    const appointY = 520, appointHeight = 82;
    const box = ctx.modal(PATROL.building, `${amount(level)} 级`, true,
        { width: UI.panelWidth, height: appointY + appointHeight + UI.action.bottom }, `点「${PATROL.appoint}」后，淡紫儿会分批从城门出发。前期升级增加人数，满队后增强单人伤害。队长品质和天赋影响伤害与出征间隔。`);
    if (panel.back) ctx.ui.button(box, "返回", 34, 108, 120, back, C.muted, 54);
    const frame = `patrol_booth_${level >= 9 ? 2 : level >= 5 ? 1 : 0}`;
    ctx.ui.image(box, frame, 50, 171, 140);
    const stats = patrolStats(level, current);
    ctx.ui.label(box, current ? `队长 · ${coloredName(current)}` : `${PATROL.role}待任命`, 214, 174, 408, 30, C.cream, true, 46);
    ctx.ui.label(box, `每批派出 ${stats.count} 人${current ? ` · 约 ${Math.round(stats.seconds)} 秒一批` : ""}`, 214, 226, 408, 26, C.cream, false, 46);
    const next = patrolStats(level + 1, current);
    const row = new Laya.Sprite(); row.pos(34, 320); box.addChild(row);
    const build = ctx.ui.buildRow(row, 0, frame, `升级至 ${amount(level + 1)} 级`,
        next.count > stats.count ? `每批 ${stats.count} → ${next.count} 人` : "单人伤害提升",
        s, patrolCost(s), patrolUpgradeReason(s), () => ctx.send({ type: "PATROL_UPGRADE" }), "升级");
    build.name = "PatrolUpgradeAction";
    ctx.ui.centerButton(box, current ? `更换${PATROL.role}` : PATROL.appoint, appointY,
        () => ctx.open({ type: "patrolCandidates", back: panel }), C.gold, day, 312, appointHeight);
}
