import { itemDefinition, ITEMS, LIANG_ESSENCE, LIANG_INDULGENCE, PATROL_RATION, SHOP_PRODUCTS } from "../../config/ShopConfig";
import { GameState } from "../../game/GameState";
import { essenceTargets, patrolItemUnavailable } from "../../game/ShopRules";
import { ScrollList } from "../ScrollList";
import { C, UI } from "../UiTheme";
import { coloredName } from "../ViewText";
import { Panel, PanelContext } from "./PanelContext";

/** 已审稿的高面板。高度随可用屏幕收紧，标题、详情和底部操作留在滑动区域以外。 */
const LAYOUT = { top: 121, gutter: 24, insetBottom: UI.action.bottom, shopHeight: 930, backpackHeight: 728,
    shopRow: 139, rowGap: 12, itemIcon: 92, emptyIcon: 112, columns: 4, tileGap: 12,
    detailHeight: 110, actionHeight: 62, actionWidth: 192 } as const;

function message(ctx: PanelContext, box: Laya.Sprite, icon: string, text: string) {
    const y = (LAYOUT.top + box.height) / 2 - 94, size = LAYOUT.emptyIcon;
    ctx.ui.image(box, icon, (box.width - size) / 2, y, size);
    ctx.ui.label(box, text, UI.inset, y + size + 12, UI.contentWidth, 30, C.cream, true, 52).align = "center";
}

export function drawItemPanel(ctx: PanelContext, state: GameState, panel: Panel, availableHeight: number) {
    if (panel.type === "itemOffer" || panel.type === "essenceTargets" || panel.type === "essenceConfirm") {
        drawItemAction(ctx, state, panel, availableHeight);
        return;
    }
    const shop = panel.type === "shop", title = shop ? "商城" : "背包";
    const spec = LAYOUT, height = Math.min(shop ? spec.shopHeight : spec.backpackHeight, availableHeight - spec.gutter * 2);
    const box = ctx.modal(title, "", true, { width: UI.panelWidth, height }, shop
        ? "这里展示已上架的商品。" : "道具存放在本村背包。点击道具可查看用途。");
    if (shop) {
        try { ctx.game.villageItems.shop(); }
        catch { message(ctx, box, "icon_shop", "商城存档暂时无法读取"); return; }
        if (!SHOP_PRODUCTS.length) { message(ctx, box, "icon_shop", "暂无商品"); return; }
        const step = spec.shopRow + spec.rowGap;
        const list = new ScrollList(UI.contentWidth, height - spec.top - spec.insetBottom,
            SHOP_PRODUCTS.length * step - spec.rowGap, panel.scroll, y => panel.scroll = y);
        list.pos(UI.inset, spec.top); box.addChild(list);
        list.setVirtualRows(SHOP_PRODUCTS.length, step, (index, row) => {
            const product = SHOP_PRODUCTS[index], { id } = product, item = ITEMS[id], width = UI.contentWidth - UI.scrollGutter;
            row.name = `ShopProduct:${id}`;
            ctx.art.panel(row, "panel_card", width, spec.shopRow);
            ctx.ui.image(row, item.icon, 12, (spec.shopRow - spec.itemIcon) / 2, spec.itemIcon);
            addItemCopy(ctx, row, item.name, item.description, 120, width - 248);
            ctx.ui.materialCosts(row, state, product, 120, 94, width - 248, 35);
            ctx.ui.button(row, "详情", width - 118, (spec.shopRow - 55) / 2, 103, () => ctx.open({ type: "itemOffer", id, back: panel }), C.green, 55);
        });
        return;
    }

    let entries: [string, number][];
    try { entries = Object.entries(ctx.game.villageItems.backpack().items); }
    catch { message(ctx, box, "icon_backpack", "背包存档暂时无法读取"); return; }
    if (!entries.length) { message(ctx, box, "icon_backpack", "背包里还没有道具"); return; }
    const detailY = height - spec.insetBottom - spec.actionHeight - spec.detailHeight - spec.rowGap;
    const gridWidth = UI.contentWidth - UI.scrollGutter;
    const tile = Math.floor((gridWidth - spec.tileGap * (spec.columns - 1)) / spec.columns);
    const step = tile + spec.tileGap, rows = Math.max(2, Math.ceil(entries.length / spec.columns));
    const list = new ScrollList(UI.contentWidth, detailY - spec.top - spec.rowGap, rows * step - spec.tileGap,
        panel.scroll, y => panel.scroll = y);
    list.pos(UI.inset, spec.top); box.addChild(list);
    if (!entries.some(([id]) => id === panel.id)) panel.id = entries[0][0];
    list.setVirtualRows(rows, step, (rowIndex, row) => {
        for (let col = 0; col < spec.columns; col++) {
            const entry = entries[rowIndex * spec.columns + col], slot = new Laya.Sprite();
            slot.pos(col * step, 0).size(tile, tile);
            row.addChild(slot);
            ctx.art.panel(slot, entry ? "panel_card" : "panel_card_disabled", tile, tile);
            if (!entry) continue;
            const [id, count] = entry, item = itemDefinition(id);
            slot.name = `BackpackItem:${id}`;
            if (id === panel.id) slot.graphics.drawRoundRect(4, 4, tile - 8, tile - 8, 15, 15, 15, 15, null, "#ffcf55", 5);
            ctx.ui.image(slot, item?.icon ?? "icon_backpack", (tile - spec.itemIcon) / 2, (tile - spec.itemIcon) / 2 - 13, spec.itemIcon);
            const label = ctx.ui.label(slot, `×${count}`, 12, tile - 43, tile - 24, 26, C.ink, true, 35);
            label.align = "center"; label.wordWrap = false; label.overflow = Laya.Text.SHRINK;
            ctx.ui.bindClick(slot, () => { panel.id = id; ctx.refresh(); });
        }
    });
    const item = itemDefinition(panel.id!), detail = new Laya.Sprite();
    detail.pos(UI.inset, detailY); box.addChild(detail);
    ctx.art.panel(detail, "panel_card", UI.contentWidth, spec.detailHeight);
    ctx.ui.image(detail, item?.icon ?? "icon_backpack", 12, (spec.detailHeight - spec.itemIcon) / 2, spec.itemIcon);
    const patrolItem = panel.id === PATROL_RATION.id || panel.id === LIANG_INDULGENCE.id ? panel.id : undefined;
    const reason = patrolItem && patrolItemUnavailable(state, patrolItem);
    addItemCopy(ctx, detail, item?.name ?? "待识别道具", reason ?? item?.description ?? "库存已保留", 118, UI.contentWidth - 143);
    const usable = patrolItem ? !reason : panel.id === LIANG_ESSENCE.id && essenceTargets(state).length > 0;
    ctx.ui.centerButton(box, "使用", detailY + spec.detailHeight + spec.rowGap,
        () => { if (patrolItem) ctx.game.usePatrolItem(patrolItem); else ctx.open({ type: "essenceTargets", back: panel }); },
        C.green, usable, spec.actionWidth, spec.actionHeight);
}

function drawItemAction(ctx: PanelContext, state: GameState, panel: Panel, availableHeight: number) {
    const targets = essenceTargets(state);
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
        const display = new Laya.Sprite();
        display.pos(UI.inset, 116); box.addChild(display);
        ctx.art.panel(display, "panel_card", UI.contentWidth, 267);
        display.graphics.drawEllipse(UI.contentWidth / 2, 133, 119, 109, "#ffe3ce", null, 0);
        ctx.ui.image(display, item.icon, (UI.contentWidth - 220) / 2, 23, 220);
        centered(box, item.description, 399, 29, 48, true);
        const cost = box.addChild(new Laya.Sprite()), footer = 536;
        cost.size(350, 56).pos((box.width - 350) / 2, footer - 74);
        ctx.art.panel(cost, "panel_card", cost.width, cost.height);
        ctx.ui.materialCosts(cost, state, offer, 46, 8, 280, 40);
        const affordable = state.food >= offer.food && state.wood >= offer.wood;
        ctx.ui.button(box, "返回", 115, footer, 152, back, C.muted, 62);
        ctx.ui.button(box, affordable ? "购买" : "粮木不足", 352, footer, 178,
            () => { if (ctx.current === panel) ctx.game.buyItem(offer.id); }, C.gold, 62, affordable);
        return;
    }
    if (panel.type === "essenceTargets") {
        const height = Math.min(LAYOUT.backpackHeight, availableHeight - LAYOUT.gutter * 2);
        const box = ctx.modal("选择村民", "", true, { width: UI.panelWidth, height });
        const step = 93, rowHeight = 82, list = new ScrollList(UI.contentWidth, height - LAYOUT.top - 111,
            Math.max(0, targets.length * step - 11), panel.scroll, y => panel.scroll = y);
        if (!targets.length) message(ctx, box, "icon_backpack", "没有可使用的成年村民");
        else {
            list.pos(UI.inset, LAYOUT.top); box.addChild(list);
            list.setVirtualRows(targets.length, step, (index, row) => {
                const target = targets[index], width = UI.contentWidth - UI.scrollGutter;
                row.name = `EssenceTarget:${target.id}`;
                ctx.art.panel(row, "panel_card", width, rowHeight);
                ctx.ui.button(row, "选择", width - 118, 14, 104,
                    () => ctx.open({ type: "essenceConfirm", id: target.id, back: panel }), C.green, 54);
                ctx.ui.image(row, ctx.art.portraitId(target), 16, 7, 66);
                const label = ctx.ui.label(row, coloredName(target), 97, 19, width - 231, 31, C.ink, true, 46);
                label.wordWrap = false; label.overflow = Laya.Text.SHRINK;
            });
        }
        ctx.ui.centerButton(box, "返回", height - 85, back, C.muted, true, 144, 58);
        return;
    }
    const target = targets.find(p => p.id === panel.id);
    const box = ctx.modal("确认使用", "", true, { width: UI.panelWidth, height: 454 });
    if (target) {
        ctx.ui.image(box, ctx.art.portraitId(target), (box.width - 104) / 2, 110, 104);
        centered(box, `给${target.name}使用「靓哥的精华」？`, 222, 29, 45, true);
        centered(box, `随机延后退休 ${LIANG_ESSENCE.minNights}–${LIANG_ESSENCE.maxNights} 夜`, 268);
        centered(box, `${target.name}还可使用 ${LIANG_ESSENCE.maxUses - (target.retirementDelayUses ?? 0)} 次`, 310);
    } else centered(box, "这位村民当前无法使用道具", 230);
    ctx.ui.button(box, "取消", 112, 365, 158, back, C.muted, 62);
    ctx.ui.button(box, "确认使用", 335, 365, 195,
        () => { if (target && ctx.current === panel) ctx.game.useEssence(target.id); }, C.gold, 62, !!target);
}

function addItemCopy(ctx: PanelContext, row: Laya.Sprite, name: string, description: string, x: number, width: number) {
    const title = ctx.ui.label(row, name, x, 16, width, 30, C.ink, true, 40);
    const copy = ctx.ui.label(row, description, x, 57, width, 24, C.ink, false, 36);
    for (const label of [title, copy]) { label.wordWrap = false; label.overflow = Laya.Text.SHRINK; }
}
