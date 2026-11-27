import { laborSlots } from "../../game/Growth";
import { replacementOperators } from "../../game/VillageJobs";
import { PATROL } from "../../config/PatrolConfig";
import { JOB_NAMES, person, canMarry } from "../../game/VillageRules";
import { GameState, isElder, isAvailableAdult, isExploring, Person } from "../../game/GameState";
import { expeditionNightsLeft } from "../../game/Expedition";
import { RULE, TRAITS, TowerKind } from "../../game/GameConfig";
import { C, UI } from "../UiTheme";
import { ScrollList } from "../ScrollList";
import { Panel, PanelContext } from "./PanelContext";
import { coloredName } from "../ViewText";
import { orderPanelRows } from "./PanelListOrder";
import { recommendedPeople, WorkRole } from "../RoleRecommendations";
import { replayButtonPress } from "../ButtonFeedback";
import { actionHintsBlocked, jobVacancyHints, towerActionHints } from "../ActionHints";
import { cardArt } from "./PanelCards";
import { residentCardText, residentListItem, RESIDENT_ROW_HEIGHT } from "./ResidentCards";

/** 岗位标签复用名册和详情入口。只在当前面板保存筛选与排序。 */
const ROSTER_TABS: readonly { title: string; role?: WorkRole; filter?: "idle" | "elder" }[] =
    [{ title: "全部" }, { title: "耕作", role: "FARM" }, { title: "伐木", role: "LOGGING" },
        { title: "待安排", filter: "idle" }, { title: "养老", filter: "elder" }];
const HISTORY_TABS: typeof ROSTER_TABS = [{ title: "最近" }, { title: "珍藏" }];
const PEOPLE_ROW = { height: RESIDENT_ROW_HEIGHT, gap: 12, actionY: 103, actionH: 52, artRight: 177 } as const;

/** 岗位名册和个人详情按相同的白天岗位容量决定直接安排，或先选出被替换的村民。 */
export function dayJobChoice(ctx: PanelContext, s: GameState, job: WorkRole, back: Panel) {
    const full = s.people.filter(q => q.job === job).length >= laborSlots(job, job === "FARM" ? s.farm : s.logging);
    return {
        full,
        select(id: string) {
            if (full) ctx.open({ type: "workers", id, job, back });
            else ctx.send({ type: "JOB", id, job });
        }
    };
}

function drawJobRoster(ctx: PanelContext, box: Laya.Sprite, s: GameState, p: Panel, job: WorkRole, choices: Person[], vacancy: boolean) {
    const name = JOB_NAMES[job], workers = s.people.filter(q => q.job === job && isAvailableAdult(s, q));
    const day = s.phase === "DAY", width = UI.contentWidth - UI.scrollGutter;
    ctx.ui.label(box, `正在${name}`, UI.inset + 4, 184, width - 100, 30, C.ink, true, 46);
    ctx.ui.label(box, `${workers.length} 人`, UI.inset + width - 94, 184, 90, 26, C.muted, false, 46).align = "right";
    const top = 238, step = PEOPLE_ROW.height + PEOPLE_ROW.gap, candidateTop = workers.length * step, headerHeight = 54;
    const candidatesHeight = day ? headerHeight + (choices.length ? choices.length * step : 56) : 0;
    const rows = new ScrollList(UI.contentWidth, box.height - top - UI.inset, candidateTop + candidatesHeight, p.scroll, offset => p.scroll = offset);
    rows.pos(UI.inset, top); box.addChild(rows);
    rows.setVirtualRows(workers.length, step, (i, row) => {
        const q = workers[i], duty = q.id === s.patrol.captain ? `兼任${PATROL.role}` : `距退休 ${q.nights} 夜`;
        residentListItem(ctx, row, `${coloredName(q)}\n${duty}`, ctx.art.portraitId(q),
            () => ctx.open({ type: "person", id: q.id, back: p }), q.job);
    });
    if (!day) return;
    ctx.ui.label(rows.content, vacancy ? `可安排${name}` : `适合来${name}`, 4, candidateTop, width - 130, 30, C.ink, true, headerHeight);
    if (!choices.length) {
        ctx.ui.label(rows.content, "暂无适合的待安排村民", 10, candidateTop + headerHeight, width - 20, 25, C.muted, false, 48);
        return;
    }
    ctx.ui.label(rows.content, "待安排", width - 124, candidateTop, 120, 26, C.muted, false, headerHeight).align = "right";
    const choice = dayJobChoice(ctx, s, job, p);
    choices.forEach((q, i) => {
        const row = new Laya.Sprite(); row.name = `JobCandidate:${q.id}`;
        row.pos(0, candidateTop + headerHeight + i * step); rows.content.addChild(row);
        ctx.art.panel(row, "panel_card", width, PEOPLE_ROW.height);
        cardArt(ctx, row, ctx.art.portraitId(q), 14, 11, 144);
        residentCardText(ctx, row, coloredName(q), PEOPLE_ROW.artRight, 12, width - 199, 49, 31, C.ink, true);
        residentCardText(ctx, row, `${q.traits.map(t => TRAITS[t][0]).join(" · ")} · 还剩 ${q.nights} 夜`,
            PEOPLE_ROW.artRight, 61, width - 199, 35, 26, C.muted);
        const button = ctx.ui.button(row, vacancy ? "安排" : "调岗", width - 154, PEOPLE_ROW.actionY, 136,
            () => choice.select(q.id), C.gold, 58, !actionHintsBlocked(ctx.game));
        if (vacancy) ctx.ui.actionBadge(button, "JobVacancyActionHint");
    });
}

export function drawPeoplePanel(ctx: PanelContext, s: GameState, p: Panel, safeHeight?: number) {
    const day = s.phase === "DAY", blocked = actionHintsBlocked(ctx.game);
    const jobHints = p.type === "people" ? jobVacancyHints(s, blocked) : { FARM: false, LOGGING: false };
    const fillTower = p.type === "operators" && towerActionHints(s, p.index!, blocked).staff;
    const staffing = ctx.game.battle?.base ?? s, towers = staffing.towers;
    if (p.type === "people" || p.type === "history" || p.type === "partners" || p.type === "operators" || p.type === "workers") {
        let list: Person[] = s.people;
        const selecting = p.type === "operators" || p.type === "workers" || p.type === "partners" && !!p.a;
        const rosterTab = p.tab ?? 0;
        let role: WorkRole | TowerKind | undefined = p.type === "people" ? ROSTER_TABS[rosterTab]?.role : undefined;
        const filter = p.type === "people" ? ROSTER_TABS[rosterTab]?.filter : undefined;
        if (filter === "idle") list = s.people.filter(q => q.job === "WAITING" && isAvailableAdult(s, q));
        else if (filter === "elder") list = s.people.filter(isElder);
        let title = "村民名册", sub = `自动安排：天赋优先，先农田后伐木。\n待安排 ${s.people.filter(q => isAvailableAdult(s, q) && q.job === "WAITING").length} 人 · 养老 ${s.people.filter(isElder).length} 人`;
        if (p.type === "history") {
            list = s.history.slice().reverse();
            if (rosterTab === 1) list = list.filter(q => s.favorites.includes(q.id));
            else list = list.slice(0, RULE.historyCap);
            title = "村落家谱";
            sub = `累计诞生 ${s.legacy.births} 人，荣休 ${s.legacy.retirees} 人。珍藏 ${s.favorites.length}/${RULE.favoriteCap}。`;
        }
        if (p.type === "partners") {
            list = s.people.filter(q => p.a ? canMarry(s, person(s, p.a), q) : s.people.some(other => canMarry(s, q, other)));
            title = p.a ? "选择另一半" : "选择成家村民";
            sub = "只列出可成家的成年单身男女，双方须未退休。\n直系亲属、兄弟姐妹不能成家。";
        }
        if (p.type === "operators") {
            list = replacementOperators(staffing, p.index!);
            const tower = towers[p.index!];
            role = tower.kind ?? undefined;
            title = "选择驻塔村民";
            sub = "可选在村未退休的成年人。耕作和伐木照常。\n选中其他塔手会换防，调任队长会自动补任。\n守夜重进会恢复战前安排。";
        }
        if (p.type === "workers") {
            list = s.people.filter(q => isAvailableAdult(s, q) && q.job === p.job && q.id !== p.id);
            title = "选择替换的工人";
            sub = `${JOB_NAMES[p.job!]}岗位已满，选一位村民换岗。\n原工人有其他空岗会自动补位。`;
        }
        const suggestions = role && (day || p.type === "operators") ? recommendedPeople(list.filter(q => !isExploring(s, q.id)), role, towers) : [];
        const recommended = (q: Person) => suggestions.includes(q);
        if (p.type === "operators") {
            const ranked = [...suggestions, ...list.filter(q => !recommended(q))];
            list = orderPanelRows(p, ranked, q => q.id, q => q.id !== staffing.patrol.captain && !towers.some(t => t.operator === q.id));
        }
        // 名册可完整放下三张大卡，短屏保持滚动并收进安全区。
        const panelHeight = p.type === "people" ? 183 + 3 * (PEOPLE_ROW.height + PEOPLE_ROW.gap) - PEOPLE_ROW.gap + UI.inset : UI.panelHeight;
        const box = ctx.modal(title, "", true, { width: UI.panelWidth, height: Math.min(panelHeight, (safeHeight ?? UI.panelHeight + 48) - 48) }, sub);
        const previous = p.back;
        if (previous) ctx.ui.backButton(box, () => ctx.open(previous, true), p.type === "workers" ? "WorkersBack" : "PanelBack");
        if (p.type === "people" || p.type === "history") {
            const tabs = p.type === "people" ? ROSTER_TABS : HISTORY_TABS;
            const gap = 10, width = (UI.contentWidth - (tabs.length - 1) * gap) / tabs.length;
            tabs.forEach(({ title, role }, i) => {
                const button = ctx.ui.tabButton(box, title, UI.inset + (width + gap) * i, 114, width, 54, i === rosterTab, () => {
                    if (i === rosterTab) return;
                    const views = p.rosterViews ?? (p.rosterViews = []);
                    views[rosterTab] = { scroll: p.scroll, rowOrder: p.rowOrder };
                    p.tab = i; p.scroll = views[i]?.scroll; p.rowOrder = views[i]?.rowOrder; p.tabFeedback = true;
                    delete p.preview;
                    ctx.refresh();
                });
                if (i === rosterTab && p.tabFeedback) { replayButtonPress(button); delete p.tabFeedback; }
                if (role && i !== rosterTab && jobHints[role]) ctx.ui.actionBadge(button, "JobTabActionHint");
            });
        }
        if (p.type === "people" && (role === "FARM" || role === "LOGGING")) {
            const vacancy = jobHints[role];
            const next = vacancy && !suggestions.length ? s.people.find(q => q.job === "WAITING" && isAvailableAdult(s, q)) : undefined;
            // 没有特长候选时也能填空岗，保留名册推荐优先。
            drawJobRoster(ctx, box, s, p, role, next ? [next] : suggestions, vacancy);
            return;
        }
        if (!list.length) {
            const message = p.type === "history" ? rosterTab === 1 ? "暂无珍藏的先辈" : "村民寿终后会记入家谱" : p.type === "partners" ? "暂无符合条件的单身男女" : p.type === "operators" ? "暂无可接替的村民" : "暂时没有符合条件的村民";
            const empty = ctx.ui.label(box, message, UI.inset, box.height / 2 - 72, UI.contentWidth, 32, C.muted, false, 144);
            empty.name = "emptyState";
            empty.align = "center";
            empty.valign = "middle";
            return;
        }
        const { height: rowHeight, gap, actionY, actionH } = PEOPLE_ROW, rowStep = rowHeight + gap;
        const currentOperator = p.type === "operators" ? s.people.find(q => q.id === towers[p.index!].operator) : undefined;
        const context = p.type === "operators" ? `当前驻塔 · ${currentOperator?.name ?? "空位"}`
            : p.type === "workers" ? `${person(s, p.id!).name} 将接替所选村民`
            : p.type === "partners" && p.a ? `为 ${person(s, p.a).name} 选择另一半` : undefined;
        if (context) ctx.ui.label(box, context, UI.inset, 109, UI.contentWidth, 26, C.ink, true, 43);
        const top = p.type === "people" || p.type === "history" ? 183 : context ? 158 : 130;
        const listBottom = box.height - UI.inset;
        const expanded = p.type === "people" && day ? list.findIndex(q => q.id === p.preview && isAvailableAdult(s, q)) : -1;
        const rowCount = list.length + (expanded >= 0 ? 1 : 0);
        const rows = new ScrollList(UI.contentWidth, listBottom - top, rowCount * rowStep - gap, p.scroll, offset => p.scroll = offset);
        rows.pos(UI.inset, top);
        box.addChild(rows);
        const buttonRight = UI.contentWidth - UI.scrollGutter - 17;
        rows.setVirtualRows(rowCount, rowStep, (slot, row) => {
            if (expanded >= 0 && slot === expanded + 1) {
                const q = list[expanded];
                const canAct = () => ctx.current === p && p.preview === q.id && !actionHintsBlocked(ctx.game);
                const width = UI.contentWidth - UI.scrollGutter;
                row.name = "RosterAssignment:" + q.id;
                row.size(width, rowHeight);
                ctx.art.panel(row, "panel_card", width, rowHeight);
                residentCardText(ctx, row, "白天", 22, 19, 81, 54, 28, C.ink, true);
                residentCardText(ctx, row, "夜间", 22, 95, 81, 54, 28, C.ink, true);
                row.graphics.drawLine(21, rowHeight / 2, width - 21, rowHeight / 2, C.trim, 1);
                const jobs = (["FARM", "LOGGING"] as const).filter(job => job !== q.job);
                const vacantJob = q.job === "WAITING" && jobs.find(job => jobHints[job]);
                jobs.forEach((job, i) => {
                    const choice = dayJobChoice(ctx, s, job, p);
                    const title = choice.full ? `换到${JOB_NAMES[job]}` : JOB_NAMES[job];
                    const action = ctx.ui.button(row, title, 115 + i * 174, 19, 160, () => {
                        if (canAct()) choice.select(q.id);
                    }, C.gold, 54, !blocked);
                    if (job === vacantJob) ctx.ui.actionBadge(action, "JobPersonActionHint");
                });
                const built = towers.map((tower, index) => ({ tower, index })).filter(({ tower }) => tower.kind);
                if (!built.length) {
                    residentCardText(ctx, row, "暂无已建塔位", 115, 95, width - 137, 54, 26, C.muted);
                } else {
                    built.forEach(({ tower, index }, i) => {
                        const current = tower.operator === q.id;
                        ctx.ui.button(row, current ? `✓ ${index + 1}塔` : `${index + 1}塔`, 115 + i * 91, 95, 83, () => {
                            if (canAct()) ctx.send({ type: "OPERATOR", index, id: q.id });
                        }, current ? C.green : C.gold, 54, !blocked && !current);
                    });
                }
                return;
            }
            const i = expanded >= 0 && slot > expanded ? slot - 1 : slot;
            const q = list[i];
            const stationed = towers.findIndex(t => t.operator === q.id);
            const trait = q.traits.length ? TRAITS[q.traits[0]][0] : "";
            const activity = p.type === "operators"
                ? q.id === staffing.patrol.captain ? `${PATROL.role} · 调任后自动补位`
                    : stationed >= 0 ? `驻守第 ${stationed + 1} 塔 · 换防` : "夜间空闲 · 可直接派驻"
                : p.type === "history" ? `第 ${q.generation} 代先辈`
                : isExploring(s, q.id) ? `探索中 · 还剩 ${expeditionNightsLeft(s.expedition!)} 夜`
                    : isElder(q) ? `养老还剩 ${q.elderNights} 夜`
                        : !q.adult ? `成长 ${q.growth}/${RULE.growNights}`
                            : [trait, q.id === s.patrol.captain ? PATROL.role : JOB_NAMES[q.job], p.type === "people" ? "" : `剩 ${q.nights} 夜`].filter(Boolean).join(" · ");
            const desc = `${coloredName(q)}\n${activity}`;
            const portrait = ctx.art.portraitId(q, p.type === "history");
            const entry = residentListItem(ctx, row, desc, portrait, () => {
                if (p.type === "history")
                    ctx.open({ type: "ancestor", id: q.id, back: p });
                else if (selecting) {
                    if (p.preview !== q.id) { p.preview = q.id; ctx.refresh(); }
                }
                else if (p.type === "partners") ctx.open({ type: "partners", a: q.id, back: p });
                else
                    ctx.open({ type: "person", id: q.id, back: p });
            }, p.type === "people" ? q.job : undefined);
            if (selecting) ctx.ui.choiceState(entry, p.preview === q.id);
            if (recommended(q)) ctx.ui.personRibbon(entry, "tag_recommended", true);
            if (p.type === "history") {
                const favorite = s.favorites.includes(q.id);
                if (favorite) ctx.ui.personRibbon(entry, "tag_favorite", true);
                ctx.ui.button(row, favorite ? "取消珍藏" : "珍藏", buttonRight - 152, actionY, 152,
                    () => ctx.send({ type: "FAVORITE", id: q.id }), favorite ? C.muted : C.gold, actionH,
                    !blocked && (favorite || s.favorites.length < RULE.favoriteCap));
                return;
            }
            if (p.type === "people") {
                const copy = entry?.getChildByName("buttonFace")?.getChildByName("buttonText") as Laya.Text | undefined;
                if (copy) {
                    copy.y = 37;
                    if (day && isAvailableAdult(s, q)) copy.width -= 124;
                }
                if (!day || !isAvailableAdult(s, q)) return;
                const isOpen = i === expanded, actionWidth = 118;
                const button = ctx.ui.button(row, isOpen ? "收起" : "安排", buttonRight - actionWidth, (rowHeight - actionH) / 2, actionWidth, () => {
                    if (isOpen) delete p.preview;
                    else {
                        p.preview = q.id;
                        const anchor = (p.scroll ?? 0) - (expanded >= 0 && expanded < i ? rowStep : 0);
                        p.scroll = Math.max(0, anchor, (i + 1) * rowStep + rowHeight - rows.height);
                    }
                    ctx.refresh();
                }, isOpen ? C.muted : C.gold, actionH, !blocked);
                if (!isOpen && q.job === "WAITING" && (jobHints.FARM || jobHints.LOGGING))
                    ctx.ui.actionBadge(button, "JobPersonActionHint");
                return;
            }
            if (p.type === "partners" && !p.a) {
                const ready = !blocked && day && Number.isSafeInteger(s.nextFamily + 1);
                const button = ctx.ui.button(row, "选为第一位", buttonRight - 169, actionY, 169,
                    () => ctx.open({ type: "partners", a: q.id, back: p }), C.gold, actionH, ready);
                if (ready) ctx.ui.actionBadge(button, "MarriagePartnerHint");
                return;
            }
            if (!selecting) return;
            const verb = p.type === "operators" ? "选此人" : p.type === "workers" ? "确认换岗" : "确认成家";
            const target = p.type === "partners" ? previous?.back : previous;
            const ready = !blocked && (p.type !== "partners" || Number.isSafeInteger(s.nextFamily + 1));
            const button = ctx.ui.button(row, verb, buttonRight - 178, actionY, 178, () => {
                if (!ready || ctx.current !== p || p.pendingChoice || actionHintsBlocked(ctx.game)) return;
                if (p.type === "operators") {
                    const index = p.index!, back = target ?? { type: "tower", index };
                    if (day) {
                        p.pendingChoice = { accepted: next => next.towers[index]?.operator === q.id, back };
                        ctx.send({ type: "OPERATOR", index, id: q.id });
                    } else if (ctx.game.reassign(index, q.id)) ctx.open(back, true);
                } else if (p.type === "workers") {
                    const id = p.id!, job = p.job!;
                    p.pendingChoice = { accepted: next => next.people.some(q => q.id === id && q.job === job),
                        back: target ?? { type: "people" } };
                    ctx.send({ type: "JOB", id, job, replace: q.id });
                } else {
                    const a = p.a!, b = q.id;
                    p.pendingChoice = { accepted: next => next.families.some(f => f.partners.includes(a) && f.partners.includes(b)),
                        back: target ?? { type: "families", tab: 0 } };
                    ctx.send({ type: "FAMILY", a, b });
                }
            }, C.gold, actionH, ready);
            if (ready && (p.type === "partners" || fillTower && stationed < 0))
                ctx.ui.actionBadge(button, p.type === "partners" ? "MarriageActionHint" : "TowerFillCandidateHint");
        });
        return;
    }
}
