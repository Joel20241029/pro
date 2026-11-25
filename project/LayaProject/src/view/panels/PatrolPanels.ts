import { PATROL, PATROL_MODE } from "../../config/PatrolConfig";
import { clone, GameState, isWorkingAdult } from "../../game/GameState";
import { patrolUpgradeReason, patrolCaptain, patrolCost, patrolSpinStats } from "../../game/PatrolRules";
import { applyCommand } from "../../game/VillageRules";
import { patrolRapidCapacity, patrolRapidDamage, patrolReloadSeconds } from "../../game/PatrolRapid";
import { ScrollList } from "../ScrollList";
import { C, UI } from "../UiTheme";
import { PATROL_BOOTH_FRAME } from "../BuildingLayout";
import { amount, coloredName, growthPreview } from "../ViewText";
import { Panel, PanelContext } from "./PanelContext";
import { actionHintsBlocked } from "../ActionHints";

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
    const appointY = 728, appointHeight = 72;
    const box = ctx.modal(PATROL.building, "", true,
        { width: UI.panelWidth, height: appointY + appointHeight + UI.action.bottom },
        "白天轻点打法卡，守夜按已选打法出征。村中成年人可自动补任队长，也可手动更换。强健提高两种打法的伤害；灵巧让旋甩更快补员、连发更快补弹。\n\n村中传闻\n起初两人比谁甩衣服甩得远。比到最后，衣服还在，人先飞了。");
    if (panel.back) {
        const backButton = ctx.ui.button(box, "", 30, 32, 54, back, C.muted, 54);
        backButton.name = "PatrolDetailBack";
        ctx.ui.image(backButton.getChildByName("buttonFace") as Laya.Sprite, "icon_back", 10, 10, 34);
    }
    ctx.ui.image(box, PATROL_BOOTH_FRAME, 35, 106, 121, 110);
    ctx.ui.label(box, `之家 ${amount(level)} 级`, 166, 115, 460, 28, C.ink, true, 40);
    ctx.ui.label(box, current ? `队长 · ${coloredName(current)}` : `${PATROL.role}待任命`, 166, 159, 460, 28, C.ink, true, 44);

    const ration = !!(s.patrol.rationReady || s.night?.patrolRation);
    const wide = !!(s.patrol.radiusReady || s.night?.patrolWideImpact);
    const stats = patrolSpinStats(level, current, !rapid && ration);
    ctx.ui.label(box, "守夜打法", UI.inset, 217, 240, 30, C.ink, true, 32);
    ctx.ui.label(box, day ? "点选后，下场守夜使用" : "本夜打法已锁定", 295, 217, 340, 25, C.muted, false, 32).align = "right";
    const modes = [
        { id: PATROL_MODE.spin, name: "淡紫儿飞速旋转", icon: "patrol_walk_0" },
        { id: PATROL_MODE.rapid, name: "城门连发", icon: "patrol_rapid_gun" }
    ] as const;
    modes.forEach((choice, i) => {
        const selected = mode === choice.id;
        const card = ctx.ui.button(box, "", UI.inset + i * 307, 252, 293, () => {
            if (ctx.current === panel && !selected) ctx.send({ type: "PATROL_MODE", mode: choice.id });
        }, selected ? C.gold : C.muted, 156, selected || canManage, true);
        card.name = `PatrolMode:${choice.id}`;
        card.mouseEnabled = !selected && canManage;
        const face = card.getChildByName("buttonFace") as Laya.Sprite;
        if (selected) face.graphics.drawRoundRect(3, 3, card.width - 6, card.height - 6, 18, 18, 18, 18, null, C.gold, 4);
        if (choice.id === PATROL_MODE.spin) {
            ctx.ui.image(face, choice.icon, 66, 7, 85, 82);
            ctx.ui.image(face, "patrol_walk_shuffle_0", 137, 11, 85, 78);
        } else ctx.ui.image(face, choice.icon, 75, 6, 143, 86);
        ctx.ui.label(face, choice.name, 10, 91, 273, 29, C.ink, true, 36).align = "center";
        ctx.ui.label(face, selected ? "✓ 已选用" : (day ? "点此选用" : "未选用"),
            10, 124, 273, 24, selected ? C.timber : C.muted, false, 28).align = "center";
    });

    const guide = new Laya.Sprite();
    guide.name = "PatrolModeDetails"; guide.pos(UI.inset, 414); box.addChild(guide);
    ctx.art.panel(guide, "panel_card", UI.contentWidth, 110);
    const controls = rapid ? "后拉城门枪架，拉住连发，松手停火。" : "后拉淡紫儿，松手砸向落点圈内的敌人。";
    const spec = PATROL.rapid;
    const profile = rapid ? `每发 ${amount(patrolRapidDamage(stats.damage))} 伤害 · ${amount(patrolRapidCapacity(level))} 发/仓 · 每秒 ${spec.shotsPerSecond} 发 · 补弹 ${patrolReloadSeconds(current)} 秒`
        : `每次 ${amount(stats.damage)} 伤害 · 约 ${Math.round(stats.seconds)} 秒补一批`;
    ctx.ui.label(guide, controls, 18, 4, 564, 27, C.ink, true, 34);
    ctx.ui.label(guide, current ? profile : "任命队长后即可出征", 18, 39, 564, 25, C.green, false, 32).overflow = Laya.Text.SHRINK;
    if (ration || wide) {
        const effect = ration && wide ? "伤害、范围提升" : ration ? "伤害提升" : "范围提升";
        const applied = s.night?.patrolRation || s.night?.patrolWideImpact;
        ctx.ui.label(guide, `${effect} · ${applied ? "本夜旋甩生效" : "下次旋甩生效"}`, 18, 70, 564, 24, C.timber, true, 34);
    } else {
        ctx.ui.label(guide, rapid ? "松手保留余弹，打空才补弹。" : "落点圈内的敌人受到同样伤害。", 18, 70, 564, 24, C.muted, false, 34);
    }
    const row = new Laya.Sprite(); row.pos(42, 531); box.addChild(row);
    const build = ctx.ui.buildRow(row, 0, PATROL_BOOTH_FRAME, `升级至 ${amount(level + 1)} 级`,
        rapid ? `弹仓 ${growthPreview(patrolRapidCapacity(level), patrolRapidCapacity(level + 1))} 发` : "伤害提升 · 补员更快",
        s, patrolCost(s), patrolUpgradeReason(s), () => ctx.send({ type: "PATROL_UPGRADE" }), "升级");
    build.name = "PatrolUpgradeAction";
    const alternatives = s.people.filter(p => p !== current && isWorkingAdult(p));
    const appoint = ctx.ui.centerButton(box, current ? `更换${PATROL.role}` : PATROL.appoint, appointY,
        () => ctx.open({ type: "patrolCandidates", back: panel }), C.gold, canManage && alternatives.length > 0, 312, appointHeight);
    const operators = new Set(s.towers.map(t => t.operator));
    if (canManage && alternatives.some(p => !operators.has(p.id) && (!current || rank(p) > rank(current))))
        ctx.ui.actionBadge(appoint, "PatrolCaptainActionHint");
}
