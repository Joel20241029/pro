import { PATROL, PATROL_MODE } from "../../config/PatrolConfig";
import { patrolCaptain } from "../../game/PatrolRules";
import { featureUnlocked } from "../../config/DailyTaskConfig";
import { tacticDefinition } from "../../config/TacticConfig";
import { ENEMIES, RULE } from "../../game/GameConfig";
import { GameState } from "../../game/GameState";
import { economy } from "../../game/VillageRules";
import { equippedTactics } from "../../game/Tactics";
import { ScrollList } from "../ScrollList";
import { C, UI } from "../UiTheme";
import { amount } from "../ViewText";
import { Panel, PanelContext } from "./PanelContext";
import { ResourceProgress } from "../ResourceProgress";

/** 词缀在战前标题显示，用于解释本夜来敌的整体特性。 */
const AFFIX_NAME = { NONE: "平常夜", FAST: "疾行来袭", STURDY: "坚韧来袭", GROUP: "结队来袭" } as const;

export function drawWavePanel(ctx: PanelContext, s: GameState, p: Panel) {
    const day = s.phase === "DAY", e = economy(s), wave = s.wave!;
    const expanded = p.showNightDetails === true;
    const counts = new Map<string, number>();
    if (expanded) for (const entry of wave.entries) counts.set(entry.kind, (counts.get(entry.kind) ?? 0) + 1);
    const enemies = Object.entries(ENEMIES).filter(([kind]) => counts.has(kind));
    const built = s.towers.filter(t => t.kind), staffed = built.filter(t => t.operator).length;
    const captain = patrolCaptain(s), rapid = s.patrol.mode === PATROL_MODE.rapid;
    const warnings = [
        e.hungry ? `口粮不足，塔攻速降至 ${Math.round(RULE.hungerSpeed * 100)}%。` : "",
        staffed < built.length ? `还有 ${built.length - staffed} 座塔无人驻守` : ""
    ].filter(Boolean);
    const detailsTop = 424 + warnings.length * 40, enemyRow = 48;
    const enemyHeight = Math.min(3, enemies.length) * enemyRow;
    const prepareTop = detailsTop + (expanded ? enemyHeight + 165 : 10);
    const state = ctx.resources.states.night, preparing = !ctx.resources.ready("night"), failed = state.phase === "FAILED";
    const buttonTop = prepareTop + (preparing ? 66 : 0);
    const box = ctx.modal("守夜准备", "", true, { width: UI.panelWidth, height: buttonTop + UI.action.height + UI.action.bottom },
        "开战时结算今日产出和口粮。点「明细」可查看来敌种类、特点和入夜库存。");
    ctx.ui.label(box, `第 ${s.day} 夜 · ${AFFIX_NAME[wave.affix]} · 来敌 ${wave.entries.length} 名`, 48, 104, 418, 28, C.ink, true, 52);
    ctx.ui.button(box, expanded ? "收起明细" : "查看明细", 475, 105, 156, () => {
        p.showNightDetails = !expanded; ctx.refresh();
    }, C.muted, 52);
    const selected = equippedTactics(s).filter(id => id !== null).map(tacticDefinition);
    const strip = new Laya.Sprite(); strip.pos(34, 162);
    ctx.art.panel(strip, "panel_card", 600, 62); box.addChild(strip);
    const width = 440 / selected.length;
    for (const [i, tactic] of selected.entries()) {
        if (selected.length === 1 && tactic.effect !== "TIMED_BLAST" && tactic.effect !== "HAND_SPEED" && tactic.effect !== "DRAGON_POISON") ctx.ui.iconValue(strip, tactic.icon, `携带 ${tactic.name}`, 18, 8, 438, 46, C.ink, 28, "left");
        else {
            const x = 18 + i * width;
            ctx.ui.image(strip, tactic.icon, x, 16, 30);
            const name = ctx.ui.label(strip, selected.length === 1 ? `携带 ${tactic.name}` : tactic.name, x + 35, 8, width - 40, selected.length === 1 ? 28 : 22, C.ink, true, 46);
            name.wordWrap = false; name.overflow = Laya.Text.SHRINK;
        }
    }
    if (featureUnlocked(s.legacy.bestNight, "tactics"))
        ctx.ui.button(strip, "更换", 474, 7, 112, () => ctx.open({ type: "tactics", back: p }), C.green, 48, day);
    const patrol = new Laya.Sprite(); patrol.pos(34, 239); box.addChild(patrol);
    ctx.art.panel(patrol, "panel_card", 600, 157);
    ctx.ui.label(patrol, "今晚出战", 20, 10, 210, 28, C.ink, true, 40);
    ctx.ui.label(patrol, `${staffed}/${built.length} 已驻守`, 331, 10, 247, 26, C.muted, true, 40).align = "right";
    ctx.ui.label(patrol, rapid ? PATROL.rapid.name : PATROL.spin.name, 20, 56, 560, 30, C.ink, true, 42);
    const controls = rapid ? "按住城门枪架后拉，持续连发" : "按住淡紫儿后拉，松手砸地";
    ctx.ui.label(patrol, captain ? controls : `${PATROL.role}待任命`, 20, 104, 560, 25, captain ? C.green : C.muted, false, 40);
    warnings.forEach((text, i) => ctx.ui.label(box, text, 40, 404 + i * 40, 588, 26, C.red, true, 39).align = "center");
    if (expanded) {
        const rows = new ScrollList(UI.contentWidth, enemyHeight, enemies.length * enemyRow, p.scroll, offset => p.scroll = offset);
        rows.pos(34, detailsTop); box.addChild(rows);
        enemies.forEach(([kind, data], i) => {
            ctx.ui.label(rows.content, `${data.name} ×${counts.get(kind)}`, 12, i * enemyRow, 278, 26, data.boss ? C.red : C.ink, true, 42);
            ctx.ui.label(rows.content, `${data.boss ? "首领 · " : ""}${data.brief}`, 294, i * enemyRow, 284, 23, C.muted, false, 42).align = "right";
        });
        const balances = new Laya.Sprite(); balances.pos(34, detailsTop + enemyHeight + 6); box.addChild(balances);
        ctx.art.panel(balances, "panel_card", 600, 144);
        for (const [i, [name, food, wood]] of [
            ["今日产出", `+${amount(e.food, true)}`, `+${amount(e.wood, true)}`],
            ["口粮消耗", `−${amount(e.rations, true)}`, ""],
            ["入夜后库存", amount(e.endFood, true), amount(e.endWood, true)]
        ].entries()) {
            const y = 8 + i * 43;
            ctx.ui.label(balances, name, 22, y, 160, 25, C.ink, false, 40);
            ctx.ui.iconValue(balances, "icon_food", food, 200, y, 160, 40, C.green, 26, "left");
            if (wood) ctx.ui.iconValue(balances, "icon_wood", wood, 386, y, 188, 40, C.timber, 26, "left");
        }
    }
    if (preparing) {
        const progress = new ResourceProgress("panel");
        progress.setWidth(600);
        progress.pos(34, prepareTop);
        box.addChild(progress);
        progress.watch("正在准备守夜", state);
        ctx.ui.centerButton(box, failed ? "重试准备守夜" : "开始守夜", buttonTop, () => { void ctx.resources.ensure("night"); }, C.gold, day && failed);
    } else ctx.ui.centerButton(box, "开始守夜", buttonTop, () => ctx.send({ type: "NIGHT" }, false), C.gold, day);
}
