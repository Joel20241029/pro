import { DAILY_TASKS, TaskKind } from "../../config/DailyTaskConfig";
import { tacticDefinition } from "../../config/TacticConfig";
import { DailyTask, activeDailyTasks, dailyTaskStatus } from "../../game/DailyTaskState";
import { ENEMIES } from "../../game/GameConfig";
import { GameState } from "../../game/GameState";
import { storageCapacity } from "../../game/Growth";
import { C, UI } from "../UiTheme";
import { PanelContext } from "./PanelContext";

/** Panel geometry follows the approved compact three-card design. All dimensions are logical pixels. */
const TASK_PANEL = { top: 168, cardHeight: 160, gap: 14, cardWidth: UI.contentWidth, footer: 76, emptyHeight: 120 };
const ORDER = { ready: 0, active: 1, full: 1, claimed: 2 } as const;

function taskTitle(task: DailyTask): string {
    const { kind, goal } = task;
    const titles: Record<TaskKind, string> = {
        win: `成功守住 ${goal} 波`, kills: `胜局累计击倒 ${goal} 只来敌`,
        gateHealth: `守住一夜且城门耐久至少 ${goal}%`, gateHits: `守住一夜且城门最多被撞 ${goal} 次`,
        enemyKind: task.enemy ? `胜局击倒 ${goal} 只${ENEMIES[task.enemy].name}` : "",
        enemyTypes: `一夜击倒 ${goal} 种小怪并守胜`, casts: `胜局累计发动 ${goal} 次战技`,
        equipped: task.tactic ? `发动一次「${tacticDefinition(task.tactic).name}」并守胜` : "",
        towersHit: `一夜有 ${goal} 座塔命中并守胜`, arrowHits: `箭楼命中 ${goal} 只来敌并守胜`,
        stoneSplash: `石塔一击命中 ${goal} 只来敌并守胜`, frostHits: `寒塔减速 ${goal} 只来敌并守胜`,
        food: `累计生产 ${goal} 粮`, wood: `累计生产 ${goal} 木`, both: `单夜生产 ${goal} 粮和 ${task.woodGoal} 木`,
        farmers: `单夜由 ${goal} 位村民耕作产粮`, loggers: `单夜由 ${goal} 位村民伐木产木`, rations: "单夜粮食产量足以支付口粮",
        towerBuild: "在空塔位建造一座塔", towerUpgrade: "升级一座防塔", farmUpgrade: "升级农田一次",
        loggingUpgrade: "升级伐木场一次", gateUpgrade: "加固城门一次", repair: "修复城门一次",
        houseBuild: "增建民居一次", housingUpgrade: "修缮民居一次", marriage: "安排一对村民成家",
        child: "迎接一个孩子", worker: "安排一位待安排村民耕作或伐木", operator: "为一座空岗防塔安排驻守"
    };
    return titles[kind];
}

export function drawDailyTaskPanel(ctx: PanelContext, s: GameState, claim: (task: DailyTask, date: string, icon: Laya.Sprite) => void) {
    const spec = TASK_PANEL, day = activeDailyTasks(s, ctx.game.taskDate);
    const tasks = (day?.tasks ?? []).map(task => ({ task, status: dailyTaskStatus(s, task) }))
        .sort((a, b) => ORDER[a.status] - ORDER[b.status]);
    const cards = tasks.length ? tasks.length * (spec.cardHeight + spec.gap) - spec.gap : spec.emptyHeight;
    const count = tasks.filter(t => t.status === "ready").length;
    const box = ctx.modal("每日任务", "", true, { width: UI.panelWidth, height: spec.top + cards + spec.footer },
        `每日最多 ${DAILY_TASKS.limit} 项，按当前村况安排。本地时间 00:00 刷新，未领取的旧奖励同时失效。`);
    ctx.ui.label(box, count ? `${count} 项奖励可领取` : `${tasks.filter(t => t.status === "claimed").length} / ${tasks.length} 项已领取`,
        36, 108, 596, 29, count ? C.timber : C.cream, true, 48).align = "center";

    if (!tasks.length)
        ctx.ui.label(box, "今天暂无可安排的任务", 34, spec.top + 30, spec.cardWidth, 28, C.cream, true, 60).align = "center";
    for (const [index, { task, status }] of tasks.entries()) {
        const card = new Laya.Sprite(); card.name = `DailyTask:${task.kind}`;
        card.pos(UI.inset, spec.top + index * (spec.cardHeight + spec.gap));
        ctx.art.panel(card, status === "claimed" ? "panel_card_disabled" : "panel_card", spec.cardWidth, spec.cardHeight); box.addChild(card);
        const title = ctx.ui.label(card, taskTitle(task), 22, 10, 556, 28, C.ink, true, 43);
        title.wordWrap = false; title.overflow = Laya.Text.SHRINK;
        const oneNight = task.kind === "gateHits" || task.kind === "gateHealth";
        const fraction = oneNight ? `${Number(task.progress === task.goal)}/1` : `${task.progress}/${task.goal}`;
        const progress = ctx.ui.label(card, fraction, 22, 54, 313, 25, C.green, true, 32);
        progress.name = "TaskProgress";
        progress.align = "right";
        card.graphics.drawRoundRect(22, 88, 313, 12, 6, 6, 6, 6, "#ddcda3");
        if (task.progress > 0) {
            const fill = 313 * task.progress / task.goal;
            const radius = Math.min(6, fill / 2);
            card.graphics.drawRoundRect(22, 88, fill, 12, radius, radius, radius, radius, "#70a137");
        }
        const icon = ctx.ui.iconValue(card, `icon_${task.material}`, `+${task.reward}`, 22, 105, 218, 42, C.timber, 30, "left");
        const label = status === "ready" ? "领取奖励" : status === "claimed" ? "已领取" : status === "full" ? "仓储不足" : "进行中";
        const claimable = status === "ready";
        ctx.ui.button(card, label, claimable ? 391 : 365, claimable ? 67 : 78, claimable ? 190 : 212,
            () => claim(task, day!.date, icon), claimable ? C.gold : C.muted, claimable ? 76 : 62, claimable);
        if (status === "full") {
            const missing = task.reward - (storageCapacity(s) - s[task.material]);
            const note = ctx.ui.label(card, `需腾出 ${missing} 格`, 157, 109, 194, 21, C.red, false, 33);
            note.name = "TaskStorageNote"; note.wordWrap = false; note.overflow = Laya.Text.SHRINK;
        }
    }
    ctx.ui.label(box, "每天 00:00 刷新", UI.inset, spec.top + cards + 19, spec.cardWidth, 24, C.cream, false, 38).align = "center";
}
