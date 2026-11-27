import { TACTICS, TACTIC_SLOTS, tacticDefinition } from "../../config/TacticConfig";
import { RULE } from "../../config/RuleConfig";
import { HERO } from "../../config/HeroConfig";
import { GameState } from "../../game/GameState";
import { canLearnTactic, equippedTactics, nextTacticSlotReady, tacticRevealed, tacticUnavailableReason } from "../../game/Tactics";
import type { GuideTrack } from "../../storage/VillageGuides";
import { actionHintsBlocked } from "../ActionHints";
import { ScrollList } from "../ScrollList";
import { drawGuideSpotlight } from "../StarterGuide";
import { C, UI } from "../UiTheme";
import { Panel, PanelContext } from "./PanelContext";

/** 圆槽、大图卡和跳过引导的视觉尺寸，调整时须保留滚动区与按钮之间的空隙。 */
const LAYOUT = {
    height: 930, margin: 48, width: 584, bottom: 43,
    slot: { top: 151, width: 188, height: 174, gap: 18, circleY: 85, radius: 45, icon: 68 },
    coach: { height: 124, width: 564, padding: 6 }
} as const;

/** 已学且没在任何槽携带的战技才可以填入空槽。 */
function hasTacticForVacantSlot(state: GameState, equipped: ReturnType<typeof equippedTactics>) {
    return equipped.includes(null) && state.tactics.learned.some(id => !equipped.includes(id));
}

/** 左侧入口和备战换装共用可办状态，普通的免费换装不常亮提醒。 */
export function tacticActionReady(state: GameState) {
    return state.phase === "DAY" && (nextTacticSlotReady(state) || canLearnTactic(state)
        || hasTacticForVacantSlot(state, equippedTactics(state)));
}

function compactLabel(ctx: PanelContext, parent: Laya.Sprite, text: string, x: number, y: number, width: number, height: number,
    font: number, color = C.ink, bold = false) {
    const label = ctx.ui.label(parent, text, x, y, width, font, color, bold, height);
    label.wordWrap = false;
    label.overflow = Laya.Text.SHRINK;
    return label;
}

function roundMedallion(ctx: PanelContext, face: Laya.Sprite, icon: string, x: number, y: number, radius: number, iconSize: number, locked = false) {
    face.graphics.drawCircle(x, y, radius, locked ? C.lockedFill : C.actionFace, locked ? C.lockedRim : C.outline, 5);
    face.graphics.drawCircle(x, y, radius - 7, null, locked ? C.blueArt : C.actionLip, 3);
    const image = ctx.ui.image(face, icon, x - iconSize / 2, y - iconSize / 2, iconSize);
    image.name = "TacticSlotIcon";
}

function coach(ctx: PanelContext, box: Laya.Sprite, track: GuideTrack, text: string, x: number, y: number, width: number, height: number) {
    const style = LAYOUT.coach;
    const shade = new Laya.Sprite(); shade.name = "TacticSlotSpotlight"; shade.mouseEnabled = false; box.addChild(shade);
    drawGuideSpotlight(shade.graphics, box.width, box.height, x - style.padding, y - style.padding,
        x + width + style.padding, y + height + style.padding);
    const card = new Laya.Sprite(), cardX = (box.width - style.width) / 2, cardY = box.height - style.height - LAYOUT.bottom;
    card.name = "TacticSlotGuide"; box.addChild(card);
    card.pos(cardX, cardY).size(style.width, style.height);
    ctx.art.panel(card, "panel_card", card.width, card.height);
    ctx.ui.image(card, HERO.portrait, 14, 28, 67);
    compactLabel(ctx, card, HERO.name, 91, 10, 320, 33, 26, C.timber, true);
    ctx.ui.label(card, text, 91, 46, style.width - 220, 25, C.ink, false, 68);
    ctx.ui.button(box, "跳过", cardX + style.width - 105, cardY + 36, 90, () => {
        ctx.finishGuide(track); ctx.refresh();
    }, C.muted, 51);
}

export function drawTacticOverview(ctx: PanelContext, s: GameState, panel: Panel, available: number) {
    const equipped = equippedTactics(s), spec = LAYOUT.slot, day = s.phase === "DAY", blocked = actionHintsBlocked(ctx.game);
    const slot = Math.min(panel.index ?? 0, equipped.length - 1), slotReady = !blocked && nextTacticSlotReady(s);
    const vacantSlot = !blocked && hasTacticForVacantSlot(s, equipped) ? equipped.indexOf(null) : -1;
    const height = Math.min(LAYOUT.height, available - LAYOUT.margin);
    const listTop = spec.top + spec.height + 57, rowHeight = 147, step = rowHeight + 12;
    const actionX = 416, actionY = 47, actionWidth = 153, actionHeight = 60;
    const target = TACTICS.findIndex(t => tacticRevealed(s, t.id) && !equipped.includes(t.id) &&
        tacticUnavailableReason(s, t.id, s.tactics.learned.includes(t.id) ? "EQUIP" : "LEARN", slot) === null);
    const roomForGuide = height - listTop - LAYOUT.bottom >= LAYOUT.coach.height + step + 32;
    const changeGuide = roomForGuide && !blocked && day && target >= 0 && !ctx.guideSeen("tacticChange");
    const unlockGuide = roomForGuide && !changeGuide && !blocked && day && !ctx.guideSeen("slot") &&
        equipped.length <= TACTIC_SLOTS.length && s.completed >= TACTIC_SLOTS[equipped.length - 1].unlockWaves;
    const box = ctx.modal("守村战技", "", true, { width: UI.panelWidth, height },
        "点圆槽选要调整的位置，再从下方装配。点战技图案或名称可展开资料。");
    if (panel.back) ctx.ui.backButton(box, () => ctx.open(panel.back!, true));
    compactLabel(ctx, box, "出战槽位", UI.inset, 110, 220, 34, 28, C.ink, true);

    for (let i = 0; i <= TACTIC_SLOTS.length; i++) {
        const id = equipped[i], skill = id ? tacticDefinition(id) : null, opened = i < equipped.length, active = i === slot;
        const x = UI.inset + i * (spec.width + spec.gap);
        const card = ctx.ui.button(box, "", x, spec.top, spec.width, () => {
            if (ctx.current !== panel) return;
            if (!opened) { ctx.open({ type: "tacticSlotUnlock", index: i, back: panel }); return; }
            const firstChoice = !ctx.guideSeen("tacticChange");
            ctx.finishGuide("tacticChange");
            panel.index = i;
            if (firstChoice) panel.scroll = 0;
            ctx.refresh();
        }, C.muted, spec.height, day && !blocked);
        card.name = `TacticSlot:${i + 1}`;
        const face = card.getChildByName("buttonFace") as Laya.Sprite;
        face.graphics.clear();
        ctx.art.panel(face, active ? "panel_card_fern" : opened ? "panel_card" : "panel_card_blue", spec.width, spec.height);
        const ink = opened ? C.ink : C.muted;
        compactLabel(ctx, face, `第 ${i + 1} 槽`, 10, 6, spec.width - 20, 34, 24, ink, true).align = "center";
        roundMedallion(ctx, face, skill?.icon ?? (opened ? "icon_build_plus" : "icon_slot_lock"), spec.width / 2,
            spec.circleY, spec.radius, opened ? spec.icon : 52, !opened);
        compactLabel(ctx, face, skill?.name ?? (opened ? "空槽位" : "未解锁"), 8, 135, spec.width - 16, 31, 25, ink, true).align = "center";
        if (slotReady && i === equipped.length) ctx.ui.cellActionBadge(card, "TacticSlotUnlockHint");
        if (!active && i === vacantSlot) ctx.ui.cellActionBadge(card, "TacticSlotActionHint");
    }
    compactLabel(ctx, box, `战技列表 · 第 ${slot + 1} 槽`, UI.inset, listTop - 46, UI.contentWidth, 36, 29, C.ink, true);

    const expandedId = panel.preview, detail = new Laya.Sprite();
    let detailHeight = 0;
    if (expandedId) {
        const skill = tacticDefinition(expandedId), revealed = tacticRevealed(s, skill.id);
        let y = 15;
        const paragraph = (copy: string, color: string, name: string, center = false) => {
            const text = ctx.ui.label(detail, copy, 24, y, LAYOUT.width - 48, 27, color, false, UI.panelHeight);
            text.name = name;
            if (center) text.align = "center";
            text.height = Math.ceil(text.textHeight) + 4;
            y += text.height + 13;
        };
        if (revealed) {
            if (skill.detail && skill.detail !== skill.summary) paragraph(skill.detail, C.green, "TacticEffect");
            const waves = s.tactics.mercyCooldown?.wavesLeft ?? 0;
            const timing = skill.effect === "KING_MERCY" ? (waves ? `冷却中 · 再守 ${waves} 波` : "每夜 1 次 · 按守住波数冷却")
                : skill.usesPerNight === undefined ? `冷却型 · ${skill.cooldownSeconds} 秒`
                : `每夜 ${skill.usesPerNight} 次${skill.usesPerNight > 1 ? ` · 冷却 ${skill.cooldownSeconds} 秒` : ""}`;
            compactLabel(ctx, detail, timing, 24, y, LAYOUT.width - 48, 34, 25, C.muted);
            y += 44;
        }
        const loreTitle = skill.effect === "ZHOU_LOVE" || skill.effect === "DRAGON_POISON" ? "村中密闻" : "村中传闻";
        compactLabel(ctx, detail, loreTitle, 24, y, LAYOUT.width - 48, 34, 26, C.timber, true);
        y += 39;
        paragraph(skill.lore, C.ink, "TacticLore", skill.effect === "ZHOU_LOVE");
        detailHeight = y + 5;
        detail.size(LAYOUT.width, detailHeight);
        ctx.art.panel(detail, "panel_card", LAYOUT.width, detailHeight);
    }

    const detailSpace = detailHeight ? detailHeight + 7 : 0;
    const actionOffset = target * step + (expandedId && TACTICS.findIndex(t => t.id === expandedId) < target ? detailSpace : 0);
    const actionTop = actionOffset + actionY - (panel.scroll ?? 0);
    const actionGuide = roomForGuide && !changeGuide && !unlockGuide && !blocked && day && target >= 0 &&
        panel.index !== undefined && !ctx.guideSeen("tacticAction") && actionTop >= 0 &&
        listTop + actionTop + actionHeight <= height - LAYOUT.bottom - LAYOUT.coach.height - 18;
    const guideSpace = changeGuide || unlockGuide || actionGuide ? LAYOUT.coach.height + 18 : 0;
    const bottom = height - LAYOUT.bottom - guideSpace;
    const unread = guideSpace ? -1 : TACTICS.findIndex(t => tacticRevealed(s, t.id) && ctx.unreadTactic(t.id));
    const list = new ScrollList(UI.contentWidth, bottom - listTop, TACTICS.length * step - (step - rowHeight) + detailSpace,
        panel.scroll ?? Math.max(0, unread) * step, offset => {
            if (panel.scroll !== offset) for (const name of ["TacticSlotSpotlight", "TacticSlotGuide", "button:跳过"])
                box.getChildByName(name)?.destroy(true);
            panel.scroll = offset;
        });
    list.pos(UI.inset, listTop); box.addChild(list);

    let y = 0, actionSpot: number | undefined;
    for (const skill of TACTICS) {
        const id = skill.id, revealed = tacticRevealed(s, id), learned = s.tactics.learned.includes(id);
        const equippedAt = equipped.indexOf(id), expanded = panel.preview === id;
        const removable = equippedAt === slot && slot > 0;
        const hasAction = revealed && day && (equippedAt < 0 || removable);
        const reason = equippedAt < 0 && revealed ? tacticUnavailableReason(s, id, learned ? "EQUIP" : "LEARN", slot) : null;
        const row = new Laya.Sprite();
        row.name = revealed ? `TacticCard:${id}` : "UnknownTactic";
        row.pos(0, y).size(LAYOUT.width, rowHeight); list.content.addChild(row);
        ctx.art.panel(row, revealed ? (equippedAt === slot ? "panel_card_fern" : "panel_card") : "panel_card_blue", row.width, rowHeight);
        if (equippedAt === slot) row.graphics.drawRoundRect(3, 3, row.width - 6, rowHeight - 6, 14, 14, 14, 14, null, C.selection, 3);
        const rowTop = y, infoWidth = hasAction ? actionX - 8 : row.width;
        const inspect = ctx.ui.button(row, "", 0, 0, infoWidth, () => {
            if (ctx.current !== panel) return;
            panel.preview = expanded ? undefined : id;
            if (!expanded) {
                if (revealed) ctx.markTacticRead(id);
                const previous = TACTICS.findIndex(t => t.id === expandedId);
                const nextTop = rowTop - (previous >= 0 && previous < TACTICS.indexOf(skill) ? detailSpace : 0);
                const scroll = (panel.scroll ?? 0) - (nextTop < rowTop ? detailSpace : 0);
                panel.scroll = Math.max(0, scroll, nextTop + rowHeight + 88 - list.height);
            }
            ctx.refresh();
        }, C.muted, rowHeight);
        inspect.name = "TacticInspect";
        const face = inspect.getChildByName("buttonFace") as Laya.Sprite;
        face.graphics.clear();
        const cy = rowHeight / 2;
        if (revealed) roundMedallion(ctx, face, skill.icon, 71, cy, 52, 90);
        else {
            face.graphics.drawCircle(71, cy, 52, C.lockedFill, C.lockedRim, 3);
            const question = compactLabel(ctx, face, "?", 19, cy - 43, 104, 86, 61, C.timber, true);
            question.align = "center"; question.valign = "middle";
        }
        const unread = !blocked && day && revealed && !expanded && ctx.unreadTactic(id);
        const caretInset = unread && !hasAction ? UI.cellActionDot.clearRight : 5;
        const titleWidth = infoWidth - 165 - caretInset;
        compactLabel(ctx, face, revealed ? skill.name : "未知战技", 137, 15, titleWidth, 42, 32, C.ink, true);
        compactLabel(ctx, face, expanded ? "⌃" : "⌄", infoWidth - 34 - caretInset, 20, 34, 35, 28, C.timber, true).align = "center";
        const summary = revealed ? skill.summary : `守住 ${skill.unlockWaves} 波后解锁`;
        const costShown = revealed && !learned;
        const copy = ctx.ui.label(face, summary, 137, 58, titleWidth, 25, C.muted, false, costShown || equippedAt >= 0 ? 44 : 66);
        copy.valign = "middle"; copy.overflow = Laya.Text.SHRINK;
        if (costShown) ctx.ui.coinCost(face, s, skill, 137, 105, titleWidth, 32);
        if (equippedAt >= 0) compactLabel(ctx, face, `✓ 已装第 ${equippedAt + 1} 槽`, 137, 106, titleWidth, 31, 24, C.green, true);
        const actionHint = hasAction && !blocked && !reason && !removable &&
            (!learned || !equipped[slot] || unread);

        if (hasAction) {
            const enabled = !blocked && !reason;
            const submit = () => {
                const active = ctx.game.state;
                if (!active || ctx.current !== panel || panel.pendingTactic || actionHintsBlocked(ctx.game) ||
                    (removable ? equippedTactics(active)[slot] !== id : tacticUnavailableReason(active, id, learned ? "EQUIP" : "LEARN", slot))) return;
                panel.pendingTactic = { id: removable ? null : id, slot };
                ctx.send(removable ? { type: "TACTIC_CLEAR_SLOT", slot } :
                    { type: learned ? "TACTIC_EQUIP" : "TACTIC_LEARN", id, slot });
            };
            ctx.ui.button(row, removable ? "卸下" : learned ? "装配" : "学习并装配", actionX, actionY, actionWidth, () => {
                if (ctx.current !== panel || actionHintsBlocked(ctx.game)) return;
                if (learned) submit();
                else ctx.confirmSpend({ title: skill.name, actionText: "确认学习", image: skill.icon,
                    detail: skill.summary, coins: skill.coins, showBadge: true }, submit);
            }, removable ? C.muted : C.gold, actionHeight, enabled);
            if (enabled && !removable && actionSpot === undefined) actionSpot = y;
            if (reason) compactLabel(ctx, row, reason, actionX - 8, 110, actionWidth + 16, 29, 22, C.red).align = "center";
        }
        if (actionHint || unread) ctx.ui.cellActionBadge(row, actionHint ? "TacticChoiceActionHint" : "TacticReadHint");
        y += step;
        if (expanded) {
            detail.pos(0, y - 5); list.content.addChild(detail);
            y += detailSpace;
        }
    }
    if (changeGuide || unlockGuide) {
        const guideSlot = changeGuide ? slot : equipped.length;
        coach(ctx, box, changeGuide ? "tacticChange" : "slot",
            changeGuide ? "先点圆槽，再在下方选要带的战技。" : "点锁住的圆槽，查看解锁条件。",
            UI.inset + guideSlot * (spec.width + spec.gap), spec.top, spec.width, spec.height);
    } else if (actionGuide && actionSpot !== undefined) {
        const targetY = listTop + actionSpot + actionY - (panel.scroll ?? 0);
        if (targetY >= listTop && targetY + actionHeight <= bottom)
            coach(ctx, box, "tacticAction", "点卡片右侧按钮，把战技装进当前圆槽。", UI.inset + actionX, targetY, actionWidth, actionHeight);
    }
}
