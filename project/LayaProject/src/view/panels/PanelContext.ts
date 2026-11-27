import { ResourcePreparation } from "../../platform/ResourcePreparation";
import type { GameState, HeroChoice } from "../../game/GameState";
import { GameSession } from "../../game/GameSession";
import { Command } from "../../game/VillageRules";
import type { GuideTrack } from "../../storage/VillageGuides";
import { WechatPlatform } from "../../platform/WechatPlatform";
import { SpriteFrames } from "../SpriteFrames";
import { UiWidgets } from "../UiWidgets";
import type { TowerKind } from "../../config/DefenseConfig";
import type { ExpeditionRoute } from "../../config/ExpeditionConfig";
/** 二次确认只保存本次操作的展示报价。实际扣费仍由原命令校验和提交。 */
export type SpendDetails = {
    title: string;
    actionText: string;
    image: string;
    detail?: string;
    coins?: number;
    quantity?: string;
    showBadge?: boolean;
};
export type Panel = {
    type: string;
    id?: string;
    index?: number;
    scroll?: number;
    /** 村委会中浏览的人选和今晚出战人选分开。回到名单仍显示原卡片和滚动位置。 */
    heroPreview?: HeroChoice;
    /** 候选高亮只保存在打开的面板，战斗或存档以实际提交结果为准。 */
    preview?: string;
    expeditionRoute?: ExpeditionRoute;
    pendingChoice?: { accepted: (state: GameState) => boolean; back: Panel };
    spend?: SpendDetails & { commit: () => void };
    /** 仅本次面板进入的条目身份顺序，不进入存档。 */
    rowOrder?: string[];
    /** 战技详情/战前返回链仅用于当前面板，保存失败时保留，成功后按来源导航。 */
    back?: Panel;
    pendingTactic?: { id: string | null; slot: number };
    /** 仅控制这一扇骰子弹窗的表现。实际结果由村庄事务提交。 */
    rewardDiceAnimationDone?: true;
    /** 只在这次购买的存档提交成功后选中新槽。 */
    pendingSlotUnlock?: number;
    /** 只在本次弹板确认的升级提交成功后返回之家。 */
    pendingPatrolLevel?: number;
    /** 确认前的塔型与等级快照，用于防止重复提交和校验成功结果。 */
    towerChange?: { from: TowerKind | null; level: number; to?: TowerKind; submitted?: boolean };
    tab?: number;
    /** 标签换页后为新的选中按钮延续松手动效，在本次渲染消费。 */
    tabFeedback?: boolean;
    /** 家庭的成家、养育列表各自保留本次打开的滚动位置。 */
    familyScroll?: [number?, number?];
    /** 商城打开期间分别保存消耗品与弹药列表的位置。 */
    shopScroll?: [number?, number?];
    /** 玩法说明每一页保留各自的阅读位置。 */
    guideScroll?: (number | undefined)[];
    /** 名册按岗位存放当前查看的滚动位置和排序。 */
    rosterViews?: { scroll?: number; rowOrder?: string[] }[];
    a?: string;
    job?: "SEWING";
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
    unreadTactic(id: string): boolean;
    markTacticRead(id: string): void;
    guideSeen(track: GuideTrack): boolean;
    finishGuide(track: GuideTrack): void;
    open(panel: Panel, preserve?: boolean): void;
    close(): void;
    send(command: Command, keep?: boolean): void;
    confirmSpend(details: SpendDetails, commit: () => void): void;
    claimExpedition(coin: Laya.Sprite): void;
    modal(title: string, subtitle: string, close?: boolean, size?: {
        width: number;
        height: number;
    }, help?: string): Laya.Sprite;
    draw(state: GameState, panel: Panel): void;
}
