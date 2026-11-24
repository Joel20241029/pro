import { SUMMON_TACTIC, TACTICS, TACTIC_NIGHT_USES, TACTIC_SLOTS, tacticDefinition, TacticDefinition } from "../../config/TacticConfig";
import { GameState } from "../../game/GameState";
import { equippedTactics, nextTacticSlotReady, tacticRevealed, tacticUnavailableReason } from "../../game/Tactics";
import type { GuideTrack } from "../../storage/VillageGuides";
import { actionHintsBlocked } from "../ActionHints";
import { ScrollList } from "../ScrollList";
import { drawGuideSpotlight } from "../StarterGuide";
import { C, UI } from "../UiTheme";
import { Panel, PanelContext } from "./PanelContext";

/** 定稿主次分工：总览优先放大圆槽；操作页保留大装备卡，候选行紧凑，右侧按钮同宽。 */
const LAYOUT = {
    height: 930, margin: 48, width: 584, bottom: 43,
    slot: { top: 157, width: 188, height: 257, gap: 18, circleY: 103, radius: 60, icon: 88, buttonWidth: 125 },
    catalog: { header: 426, top: 493, standalone: 121, step: 111, row: 99 },
    swap: { equippedTop: 114, equippedHeight: 166, top: 299, row: 108, step: 119, group: 46, buttonX: 367, buttonW: 199, buttonH: 72 },
    coach: { height: 124, width: 564, padding: 6 }
} as const;

const names = { overview: "守村战技", catalog: "战技图鉴" } as const;

function panelHeight(available: number) { return Math.min(LAYOUT.height, available - LAYOUT.margin); }

function backButton(ctx: PanelContext, box: Laya.Sprite, panel: Panel) {
    if (panel.back) ctx.ui.button(box, "‹", 30, 32, 54, () => ctx.open(panel.back!, true), C.muted, 54);
}

function compactLabel(ctx: PanelContext, parent: Laya.Sprite, text: string, x: number, y: number, width: number, height: number,
    font: number, color = C.ink, bold = false) {
    const label = ctx.ui.label(parent, text, x, y, width, font, color, bold, height);
    label.wordWrap = false;
    label.overflow = Laya.Text.SHRINK;
    return label;
}

function roundMedallion(ctx: PanelContext, face: Laya.Sprite, icon: string, x: number, y: number, radius: number, iconSize: number, locked = false) {
    face.graphics.drawCircle(x, y, radius, locked ? "#677951" : "#f5d896", locked ? "#d7c47e" : "#e5a33d", 5);
    face.graphics.drawCircle(x, y, radius - 7, null, locked ? "#a69d6a" : "#fff0c1", 3);
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
    ctx.ui.image(card, tacticDefinition(SUMMON_TACTIC).icon, 14, 28, 67);
    compactLabel(ctx, card, "智卓", 91, 10, 320, 33, 26, C.timber, true);
    ctx.ui.label(card, text, 91, 46, style.width - 220, 25, C.ink, false, 68);
    ctx.ui.button(box, "跳过", cardX + style.width - 105, cardY + 36, 90, () => {
        ctx.finishGuide(track); ctx.refresh();
    }, C.muted, 51);
}

function catalogRows(ctx: PanelContext, state: GameState, panel: Panel, box: Laya.Sprite, top: number) {
    const spec = LAYOUT.catalog;
    const list = new ScrollList(UI.contentWidth, box.height - top - LAYOUT.bottom,
        TACTICS.length * spec.step - (spec.step - spec.row), panel.scroll, y => panel.scroll = y);
    list.pos(UI.inset, top); box.addChild(list);
    TACTICS.forEach((skill, index) => {
        const row = new Laya.Sprite(); row.pos(0, index * spec.step).size(LAYOUT.width, spec.row); list.content.addChild(row);
        const revealed = tacticRevealed(state, skill.id);
        const inspect = () => ctx.open({ type: "tactic", id: skill.id, back: panel });
        row.name = revealed ? `TacticCard:${skill.id}` : "UnknownTactic";
        ctx.art.panel(row, revealed ? "panel_card" : "panel_card_disabled", LAYOUT.width, spec.row);
        if (revealed) ctx.ui.image(row, skill.icon, 11, 9, 78);
        else compactLabel(ctx, row, "?", 15, 0, 63, spec.row, 57, C.timber, true).align = "center";
        compactLabel(ctx, row, revealed ? skill.name : "未知战技", 101, 9, 325, 42, 31, C.ink, true);
        compactLabel(ctx, row, revealed ? skill.summary : `守住 ${skill.unlockWaves} 波后解锁`, 101, 51, 325, 36, 24, C.green);
        const button = ctx.ui.button(row, revealed ? "详情" : "传闻", 449, 23, 115, inspect, C.muted, 54);
        if (revealed && ctx.unreadTactic(skill.id)) ctx.ui.actionBadge(button, "TacticReadHint");
    });
}

export function drawTacticOverview(ctx: PanelContext, state: GameState, panel: Panel, available: number) {
    const height = panelHeight(available);
    const box = ctx.modal(names.overview, "", true, { width: UI.panelWidth, height }, "点出战槽位更换战技。守夜时使用底栏的施放按钮。");
    const equipped = equippedTactics(state), spec = LAYOUT.slot, day = state.phase === "DAY", blocked = actionHintsBlocked(ctx.game);
    const ready = !blocked && nextTacticSlotReady(state);
    backButton(ctx, box, panel);
    compactLabel(ctx, box, "出战槽位", UI.inset, 105, 270, 43, 31, C.cream, true);
    compactLabel(ctx, box, `每夜共可施放 ${TACTIC_NIGHT_USES[equipped.length - 1]} 次`, 325, 107, 309, 43, 25, C.cream).align = "right";
    const changeGuide = !blocked && day && !ctx.guideSeen("tacticChange") && TACTICS.some(t =>
        tacticUnavailableReason(state, t.id, state.tactics.learned.includes(t.id) ? "EQUIP" : "LEARN", 0) === null);
    const unlockGuide = !changeGuide && day && !blocked && !ctx.guideSeen("slot") &&
        equipped.length <= TACTIC_SLOTS.length && state.completed >= TACTIC_SLOTS[equipped.length - 1].unlockWaves;
    const guideSlot = changeGuide ? 0 : unlockGuide ? equipped.length : -1;

    for (let i = 0; i <= TACTIC_SLOTS.length; i++) {
        const id = equipped[i], skill = id ? tacticDefinition(id) : null, opened = i < equipped.length;
        const x = UI.inset + i * (spec.width + spec.gap);
        const open = () => {
            if (ctx.current !== panel) return;
            if (opened) {
                ctx.finishGuide("tacticChange");
                ctx.open({ type: "tacticSwap", index: i, back: panel });
            } else ctx.open({ type: "tacticSlotUnlock", index: i, back: panel });
        };
        const card = ctx.ui.button(box, "", x, spec.top, spec.width, open, C.green, spec.height, day && !blocked);
        card.name = `TacticSlot:${i + 1}`;
        const face = card.getChildByName("buttonFace") as Laya.Sprite;
        face.graphics.clear(); ctx.art.panel(face, opened ? "panel_header" : "panel_card_disabled", spec.width, spec.height);
        const caption = compactLabel(ctx, face, `第 ${i + 1} 槽`, 12, 11, spec.width - 24, 31, 25, opened ? C.cream : C.muted, true);
        caption.align = "center";
        roundMedallion(ctx, face, skill?.icon ?? (opened ? "icon_build_plus" : "icon_slot_lock"), spec.width / 2,
            spec.circleY, spec.radius, opened ? spec.icon : 61, !opened);
        compactLabel(ctx, face, skill?.name ?? (opened ? "空槽位" : "未解锁"), 10, 170, spec.width - 20, 34, 27,
            opened ? C.cream : C.ink, true).align = "center";
        // 整卡负责点击，子按钮只画出操作意图，图标和动作文字共享命中范围。
        const action = ctx.ui.button(face, opened ? (skill ? "更换" : "装配") : "解锁", (spec.width - spec.buttonWidth) / 2, 206,
            spec.buttonWidth, open, opened ? C.gold : C.muted, 42);
        action.mouseEnabled = false;
        if (ready && i === equipped.length) ctx.ui.actionBadge(card, "TacticSlotUnlockHint");
    }
    const y = LAYOUT.catalog.header;
    compactLabel(ctx, box, names.catalog, UI.inset, y, 240, 51, 31, C.cream, true);
    const catalog = ctx.ui.button(box, "查看全部", 476, y, 158, () => {
        if (ctx.current === panel) ctx.open({ type: "tacticCatalog", back: panel });
    }, C.muted, 53);
    if (ctx.tacticUnread) ctx.ui.actionBadge(catalog, "TacticCatalogHint");
    catalogRows(ctx, state, panel, box, LAYOUT.catalog.top);
    if (guideSlot >= 0) coach(ctx, box, changeGuide ? "tacticChange" : "slot",
        changeGuide ? "点槽位上的「更换」，再选想带的战技。" : "点锁住的槽位，查看解锁条件。",
        UI.inset + guideSlot * (spec.width + spec.gap), spec.top, spec.width, spec.height);
}

export function drawTacticCatalog(ctx: PanelContext, state: GameState, panel: Panel, available: number) {
    const box = ctx.modal(names.catalog, "", true, { width: UI.panelWidth, height: panelHeight(available) });
    backButton(ctx, box, panel);
    catalogRows(ctx, state, panel, box, LAYOUT.catalog.standalone);
}

export function drawTacticSwap(ctx: PanelContext, state: GameState, panel: Panel, available: number) {
    const slot = panel.index!, equipped = equippedTactics(state);
    if (slot < 0 || slot >= equipped.length) return;
    const id = equipped[slot], current = id ? tacticDefinition(id) : null, spec = LAYOUT.swap, blocked = actionHintsBlocked(ctx.game);
    const height = panelHeight(available), box = ctx.modal(`${current ? "更换" : "装配"}第 ${slot + 1} 槽`, "", true, { width: UI.panelWidth, height });
    backButton(ctx, box, panel);
    const card = new Laya.Sprite(); card.pos(UI.inset, spec.equippedTop).size(UI.contentWidth, spec.equippedHeight); box.addChild(card);
    card.name = "TacticCurrentEquipment";
    ctx.art.panel(card, "panel_header", card.width, card.height);
    roundMedallion(ctx, card, current?.icon ?? "icon_build_plus", 76, card.height / 2, 53, 75);
    compactLabel(ctx, card, "当前装备", 148, 31, 330, 37, 25, C.cream, true);
    compactLabel(ctx, card, current?.name ?? "空槽位", 148, 66, 310, 55, 41, C.cream, true);
    if (current && slot > 0) ctx.ui.button(card, "卸下", 456, (card.height - 65) / 2, 122, () => {
        if (ctx.current !== panel) return;
        panel.pendingTactic = { id: null, slot };
        ctx.send({ type: "TACTIC_CLEAR_SLOT", slot });
    }, C.muted, 65, !blocked);

    const visible = TACTICS.filter(t => t.id !== id && tacticRevealed(state, t.id));
    const learned = visible.filter(t => state.tactics.learned.includes(t.id));
    const groups = [
        { title: current ? "可直接换上" : "可直接装配", skills: learned.filter(t => !equipped.includes(t.id)), learned: true, elsewhere: false },
        { title: current ? "学习后可换上" : "学习后可装配", skills: visible.filter(t => !state.tactics.learned.includes(t.id)), learned: false, elsewhere: false },
        { title: "已装在其他槽", skills: learned.filter(t => equipped.includes(t.id)), learned: true, elsewhere: true }
    ].filter(group => group.skills.length);
    if (!groups.length) {
        compactLabel(ctx, box, "暂无可装配战技", UI.inset, spec.top + 20, UI.contentWidth, 60, 29, C.cream).align = "center";
        return;
    }
    const contentHeight = groups.reduce((n, group) => n + spec.group + group.skills.length * spec.step, 0);
    const list = new ScrollList(UI.contentWidth, height - spec.top - LAYOUT.bottom, contentHeight, panel.scroll, y => {
        if (panel.scroll !== y) for (const name of ["TacticSlotSpotlight", "TacticSlotGuide", "button:跳过"])
            box.getChildByName(name)?.destroy(true);
        panel.scroll = y;
    });
    list.pos(UI.inset, spec.top); box.addChild(list);
    let y = 0, firstAction: number | undefined;
    const addRow = (skill: TacticDefinition, learned: boolean, elsewhere: boolean) => {
        const row = new Laya.Sprite(); row.name = `TacticChoice:${skill.id}`;
        row.pos(0, y).size(LAYOUT.width, spec.row); list.content.addChild(row);
        ctx.art.panel(row, elsewhere ? "panel_card_disabled" : "panel_card", LAYOUT.width, spec.row);
        ctx.ui.image(row, skill.icon, 12, 12, 82);
        compactLabel(ctx, row, skill.name, 105, 9, 256, 43, 30, C.ink, true);
        if (learned) compactLabel(ctx, row, skill.summary, 105, 53, 256, 37, 24, C.green);
        else ctx.ui.materialCosts(row, state, skill, 105, 52, 240, 40);
        if (elsewhere) {
            compactLabel(ctx, row, `已装第 ${equipped.indexOf(skill.id) + 1} 槽`, spec.buttonX, 24, spec.buttonW, 60, 25, C.muted).align = "center";
        } else {
            const canSelect = !blocked && tacticUnavailableReason(state, skill.id, learned ? "EQUIP" : "LEARN", slot) === null;
            const label = learned ? (current ? "换上" : "装配") : (current ? "学习并换上" : "学习并装配");
            ctx.ui.button(row, label, spec.buttonX, 18, spec.buttonW, () => {
                if (ctx.current !== panel) return;
                panel.pendingTactic = { id: skill.id, slot };
                ctx.send({ type: learned ? "TACTIC_EQUIP" : "TACTIC_LEARN", id: skill.id, slot });
            }, learned ? C.gold : C.green, spec.buttonH, canSelect);
            if (canSelect && firstAction === undefined) firstAction = y + 18;
        }
        y += spec.step;
    };
    for (const group of groups) {
        compactLabel(ctx, list.content, group.title, 2, y, LAYOUT.width, spec.group, 26, C.cream, true);
        y += spec.group;
        for (const skill of group.skills) addRow(skill, group.learned, group.elsewhere);
    }
    if (firstAction !== undefined && !ctx.guideSeen("tacticAction")) {
        const targetY = spec.top + firstAction - (panel.scroll ?? 0);
        if (targetY >= spec.top + LAYOUT.coach.padding && targetY + spec.buttonH + LAYOUT.coach.padding < height - LAYOUT.bottom - LAYOUT.coach.height)
            coach(ctx, box, "tacticAction", current ? "点右侧按钮，把战技换到当前槽。" : "点右侧按钮，把战技装进当前槽。",
                UI.inset + spec.buttonX, targetY, spec.buttonW, spec.buttonH);
    }
}
