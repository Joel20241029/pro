import { GameState } from "../game/GameState";
import { BuildingVisuals } from "./BuildingVisuals";
import { VillagerMotion } from "./VillagerMotion";
import { UiWidgets } from "./UiWidgets";
import { PATROL_PROP } from "./config/VillageSceneConfig";
import { HOUSE_TIP_NAMES } from "./config/AnchoredTipConfig";

/** 同一份绘制深度同时用于地图点选；人物身份随当前帧写入，不能绑定到精灵池下标。 */
export interface WorldItem {
    id: string; y: number; node: Laya.Sprite;
    visual?: BuildingVisuals; ground?: boolean; personId?: string;
}
/** 地图点选及按下身份的唯一所有者；读取当前状态/运动对象，重开后不保留旧村民引用。 */
export class WorldInteraction {
    private pickDepth: WorldItem[] = [];
    private pressedTargets = new Map<number, { source: Laya.Sprite; sourceId: string; target: WorldItem }>();
    private pickPoint = new Laya.Point();
    private pickBounds = new Laya.Rectangle();
    constructor(private state: () => GameState | null, private motion: () => VillagerMotion) { }
    bind(clickNodes: Laya.Sprite[], ui: UiWidgets, houseClicked: (name: string, visual: BuildingVisuals) => void, personClicked: (id: string) => void, patrolClicked?: () => void) {
        for (const node of clickNodes) {
            node.on(Laya.Event.MOUSE_DOWN, this, (event: Laya.Event) => {
                const target = this.pickAt(event.stageX, event.stageY);
                if (target) this.pressedTargets.set(event.touchId, { source: node, sourceId: node.name, target });
                else { this.pressedTargets.delete(event.touchId); Laya.InputManager.cancelClick(event.touchId); }
            });
            ui.bindClick(node, event => {
                const down = this.pressedTargets.get(event.touchId);
                this.pressedTargets.delete(event.touchId);
                const target = this.pickAt(event.stageX, event.stageY);
                if (!down || !target || !down.source.visible || down.source.name !== down.sourceId || target.id !== down.target.id || target.node !== down.target.node) return;
                if (target.personId) personClicked(target.personId);
                else if (target.id === PATROL_PROP) patrolClicked?.();
                else houseClicked(HOUSE_TIP_NAMES[target.id], target.visual!);
            });
            node.on(Laya.Event.MOUSE_OUT, this, (event?: Laya.Event) => {
                if (event) this.pressedTargets.delete(event.touchId);
            });
            node.on(Laya.Event.UNDISPLAY, this, () => {
                for (const [touchId, down] of this.pressedTargets)
                    if (down.source === node || down.target.node === node) {
                        Laya.InputManager.cancelClick(touchId); this.pressedTargets.delete(touchId);
                    }
            });
        }
    }
    /** 输入遍历不服从zIndex；逆序复用绘制深度，前景实体挡住后景，农田地面仍可点到农夫。 */
    pickAt(stageX: number, stageY: number): WorldItem | null {
        const state = this.state();
        if (!state) return null;
        for (let i = this.pickDepth.length - 1; i >= 0; i--) {
            const item = this.pickDepth[i], node = item.node;
            if (item.ground || !node.visible || node.destroyed) continue;
            if (item.personId && (!state.people.some(p => p.id === item.personId) || !this.motion().visiblePeople.some(p => p.id === item.personId) || this.motion().get(item.personId).insideTower)) continue;
            node.globalToLocal(this.pickPoint.setTo(stageX, stageY));
            // 人物只取自身贴图，红心不扩大点击范围；建筑/树木包含自己的可见部件。
            const bounds = item.personId ? node.getGraphicBounds(false, this.pickBounds) : node.getSelfBounds(this.pickBounds, true);
            if (bounds.contains(this.pickPoint.x, this.pickPoint.y))
                return item.personId || HOUSE_TIP_NAMES[item.id] || item.id === PATROL_PROP ? item : null;
        }
        return null;
    }
    /** 接收已按绘制顺序排列且已完成身份/可见性更新的节点，随后取消失效手势。 */
    update(depth: WorldItem[]) {
        this.pickDepth = depth;
        // 一帧内先隐藏再填充整个池，因此在最终可见性/身份确定后取消失效按下记录。
        for (const [touchId, down] of this.pressedTargets)
            if (!down.source.visible || down.source.name !== down.sourceId || !depth.some(p => p.id === down.target.id && p.node === down.target.node && p.node.visible)) {
                Laya.InputManager.cancelClick(touchId); this.pressedTargets.delete(touchId);
            }
    }
    clearDepth() { this.pickDepth = []; }
    cancelPresses() {
        for (const touchId of this.pressedTargets.keys()) Laya.InputManager.cancelClick(touchId);
        this.pressedTargets.clear();
    }
}
