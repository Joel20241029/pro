import { DAILY_TASKS, TaskKind } from "../../config/DailyTaskConfig";
import { tacticDefinition } from "../../config/TacticConfig";
import { ITEMS } from "../../config/ShopConfig";
import { DailyTask, activeDailyTasks, dailyTaskStatus } from "../../game/DailyTaskState";
import { ENEMIES } from "../../game/GameConfig";
import { GameState } from "../../game/GameState";
import { actionHintsBlocked } from "../ActionHints";
import { ScrollList } from "../ScrollList";
import { C, UI } from "../UiTheme";
import { PanelContext } from "./PanelContext";

/** 三张任务卡的奖励图固定在左侧，条件和操作分栏。 */
const TASK_PANEL = { top: 119, cardHeight: 172, gap: 14, cardWidth: UI.contentWidth, footer: 76, emptyHeight: 120 };
const ORDER = { ready: 0, active: 1, claimed: 2 } as const;

function taskCopy(task: DailyTask): [title: string, condition?: string] {
    const { kind, goal } = task;
    const copy: Record<TaskKind, [string, string?]> = {
        win: [`守住 ${goal} 波`],
        kills: [`击倒 ${goal} 只来敌`, "胜局累计"],
        gateHealth: ["保卫城门", `守胜 · 耐久 ≥ ${goal}%`],
        gateHits: ["保卫城门", `守胜 · 撞门 ≤ ${goal} 次`],
        enemyKind: task.enemy ? [`击倒 ${goal} 只${ENEMIES[task.enemy].name}`, "胜局累计"] : [""],
        enemyTypes: [`击倒 ${goal} 种小怪`, "单夜守胜"],
        casts: [`发动 ${goal} 次战技`, "胜局累计"],
        equipped: task.tactic ? [tacticDefinition(task.tactic).name, "发动一次并守胜"] : [""],
        towersHit: [`${goal} 座塔命中`, "单夜守胜"],
        arrowHits: [`弓箭命中 ${goal} 只来敌`, "单夜守胜"],
        stoneSplash: [`石弹一击命中 ${goal} 只`, "单夜守胜"],
        frostHits: [`冰弹减速 ${goal} 只来敌`, "单夜守胜"],
        sewCoins: [`缝纫赚取 ${goal} 尔币`, "仅累计白天缝纫收入"],
        towerBuild: ["建造防塔", "在空塔位建造"], towerUpgrade: ["升级防塔"], factoryUpgrade: ["升级缝纫工坊"],
        gateUpgrade: ["加固城门"], repair: ["修复城门"],
        houseBuild: ["增建民居"], marriage: ["安排成家"],
        child: ["迎接孩子"], operator: ["安排驻塔", "填补空岗"]
    };
    return copy[kind];
}

export function drawDailyTaskPanel(ctx: PanelContext, s: GameState, claim: (task: DailyTask, date: string, icon: Laya.Sprite) => void,
    availableHeight = Infinity) {
    const spec = TASK_PANEL, day = activeDailyTasks(s, ctx.game.taskDate);
    const tasks = (day?.tasks ?? []).map(task => ({ task, status: dailyTaskStatus(task) }))
        .sort((a, b) => ORDER[a.status] - ORDER[b.status]);
    const cards = tasks.length ? tasks.length * (spec.cardHeight + spec.gap) - spec.gap : spec.emptyHeight;
    const height = Math.min(spec.top + cards + spec.footer, availableHeight);
    const viewport = height - spec.top - spec.footer;
    const canClaim = s.phase === "DAY" && !actionHintsBlocked(ctx.game);
    const box = ctx.modal("每日任务", "", true, { width: UI.panelWidth, height },
        `每日最多 ${DAILY_TASKS.limit} 项，道具奖励放入背包。本地时间 00:00 刷新，未领取的旧奖励失效。`);
    const panel = ctx.current, list = tasks.length && cards > viewport
        ? new ScrollList(spec.cardWidth + UI.scrollGutter, viewport, cards, panel?.scroll,
            offset => { if (panel) panel.scroll = offset; }) : null;
    if (list) {
        list.pos(UI.inset, spec.top);
        box.addChild(list);
    }

    if (!tasks.length)
        ctx.ui.label(box, "今天暂无可安排的任务", 34, spec.top + 30, spec.cardWidth, 28, C.cream, true, 60).align = "center";
    for (const [index, { task, status }] of tasks.entries()) {
        const card = new Laya.Sprite().size(spec.cardWidth, spec.cardHeight); card.name = `DailyTask:${task.kind}`;
        card.pos(list ? 0 : UI.inset, (list ? 0 : spec.top) + index * (spec.cardHeight + spec.gap));
        ctx.art.panel(card, status === "claimed" ? "panel_card_disabled" : "panel_card", spec.cardWidth, spec.cardHeight);
        (list?.content ?? box).addChild(card);
        const [name, requirement] = taskCopy(task);
        card.graphics.drawCircle(74, 70, 49, C.petalCenter);
        const reward = ITEMS[task.reward], icon = ctx.ui.image(card, reward.icon, 31, 27, 86);
        const rewardName = ctx.ui.label(card, reward.name, 10, 116, 128, 23, C.timber, true, 39);
        rewardName.align = "center"; rewardName.wordWrap = false; rewardName.overflow = Laya.Text.SHRINK;
        const title = ctx.ui.label(card, name, 140, 18, 288, 30, C.ink, true, 43);
        title.wordWrap = false; title.overflow = Laya.Text.SHRINK;
        if (requirement) {
            const condition = ctx.ui.label(card, requirement, 140, 59, 288, 24, C.muted, false, 35);
            condition.wordWrap = false; condition.overflow = Laya.Text.SHRINK;
        }
        const bar = { x: 140, y: 109, width: 266, height: 12 } as const;
        const oneNight = task.kind === "gateHits" || task.kind === "gateHealth";
        const fraction = oneNight ? `${Number(task.progress === task.goal)}/1` : `${task.progress}/${task.goal}`;
        const progress = ctx.ui.label(card, fraction, bar.x, bar.y + 15, bar.width, 25, C.green, true, 32);
        progress.name = "TaskProgress";
        card.graphics.drawRoundRect(bar.x, bar.y, bar.width, bar.height, 6, 6, 6, 6, C.paper);
        if (task.progress > 0) {
            const fill = bar.width * task.progress / task.goal;
            const radius = Math.min(6, fill / 2);
            card.graphics.drawRoundRect(bar.x, bar.y, fill, bar.height, radius, radius, radius, radius, C.fern);
        }
        const claimable = canClaim && status === "ready";
        if (claimable) {
            ctx.ui.button(card, "领取", 432, 56, 146,
                () => claim(task, day!.date, icon), C.gold, 64);
            ctx.ui.cellActionBadge(card, "ClaimRewardHint");
        } else if (status === "claimed")
            ctx.ui.label(card, "已领取", 420, 64, 160, 25, C.muted, false, 46).align = "center";
    }
    ctx.ui.label(box, "每天 00:00 刷新", UI.inset, height - spec.footer + 19, spec.cardWidth, 24, C.cream, false, 38).align = "center";
}
