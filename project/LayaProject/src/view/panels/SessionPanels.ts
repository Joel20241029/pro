import { person } from "../../game/VillageRules";
import { GameState } from "../../game/GameState";
import { POLICIES, RULE, SEASONS, SKILLS } from "../../game/GameConfig";
import { season } from "../../game/WaveGenerator";
import { C, UI } from "../UiTheme";
import { dailyRationAmount } from "../../game/DailyRation";
import { PanelContext } from "./PanelContext";
import { coloredName } from "../ViewText";
import { drawTravelerPanel } from "./TravelerPanel";
export function drawBoot(ctx: PanelContext) {
    const b = ctx.game.boot;
    if (ctx.game.saves.pending) {
        drawPending(ctx);
        return;
    }
    if (b?.kind === "recover") {
        const buttonY = 242;
        const box = ctx.modal("发现一份可恢复进度", "另一份存档损坏。确认后从有效存档继续；原始记录不会被悄悄清除。", false,
            { width: 620, height: buttonY + UI.action.height + UI.action.bottom });
        ctx.ui.centerButton(box, `恢复第 ${b.state.day} 天的村落`, buttonY, () => ctx.game.recover(), C.gold, true, 370);
        return;
    }
    if (b?.kind === "incompatible") {
        const buttonY = 304;
        const box = ctx.modal("存档版本已变化", b.reason, false, { width: 620, height: buttonY + UI.action.height + UI.action.bottom });
        ctx.ui.label(box, "旧进度不能用于当前版本\n重新开村将从第一天开始", 34, 206, box.width - 68, 32, C.timber, true, 88).align = "center";
        ctx.ui.centerButton(box, "重新开村", buttonY, () => ctx.game.newVillage(true), C.gold);
        return;
    }
    if (b?.kind === "blocked") {
        const retryY = 229, resetY = 339;
        const box = ctx.modal("进度需要核对", b.reason, false,
            { width: 620, height: (b.canReset ? resetY : retryY) + UI.action.height + UI.action.bottom });
        ctx.ui.centerButton(box, "重新读取", retryY, () => ctx.game.retry(), C.gold);
        if (b.canReset)
            ctx.ui.centerButton(box, "放弃进度并开村", resetY, () => ctx.game.newVillage(true), C.red);
        return;
    }
    const box = ctx.modal("一处村落，代代相守", "白天经营村庄，夜晚守住城门。", false, undefined,
        "可安排村民耕作、驻塔、成家与照料孩子。孩子继承双亲之一的天赋，成年后可选专长。");
    ctx.ui.image(box, "icon_house", 239, 228, 190);
    ctx.ui.label(box, "先让村民成家，迎接孩子、安排照料。\n守住两夜，再为孩子选择一项专长。", 42, 450, 584, 30, C.green, true, 122).align = "center";
    ctx.ui.centerButton(box, "开始开村", 646, () => ctx.game.newVillage(), C.gold);
}
export function drawPending(ctx: PanelContext) {
    const width = 620, buttonY = 272;
    const box = ctx.modal("正在核对保存结果", "本次操作已冻结，重试会核对同一份进度，不会再扣资源或再次结算。", false,
        { width, height: buttonY + UI.action.height + UI.action.bottom });
    ctx.ui.label(box, ctx.game.error || "正在保存…", 40, 199, width - 80, 28, C.red, false, 64).align = "center";
    ctx.ui.centerButton(box, "重试保存", buttonY, () => ctx.game.retry(), C.gold);
}
function drawDawn(ctx: PanelContext, s: GameState, safeHeight: number) {
    const q = s.choices[0];
    if (!q)
        return;
    if (q.kind === "TRAVELER") {
        drawTravelerPanel(ctx, s, q.person, safeHeight);
        return;
    }
    const help = q.kind === "SKILL" ? "孩子成年后选定一项专长。专长会影响生产、照料或驻防表现。"
            : `村规持续 ${RULE.seasonDays} 天，换季后可以再选。绿色为提升，红色为代价。`;
    const box = ctx.modal("天亮了 · 新的一天", s.summary, false, undefined, help);
    const optionWidth = 500, optionHeight = 112;
    if (q.kind === "SKILL") {
        ctx.ui.label(box, `${coloredName(person(s, q.person))} 成年了\n选择一项专长：`, 34, 226, 600, 32, C.green, true, 104).align = "center";
        q.options.forEach((k, i) => ctx.ui.button(box, SKILLS[k].join("\n"), (box.width - optionWidth) / 2, 378 + i * 132,
            optionWidth, () => ctx.send({ type: "CHOOSE", value: k }), i === 0 ? C.gold : C.green, optionHeight));
    }
    else if (q.kind === "POLICY") {
        ctx.ui.label(box, `为${SEASONS[season(s.day)]}季定下村规\n持续 ${RULE.seasonDays} 天`, 34, 226, 600, 32, C.green, true, 104).align = "center";
        q.options.forEach((id, i) => drawPolicyOption(ctx, box, id, 378 + i * 132, optionWidth, optionHeight));
    }
}
/** 村规直接以定义的数值绘制，不另维护一份可能与实际效果不一致的说明。 */
function drawPolicyOption(ctx: PanelContext, box: Laya.Sprite, id: string, y: number, width: number, height: number) {
    const policy = POLICIES[id];
    const button = ctx.ui.button(box, policy.name, (box.width - width) / 2, y, width, () => ctx.send({ type: "CHOOSE", value: id }), C.muted, height);
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
        const w = (width - 40) / effects.length, x = 20 + i * w, color = (value! > 0) !== !!reduces ? C.green : C.red;
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
    const buttonHeight = 82;
    ctx.ui.centerButton(box, "重新开村", UI.panelHeight - buttonHeight - UI.action.bottom, () => ctx.open({ type: "restart" }), C.gold, true, 328, buttonHeight);
}
/** 保存、口粮和回前台先处理，随后是结算，再接失败、清晨或普通界面。 */
export function drawSessionPanel(ctx: PanelContext, s: GameState, safeHeight: number, drawResult?: () => boolean) {
    if (ctx.game.saves.pending)
        drawPending(ctx);
    else if (ctx.game.dailyRationDate !== null) {
        const amount = dailyRationAmount(s, ctx.game.dailyRationDate)!;
        const buttonY = 292, buttonHeight = 82;
        const box = ctx.modal("每日口粮", "", false, { width: 540, height: buttonY + buttonHeight + UI.action.bottom }, `本村每天可领一次。每日补给 ${RULE.dailyFood} 粮，放不下时按剩余仓储发放。`);
        ctx.ui.label(box, "本次到账", 34, 114, 472, 28, C.cream, true, 40).align = "center";
        ctx.ui.iconValue(box, "icon_food", `+${amount}`, 34, 160, 472, 61, amount ? C.cream : C.muted, 42);
        const detail = amount === 0 ? "仓储已满，确认后计为已领" : amount < RULE.dailyFood ? "按剩余仓储发放，今天只领一次" : "确认后入库，本村今日仅领一次";
        const note = ctx.ui.label(box, detail, 34, 234, 472, 28, C.muted, false, 48);
        note.align = "center";
        note.valign = "middle";
        ctx.ui.centerButton(box, ctx.game.pauses.has("WAIT_RESUME") ? "确认并继续" : "确认领取", buttonY, () => ctx.game.claimDailyRation(), C.gold, true, 292, buttonHeight);
    }
    else if (ctx.game.pauses.has("WAIT_RESUME")) {
        const buttonY = 202, buttonHeight = 82;
        const box = ctx.modal("欢迎回来", "村庄已暂停，欢迎回来。\n离开期间没有收益或损耗。", false, { width: 540, height: buttonY + buttonHeight + UI.action.bottom });
        ctx.ui.centerButton(box, "继续游戏", buttonY, () => { ctx.game.resume("WAIT_RESUME"); ctx.refresh(); }, C.gold, true, 286, buttonHeight);
    }
    else if (!ctx.game.pauses.has("BACKGROUND") && drawResult?.()) return;
    else if (s.phase === "GAME_OVER")
        drawGameOver(ctx, s);
    else if (s.phase === "DAWN")
        drawDawn(ctx, s, safeHeight);
    // 切后台只释放已打开的开放域；回前台点“继续游戏”后再请求授权与绘制。
    else if (ctx.current && !ctx.game.pauses.has("BACKGROUND"))
        ctx.draw(s, ctx.current);
}
