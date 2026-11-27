import { PATROL } from "../../config/PatrolConfig";

/** 第 n 条对应首次准备第 n 波时的白天。调整文案会同步游戏内「起步」手册。 */
export const STARTER_LESSONS = [
    { target: "start", title: "准备守夜", text: "白天可以慢慢准备。点「开始守夜」，先看来敌和口粮，再确认出战。" },
    { target: "families", title: "安排家庭", text: "打开「家庭」迎接孩子。家里已有孩子，可以查看距成年还有几夜。" },
    { target: "people", title: "认识村民", text: "去「村民」看看谁擅长种田或伐木。底栏能看到今晚的产出和口粮。" },
    { target: "tower", title: "加固防线", text: "点空塔底座的「＋」建塔。点已有的塔，可以升级或更换驻守者。" },
    { target: "tactics", title: "使用战技", text: "左侧「战技」可以查看和更换。守夜时点底栏施放，等敌人进射程再用塔的增益。" }
] as const;
export type StarterTarget = typeof STARTER_LESSONS[number]["target"] | "build";
/** 淡紫儿引导独立查看记录；旧档也可看到新系统，跳过不会改变五波引导进度。 */
export const PATROL_LESSONS = [
    { text: `点${PATROL.building}，在「切换打法」里选旋甩或连发。` }
] as const;

/** 开村即可查看的单步引导。空背包、空商城也可打开并完成。 */
export const BACKPACK_LESSON = [{ text: "打开背包就能看到每件道具的用途，点旁边的按钮就能使用或选村民。" }] as const;
export const SHOP_LESSON = [{ text: "买下的道具在背包里使用，买到的弹药可在塔上换装。" }] as const;
