import { nightRewardMultiplier } from "../../config/ShopConfig";
import { PATROL, PATROL_MODE } from "../../config/PatrolConfig";
import { HERO, SONGLEI } from "../../config/HeroConfig";
import { DELIVERY_HERO } from "../../config/DeliveryHeroConfig";
import { patrolCaptain } from "../../game/PatrolRules";
import { featureUnlocked } from "../../config/DailyTaskConfig";
import { tacticDefinition } from "../../config/TacticConfig";
import { ENEMIES, RULE } from "../../game/GameConfig";
import { GameState } from "../../game/GameState";
import { gateCapacity } from "../../game/Growth";
import { economy } from "../../game/VillageRules";
import { equippedTactics } from "../../game/Tactics";
import { ScrollList } from "../ScrollList";
import { C, UI } from "../UiTheme";
import { amount } from "../ViewText";
import { Panel, PanelContext } from "./PanelContext";
import { ResourceProgress } from "../ResourceProgress";
import { actionHintsBlocked } from "../ActionHints";
import { tacticActionReady } from "./TacticLoadoutPanels";
import { cardArt } from "./PanelCards";

/** 词缀沿用战斗配置，在备战首页和敌情窗显示。 */
const AFFIX_NAME = { NONE: "平常夜", FAST: "疾行来袭", STURDY: "坚韧来袭", GROUP: "结队来袭" } as const;
/** 备战视觉尺寸。短屏缩小内容窗口，启动操作和分包进度始终放在窗口下方。 */
const PREPARATION = { top: 115, overview: 150, supplies: 150, tactics: 138, patrol: 112, hero: 112, gap: 13, progress: 72, warning: 36 } as const;

function patrolPicture(ctx: PanelContext, parent: Laya.Sprite, rapid: boolean, x: number, y: number, size: number) {
    if (rapid) ctx.ui.image(parent, "patrol_rapid_gun", x, y, size, size);
    else {
        ctx.ui.image(parent, "patrol_walk_0", x, y + size * .08, size * .55, size * .84);
        ctx.ui.image(parent, "patrol_walk_shuffle_0", x + size * .45, y + size * .12, size * .55, size * .84);
    }
}

function drawNightDetails(ctx: PanelContext, s: GameState, p: Panel, available: number) {
    const wave = s.wave!, balance = economy(s);
    const counts = new Map<string, number>();
    for (const entry of wave.entries) counts.set(entry.kind, (counts.get(entry.kind) ?? 0) + 1);
    const enemies = Object.entries(ENEMIES).filter(([kind]) => counts.has(kind)).sort(([, a], [, b]) => Number(b.boss) - Number(a.boss));
    const listTop = 201, rowHeight = 148, balancesHeight = 158, footerGap = 18;
    const fixed = listTop + balancesHeight + footerGap + UI.action.bottom;
    const height = Math.min(available - UI.action.bottom, fixed + enemies.length * rowHeight);
    const listHeight = height - fixed;
    const box = ctx.modal("敌情与收支", "", true, { width: UI.panelWidth, height });
    if (p.back) ctx.ui.backButton(box, () => ctx.open(p.back!, true));
    const headline = new Laya.Sprite(); headline.pos(UI.inset, 111); box.addChild(headline);
    ctx.art.panel(headline, "panel_card", UI.contentWidth, 76);
    ctx.ui.image(headline, "icon_night_shield", 20, 8, 60);
    const heading = ctx.ui.label(headline, `${AFFIX_NAME[wave.affix]} · 来敌 ${amount(wave.entries.length, true)} 名`, 96, 8, 464, 31, C.ink, true, 60);
    heading.overflow = Laya.Text.SHRINK;
    const rows = new ScrollList(UI.contentWidth, listHeight, enemies.length * rowHeight, p.scroll, offset => p.scroll = offset);
    rows.pos(UI.inset, listTop); box.addChild(rows);
    rows.setVirtualRows(enemies.length, rowHeight, (i, row) => {
        const [kind, enemy] = enemies[i], width = UI.contentWidth - UI.scrollGutter;
        ctx.art.panel(row, "panel_card", width, rowHeight - 9);
        if (ctx.resources.ready("night")) cardArt(ctx, row, `${kind}_walk_00`, 12, 7, 126, 126, enemy.boss ? C.petal : C.paper);
        const label = ctx.ui.label(row, enemy.name, 154, 40, 393, 31, C.ink, true, 46);
        label.wordWrap = false; label.overflow = Laya.Text.SHRINK;
        const brief = ctx.ui.label(row, enemy.brief, 154, 87, 385, 25, C.muted, false, 38);
        brief.wordWrap = false; brief.overflow = Laya.Text.SHRINK;
        ctx.ui.label(row, `${enemy.boss ? "首领 " : ""}×${amount(counts.get(kind)!, true)}`, 154, 10, 385, 24, enemy.boss ? C.red : C.green, true, 31);
    });
    const balances = new Laya.Sprite(), balancesTop = listTop + listHeight + footerGap;
    balances.pos(UI.inset, balancesTop); box.addChild(balances);
    ctx.art.panel(balances, "panel_card", UI.contentWidth, balancesHeight);
    for (const [i, [name, food, wood]] of [
        ["今日产出", `+${amount(balance.food, true)}`, `+${amount(balance.wood, true)}`],
        ["口粮消耗", `−${amount(balance.rations, true)}`, ""],
        ["入夜后库存", amount(balance.endFood, true), amount(balance.endWood, true)]
    ].entries()) {
        const y = 12 + i * 45;
        ctx.ui.label(balances, name, 22, y, 160, 25, C.ink, false, 40);
        ctx.ui.iconValue(balances, "icon_food", food, 200, y, 160, 40, C.green, 26, "left");
        if (wood) ctx.ui.iconValue(balances, "icon_wood", wood, 386, y, 188, 40, C.timber, 26, "left");
    }
}

export function drawWavePanel(ctx: PanelContext, s: GameState, p: Panel, available: number) {
    if (p.type === "nightDetails") return drawNightDetails(ctx, s, p, available);
    const day = s.phase === "DAY", balance = economy(s), wave = s.wave!;
    const built = s.towers.filter(t => t.kind), staffed = built.filter(t => t.operator).length;
    const captain = patrolCaptain(s), rapid = s.patrol.mode === PATROL_MODE.rapid;
    const controls = rapid ? "按住城门枪架后拉，持续连发。" : "按住淡紫儿后拉，松手砸地。";
    if (p.type === "nightPatrolHelp") {
        const box = ctx.modal(rapid ? PATROL.rapid.name : PATROL.spin.name, "", true, { width: 540, height: 345 });
        if (p.back) ctx.ui.backButton(box, () => ctx.open(p.back!, true));
        patrolPicture(ctx, box, rapid, (box.width - 144) / 2, 109, 144);
        const text = ctx.ui.label(box, controls, UI.inset, 261, box.width - 2 * UI.inset, 29, C.ink, true, 50);
        text.align = "center"; text.valign = "middle";
        return;
    }
    const warnings = [
        balance.hungry ? `口粮不足 · 塔攻速降至 ${Math.round(RULE.hungerSpeed * 100)}%` : "",
        staffed < built.length ? `还有 ${built.length - staffed} 座塔无人驻守` : ""
    ].filter(Boolean);
    const loading = ctx.resources.states.night, preparing = !ctx.resources.ready("night"), failed = loading.phase === "FAILED";
    const v = PREPARATION, overviewHeight = v.overview + warnings.length * v.warning;
    const fullHeight = overviewHeight + v.supplies + v.tactics + v.patrol + v.hero + 4 * v.gap;
    const controlsHeight = UI.action.bottom + UI.action.pairHeight + 20 + (preparing ? v.progress : 0);
    const bodyHeight = Math.min(fullHeight, available - UI.action.bottom - controlsHeight - v.top);
    const height = v.top + bodyHeight + controlsHeight;
    const box = ctx.modal("守夜准备", "", true, { width: UI.panelWidth, height });
    const body = new ScrollList(UI.contentWidth, bodyHeight, fullHeight, p.scroll, offset => p.scroll = offset);
    const cardWidth = UI.contentWidth - UI.scrollGutter;
    body.pos(UI.inset, v.top); box.addChild(body);

    const threat = new Laya.Sprite(); body.content.addChild(threat);
    ctx.art.panel(threat, "panel_card", cardWidth, overviewHeight);
    ctx.ui.image(threat, "icon_night_shield", 20, 17, 112);
    ctx.ui.label(threat, `第 ${s.day} 夜 · ${AFFIX_NAME[wave.affix]}`, 151, 12, 405, 26, C.muted, false, 34);
    ctx.ui.label(threat, `来敌 ${amount(wave.entries.length, true)} 名`, 151, 46, 410, 40, C.ink, true, 54);
    ctx.ui.iconValue(threat, "icon_build", `${staffed}/${built.length} 已驻守`, 151, 103, 402, 36, C.ink, 26, "left");
    warnings.forEach((message, i) => {
        const warning = ctx.ui.label(threat, message, 23, v.overview - 3 + i * v.warning, cardWidth - 46, 24, C.red, true, v.warning);
        warning.overflow = Laya.Text.SHRINK;
    });

    const supplies = new Laya.Sprite(); supplies.y = overviewHeight + v.gap; body.content.addChild(supplies);
    ctx.art.panel(supplies, "panel_card", cardWidth, v.supplies);
    const entries = [s.rewardDie === undefined ? "今日产出" : `骰子产出 ×${nightRewardMultiplier(s.rewardDie)}`, "本夜口粮", "城门耐久"];
    entries.forEach((name, i) => ctx.ui.label(supplies, name, 22, 10 + 44 * i, 180, 26, C.ink, true, 40));
    ctx.ui.iconValue(supplies, "icon_wood", `+${amount(balance.wood, true)}`, 265, 10, 144, 40, C.timber, 27, "left");
    ctx.ui.iconValue(supplies, "icon_food", `+${amount(balance.food, true)}`, 417, 10, 144, 40, C.green, 27, "left");
    ctx.ui.iconValue(supplies, "icon_food", `−${amount(balance.rations, true)}`, 417, 54, 144, 40, C.timber, 27, "left");
    const gate = ctx.ui.label(supplies, `${amount(s.gate, true)}/${amount(gateCapacity(s), true)}`, 262, 98, 294, 27, C.ink, true, 40);
    gate.align = "right"; gate.wordWrap = false; gate.overflow = Laya.Text.SHRINK;

    const strip = new Laya.Sprite(); strip.y = supplies.y + v.supplies + v.gap; body.content.addChild(strip);
    ctx.art.panel(strip, "panel_card", cardWidth, v.tactics);
    ctx.ui.label(strip, "出战战技", 22, 8, 420, 25, C.muted, true, 32);
    const selected = equippedTactics(s).filter(id => id !== null).map(tacticDefinition), cell = 134;
    if (!selected.length) ctx.ui.label(strip, "未携带战技", 22, 49, 400, 31, C.ink, true, 52);
    for (const [i, tactic] of selected.entries()) {
        const x = 22 + i * cell, artSize = 56;
        ctx.ui.image(strip, tactic.icon, x + (cell - artSize) / 2, 41, artSize);
        const name = ctx.ui.label(strip, tactic.name, x, 96, cell, 25, C.ink, true, 30);
        name.align = "center";
        name.wordWrap = false; name.overflow = Laya.Text.SHRINK;
    }
    if (featureUnlocked(s.legacy.bestNight, "tactics")) {
        const blocked = actionHintsBlocked(ctx.game);
        const change = ctx.ui.button(strip, "更换", 445, 41, 116, () => ctx.open({ type: "tactics", back: p }), C.green, 56, day && !blocked);
        if (day && !blocked && tacticActionReady(s)) ctx.ui.actionBadge(change, "TacticActionHint");
    }
    const patrol = new Laya.Sprite(); patrol.y = strip.y + v.tactics + v.gap; body.content.addChild(patrol);
    ctx.art.panel(patrol, "panel_card", cardWidth, v.patrol);
    patrolPicture(ctx, patrol, rapid, 14, 7, 98);
    ctx.ui.label(patrol, "淡紫儿打法", 132, 17, 330, 25, C.muted, false, 31);
    ctx.ui.label(patrol, captain ? rapid ? PATROL.rapid.name : PATROL.spin.name : `${PATROL.role}待任命`,
        132, 49, 330, 32, captain ? C.ink : C.muted, true, 49);
    ctx.ui.button(patrol, "?", 499, 29, 61, () => ctx.open({ type: "nightPatrolHelp", back: p }), C.muted, 56);
    const hero = s.selectedHero === SONGLEI.actorId ? SONGLEI : s.selectedHero === DELIVERY_HERO.actorId ? DELIVERY_HERO : HERO;
    const heroRow = new Laya.Sprite();
    heroRow.y = patrol.y + v.patrol + v.gap; body.content.addChild(heroRow);
    ctx.art.panel(heroRow, "panel_card", cardWidth, v.hero);
    ctx.ui.image(heroRow, hero.portrait, 19, 10, 92);
    ctx.ui.label(heroRow, "出战英雄", 132, 17, 302, 25, C.muted, false, 31);
    const heroName = ctx.ui.label(heroRow, hero.name, 132, 49, 302, 32, C.ink, true, 49);
    heroName.overflow = Laya.Text.SHRINK;
    ctx.ui.button(heroRow, "更换", 445, 28, 116, () => ctx.open({ type: "heroCommittee", back: p }), C.green, 56, day);

    const buttonTop = height - UI.action.bottom - UI.action.pairHeight;
    if (preparing) {
        const progressCard = new Laya.Sprite(); progressCard.pos(UI.inset, buttonTop - v.progress); box.addChild(progressCard);
        progressCard.graphics.drawRoundRect(0, 0, cardWidth, 62, 13, 13, 13, 13, C.paper, C.trim, 2);
        const progress = new ResourceProgress("panel");
        progress.setWidth(cardWidth - 24);
        progress.pos(12, 0);
        progressCard.addChild(progress);
        progress.watch("正在准备守夜", loading);
    }
    ctx.ui.button(box, "敌情与收支", UI.inset + 20, buttonTop, 236,
        () => ctx.open({ type: "nightDetails", back: p }), C.muted, UI.action.pairHeight);
    ctx.ui.button(box, preparing && failed ? "重试准备守夜" : "开始守夜", UI.inset + 288, buttonTop, 290, () => {
        if (preparing) void ctx.resources.ensure("night");
        else ctx.send({ type: "NIGHT" }, false);
    }, C.gold, UI.action.pairHeight, day && (!preparing || failed));
}
