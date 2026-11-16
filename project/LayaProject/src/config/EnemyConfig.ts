export type EnemyKind = "enemy_raider" | "enemy_runner" | "enemy_armored" | "enemy_boar" | "enemy_disruptor" | "enemy_chief" | "enemy_commander" | "enemy_wolfking" | "enemy_tuskking" | "enemy_shaman";
export interface EnemyDefinition {
    name: string; brief: string; hp: number; speed: number; armor: number; gate: number; cost: number; weight: number; unlock: number;
    boss: boolean; summon: boolean; disrupt: boolean;
}
/** doc/tech/28 已确认5小怪+5首领。旧单位数值保持；野猪为3预算厚血撞门单位。
 * 首领统一12预算，每12夜轮换：以原匪首及4次召唤的综合压力为参照，分别突出破甲、减速和集火。
 * brief 是战前列表的定位提示，与实际能力一致，颜色和饰物不赋予额外属性。
 * summon/disrupt 复用原有能力，无新战斗机制。改动数值须跑300夜模拟并升级配置版本。
 */
export const ENEMIES: Record<EnemyKind, EnemyDefinition> = {
    enemy_raider: { name: "灰牙劫掠者", brief: "基础来敌", hp: 36, speed: 36, armor: 0, gate: 8, cost: 1, weight: 6, unlock: 1, boss: false, summon: false, disrupt: false },
    enemy_runner: { name: "赤帽疾行者", brief: "快速突进", hp: 24, speed: 70, armor: 0, gate: 6, cost: 2, weight: 3, unlock: 2, boss: false, summon: false, disrupt: false },
    enemy_armored: { name: "铁鬃卫士", brief: "高甲慢行", hp: 160, speed: 22, armor: .4, gate: 18, cost: 5, weight: 2, unlock: 4, boss: false, summon: false, disrupt: false },
    enemy_boar: { name: "石背野猪", brief: "厚血撞门", hp: 100, speed: 28, armor: .1, gate: 14, cost: 3, weight: 2, unlock: 6, boss: false, summon: false, disrupt: false },
    enemy_disruptor: { name: "苔角巫医", brief: "扰乱攻速", hp: 96, speed: 28, armor: 0, gate: 12, cost: 4, weight: 1, unlock: 7, boss: false, summon: false, disrupt: true },
    enemy_chief: { name: "裂岩食人魔", brief: "召唤援兵", hp: 480, speed: 18, armor: .2, gate: 40, cost: 12, weight: 0, unlock: 12, boss: true, summon: true, disrupt: false },
    enemy_commander: { name: "黑铁督军", brief: "重甲防护", hp: 430, speed: 17, armor: .45, gate: 40, cost: 12, weight: 0, unlock: 12, boss: true, summon: false, disrupt: false },
    enemy_wolfking: { name: "霜脊狼王", brief: "迅疾突袭", hp: 340, speed: 34, armor: .05, gate: 30, cost: 12, weight: 0, unlock: 12, boss: true, summon: false, disrupt: false },
    enemy_tuskking: { name: "熔牙巨兽", brief: "厚血重撞", hp: 720, speed: 14, armor: .1, gate: 50, cost: 12, weight: 0, unlock: 12, boss: true, summon: false, disrupt: false },
    enemy_shaman: { name: "古木祭司", brief: "扰乱攻速", hp: 480, speed: 18, armor: .1, gate: 35, cost: 12, weight: 0, unlock: 12, boss: true, summon: false, disrupt: true }
};
/** 前5场依次展示全部首领；之后循环底型，外观单独组合。周期仍沿用 RULE.yearDays。 */
export const BOSS_ROTATION: readonly EnemyKind[] = ["enemy_chief", "enemy_commander", "enemy_wolfking", "enemy_tuskking", "enemy_shaman"];
