import { PATROL } from "../../config/PatrolConfig";

/** 第 n 条对应首次准备第 n 波时的白天。调整文案会同步游戏内「起步」手册。 */
export const STARTER_LESSONS = [
    { target: "start", title: "准备守夜", text: "白天可以慢慢准备。点「开始守夜」，先看来敌和口粮，再确认出战。" },
    { target: "families", title: "安排家庭", text: "打开「家庭」迎接孩子。家里已有孩子，就看看谁在照料。" },
    { target: "people", title: "认识村民", text: "去「村民」看看谁擅长种田或伐木。底栏能看到今晚的产出和口粮。" },
    { target: "tower", title: "加固防线", text: "点空塔底座的「＋」建塔。点已有的塔，可以升级或更换驻守者。" },
    { target: "tactics", title: "使用战技", text: "左侧「战技」可以查看和更换。守夜时点底栏施放，等敌人进射程再用塔的增益。" }
] as const;
export type StarterTarget = typeof STARTER_LESSONS[number]["target"] | "build";
/** 淡紫儿引导独立查看记录；旧档也可看到新系统，跳过不会改变五波引导进度。 */
export const PATROL_LESSONS = [
    { text: `开村就有${PATROL.building}。点地图上的粉色房子，给夜间小队选一位队长。` },
    { text: `点「${PATROL.appoint}」。队长白天照常工作，夜里负责带队。` },
    { text: "淡紫儿从城门出发了！小队沿友谊路分散迎敌。" },
] as const;
// 首日流程已重排，旧的五步建设进度不能当作这三步的查看记录。
export const PATROL_GUIDE_KEY = "daidai_village.patrol_intro_guide";
/** 战技页独立提示，达到槽位波数后显示。第3槽才增加每夜施放次数。 */
export const SLOT_GUIDE_TEXT = "多开一槽，多带一项战技。";
