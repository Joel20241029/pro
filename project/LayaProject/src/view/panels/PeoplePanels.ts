import { PATROL } from "../../config/PatrolConfig";
import { JOB_NAMES, person, canMarry, birthUnavailableReason } from "../../game/VillageRules";
import { GameState, isElder, isWorkingAdult, Person } from "../../game/GameState";
import { RULE, TRAITS, TowerKind } from "../../game/GameConfig";
import { C, UI } from "../UiTheme";
import { ScrollList } from "../ScrollList";
import { Panel, PanelContext } from "./PanelContext";
import { amount, coloredName, reasonBesideCost } from "../ViewText";
import { orderPanelRows } from "./PanelListOrder";
import { recommendedPeople, WorkRole } from "../RoleRecommendations";
import { replayButtonPress } from "../ButtonFeedback";

/** 岗位标签复用名册和详情入口。只在当前面板保存筛选与排序。 */
const ROSTER_TABS: readonly { title: string; role?: WorkRole }[] =
    [{ title: "全部" }, { title: "耕作", role: "FARM" }, { title: "伐木", role: "LOGGING" }];

export function drawPeoplePanel(ctx: PanelContext, s: GameState, p: Panel) {
    const day = s.phase === "DAY";
    const towers = ctx.game.battle?.base.towers ?? s.towers;
    if (p.type === "people" || p.type === "history" || p.type === "partners" || p.type === "operators" || p.type === "workers") {
        let list: Person[] = s.people;
        const rosterTab = p.tab ?? 0;
        let role: WorkRole | TowerKind | undefined = p.type === "people" ? ROSTER_TABS[rosterTab].role : undefined;
        let currentOperator: string | null = null;
        let title = "村民名册", sub = `自动安排：天赋优先，先农田后伐木。\n待安排 ${s.people.filter(q => isWorkingAdult(q) && q.job === "WAITING").length} 人 · 养老 ${s.people.filter(isElder).length} 人（占住房）。`;
        if (p.type === "history") {
            list = s.history.slice().reverse();
            title = "村落家谱";
            sub = `累计诞生 ${s.legacy.births} 人，荣休 ${s.legacy.retirees} 人。珍藏 ${s.favorites.length}/20。`;
        }
        if (p.type === "partners") {
            list = s.people.filter(q => p.a ? canMarry(s, person(s, p.a), q) : s.people.some(other => canMarry(s, q, other)));
            title = p.a ? "选择另一半" : "选择成家村民";
            sub = "只列出可成家的成年单身男女，双方须未退休。\n直系亲属、兄弟姐妹不能成家。";
        }
        if (p.type === "operators") {
            list = s.people.filter(q => isWorkingAdult(q) && q.id !== s.patrol.captain);
            const tower = towers[p.index!];
            role = tower.kind ?? undefined; currentOperator = tower.operator;
            title = "安排驻塔";
            sub = "空位自动补人，已驻塔者可直接对调；队长不参与驻塔。\n夜间换人只影响本夜，重进恢复战前安排。";
        }
        if (p.type === "workers") {
            list = s.people.filter(q => isWorkingAdult(q) && q.job === p.job && q.id !== p.id);
            title = "选择替换的工人";
            sub = `${JOB_NAMES[p.job!]}岗位已满，选一位村民换岗。\n原工人有其他空岗会自动补位。`;
        }
        const suggestions = role && (day || p.type === "operators") ? recommendedPeople(list, role, towers) : [];
        const recommended = (q: Person) => suggestions.includes(q);
        const byRecommendation = !p.rowOrder && suggestions.length ? [...suggestions, ...list.filter(q => !recommended(q))] : list;
        if (p.type === "people" && role) list = orderPanelRows(p, byRecommendation.filter(isWorkingAdult), q => q.id, recommended);
        else if (p.type === "operators") {
            list = orderPanelRows(p, byRecommendation, q => q.id, q => q.id !== currentOperator);
        }
        const overview = p.type === "people" || p.type === "history" ? sub.slice(sub.lastIndexOf("\n") + 1) : "";
        const box = ctx.modal(title, overview, true, undefined, sub);
        if (p.type === "people") ROSTER_TABS.forEach(({ title }, i) => {
            const button = ctx.ui.button(box, title, UI.inset + 202 * i, 160, 190, () => {
                if (i === rosterTab) return;
                const tabs = p.rosterViews ?? (p.rosterViews = []);
                tabs[rosterTab] = { scroll: p.scroll, rowOrder: p.rowOrder };
                p.tab = i; p.scroll = tabs[i]?.scroll; p.rowOrder = tabs[i]?.rowOrder; p.tabFeedback = true;
                ctx.refresh();
            }, i === rosterTab ? C.gold : C.green, 54);
            if (i === rosterTab && p.tabFeedback) { replayButtonPress(button); delete p.tabFeedback; }
        });
        if (!list.length) {
            const message = p.type === "history" ? "家谱暂无记录\n村民寿终后会记入这里" : p.type === "partners" ? "暂无符合条件的单身男女\n可等待孩子成年或旅人加入" : p.type === "operators" ? "暂无成年且未退休的村民\n孩子成年或旅人加入后可驻塔" : "暂时没有符合条件的村民";
            const empty = ctx.ui.label(box, message, UI.inset, UI.panelHeight / 2 - 72, UI.contentWidth, 32, C.muted, false, 144);
            empty.name = "emptyState";
            empty.align = "center";
            empty.valign = "middle";
            return;
        }
        const rowHeight = UI.listHeight, rowStep = UI.listStep;
        const top = p.type === "people" ? 232 : overview ? 184 : 130;
        const rows = new ScrollList(UI.contentWidth, UI.panelHeight - top - UI.inset, Math.max(0, list.length * rowStep - (rowStep - rowHeight)), p.scroll, offset => p.scroll = offset);
        rows.pos(UI.inset, top);
        box.addChild(rows);
        rows.setVirtualRows(list.length, rowStep, (i, row) => {
            const q = list[i];
            const desc = `${coloredName(q, true)} · ${q.sex === "MALE" ? "男" : "女"} · ${q.traits.map(t => TRAITS[t][0]).join("、")}\n${p.type === "history" ? "已寿终 · 留念家谱" : isElder(q) ? `养老还剩 ${q.elderNights} 夜` : q.adult ? `${q.id === s.patrol.captain ? PATROL.role : JOB_NAMES[q.job]} · 距退休 ${q.nights} 夜` : `成长 ${q.growth}/${RULE.growNights} · 守夜后自然成长`}`;
            const portrait = ctx.art.portraitId(q, p.type === "history");
            const entry = ctx.ui.listItem(row, desc, portrait, 0, () => {
                if (p.type === "history")
                    ctx.open({ type: "ancestor", id: q.id });
                else if (p.type === "partners") {
                    if (p.a)
                        ctx.send({ type: "FAMILY", a: p.a, b: q.id }, false);
                    else
                        ctx.open({ type: "partners", a: q.id });
                }
                else if (p.type === "operators") {
                    if (day)
                        ctx.send({ type: "OPERATOR", index: p.index!, id: q.id }, false);
                    else if (ctx.game.reassign(p.index!, q.id))
                        ctx.close();
                }
                else if (p.type === "workers")
                    ctx.send({ type: "JOB", id: p.id!, job: p.job!, replace: q.id }, false);
                else
                    ctx.open({ type: "person", id: q.id });
            }, true, rowHeight);
            if (p.type === "history" && s.favorites.includes(q.id)) ctx.ui.personRibbon(entry, "tag_favorite", true);
            if (recommended(q)) ctx.ui.personRibbon(entry, "tag_recommended", true);
        });
        return;
    }
}
