import { ICE_AMMO_OFFER, itemDefinition, ITEMS, LIANG_ESSENCE, LIANG_INDULGENCE, nightRewardMultiplier, PATROL_RATION, SHOP_PRODUCTS, YUEXIU_DICE } from "../../config/ShopConfig";
import { featureUnlocked } from "../../config/DailyTaskConfig";
import { GameState, ownsTowerAmmo } from "../../game/GameState";
import type { GameSession } from "../../game/GameSession";
import { essenceTargets, patrolItemUnavailable, rewardDiceUnavailable } from "../../game/ShopRules";
import { actionHintsBlocked } from "../ActionHints";
import { replayButtonPress } from "../ButtonFeedback";
import { ScrollList } from "../ScrollList";
import { C, UI } from "../UiTheme";
import { coloredName } from "../ViewText";
import { Panel, PanelContext } from "./PanelContext";

/** 商城大图单列，背包三列。选择道具后在同一滚动区域显示操作。 */
const LAYOUT = { top: 121, gutter: 24, insetBottom: UI.action.bottom, shopHeight: 720, backpackHeight: 728,
    // 审稿图的商城标签和列表位置。缩短安全区时只压缩列表视口，可继续滚动。
    shopTabs: { top: 115, height: 60, gap: 14, icon: 38 }, shopListTop: 202,
    shopRow: 154, itemIcon: 122, bagTile: 166, bagIcon: 94, detail: 132, target: 112, rowGap: 12, emptyIcon: 112 } as const;

/** 按商城现有 ammo 字段分组。新打开的商城默认展示第一项消耗品。 */
const SHOP_TABS = [
    { title: "消耗品", icon: "icon_backpack", ammo: false },
    { title: "弹药", icon: "cannon_ammo_stone", ammo: true }
] as const;

type Product = typeof SHOP_PRODUCTS[number];
function backpackAction(state: GameState, id: string, hasEssenceTarget: boolean) {
    const patrolItem = id === PATROL_RATION.id || id === LIANG_INDULGENCE.id ? id : undefined;
    const essence = id === LIANG_ESSENCE.id, dice = id === YUEXIU_DICE.id;
    const reason = patrolItem ? patrolItemUnavailable(state, patrolItem)
        : dice ? rewardDiceUnavailable(state) : essence && !hasEssenceTarget ? "没有可使用的成年村民" : null;
    return { patrolItem, dice, reason, enabled: !!(patrolItem || essence || dice) && reason === null };
}

/** 道具增益和购买的 HUD、列表、确认按钮共用同一套当前可操作条件。 */
function purchaseReady(state: GameState, offer: Product, inventory: Record<string, number> | undefined) {
    return state.food >= offer.food && state.wood >= offer.wood && (offer.id === ICE_AMMO_OFFER.id
        ? !ownsTowerAmmo(state, "SLOW")
        : !!inventory && Number.isSafeInteger((inventory[offer.id] ?? 0) + 1));
}

/** 角标仅提示能提交的操作。读取失败时保留已打开界面原有的存档错误提示。 */
function backpackInventory(game: GameSession) {
    try { return game.villageItems.backpack().items; }
    catch { return undefined; }
}

export function itemActionHints(game: GameSession, state: GameState, blocked: boolean) {
    if (blocked || state.phase !== "DAY") return { backpack: false, shop: false };
    const bagOpen = featureUnlocked(state.legacy.bestNight, "backpack");
    const shopOpen = featureUnlocked(state.legacy.bestNight, "shop");
    const inventory = bagOpen || shopOpen ? backpackInventory(game) : undefined;
    const hasTarget = !!inventory?.[LIANG_ESSENCE.id] && essenceTargets(state).length > 0;
    const backpack = bagOpen && !!inventory && Object.keys(inventory).some(id => backpackAction(state, id, hasTarget).enabled);
    let shop = false;
    if (shopOpen && SHOP_PRODUCTS.some(offer => purchaseReady(state, offer, inventory))) {
        try { game.villageItems.shop(); shop = true; }
        catch { /* 商城列表已有读取错误的处理。 */ }
    }
    return { backpack, shop };
}

function message(ctx: PanelContext, box: Laya.Sprite, icon: string, text: string, top: number = LAYOUT.top) {
    const y = (top + box.height) / 2 - 94, size = LAYOUT.emptyIcon;
    ctx.ui.image(box, icon, (box.width - size) / 2, y, size);
    ctx.ui.label(box, text, UI.inset, y + size + 12, UI.contentWidth, 30, C.cream, true, 52).align = "center";
}

export function drawItemPanel(ctx: PanelContext, state: GameState, panel: Panel, availableHeight: number) {
    if (panel.type === "rewardDice") {
        drawRewardDice(ctx, state, panel);
        return;
    }
    if (panel.type === "itemOffer" || panel.type === "essenceConfirm") {
        drawItemAction(ctx, state, panel);
        return;
    }
    const shop = panel.type === "shop", title = shop ? "商城" : "背包";
    const spec = LAYOUT, height = Math.min(shop ? spec.shopHeight : spec.backpackHeight, availableHeight - spec.gutter * 2);
    const box = ctx.modal(title, "", true, { width: UI.panelWidth, height }, shop
        ? "按分类查看商品。点购买后可以查看商品效果和费用。" : "道具名称旁显示库存数量。精华需要选定村民并确认后使用。");
    const canOperate = state.phase === "DAY" && !actionHintsBlocked(ctx.game);
    if (shop) {
        try { ctx.game.villageItems.shop(); }
        catch { message(ctx, box, "icon_shop", "商城存档暂时无法读取"); return; }
        const inventory = canOperate ? backpackInventory(ctx.game) : undefined;
        const enabled = canOperate && featureUnlocked(state.legacy.bestNight, "shop");
        const purchasable = (product: Product) => enabled && purchaseReady(state, product, inventory);
        const tab = panel.tab ?? 0, tabs = spec.shopTabs, tabWidth = (UI.contentWidth - tabs.gap) / SHOP_TABS.length;
        const groups = SHOP_TABS.map(entry => SHOP_PRODUCTS.filter(product => (product.ammo !== undefined) === entry.ammo));
        SHOP_TABS.forEach(({ title, icon }, i) => {
            const button = ctx.ui.tabButton(box, title, UI.inset + i * (tabWidth + tabs.gap), tabs.top, tabWidth, tabs.height, tab === i, () => {
                if (tab === i) return;
                panel.tab = i;
                panel.tabFeedback = true;
                ctx.refresh();
            });
            ctx.ui.buttonIcon(button, icon, tabs.icon);
            if (i === tab && panel.tabFeedback) { replayButtonPress(button); delete panel.tabFeedback; }
            if (i !== tab && groups[i].some(purchasable)) ctx.ui.actionBadge(button, "ShopTabActionHint");
        });
        const products = groups[tab];
        if (!products.length) {
            const { title, icon } = SHOP_TABS[tab];
            message(ctx, box, icon, `暂无上架${title}`, spec.shopListTop);
            return;
        }
        const step = spec.shopRow + spec.rowGap;
        const scroll = panel.shopScroll ??= [];
        const list = new ScrollList(UI.contentWidth, height - spec.shopListTop - spec.insetBottom,
            products.length * step - spec.rowGap, scroll[tab], y => scroll[tab] = y);
        list.pos(UI.inset, spec.shopListTop); box.addChild(list);
        list.setVirtualRows(products.length, step, (index, row) => {
            const product = products[index], { id } = product, item = ITEMS[id], width = UI.contentWidth - UI.scrollGutter;
            const owned = id === ICE_AMMO_OFFER.id && ownsTowerAmmo(state, "SLOW");
            row.name = `ShopProduct:${id}`;
            row.size(width, spec.shopRow);
            ctx.art.panel(row, "panel_card", width, spec.shopRow);
            ctx.ui.image(row, item.icon, 15, (spec.shopRow - spec.itemIcon) / 2, spec.itemIcon);
            const textX = 152, actionWidth = 116, actionX = width - actionWidth - 17, textWidth = actionX - textX - 14;
            const title = ctx.ui.label(row, item.name, textX, 26, textWidth, 33, C.ink, true, 47);
            title.wordWrap = false; title.overflow = Laya.Text.SHRINK;
            if (!owned) ctx.ui.materialCosts(row, state, product.food ? product : { wood: product.wood }, textX, 81, textWidth, 39);
            else ctx.ui.label(row, "✓ 已拥有", textX, 81, textWidth, 24, C.green, true, 39);
            const buy = ctx.ui.button(row, owned ? "详情" : "购买", actionX, 49, actionWidth,
                () => ctx.open({ type: "itemOffer", id, back: panel }), owned ? C.muted : C.gold, 62);
            if (purchasable(product)) ctx.ui.actionBadge(buy, "ShopOfferHint");
        });
        return;
    }

    let entries: [string, number][];
    try { entries = Object.entries(ctx.game.villageItems.backpack().items); }
    catch { message(ctx, box, "icon_backpack", "背包存档暂时无法读取"); return; }
    if (!entries.length) { message(ctx, box, "icon_backpack", "背包里还没有道具"); return; }
    const columns = 3, width = UI.contentWidth - UI.scrollGutter, tileWidth = (width - (columns - 1) * spec.rowGap) / columns;
    const targets = entries.some(([id]) => id === LIANG_ESSENCE.id) ? essenceTargets(state).sort((a, b) => a.nights - b.nights) : [];
    const selected = entries.find(([id]) => id === panel.id);
    const recipients = selected?.[0] === LIANG_ESSENCE.id ? targets : [];
    const gridStep = spec.bagTile + spec.rowGap, targetStep = spec.target + spec.rowGap;
    const detailY = Math.ceil(entries.length / columns) * gridStep;
    const targetY = detailY + spec.detail + spec.rowGap + 40;
    const contentHeight = recipients.length ? targetY + recipients.length * targetStep - spec.rowGap
        : selected ? detailY + spec.detail : detailY - spec.rowGap;
    const viewport = height - spec.top - spec.insetBottom;
    const list = new ScrollList(UI.contentWidth, viewport, contentHeight, panel.scroll, y => panel.scroll = y);
    list.pos(UI.inset, spec.top); box.addChild(list);
    const tileText = (tile: Laya.Sprite, value: string, y: number, font: number, color = C.ink) => {
        const label = ctx.ui.label(tile, value, 8, y, tile.width - 16, font, color, true, 34);
        label.align = "center"; label.wordWrap = false; label.overflow = Laya.Text.SHRINK;
    };
    entries.forEach(([id, count], index) => {
        const item = itemDefinition(id), { enabled } = backpackAction(state, id, !!targets.length);
        const tile = list.content.addChild(new Laya.Sprite()).size(tileWidth, spec.bagTile)
            .pos(index % columns * (tileWidth + spec.rowGap), Math.floor(index / columns) * gridStep);
        tile.name = `BackpackItem:${id}`;
        ctx.art.panel(tile, "panel_card", tileWidth, spec.bagTile);
        ctx.ui.choiceState(tile, selected?.[0] === id);
        ctx.ui.image(tile, item?.icon ?? "icon_backpack", (tileWidth - spec.bagIcon) / 2, 11, spec.bagIcon);
        tileText(tile, item?.name ?? "待识别道具", 103, 26);
        tileText(tile, `×${count}`, 133, 24, C.muted);
        ctx.ui.bindClick(tile, () => {
            if (ctx.current !== panel || panel.id === id) return;
            panel.id = id;
            panel.scroll = Math.max(panel.scroll ?? 0, detailY + spec.detail - viewport);
            ctx.refresh();
        });
        if (canOperate && enabled && selected?.[0] !== id) {
            const badge = ctx.ui.actionBadge(tile, "BackpackUseHint");
            badge.pos(tileWidth - badge.width, 0);
        }
    });
    if (!selected) return;
    const [id] = selected, item = itemDefinition(id);
    const { patrolItem, dice, reason, enabled } = backpackAction(state, id, !!targets.length);
    const detail = list.content.addChild(new Laya.Sprite()).pos(0, detailY).size(width, spec.detail);
    detail.name = `BackpackDetail:${id}`;
    ctx.art.panel(detail, "panel_card", width, spec.detail);
    const copyWidth = patrolItem || dice ? width - 172 : width - 36;
    ctx.ui.label(detail, item?.name ?? "待识别道具", 18, 11, copyWidth, 30, C.ink, true, 40);
    const copy = ctx.ui.label(detail, item?.description ?? "库存已保留", 18, 51, copyWidth, 24, C.muted, false, reason ? 44 : 66);
    copy.wordWrap = true; copy.overflow = Laya.Text.SHRINK;
    const status = dice && state.rewardDie !== undefined ? `已掷出 ${state.rewardDie} 点 · 产出 ×${nightRewardMultiplier(state.rewardDie)}` : reason;
    if (status) ctx.ui.label(detail, status, 18, 96, copyWidth, 23, C.muted, false, 30);
    if ((patrolItem || dice) && item) {
        const use = ctx.ui.button(detail, "使用", width - 139, 36, 122, () => {
            if (ctx.current !== panel) return;
            if (dice) { ctx.open({ type: "rewardDice", back: panel }); return; }
            ctx.confirmSpend({ title: item.name, actionText: "确认使用", image: item.icon, detail: item.description, quantity: "×1" },
                () => { if (patrolItem && ctx.current === panel) ctx.game.usePatrolItem(patrolItem); });
        }, C.gold, 62, canOperate && enabled);
        if (canOperate && enabled) ctx.ui.actionBadge(use, "BackpackUseHint");
    }
    if (recipients.length) ctx.ui.label(list.content, "选择一位村民", 15, targetY - 40, width - 30, 26, C.ink, true, 40);
    recipients.forEach((target, index) => {
        const row = list.content.addChild(new Laya.Sprite()).pos(0, targetY + index * targetStep).size(width, spec.target);
        row.name = `EssenceTarget:${target.id}`;
        ctx.art.panel(row, "panel_card", width, spec.target);
        ctx.ui.image(row, ctx.art.portraitId(target), 11, 11, 90);
        const title = ctx.ui.label(row, coloredName(target), 113, 10, width - 265, 29, C.ink, true, 43);
        title.wordWrap = false; title.overflow = Laya.Text.SHRINK;
        const uses = LIANG_ESSENCE.maxUses - (target.retirementDelayUses ?? 0);
        const notes = ctx.ui.label(row, `距退休 ${target.nights} 夜 · 还可用 ${uses} 次`, 113, 59, width - 265, 24, C.muted, false, 37);
        notes.wordWrap = false; notes.overflow = Laya.Text.SHRINK;
        const use = ctx.ui.button(row, "使用", width - 139, 25, 122, () => {
            if (ctx.current === panel) ctx.open({ type: "essenceConfirm", id: target.id, back: panel });
        }, C.gold, 62, canOperate && enabled);
        if (canOperate && enabled) ctx.ui.actionBadge(use, "EssenceSelectHint");
    });
}

function drawItemAction(ctx: PanelContext, state: GameState, panel: Panel) {
    const canOperate = state.phase === "DAY" && !actionHintsBlocked(ctx.game);
    const back = () => panel.back ? ctx.open(panel.back, true) : ctx.close();
    const centered = (box: Laya.Sprite, text: string, y: number, font = 27, height = 45, bold = false) => {
        const label = ctx.ui.label(box, text, UI.inset, y, UI.contentWidth, font, C.ink, bold, height);
        label.align = "center";
    };
    if (panel.type === "itemOffer") {
        const offer = SHOP_PRODUCTS.find(product => product.id === panel.id);
        if (!offer) return;
        const item = ITEMS[offer.id];
        const box = ctx.modal(item.name, "", true, { width: UI.panelWidth, height: 648 },
            offer.lore ? `村中传闻\n${offer.lore}` : undefined);
        ctx.ui.backButton(box, back);
        const display = new Laya.Sprite();
        display.pos(UI.inset, 116); box.addChild(display);
        ctx.art.panel(display, "panel_card", UI.contentWidth, 267);
        display.graphics.drawEllipse(UI.contentWidth / 2, 133, 119, 109, "#ffe3ce", null, 0);
        ctx.ui.image(display, item.icon, (UI.contentWidth - 220) / 2, 23, 220);
        const patrol = offer.id === PATROL_RATION.id || offer.id === LIANG_INDULGENCE.id;
        const description = patrol ? `${item.description}\n使用突突队守夜时保留，等下次旋转生效。` : item.description;
        const copy = ctx.ui.label(box, description, UI.inset, 385, UI.contentWidth, 26, C.ink, true, 71);
        copy.align = "center"; copy.valign = "middle"; copy.overflow = Laya.Text.SHRINK;
        const cost = box.addChild(new Laya.Sprite()), footer = 536;
        cost.size(350, 56).pos((box.width - 350) / 2, footer - 74);
        ctx.art.panel(cost, "panel_card", cost.width, cost.height);
        ctx.ui.materialCosts(cost, state, offer, 46, 8, 280, 40);
        const owned = offer.id === ICE_AMMO_OFFER.id && ownsTowerAmmo(state, "SLOW");
        const affordable = state.food >= offer.food && state.wood >= offer.wood;
        let canBuy = false;
        if (canOperate && featureUnlocked(state.legacy.bestNight, "shop") && affordable && !owned) {
            try {
                ctx.game.villageItems.shop();
                canBuy = purchaseReady(state, offer, offer.id === ICE_AMMO_OFFER.id ? undefined : backpackInventory(ctx.game));
            } catch { /* 交易暂不可用，商城列表保留具体的读取错误。 */ }
        }
        if (owned) centered(box, "✓ 已拥有", footer, 27, 60, true);
        else ctx.ui.choiceAction(box, "确认购买", footer + 30, () => {
            if (ctx.current === panel) ctx.game.buyItem(offer.id);
        }, canBuy ? undefined : !affordable ? "粮木不足" : !canOperate ? "白天可购买" : "暂不可购买");
        return;
    }
    const targets = essenceTargets(state);
    const canUseEssence = canOperate && !!backpackInventory(ctx.game)?.[LIANG_ESSENCE.id];
    const target = targets.find(p => p.id === panel.id);
    const box = ctx.modal("确认使用", "", false, { width: UI.panelWidth, height: 454 });
    if (target) {
        ctx.ui.image(box, ctx.art.portraitId(target), (box.width - 104) / 2, 110, 104);
        centered(box, `给${target.name}使用「靓哥的精华」？`, 222, 29, 45, true);
        centered(box, `随机延后退休 ${LIANG_ESSENCE.minNights}–${LIANG_ESSENCE.maxNights} 夜`, 268);
        centered(box, `${target.name}还可使用 ${LIANG_ESSENCE.maxUses - (target.retirementDelayUses ?? 0)} 次`, 310);
    } else centered(box, "这位村民当前无法使用道具", 230);
    ctx.ui.button(box, "取消", 112, 365, 158, back, C.muted, 62);
    const confirm = ctx.ui.button(box, "确认使用", 335, 365, 195,
        () => { if (target && ctx.current === panel) ctx.game.useEssence(target.id); }, C.gold, 62, !!target && canUseEssence);
    if (target && canUseEssence) ctx.ui.actionBadge(confirm, "EssenceConfirmHint");
}

/** 一次约一秒，以真实帧时钟播放。中间点数只作演出，最后一帧读取已提交的结果。 */
const DICE_MOTION = { duration: 840, frame: 75, lift: 43, turn: 30 } as const;
class RewardDie extends Laya.Sprite {
    private shown = 0;
    constructor(x: number, y: number, face: number, landed?: () => void) {
        super();
        this.name = "RewardDie";
        this.mouseEnabled = false;
        this.pos(x, y);
        this.drawFace(face);
        if (!landed) return;
        let elapsed = 0;
        const update = () => {
            elapsed = Math.min(DICE_MOTION.duration, elapsed + Math.min(48, Laya.timer.delta));
            const t = elapsed / DICE_MOTION.duration;
            const bounce = Math.abs(Math.sin(Math.PI * t * 3)) * (1 - t);
            this.y = y - bounce * DICE_MOTION.lift;
            this.rotation = Math.sin(Math.PI * t * 5) * (1 - t) * DICE_MOTION.turn;
            if (t < 1) {
                this.drawFace(1 + Math.floor(elapsed / DICE_MOTION.frame) % YUEXIU_DICE.faces);
                return;
            }
            Laya.timer.clearAll(this);
            this.drawFace(face);
            landed();
        };
        this.drawFace(1);
        Laya.timer.frameLoop(1, this, update);
    }
    private drawFace(face: number) {
        if (this.shown === face) return;
        this.shown = face;
        const g = this.graphics;
        g.clear();
        g.drawRoundRect(-61, -52, 122, 119, 24, 24, 24, 24, "#c49071", C.outline, 4);
        g.drawRoundRect(-61, -61, 122, 119, 24, 24, 24, 24, "#fff2d6", C.outline, 4);
        const dot = (x: number, y: number) => g.drawCircle(x, y, face === 1 ? 12 : 8, C.red);
        if (face % 2) dot(0, 0);
        if (face > 1) { dot(-33, -33); dot(33, 33); }
        if (face > 3) { dot(33, -33); dot(-33, 33); }
        if (face === YUEXIU_DICE.faces) { dot(-33, 0); dot(33, 0); }
    }
    destroy(destroyChild = true) {
        Laya.timer.clearAll(this);
        super.destroy(destroyChild);
    }
}

function drawRewardDice(ctx: PanelContext, state: GameState, panel: Panel) {
    const width = 562, roll = state.rewardDie, animation = roll !== undefined && !panel.rewardDiceAnimationDone;
    const box = ctx.modal(ITEMS[YUEXIU_DICE.id].name, "", false, { width, height: 477 });
    box.graphics.drawEllipse(width / 2, 252, 78, 14, C.trim, null, 0);
    box.addChild(new RewardDie(width / 2, 183, roll ?? YUEXIU_DICE.faces, animation ? () => {
        if (ctx.current !== panel) return;
        panel.rewardDiceAnimationDone = true;
        ctx.refresh();
    } : undefined));
    const text = roll === undefined ? "1–3 点 · 粮木产出减半\n4–6 点 · 粮木产出翻倍"
        : animation ? "骰子滚动中…" : `${roll} 点 · 下场守夜粮木产出 ×${nightRewardMultiplier(roll)}`;
    const line = ctx.ui.label(box, text, 36, 278, width - 72, 28, roll !== undefined && roll < YUEXIU_DICE.highFrom ? C.red : C.ink, true, 80);
    line.align = "center"; line.valign = "middle"; line.overflow = Laya.Text.SHRINK;
    if (animation) return;
    const back = () => ctx.open(panel.back!, true);
    if (roll !== undefined) {
        ctx.ui.centerButton(box, "收下", 379, back, C.gold, true, 216, 62);
        return;
    }
    const ready = !actionHintsBlocked(ctx.game) && rewardDiceUnavailable(state) === null && !!backpackInventory(ctx.game)?.[YUEXIU_DICE.id];
    ctx.ui.button(box, "取消", 71, 379, 170, back, C.muted, 62, !ctx.game.saves.pending);
    ctx.ui.button(box, "投入 1 件并掷骰", 266, 379, 224, () => {
        if (ctx.current === panel && !actionHintsBlocked(ctx.game)) ctx.game.rollRewardDice();
    }, C.gold, 62, ready);
}
