/** 第 n 条对应首次准备第 n 波时的白天。调整文案会同步游戏内「起步」手册。 */
export const STARTER_LESSONS = [
    { target: "start", title: "准备守夜", text: "白天可以慢慢准备。点「开始守夜」，先看来敌和口粮，再确认出战。" },
    { target: "families", title: "安排家庭", text: "打开「家庭」迎接孩子。家里已有孩子，就看看谁在照料。" },
    { target: "people", title: "认识村民", text: "去「村民」看看谁擅长种田或伐木。底栏能看到今晚的产出和口粮。" },
    { target: "tower", title: "加固防线", text: "点空塔底座的「＋」建塔。点已有的塔，可以升级或更换驻守者。" },
    { target: "tactics", title: "使用战技", text: "左侧「战技」可以查看和更换。守夜时点底栏施放，等敌人进射程再用塔的增益。" }
] as const;
export type StarterTarget = typeof STARTER_LESSONS[number]["target"];
