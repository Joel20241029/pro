import { PATROL } from "../../config/PatrolConfig";
import { JOB_NAMES, person, canMarry, birthUnavailableReason } from "../../game/VillageRules";
import { GameState, isElder, isWorkingAdult, Person } from "../../game/GameState";
import { VILLAGER_QUALITY } from "../../config/VillagerQuality";
import { RULE, SKILLS, TRAITS, TowerKind } from "../../game/GameConfig";
import { laborSlots } from "../../game/Growth";
import { C, UI } from "../UiTheme";
import { ScrollList } from "../ScrollList";
import { Panel, PanelContext } from "./PanelContext";
import { amount, coloredName, reasonBesideCost } from "../ViewText";
import { personNeedsAttention } from "../ActionHints";
import { orderPanelRows } from "./PanelListOrder";
import { recommendedPeople, WorkRole } from "../RoleRecommendations";
import { replayButtonPress } from "../ButtonFeedback";

/** 岗位标签复用名册和详情入口。只在当前面板保存筛选与排序。 */
const ROSTER_TABS: readonly { title: string; role?: WorkRole }[] =
    [{ title: "全部" }, { title: "耕作", role: "FARM" }, { title: "伐木", role: "LOGGING" }, { title: "照料", role: "CARE" }];

export function drawPeoplePanel(ctx: PanelContext, s: GameState, p: Panel) {
    const day = s.phase === "DAY";
    const towers = ctx.game.battle?.base.towers ?? s.towers;
    const needsCarer = () => s.people.some(child => !child.adult && !s.people.some(a => a.careChild === child.id));
    if (p.type === "people" || p.type === "history" || p.type === "partners" || p.type === "carers" || p.type === "operators" || p.type === "care" || p.type === "workers") {
        let list: Person[] = s.people;
        const rosterTab = p.tab ?? 0;
        let role: WorkRole | TowerKind | undefined = p.type === "people" ? ROSTER_TABS[rosterTab].role : undefined;
        let currentOperator: string | null = null;
        let title = "村民名册", sub = `自动安排：专长优先，先农田后伐木。\n待安排 ${s.people.filter(q => isWorkingAdult(q) && q.job === "WAITING").length} 人 · 养老 ${s.people.filter(isElder).length} 人（占住房）。`;
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
        if (p.type === "carers") {
            list = s.people.filter(q => isWorkingAdult(q) && q.job !== "CARE");
            role = "CARE";
            title = "选择孩子的照料者";
            sub = "选定后迎接孩子。人选转为照料，夜间仍可驻塔。红字显示现有／所需。";
        }
        if (p.type === "operators") {
            list = s.people.filter(q => isWorkingAdult(q) && q.id !== s.patrol?.captain);
            const tower = towers[p.index!];
            role = tower.kind ?? undefined; currentOperator = tower.operator;
            title = "安排驻塔";
            sub = "空位自动补人，已驻塔者可直接对调；队长不参与驻塔。\n夜间换人只影响本夜，重进恢复战前安排。";
        }
        if (p.type === "care") {
            list = s.people.filter(q => !q.adult && !s.people.some(a => a.careChild === q.id));
            title = "选择照料的孩子";
            sub = `只列出无人照料的孩子。\n照料并成功守住 ${RULE.growNights} 夜后成年。`;
        }
        if (p.type === "workers") {
            list = s.people.filter(q => isWorkingAdult(q) && q.job === p.job && q.id !== p.id);
            title = "选择替换的工人";
            sub = `${JOB_NAMES[p.job!]}岗位已满，选一位村民换岗。\n原工人有其他空岗会自动补位。`;
        }
        const canRecommend = p.type === "operators" || day && (p.type === "carers" || role !== "CARE" || needsCarer());
        const suggestions = role && canRecommend ? recommendedPeople(p.type === "carers"
            ? list.filter(q => birthUnavailableReason(s, p.id!, q.id) === null) : list, role, towers) : [];
        const recommended = (q: Person) => suggestions.includes(q);
        const byRecommendation = !p.rowOrder && suggestions.length ? [...suggestions, ...list.filter(q => !recommended(q))] : list;
        if (p.type === "people" && role) list = orderPanelRows(p, byRecommendation.filter(isWorkingAdult), q => q.id, recommended);
        else if (p.type === "people") list = orderPanelRows(p, list, q => q.id, q => personNeedsAttention(s, q));
        else if (p.type === "carers") list = orderPanelRows(p, byRecommendation, q => q.id, q => birthUnavailableReason(s, p.id!, q.id) === null);
        else if (p.type === "operators") {
            list = orderPanelRows(p, byRecommendation, q => q.id, q => q.id !== currentOperator);
        }
        const overview = p.type === "people" || p.type === "history" ? sub.slice(sub.lastIndexOf("\n") + 1) : "";
        const box = ctx.modal(title, overview, true, undefined, sub);
        if (p.type === "people") ROSTER_TABS.forEach(({ title }, i) => {
            const button = ctx.ui.button(box, title, UI.inset + 152 * i, 160, 144, () => {
                if (i === rosterTab) return;
                const tabs = p.rosterViews ?? (p.rosterViews = []);
                tabs[rosterTab] = { scroll: p.scroll, rowOrder: p.rowOrder };
                p.tab = i; p.scroll = tabs[i]?.scroll; p.rowOrder = tabs[i]?.rowOrder; p.tabFeedback = true;
                ctx.refresh();
            }, i === rosterTab ? C.gold : C.green, 54);
            if (i === rosterTab && p.tabFeedback) { replayButtonPress(button); delete p.tabFeedback; }
        });
        if (p.type === "carers") {
            ctx.ui.label(box, "迎接所需", 36, 111, 220, 27, C.cream, true, 54).align = "right";
            ctx.ui.iconValue(box, "icon_food", s.food >= RULE.birthCost ? String(RULE.birthCost) : `${amount(s.food, true)}/${RULE.birthCost}`,
                277, 111, 328, 54, s.food >= RULE.birthCost ? C.cream : C.red, 31, "left");
        }
        if (!list.length) {
            const message = p.type === "history" ? "家谱暂无记录\n村民寿终后会记入这里" : p.type === "partners" ? "暂无符合条件的单身男女\n可等待孩子成年或旅人加入" : p.type === "care" ? "暂无需要安排照料的孩子\n已有照料者的孩子不会重复列出" : p.type === "operators" ? "暂无成年且未退休的村民\n孩子成年或旅人加入后可驻塔" : "暂时没有符合条件的村民";
            const empty = ctx.ui.label(box, message, UI.inset, UI.panelHeight / 2 - 72, UI.contentWidth, 32, C.muted, false, 144);
            empty.name = "emptyState";
            empty.align = "center";
            empty.valign = "middle";
            return;
        }
        const rowHeight = p.type === "carers" ? UI.conditionRowHeight : UI.listHeight, rowStep = p.type === "carers" ? UI.conditionRowStep : UI.listStep;
        const top = p.type === "people" ? 232 : overview || p.type === "carers" ? 184 : 130;
        const rows = new ScrollList(UI.contentWidth, UI.panelHeight - top - UI.inset, Math.max(0, list.length * rowStep - (rowStep - rowHeight)), p.scroll, offset => p.scroll = offset);
        rows.pos(UI.inset, top);
        box.addChild(rows);
        rows.setVirtualRows(list.length, rowStep, (i, row) => {
            const q = list[i];
            const reason = p.type === "carers" ? birthUnavailableReason(s, p.id!, q.id) : null;
            const desc = `${coloredName(q, reason === null)} · ${q.sex === "MALE" ? "男" : "女"} · ${TRAITS[q.trait][0]}\n${reason !== null ? reasonBesideCost(reason) ?? "费用不足，缺口见上方" : p.type === "history" ? "已寿终 · 留念家谱" : isElder(q) ? `养老还剩 ${q.elderNights} 夜` : q.adult ? `${q.id === s.patrol?.captain ? PATROL.role : JOB_NAMES[q.job]} · 距退休 ${q.nights} 夜` : `成长 ${q.growth}/${RULE.growNights} · 还需照料守夜`}`;
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
                else if (p.type === "carers")
                    ctx.send({ type: "BIRTH", family: p.id!, carer: q.id }, false);
                else if (p.type === "operators") {
                    if (day)
                        ctx.send({ type: "OPERATOR", index: p.index!, id: q.id }, false);
                    else if (ctx.game.reassign(p.index!, q.id))
                        ctx.close();
                }
                else if (p.type === "care")
                    ctx.send({ type: "JOB", id: p.id!, job: "CARE", child: q.id }, false);
                else if (p.type === "workers")
                    ctx.send({ type: "JOB", id: p.id!, job: p.job!, replace: q.id }, false);
                else
                    ctx.open({ type: "person", id: q.id });
            }, reason === null, rowHeight);
            if (p.type === "history" && s.favorites.includes(q.id)) ctx.ui.personRibbon(entry, "tag_favorite", true);
            if (recommended(q)) ctx.ui.personRibbon(entry, "tag_recommended", true);
        });
        return;
    }
    if (p.type === "person" || p.type === "ancestor") {
        const ancestor = p.type === "ancestor";
        const q = ancestor ? s.history.find(q => q.id === p.id)! : person(s, p.id!), parents = q.parents.map(id => { const parent = [...s.people, ...s.history].find(a => a.id === id); return parent?.name ? coloredName(parent) : "更早的家族成员"; });
        const help = ancestor ? `珍藏最多 ${RULE.favoriteCap} 位，满了可先取消一位。普通家谱保留最近 ${RULE.historyCap} 位先辈。`
            : isElder(q) ? "养老的人仍占一个住房名额，口粮计入全村。成功守夜推进晚年，寿终后记入家谱。"
                : !q.adult ? "孩子由成年村民照料，成功守夜才能成长。在成人详情中安排照料。"
                    : "白天工作与夜间岗位互不占用。夜间可驻塔，或在粉红色的回忆担任淡紫儿队长。";
        const box = ctx.modal(`${coloredName(q)} · 第 ${q.generation} 代`, `${TRAITS[q.trait].join("：")}\n${q.skill ? SKILLS[q.skill].join("：") : "成年后选择专长"}`, true, undefined, help);
        const quality = VILLAGER_QUALITY[q.quality], special = q.quality !== "COMMON";
        // 所有品质的头像共享中心。
        ctx.ui.image(box, ctx.art.portraitId(q, ancestor), (box.width - (special ? 140 : 112)) / 2, special ? 198 : 212, special ? 140 : 112);
        const cared = s.people.some(a => a.careChild === q.id);
        ctx.ui.label(box, ancestor ? `已寿终 · 留念家谱\n来自第 ${q.id.split(":")[0]} 个村落` : isElder(q) ? `养老还剩 ${q.elderNights} 夜` : q.adult ? `距退休 ${q.nights} 夜\n${JOB_NAMES[q.job]}${q.id === s.patrol?.captain ? ` · ${PATROL.role}` : ""}` : `还需照料并守住 ${RULE.growNights - q.growth} 夜\n${cared ? "已安排照料者" : "无人照料，成长暂停"}`, UI.inset, 348, UI.contentWidth, 30, C.green, true, isElder(q) ? 39 : 76).align = "center";
        if (isElder(q)) ctx.ui.iconValue(box, "icon_food", `基础口粮 ${q.trait === "trait_frugal" ? 1 : RULE.adultRation}/夜`, UI.inset, 387, UI.contentWidth, 40, C.cream);
        ctx.ui.label(box, parents.length ? `双亲：${parents.join("、")}` : q.origin === "TRAVELER" ? "来历：路过村落的旅人" : "来历：第一代开村人", UI.inset, 426, UI.contentWidth, 28, C.muted, false, 42).align = "center";
        if (special) {
            const productionBonus = Math.round((quality.production - 1) * 100);
            const damageBonus = Math.round((quality.damage - 1) * 100);
            const production = ctx.ui.label(box, `耕伐 +${productionBonus}% · 塔伤 +${damageBonus}%`, 34, 468, 294, 28, C.timber, true, 40);
            const lifespan = ctx.ui.label(box, `劳作 ${quality.adultNights} 夜 · 养老 ${quality.elderNights} 夜`, 340, 468, 294, 28, C.timber, true, 40);
            for (const text of [production, lifespan]) {
                text.align = "center"; text.wordWrap = false; text.overflow = Laya.Text.SHRINK;
            }
            ctx.ui.iconValue(box, "icon_food", `照料 +${quality.careFood}`, 34, 508, 600, 38, C.cream, 25);
        }
        if (ancestor) {
            const favorite = s.favorites.includes(q.id), full = s.favorites.length >= RULE.favoriteCap;
            const buttonY = special ? 556 : 510;
            if (!favorite && full) ctx.ui.label(box, `珍藏已满 ${RULE.favoriteCap} 位`, UI.inset, buttonY, UI.contentWidth, 27, C.muted, false, 40).align = "center";
            const button = ctx.ui.centerButton(box, favorite ? "取消珍藏" : "珍藏这位先辈", favorite || !full ? buttonY : buttonY + 44,
                () => ctx.send({ type: "FAVORITE", id: q.id }), C.gold, favorite || !full);
            if (favorite) ctx.ui.personRibbon(button, "tag_favorite");
            return;
        }
        if (isElder(q)) return;
        if (isWorkingAdult(q) && day) {
            (["FARM", "LOGGING"] as const).forEach((job, i) => {
                const full = s.people.filter(a => a.job === job).length >= laborSlots(job, job === "FARM" ? s.farm : s.logging);
                const current = q.job === job;
                const button = ctx.ui.button(box, `${JOB_NAMES[job]}${current ? " · 当前" : full ? " · 换人" : ""}`, 34 + i * 308, special ? 556 : 484, 292, () => {
                    if (full && !current)
                        ctx.open({ type: "workers", id: q.id, job });
                    else
                        ctx.send({ type: "JOB", id: q.id, job });
                }, current ? C.gold : C.green, 78);
                if (recommendedPeople(s.people, job, towers).includes(q)) ctx.ui.personRibbon(button, "tag_recommended");
            });
            const needsCare = needsCarer();
            const careY = special ? 648 : 596;
            if (!needsCare) ctx.ui.label(box, "暂无需要照料的孩子", UI.inset, careY - 4, UI.contentWidth, 26, C.muted, false, 36).align = "center";
            const care = ctx.ui.centerButton(box, "安排照料孩子", needsCare ? careY : careY + 32, () => ctx.open({ type: "care", id: q.id }), C.green, needsCare);
            if (needsCare && recommendedPeople(s.people, "CARE", towers).includes(q)) ctx.ui.personRibbon(care, "tag_recommended");
        }
        return;
    }
}
