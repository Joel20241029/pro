import { ResourcePreparation } from "../../platform/ResourcePreparation";
import { GameState } from "../../game/GameState";
import { GameSession } from "../../game/GameSession";
import { Command } from "../../game/VillageRules";
import { WechatPlatform } from "../../platform/WechatPlatform";
import { SpriteFrames } from "../SpriteFrames";
import { UiWidgets } from "../UiWidgets";
export type Panel = {
    type: string;
    id?: string;
    index?: number;
    scroll?: number;
    /** 仅本次面板进入的条目身份顺序，不进入存档。 */
    rowOrder?: string[];
    /** 战技详情/战前返回链仅用于当前面板，保存失败时保留，成功后按来源导航。 */
    back?: Panel;
    pendingTactic?: string;
    tab?: number;
    a?: string;
    job?: "FARM" | "LOGGING";
};
/** 绘制模块只访问这些明确服务；current 由 GamePanels 唯一持有，滚动回调沿用同一个 Panel 对象。 */
export interface PanelContext {
    readonly game: GameSession;
    readonly resources: ResourcePreparation;
    readonly art: SpriteFrames;
    readonly platform: WechatPlatform;
    readonly ui: UiWidgets;
    current: Panel | null;
    readonly refresh: () => void;
    open(panel: Panel, preserve?: boolean): void;
    close(): void;
    send(command: Command, keep?: boolean): void;
    modal(title: string, subtitle: string, close?: boolean, size?: {
        width: number;
        height: number;
    }): Laya.Sprite;
    draw(state: GameState, panel: Panel): void;
}
