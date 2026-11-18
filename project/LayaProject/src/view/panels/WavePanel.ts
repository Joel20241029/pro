import { tacticDefinition } from "../../config/TacticConfig";
import { ENEMIES, PADS, RULE } from "../../game/GameConfig";
import { GameState } from "../../game/GameState";
import { enemyPower } from "../../game/Growth";
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
    const day = s.phase === "DAY", start = p.type === "start", e = economy(s), wave = s.wave!;
    const enemies = Object.entries(ENEMIES).filter(([kind]) => wave.entries.some(entry => entry.kind === kind));
    const enemyTop = start ? 236 : 169;
    const enemyRow = 52, enemyHeight = Math.min(start ? 2 : 4, enemies.length) * enemyRow;
    const summaryTop = enemyTop + 44 + enemyHeight + 14, summaryHeight = 236;
    const risk = [e.hungry ? `口粮不足，塔攻速降至 ${Math.round(RULE.hungerSpeed * 100)}%。` : "",
        !s.towers.some(t => t.operator) ? "无人驻塔，城门将直接承受进攻。" : ""].filter(Boolean);
    const riskTop = summaryTop + summaryHeight + 8, riskHeight = 36;
    const prepareTop = riskTop + risk.length * riskHeight;
    const state = ctx.resources.states.night, ready = ctx.resources.ready("night"), failed = state.phase === "FAILED";
    const preparing = start && !ready, buttonTop = prepareTop + (preparing ? 66 : 0) + 6;
    const box = ctx.modal(start ? "今夜，也要守住家" : "瞭望来报", "", true, { width: UI.panelWidth, height: buttonTop + 94 },
        "来敌数量按种类统计。敌军倍率是本夜的生命与撞门基准，词缀会再改变来敌。开始守夜时先结算生产与口粮，再按仓储保留库存。夜战中退出后重进，从本夜开头守起。");
    ctx.ui.label(box, `第 ${s.day} 夜 · 预计来敌 ${wave.entries.length} 名 · ${AFFIX_NAME[wave.affix]}`, 34, 108, 600, 29, C.cream, true, 48).align = "center";
    if (start) {
        const selected = equippedTactics(s).filter(id => id !== null).map(tacticDefinition);
        const strip = new Laya.Sprite(); strip.pos(34, 162);
        ctx.art.panel(strip, "panel_card", 600, 62); box.addChild(strip);
        const width = 440 / selected.length;
        for (const [i, tactic] of selected.entries()) {
            if (selected.length === 1) ctx.ui.iconValue(strip, tactic.icon, `携带 ${tactic.name}`, 18, 8, 438, 46, C.ink, 28, "left");
            else {
                const x = 18 + i * width;
                ctx.ui.image(strip, tactic.icon, x, 16, 30);
                const name = ctx.ui.label(strip, tactic.name, x + 35, 8, width - 40, 22, C.ink, true, 46);
                name.wordWrap = false; name.overflow = Laya.Text.SHRINK;
            }
        }
        ctx.ui.button(strip, "更换", 474, 7, 112, () => ctx.open({ type: "tactics", back: p }), C.green, 48, day);
    }
    ctx.ui.label(box, "敌人／数量", 38, enemyTop, 264, 27, C.cream, true, 39);
    const features = ctx.ui.label(box, "特点", 338, enemyTop, 290, 26, C.cream, false, 39);
    features.align = "right";
    const rows = new ScrollList(UI.contentWidth, enemyHeight, enemies.length * enemyRow, p.scroll, offset => p.scroll = offset);
    rows.pos(34, enemyTop + 44); box.addChild(rows);
    for (const [i, [kind, data]] of enemies.entries()) {
        const count = wave.entries.filter(e => e.kind === kind).length;
        ctx.ui.label(rows.content, `${data.name} ×${count}`, 4, i * enemyRow, 309, 28, data.boss ? C.red : C.ink, true, 42);
        ctx.ui.label(rows.content, `${data.boss ? "首领 · " : ""}${data.brief}`, 320, i * enemyRow, 260, 24, C.muted, false, 42).align = "right";
    }

    const summary = new Laya.Sprite(); summary.pos(34, summaryTop);
    ctx.art.panel(summary, "panel_card", 600, summaryHeight); box.addChild(summary);
    ctx.ui.label(summary, "守夜准备", 22, 9, 174, 29, C.ink, true, 40);
    ctx.ui.label(summary, `驻塔 ${s.towers.filter(t => t.operator).length}/${PADS.length} 座`, 334, 9, 244, 26, C.green, true, 40).align = "right";
    const balances = [
        ["今日产出", `+${amount(e.food, true)}`, `+${amount(e.wood, true)}`],
        ["口粮消耗", `−${amount(e.rations, true)}`, ""],
        ["入夜后库存", amount(e.endFood, true), amount(e.endWood, true)]
    ];
    balances.forEach(([name, food, wood], i) => {
        const y = 58 + i * 42, color = i === 1 && e.hungry ? C.red : C.ink;
        ctx.ui.label(summary, name, 22, y, 178, 25, C.muted, false, 40);
        ctx.ui.iconValue(summary, "icon_food", food, 208, y, 144, 40, color, 26, "left");
        if (wood) ctx.ui.iconValue(summary, "icon_wood", wood, 392, y, 183, 40, color, 26, "left");
    });
    const pressure = wave.ordinaryHealthPercent ? ` · 小怪生命另 +${wave.ordinaryHealthPercent - 100}%` : "";
    ctx.ui.label(summary, `生命／撞门基准 ×${enemyPower(s.day).toFixed(2)}${pressure}`, 22, 190, 556, 24, C.muted, false, 32);
    risk.forEach((message, i) => {
        ctx.ui.label(box, message, 34, riskTop + i * riskHeight, 600, 28, C.red, true, riskHeight).align = "center";
    });
    if (preparing) {
        const progress = new ResourceProgress("panel");
        progress.setWidth(600);
        progress.pos(34, prepareTop);
        box.addChild(progress);
        progress.watch("正在准备守夜", state);
        ctx.ui.button(box, failed ? "重试准备守夜" : "确认安排 · 开始守夜", 34, buttonTop, 600, () => { void ctx.resources.ensure("night"); }, C.gold, 72, day && failed);
    } else ctx.ui.button(box, start ? "确认安排 · 开始守夜" : "准备守夜", 34, buttonTop, 600,
        () => start ? ctx.send({ type: "NIGHT" }, false) : ctx.open({ type: "start" }), C.gold, 72, day);
}
