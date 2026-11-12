import { capacity, person } from "../../game/VillageRules";
import { GameState } from "../../game/GameState";
import { ELITE, POLICIES, RULE, SEASONS, SKILLS, TRAITS } from "../../game/GameConfig";
import { season } from "../../game/WaveGenerator";
import { C } from "../UiTheme";
import { dailyRationAmount } from "../../game/DailyRation";
import { PanelContext } from "./PanelContext";
import { coloredName } from "../ViewText";
export function drawBoot(ctx: PanelContext) {
    const b = ctx.game.boot;
    if (ctx.game.saves.pending) {
        drawPending(ctx);
        return;
    }
    if (b?.kind === "recover") {
        const box = ctx.modal("发现一份可恢复进度", "另一份存档损坏。确认后从有效存档继续；原始记录不会被悄悄清除。", false);
        ctx.ui.button(box, `恢复第 ${b.state.day} 天的村落`, 34, 540, 600, () => ctx.game.recover(), C.gold, 80);
        return;
    }
    if (b?.kind === "incompatible") {
        const box = ctx.modal("存档版本已变化", b.reason, false);
        ctx.ui.label(box, "旧进度不能用于当前版本\n重新开村将从第一天开始", 34, 320, 600, 32, C.timber, true, 110).align = "center";
        ctx.ui.button(box, "确认放弃旧进度，重新开村", 34, 540, 600, () => ctx.game.newVillage(undefined, true), C.gold, 80);
        return;
    }
    if (b?.kind === "blocked") {
        const box = ctx.modal("进度需要核对", b.reason, false);
        ctx.ui.button(box, "重新读取", 34, 490, 600, () => ctx.game.retry(), C.gold, 80);
        if (b.canReset)
            ctx.ui.button(box, "确认放弃损坏进度，重新开村", 34, 622, 600, () => ctx.game.newVillage(undefined, true), C.red, 80);
        return;
    }
    const box = ctx.modal("一处村落，代代相守", "白天安排耕作与家庭，夜晚守住城门。孩子继承双亲天赋，长大后接过守村的责任。", false);
    ctx.ui.image(box, "building_house_terracotta", 239, 228, 190);
    ctx.ui.label(box, "先让村民成家，迎接孩子、安排照料。\n守住两夜，再为孩子选择一项专长。", 42, 450, 584, 30, C.green, true, 122).align = "center";
    ctx.ui.button(box, "开村 · 从这一代开始", 34, 646, 600, () => ctx.game.newVillage(), C.gold, 84);
    ctx.ui.label(box, "单机存档 · 随时暂停 · 没有最后一关", 34, 758, 600, 28, C.muted).align = "center";
}
export function drawPending(ctx: PanelContext) {
    const box = ctx.modal("正在核对保存结果", "本次操作已冻结，重试会核对同一份进度，不会再扣资源或再次结算。", false);
    ctx.ui.label(box, ctx.game.error || "正在保存…", 40, 250, 588, 28, C.red, false, 270);
    ctx.ui.button(box, "核对 / 重试保存", 34, 650, 600, () => ctx.game.retry(), C.gold, 80);
}
export function drawDawn(ctx: PanelContext, s: GameState) {
    const q = s.choices[0];
    if (!q)
        return;
    const box = ctx.modal("天亮了 · 新的一天", s.summary, false);
    if (q.kind === "SKILL") {
        ctx.ui.label(box, `${coloredName(person(s, q.person))} 成年了\n选择一项专长：`, 34, 226, 600, 32, C.green, true, 104).align = "center";
        q.options.forEach((k, i) => ctx.ui.button(box, SKILLS[k].join("\n"), 34, 378 + i * 132, 600, () => ctx.send({ type: "CHOOSE", value: k }), i === 0 ? C.gold : C.green, 102));
    }
    else if (q.kind === "TRAVELER") {
        ctx.ui.image(box, ctx.art.frameId(`villager_${q.person.appearance}_walk`, 0, false), q.person.elite ? 229 : 250, 200, q.person.elite ? 210 : 168);
        ctx.ui.label(box, `${coloredName(q.person)} 希望加入村落\n天赋：${TRAITS[q.person.trait][0]}  ·  专长：${SKILLS[q.person.skill!][0]}\n民居 ${s.people.length}/${capacity(s)}`, 34, 408, 600, 30, C.green, true, 155).align = "center";
        if (q.person.elite)
            ctx.ui.label(box, `耕伐 +50% · 塔伤 +25% · 照料 +${ELITE.careFoodBonus} 粮\n劳作 ${ELITE.adultNights} 夜 · 养老 ${ELITE.elderNights} 夜`, 34, 550, 600, 28, C.timber, true, 68).align = "center";
        const full = s.people.length >= capacity(s);
        ctx.ui.button(box, full ? "住房已满，无法接纳" : "欢迎加入", 34, 626, 600, () => ctx.send({ type: "CHOOSE", value: "accept" }), C.gold, 78, !full);
        ctx.ui.button(box, !full ? "礼貌谢绝" : s.people.length >= RULE.populationCap ? "先谢绝，等待村中空出名额" : "先谢绝，白天增建民居", 34, 744, 600, () => ctx.send({ type: "CHOOSE", value: "decline" }), C.muted, 78);
    }
    else if (q.kind === "POLICY") {
        ctx.ui.label(box, `为${SEASONS[season(s.day)]}季定下村规\n持续 3 天`, 34, 226, 600, 32, C.green, true, 104).align = "center";
        q.options.forEach((id, i) => ctx.ui.button(box, `${POLICIES[id].name}\n${POLICIES[id].desc}`, 34, 378 + i * 132, 600, () => ctx.send({ type: "CHOOSE", value: id }), i === 0 ? C.gold : C.green, 102));
    }
    else {
        ctx.ui.label(box, "又是一年\n选择这一年的挑战", 34, 226, 600, 32, C.green, true, 104).align = "center";
        ["安居 · 0 档", "坚守 · 1 档", "奋战 · 2 档", "无畏 · 3 档"].forEach((v, i) => ctx.ui.button(box, v, 34, 366 + i * 110, 600, () => ctx.send({ type: "CHOOSE", value: String(i) }), i === s.tier ? C.gold : C.green, 82));
    }
}
export function drawGameOver(ctx: PanelContext, s: GameState) {
    if (ctx.current && ["restart", "inherit", "cleanStart"].includes(ctx.current.type)) {
        ctx.draw(s, ctx.current);
        return;
    }
    const box = ctx.modal("灯火未尽，传承不息", "城门被突破。此夜没有推进年龄与日期，村落的故事已记入传承。", false);
    ctx.ui.image(box, "building_hearth_lit", 253, 226, 162);
    ctx.ui.label(box, s.summary, 34, 430, 600, 32, C.green, true, 140).align = "center";
    ctx.ui.label(box, `最长坚守 ${s.legacy.bestNight} 夜 · 累计出生 ${s.legacy.births} 人`, 34, 620, 600, 28, C.muted, false, 80).align = "center";
    ctx.ui.button(box, "传承开村", 34, 748, 286, () => ctx.open({ type: "inherit" }), C.green, 82);
    ctx.ui.button(box, "纯净开始", 338, 748, 296, () => ctx.open({ type: "cleanStart" }), C.gold, 82);
}
/** 与旧 refresh 相同的面板优先级：保存、口粮、返回、失败、清晨、主动面板。 */
export function drawSessionPanel(ctx: PanelContext, s: GameState) {
    if (ctx.game.saves.pending)
        drawPending(ctx);
    else if (ctx.game.dailyRationDate !== null) {
        const amount = dailyRationAmount(s, ctx.game.dailyRationDate)!;
        const box = ctx.modal("每日口粮", `每日补给 ${RULE.dailyFood} 粮`, false, { width: 540, height: 402 });
        const reward = ctx.ui.label(box, `＋${amount} 粮`, 0, 168, 230, 42, amount ? C.green : C.muted, true, 64);
        reward.width = Math.ceil(reward.textWidth) + 4;
        const rewardLeft = (540 - 88 - 12 - reward.width) / 2;
        ctx.ui.image(box, "icon_food", rewardLeft, 156, 88);
        reward.x = rewardLeft + 100;
        const detail = amount === 0 ? "粮仓已满，本次到账 0 粮\n本村今日不再发放" : amount < RULE.dailyFood ? `仓储仅剩 ${amount}，本次入库 ${amount} 粮\n本村今日不再发放` : "确认后入库，本村今日仅领一次";
        const note = ctx.ui.label(box, detail, 34, 238, 472, 28, C.muted, false, 64);
        note.align = "center";
        note.valign = "middle";
        ctx.ui.button(box, ctx.game.pauses.has("WAIT_RESUME") ? "确认并继续" : "确认领取", 130, 308, 280, () => ctx.game.claimDailyRation(), C.gold, 72);
    }
    else if (ctx.game.pauses.has("WAIT_RESUME")) {
        const box = ctx.modal("欢迎回来", "村庄已暂停，欢迎回来。\n离开期间没有收益或损耗。", false, { width: 540, height: 300 });
        ctx.ui.button(box, "继续游戏", 130, 202, 280, () => { ctx.game.resume("WAIT_RESUME"); ctx.refresh(); }, C.gold, 72);
    }
    else if (s.phase === "GAME_OVER")
        drawGameOver(ctx, s);
    else if (s.phase === "DAWN")
        drawDawn(ctx, s);
    // 切后台只释放已打开的开放域；回前台点“继续游戏”后再请求授权与绘制。
    else if (ctx.current && !ctx.game.pauses.has("BACKGROUND"))
        ctx.draw(s, ctx.current);
}
