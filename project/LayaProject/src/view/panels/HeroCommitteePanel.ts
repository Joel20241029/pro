import { DELIVERY_HERO as DELIVERY } from "../../config/DeliveryHeroConfig";
import { HERO, SONGLEI } from "../../config/HeroConfig";
import type { GameState, HeroChoice } from "../../game/GameState";
import { deliveryDamage, deliveryRecruitmentReason } from "../../game/DeliverySortie";
import { heroStrikeDamage, songLeiRecruitmentReason } from "../../game/HeroSortie";
import { RULE } from "../../config/RuleConfig";
import { ScrollList } from "../ScrollList";
import { C, UI } from "../UiTheme";
import { amount } from "../ViewText";
import { actionHintsBlocked } from "../ActionHints";
import { HERO_COMMITTEE_FRAME } from "../config/VillageSceneConfig";
import { cardArt } from "./PanelCards";
import type { Panel, PanelContext } from "./PanelContext";

type RosterEntry = {
    id: HeroChoice; name: string; frame: string;
    skill: string; describe: (state: GameState) => string; lore: string;
    recruitment?: {
        unlocked: (state: GameState) => boolean;
        reason: (state: GameState) => string | null;
        cost: { wood: number; food: number };
        command: "RECRUIT_DELIVERY" | "RECRUIT_SONGLEI";
    };
};

const ROSTER: readonly RosterEntry[] = [
    { id: HERO.actorId, name: HERO.name, frame: `${HERO.spritePrefix}_down_idle`,
        skill: "双瓶连挥",
        describe: s => {
            const damage = heroStrikeDamage(s.day, s.wave?.rhythm);
            return [
                `每 ${HERO.duel.interval} 秒连打两瓶，瞄准同一敌人`,
                `单瓶伤害 ${amount(damage)}，对首领 ${amount(Math.floor(damage * HERO.duel.bossMultiplier))}`,
                `出战 ${HERO.extendedSortieSeconds} 秒，休息 ${HERO.restSeconds} 秒`
            ].join("\n");
        },
        lore: "文明里村首任村长。相传他两瓶相碰，「老谭儿」便顶着他的脸出阵。" },
    { id: DELIVERY.actorId, name: DELIVERY.name, frame: `${DELIVERY.spritePrefix}_down_idle`,
        skill: DELIVERY.attackName,
        describe: s => [
            `每 ${DELIVERY.solo.intervalSeconds} 秒一投，直击 ${amount(deliveryDamage(s.day, s.wave?.rhythm))}`,
            `最多溅射 ${DELIVERY.solo.splashTargets} 只，各受 ${Math.round(DELIVERY.solo.splashRatio * 100)}% 伤害`,
            `命中减速 ${Math.round(DELIVERY.patrol.slow * 100)}%，持续 ${DELIVERY.patrol.slowSeconds} 秒`,
            `下车出战 ${DELIVERY.solo.fightSeconds} 秒，回村休息 ${DELIVERY.solo.restSeconds} 秒`
        ].join("\n"),
        lore: DELIVERY.lore,
        recruitment: { unlocked: s => s.deliveryUnlocked === true, reason: deliveryRecruitmentReason,
            cost: DELIVERY.recruitment, command: "RECRUIT_DELIVERY" } },
    { id: SONGLEI.actorId, name: SONGLEI.name, frame: `${SONGLEI.spritePrefix}_down_idle`,
        skill: SONGLEI.attackName,
        describe: s => [
            `先打最靠近城门的怪物，麻痹后换目标`,
            `单棍伤害 ${amount(heroStrikeDamage(s.day, s.wave?.rhythm, true, true))}，每棍 ${SONGLEI.paralysis.chancePercent}% 概率麻痹`,
            `普通怪停步 ${SONGLEI.paralysis.seconds / RULE.battleSpeed} 秒，首领 ${SONGLEI.paralysis.bossSeconds / RULE.battleSpeed} 秒`
        ].join("\n"),
        lore: SONGLEI.lore,
        recruitment: { unlocked: s => s.songLeiUnlocked === true, reason: songLeiRecruitmentReason,
            cost: SONGLEI.recruitment, command: "RECRUIT_SONGLEI" } }
];

// 村委会图文卡保留全身图。展开资料共用列表滚动，派出和招募仍位于每张卡的上半部分。
const LAYOUT = { width: 668, inset: 25, listTop: 110, cardHeight: 254, artWidth: 260, artHeight: 220,
    gap: 14, detailHeight: 268, bottom: 24 } as const;
const contentWidth = LAYOUT.width - LAYOUT.inset * 2;

export function drawHeroCommittee(ctx: PanelContext, s: GameState, p: Panel, available: number) {
    const equipped = s.selectedHero ?? HERO.actorId;
    const fromMap = ROSTER.find(hero => hero.id === p.id);
    const expanded = fromMap ?? ROSTER.find(hero => hero.id === p.heroPreview);
    const roster = fromMap ? [fromMap] : ROSTER;
    const back = p.back ?? (fromMap ? { type: "heroCommittee", heroPreview: fromMap.id } : undefined);
    const contentHeight = roster.length * (LAYOUT.cardHeight + LAYOUT.gap) - LAYOUT.gap +
        (expanded ? LAYOUT.detailHeight : 0);
    const listHeight = Math.min(contentHeight, available - LAYOUT.listTop - LAYOUT.bottom * 2);
    const box = ctx.modal(HERO.committeeName, "", true,
        { width: LAYOUT.width, height: LAYOUT.listTop + listHeight + LAYOUT.bottom });
    if (back) ctx.ui.backButton(box, () => ctx.open(back, true), "heroCommittee:back");
    else ctx.ui.image(box, HERO_COMMITTEE_FRAME, 36, 29, 65, 60);

    const list = new ScrollList(contentWidth, listHeight, contentHeight, p.scroll, offset => p.scroll = offset);
    list.pos(LAYOUT.inset, LAYOUT.listTop); box.addChild(list);
    const rowWidth = contentWidth - UI.scrollGutter;
    const canAct = () => ctx.current === p && !p.pendingChoice && !actionHintsBlocked(ctx.game);
    let y = 0;
    for (const hero of roster) {
        const open = hero === expanded;
        const selected = hero.id === equipped;
        const recruit = hero.recruitment && !hero.recruitment.unlocked(s) ? hero.recruitment : undefined;
        const reason = recruit ? recruit.reason(s) : null;
        const card = new Laya.Sprite();
        card.name = `heroCommittee:${hero.id}`;
        const height = LAYOUT.cardHeight + (open ? LAYOUT.detailHeight : 0);
        card.pos(0, y).size(rowWidth, height);
        list.content.addChild(card);
        ctx.art.panel(card, "panel_card", rowWidth, height);

        cardArt(ctx, card, hero.frame, 12, 17, LAYOUT.artWidth, LAYOUT.artHeight);
        const textX = LAYOUT.artWidth + 26, textWidth = rowWidth - textX - 15;
        const name = ctx.ui.label(card, hero.name, textX, 21, textWidth, 36, C.ink, true, 49);
        name.wordWrap = false; name.overflow = Laya.Text.SHRINK;
        ctx.ui.label(card, hero.skill, textX, 73, textWidth, 26, C.status, true, 35);
        if (recruit) {
            ctx.ui.label(card, reason ?? "可招募", textX, 109, textWidth, 25, reason ? C.muted : C.green, true, 38);
            ctx.ui.materialCosts(card, s, recruit.cost, textX, 145, textWidth, 34);
        } else if (selected) {
            ctx.ui.iconValue(card, "icon_night_shield", "今晚出战", textX, 115, textWidth, 46, C.green, 28, "left");
        }

        if (!fromMap) {
            const top = y;
            ctx.ui.button(card, open ? "收起资料" : "展开资料", textX, 188, 138, () => {
                p.heroPreview = open ? undefined : hero.id;
                if (!open) {
                    const nextTop = top - (expanded && roster.indexOf(expanded) < roster.indexOf(hero) ? LAYOUT.detailHeight : 0);
                    p.scroll = Math.max(0, nextTop + LAYOUT.cardHeight + LAYOUT.detailHeight - listHeight);
                }
                ctx.refresh();
            }, C.muted, 52);
        }
        if (!selected) {
            const enabled = reason === null && !actionHintsBlocked(ctx.game);
            const action = ctx.ui.button(card, recruit ? "招募" : "派出", rowWidth - 155, 188, 140, () => {
                if (!canAct()) return;
                if (recruit) {
                    ctx.confirmSpend({ title: `招募${hero.name}`, actionText: "确认招募", image: hero.frame,
                        detail: "招募后可在村委会安排出战。", food: recruit.cost.food, wood: recruit.cost.wood,
                        showBadge: true }, () => ctx.send({ type: recruit.command }));
                } else {
                    if (p.back) p.pendingChoice = { accepted: next => next.selectedHero === hero.id, back: p.back };
                    ctx.send({ type: "SELECT_HERO", id: hero.id });
                }
            }, C.gold, 52, enabled);
            if (recruit && enabled) ctx.ui.actionBadge(action, "HeroRecruitHint");
        }

        if (open) {
            const top = LAYOUT.cardHeight;
            card.graphics.drawLine(20, top, rowWidth - 20, top, C.trim, 2);
            const skill = ctx.ui.label(card, hero.describe(s), 24, top + 14, rowWidth - 48, 25, C.muted, false, 132);
            skill.overflow = Laya.Text.SHRINK;
            ctx.ui.label(card, "村中传闻", 24, top + 148, rowWidth - 48, 26, C.ink, true, 36);
            const lore = ctx.ui.label(card, hero.lore, 24, top + 185, rowWidth - 48, 24, C.muted, false, 74);
            lore.overflow = Laya.Text.SHRINK;
        }
        y += height + LAYOUT.gap;
    }
}
