import { JOB_NAMES, person, canMarry, birthUnavailableReason } from "../../game/VillageRules";
import { GameState, isElder, isWorkingAdult, Person } from "../../game/GameState";
import { ELITE, RULE, SKILLS, TRAITS } from "../../game/GameConfig";
import { laborSlots } from "../../game/Growth";
import { C, UI } from "../UiTheme";
import { ScrollList } from "../ScrollList";
import { Panel, PanelContext } from "./PanelContext";
import { coloredName } from "../ViewText";
export function drawPeoplePanel(ctx: PanelContext, s: GameState, p: Panel) {
    const day = s.phase === "DAY";
    if (p.type === "people" || p.type === "history" || p.type === "partners" || p.type === "carers" || p.type === "operators" || p.type === "care" || p.type === "workers") {
        let list: Person[] = s.people;
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
            title = "选择孩子的照料者";
            sub = `选择后迎接孩子，消耗 ${RULE.birthCost} 粮。\n人选会转为照料，夜间仍可驻塔。`;
        }
        if (p.type === "operators") {
            list = s.people.filter(isWorkingAdult);
            title = "安排驻塔";
            sub = "空位自动补人，已驻塔者可直接对调。\n夜间换人只影响本夜，重进恢复战前安排。";
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
        const box = ctx.modal(title, sub);
        if (!list.length) {
            const message = p.type === "history" ? "家谱暂无记录\n村民寿终后会记入这里" : p.type === "partners" ? "暂无符合条件的单身男女\n可等待孩子成年或旅人加入" : p.type === "care" ? "暂无需要安排照料的孩子\n已有照料者的孩子不会重复列出" : p.type === "operators" ? "暂无成年且未退休的村民\n孩子成年或旅人加入后可驻塔" : "暂时没有符合条件的村民";
            const empty = ctx.ui.label(box, message, UI.inset, UI.panelHeight / 2 - 72, UI.contentWidth, 32, C.muted, false, 144);
            empty.name = "emptyState";
            empty.align = "center";
            empty.valign = "middle";
            return;
        }
        const rowHeight = p.type === "carers" ? UI.conditionRowHeight : UI.listHeight, rowStep = p.type === "carers" ? UI.conditionRowStep : UI.listStep;
        const rows = new ScrollList(UI.contentWidth, 590, Math.max(0, list.length * rowStep - (rowStep - rowHeight)), p.scroll, offset => p.scroll = offset);
        rows.pos(UI.inset, UI.listTop);
        box.addChild(rows);
        list.forEach((q, i) => {
            const reason = p.type === "carers" ? birthUnavailableReason(s, p.id!, q.id) : null;
            const desc = `${coloredName(q, reason === null)} · ${q.sex === "MALE" ? "男" : "女"} · ${TRAITS[q.trait][0]}\n${reason !== null ? reason : p.type === "history" ? (s.favorites.includes(q.id) ? "★ 珍藏的先辈" : "已寿终 · 留念家谱") : isElder(q) ? `养老还剩 ${q.elderNights} 夜` : q.adult ? `${JOB_NAMES[q.job]} · 距退休 ${q.nights} 夜` : `成长 ${q.growth}/${RULE.growNights} · 还需照料守夜`}`;
            const portrait = ctx.art.frameId(p.type === "history" || isElder(q) ? `villager_elder_${q.sex === "MALE" ? "male" : "female"}_idle` : q.adult ? `villager_${q.appearance}_walk` : q.growth === 0 ? "villager_baby_idle" : `villager_${q.sex === "MALE" ? "boy" : "girl"}_walk`, 0, false);
            ctx.ui.listItem(rows.content, desc, portrait, i * rowStep, () => {
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
        });
        return;
    }
    if (p.type === "person" || p.type === "ancestor") {
        const ancestor = p.type === "ancestor";
        const q = ancestor ? s.history.find(q => q.id === p.id)! : person(s, p.id!), parents = q.parents.map(id => { const parent = [...s.people, ...s.history].find(a => a.id === id); return parent?.name ? coloredName(parent) : "更早的家族成员"; });
        const box = ctx.modal(`${coloredName(q)} · 第 ${q.generation} 代`, `${TRAITS[q.trait].join("：")}\n${q.skill ? SKILLS[q.skill].join("：") : "成年后选择专长"}`);
        // 详情统一沿面板中轴排版；精英保留原放大尺寸，两种头像的中心高度一致。
        ctx.ui.image(box, ctx.art.frameId(ancestor || isElder(q) ? `villager_elder_${q.sex === "MALE" ? "male" : "female"}_idle` : q.adult ? `villager_${q.appearance}_walk` : q.growth === 0 ? "villager_baby_idle" : `villager_${q.sex === "MALE" ? "boy" : "girl"}_walk`, 0, false), (box.width - (q.elite ? 140 : 112)) / 2, q.elite ? 198 : 212, q.elite ? 140 : 112);
        const cared = s.people.some(a => a.careChild === q.id);
        ctx.ui.label(box, ancestor ? `已寿终 · 留念家谱\n来自第 ${q.id.split(":")[0]} 个村落` : isElder(q) ? `养老还剩 ${q.elderNights} 夜\n基础口粮 ${q.trait === "trait_frugal" ? 1 : RULE.adultRation} / 夜` : q.adult ? `距退休 ${q.nights} 夜\n当前${JOB_NAMES[q.job]}` : `还需照料并守住 ${RULE.growNights - q.growth} 夜\n${cared ? "已安排照料者" : "无人照料，成长暂停"}`, UI.inset, 348, UI.contentWidth, 30, C.green, true, 76).align = "center";
        ctx.ui.label(box, parents.length ? `双亲：${parents.join("、")}` : q.origin === "TRAVELER" ? "来历：路过村落的旅人" : "来历：第一代开村人", UI.inset, 424, UI.contentWidth, 28, C.muted, false, 44).align = "center";
        if (q.elite)
            ctx.ui.label(box, `耕伐 +50% · 塔伤 +25% · 照料 +${ELITE.careFoodBonus} 粮\n劳作 ${ELITE.adultNights} 夜 · 养老 ${ELITE.elderNights} 夜 · 口粮不变`, 34, 472, 600, 28, C.timber, true, 68).align = "center";
        if (ancestor) {
            const favorite = s.favorites.includes(q.id), full = s.favorites.length >= RULE.favoriteCap;
            ctx.ui.button(box, favorite ? "取消珍藏" : full ? `珍藏已满 ${RULE.favoriteCap} 位` : "珍藏这位先辈", 34, q.elite ? 556 : 510, 600, () => ctx.send({ type: "FAVORITE", id: q.id }), C.gold, 78, favorite || !full);
            ctx.ui.label(box, `珍藏最多 ${RULE.favoriteCap} 位，满了可先取消一位。\n普通家谱保留最近 ${RULE.historyCap} 位先辈。`, 34, q.elite ? 680 : 650, 600, 28, C.muted, false, 126).align = "center";
            return;
        }
        if (isElder(q)) {
            ctx.ui.label(box, "已卸下劳作，留在熟悉的村落养老。\n占用 1 个住房名额，口粮计入每日消耗。\n成功守夜才推进晚年，寿终后记入家谱。", 34, q.elite ? 556 : 504, 600, 29, C.timber, false, 180).align = "center";
            return;
        }
        if (isWorkingAdult(q) && day) {
            (["FARM", "LOGGING"] as const).forEach((job, i) => {
                const full = s.people.filter(a => a.job === job).length >= laborSlots(job, job === "FARM" ? s.farm : s.logging);
                const current = q.job === job;
                ctx.ui.button(box, `${JOB_NAMES[job]}${current ? " · 当前" : full ? " · 换人" : ""}`, 34 + i * 308, q.elite ? 556 : 484, 292, () => {
                    if (full && !current)
                        ctx.open({ type: "workers", id: q.id, job });
                    else
                        ctx.send({ type: "JOB", id: q.id, job });
                }, current ? C.gold : C.green, 78);
            });
            const needsCare = s.people.some(child => !child.adult && !s.people.some(a => a.careChild === child.id));
            ctx.ui.button(box, needsCare ? "安排照料孩子" : "暂无需要照料的孩子", 34, q.elite ? 648 : 596, 600, () => ctx.open({ type: "care", id: q.id }), C.green, 78, needsCare);
        }
        ctx.ui.label(box, !q.adult ? "孩子暂不参加工作和驻塔。\n请在成人详情中为他安排照料。" : !day ? "夜间可换驻塔人选，白天再调工作。\n白天岗位与夜间驻塔互不占用。" : "防塔会自动补人，点击地图防塔可换人。\n白天岗位与夜间驻塔互不占用。", 34, q.elite ? 744 : 716, 600, 28, C.muted, false, 96).align = "center";
        return;
    }
}
