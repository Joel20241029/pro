import { ResourcePreparation } from "../../platform/ResourcePreparation";
import { GameState } from "../../game/GameState";
import { GameSession } from "../../game/GameSession";
import { Command } from "../../game/VillageRules";
import type { GuideTrack } from "../../storage/VillageGuides";
import { WechatPlatform } from "../../platform/WechatPlatform";
import { SpriteFrames } from "../SpriteFrames";
import { UiWidgets } from "../UiWidgets";
import type { TowerKind } from "../../config/DefenseConfig";
export type Panel = {
    type: string;
    id?: string;
    index?: number;
    scroll?: number;
    showNightDetails?: boolean;
    /** 仅本次面板进入的条目身份顺序，不进入存档。 */
    rowOrder?: string[];
    /** 战技详情/战前返回链仅用于当前面板，保存失败时保留，成功后按来源导航。 */
    back?: Panel;
    pendingTactic?: { id: string | null; slot: number };
    /** 只在这次购买的存档提交成功后选中新槽。 */
    pendingSlotUnlock?: number;
    /** 确认前的塔型与等级快照，用于防止重复提交和校验成功结果。 */
    towerChange?: { from: TowerKind | null; level: number; to?: TowerKind; submitted?: boolean };
    tab?: number;
    /** 标签换页后为新的选中按钮延续松手动效，在本次渲染消费。 */
    tabFeedback?: boolean;
    /** 家庭的成家、养育列表各自保留本次打开的滚动位置。 */
    familyScroll?: [number?, number?];
    /** 名册按岗位存放当前查看的滚动位置和排序。 */
    rosterViews?: { scroll?: number; rowOrder?: string[] }[];
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
    readonly tacticUnread: boolean;
    unreadTactic(id: string): boolean;
    guideSeen(track: GuideTrack): boolean;
    finishGuide(track: GuideTrack): void;
    open(panel: Panel, preserve?: boolean): void;
    close(): void;
    send(command: Command, keep?: boolean): void;
    modal(title: string, subtitle: string, close?: boolean, size?: {
        width: number;
        height: number;
    }, help?: string): Laya.Sprite;
    draw(state: GameState, panel: Panel): void;
}
