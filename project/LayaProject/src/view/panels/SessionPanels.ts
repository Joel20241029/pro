import { capacity, person } from "../../game/VillageRules";
import { GameState } from "../../game/GameState";
import { VILLAGER_QUALITY } from "../../config/VillagerQuality";
import { POLICIES, RULE, SEASONS, SKILLS, TRAITS } from "../../game/GameConfig";
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
        ctx.ui.button(box, "确认放弃旧进度，重新开村", 34, 540, 600, () => ctx.game.newVillage(true), C.gold, 80);
        return;
    }
    if (b?.kind === "blocked") {
        const box = ctx.modal("进度需要核对", b.reason, false);
        ctx.ui.button(box, "重新读取", 34, 490, 600, () => ctx.game.retry(), C.gold, 80);
        if (b.canReset)
            ctx.ui.button(box, "确认放弃损坏进度，重新开村", 34, 622, 600, () => ctx.game.newVillage(true), C.red, 80);
        return;
    }
    const box = ctx.modal("一处村落，代代相守", "白天经营村庄，夜晚守住城门。", false, undefined,
        "可安排村民耕作、驻塔、成家与照料孩子。孩子继承双亲之一的天赋，成年后可选专长。");
    ctx.ui.image(box, "icon_house", 239, 228, 190);
    ctx.ui.label(box, "先让村民成家，迎接孩子、安排照料。\n守住两夜，再为孩子选择一项专长。", 42, 450, 584, 30, C.green, true, 122).align = "center";
    ctx.ui.button(box, "开村 · 从这一代开始", 34, 646, 600, () => ctx.game.newVillage(), C.gold, 84);
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
    const help = q.kind === "SKILL" ? "孩子成年后选定一项专长。专长会影响生产、照料或驻防表现。"
        : q.kind === "TRAVELER" ? "有空余住房就能接纳旅人。谢绝后可在白天扩建民居，等待下一位旅人。"
            : `村规持续 ${RULE.seasonDays} 天，换季后可以再选。绿色为提升，红色为代价。`;
    const box = ctx.modal("天亮了 · 新的一天", s.summary, false, undefined, help);
    if (q.kind === "SKILL") {
        ctx.ui.label(box, `${coloredName(person(s, q.person))} 成年了\n选择一项专长：`, 34, 226, 600, 32, C.green, true, 104).align = "center";
        q.options.forEach((k, i) => ctx.ui.button(box, SKILLS[k].join("\n"), 34, 378 + i * 132, 600, () => ctx.send({ type: "CHOOSE", value: k }), i === 0 ? C.gold : C.green, 102));
    }
    else if (q.kind === "TRAVELER") {
        const quality = VILLAGER_QUALITY[q.person.quality], special = q.person.quality !== "COMMON";
        ctx.ui.image(box, ctx.art.portraitId(q.person), special ? 229 : 250, 200, special ? 210 : 168);
        ctx.ui.label(box, `${coloredName(q.person)} 希望加入村落\n天赋：${TRAITS[q.person.trait][0]}  ·  专长：${SKILLS[q.person.skill!][0]}\n民居 ${s.people.length}/${capacity(s)}`, 34, 408, 600, 30, C.green, true, 155).align = "center";
        if (special) {
            ctx.ui.label(box, `耕伐 +${Math.round((quality.production - 1) * 100)}% · 塔伤 +${Math.round((quality.damage - 1) * 100)}% · 劳作 ${quality.adultNights} 夜 · 养老 ${quality.elderNights} 夜`, 34, 548, 600, 24, C.timber, true, 38).align = "center";
            ctx.ui.iconValue(box, "icon_food", `照料 +${quality.careFood}`, 34, 585, 600, 34, C.cream, 24);
        }
        const full = s.people.length >= capacity(s);
        ctx.ui.button(box, full ? "住房已满，无法接纳" : "欢迎加入", 34, 626, 600, () => ctx.send({ type: "CHOOSE", value: "accept" }), C.gold, 78, !full);
        ctx.ui.button(box, !full ? "礼貌谢绝" : s.people.length >= RULE.populationCap ? "先谢绝，等待村中空出名额" : "先谢绝，白天增建民居", 34, 744, 600, () => ctx.send({ type: "CHOOSE", value: "decline" }), C.muted, 78);
    }
    else if (q.kind === "POLICY") {
        ctx.ui.label(box, `为${SEASONS[season(s.day)]}季定下村规\n持续 ${RULE.seasonDays} 天`, 34, 226, 600, 32, C.green, true, 104).align = "center";
        q.options.forEach((id, i) => drawPolicyOption(ctx, box, id, 378 + i * 132));
    }
}
/** 村规直接以定义的数值绘制，不另维护一份可能与实际效果不一致的说明。 */
function drawPolicyOption(ctx: PanelContext, box: Laya.Sprite, id: string, y: number) {
    const policy = POLICIES[id];
    const button = ctx.ui.button(box, policy.name, 34, y, 600, () => ctx.send({ type: "CHOOSE", value: id }), C.muted, 104);
    const face = button.getChildByName("buttonFace") as Laya.Sprite, name = face.getChildByName("buttonText") as Laya.Text;
    name.y = 8; name.height = 43;
    const effects = [
        { title: "产出", value: policy.food, icon: "icon_food" }, { title: "产出", value: policy.wood, icon: "icon_wood" },
        { title: "口粮", value: policy.ration, icon: "icon_food", reduces: true }, { title: "照料", value: policy.care, icon: "icon_food", absolute: true },
        { title: "攻速", value: policy.speed }, { title: "伤害", value: policy.damage }, { title: "射程", value: policy.range },
        { title: "箭楼攻速", value: policy.arrowSpeed }, { title: "石塔攻速", value: policy.stoneSpeed },
        { title: "石塔伤害", value: policy.stoneDamage }, { title: "减速", value: policy.slow },
        { title: "修门效果", value: policy.repair }, { title: "城门受伤", value: policy.gate, reduces: true }
    ].filter(entry => entry.value !== undefined);
    effects.forEach(({ title, value, icon, reduces, absolute }, i) => {
        const text = `${title} ${value! > 0 ? "+" : "−"}${Math.round(Math.abs(value!) * (absolute ? 1 : 100))}${absolute ? "" : "%"}`;
        const w = 560 / effects.length, x = 20 + i * w, color = (value! > 0) !== !!reduces ? C.green : C.red;
        if (icon) ctx.ui.iconValue(face, icon, text, x, 55, w, 36, color, 24);
        else ctx.ui.label(face, text, x, 55, w, 24, color, true, 36).align = "center";
    });
}
export function drawGameOver(ctx: PanelContext, s: GameState) {
    if (ctx.current?.type === "restart") {
        ctx.draw(s, ctx.current);
        return;
    }
    const box = ctx.modal("守夜失败", "城门被突破，本局结束。", false);
    ctx.ui.image(box, "icon_heart", 253, 226, 162);
    ctx.ui.label(box, s.summary, 34, 430, 600, 32, C.green, true, 140).align = "center";
    ctx.ui.label(box, `最长坚守 ${s.legacy.bestNight} 夜 · 累计出生 ${s.legacy.births} 人`, 34, 620, 600, 28, C.muted, false, 80).align = "center";
    ctx.ui.button(box, "重新开村", 170, 748, 328, () => ctx.open({ type: "restart" }), C.gold, 82);
}
/** 保存、口粮和回前台先处理，随后是结算，再接失败、清晨或普通界面。 */
export function drawSessionPanel(ctx: PanelContext, s: GameState, drawResult?: () => boolean) {
    if (ctx.game.saves.pending)
        drawPending(ctx);
    else if (ctx.game.dailyRationDate !== null) {
        const amount = dailyRationAmount(s, ctx.game.dailyRationDate)!;
        const box = ctx.modal("每日口粮", "", false, { width: 540, height: 382 }, `本村每天可领一次。每日补给 ${RULE.dailyFood} 粮，放不下时按剩余仓储发放。`);
        ctx.ui.label(box, "本次到账", 34, 114, 472, 28, C.cream, true, 40).align = "center";
        ctx.ui.iconValue(box, "icon_food", `+${amount}`, 34, 160, 472, 61, amount ? C.cream : C.muted, 42);
        const detail = amount === 0 ? "仓储已满，确认后计为已领" : amount < RULE.dailyFood ? "按剩余仓储发放，今天只领一次" : "确认后入库，本村今日仅领一次";
        const note = ctx.ui.label(box, detail, 34, 238, 472, 28, C.muted, false, 64);
        note.align = "center";
        note.valign = "middle";
        ctx.ui.button(box, ctx.game.pauses.has("WAIT_RESUME") ? "确认并继续" : "确认领取", 130, 292, 280, () => ctx.game.claimDailyRation(), C.gold, 68);
    }
    else if (ctx.game.pauses.has("WAIT_RESUME")) {
        const box = ctx.modal("欢迎回来", "村庄已暂停，欢迎回来。\n离开期间没有收益或损耗。", false, { width: 540, height: 300 });
        ctx.ui.button(box, "继续游戏", 130, 202, 280, () => { ctx.game.resume("WAIT_RESUME"); ctx.refresh(); }, C.gold, 72);
    }
    else if (!ctx.game.pauses.has("BACKGROUND") && drawResult?.()) return;
    else if (s.phase === "GAME_OVER")
        drawGameOver(ctx, s);
    else if (s.phase === "DAWN")
        drawDawn(ctx, s);
    // 切后台只释放已打开的开放域；回前台点“继续游戏”后再请求授权与绘制。
    else if (ctx.current && !ctx.game.pauses.has("BACKGROUND"))
        ctx.draw(s, ctx.current);
}
