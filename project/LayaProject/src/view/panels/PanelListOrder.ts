import { Panel } from "./PanelContext";

/** 本次进入时把可操作项稳定排前。只缓存身份，不缓存数据或按钮闭包；
 * 刷新继续使用原顺序，新出现的条目追加，移除的条目不绘制，关闭重进重新计算。
 * 不修改游戏数组、随机数或存档。用于建设、家庭及人员操作列表。
 */
export function orderPanelRows<T>(panel: Panel, rows: readonly T[], id: (row: T) => string, actionable: (row: T) => boolean): T[] {
    if (!panel.rowOrder) {
        const ready = rows.filter(actionable), unavailable = rows.filter(row => !actionable(row));
        panel.rowOrder = [...ready, ...unavailable].map(id);
    }
    const positions = new Map(panel.rowOrder.map((key, index) => [key, index]));
    for (const row of rows) if (!positions.has(id(row))) {
        positions.set(id(row), panel.rowOrder.length);
        panel.rowOrder.push(id(row));
    }
    return rows.slice().sort((a, b) => positions.get(id(a))! - positions.get(id(b))!);
}
