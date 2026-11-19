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
    { text: "粉红色的回忆开放了。点「建设」，看看新的守夜帮手。" },
    { text: "点「粉红色的回忆」，看看建造需要多少粮木。" },
    { text: "材料齐了就能建造。缺材料也可以照常守夜。" },
    { text: "点「任命队长」。队长白天照常工作，夜里只能领队或驻塔。" },
    { text: "淡紫儿从城门出发了！他会沿着友谊路迎敌。" },
] as const;
export const PATROL_GUIDE_KEY = "daidai_village.patrol_guide";
/** 战技页独立提示，达到槽位波数后显示。第3槽才增加每夜施放次数。 */
export const SLOT_GUIDE_TEXT = "多开一槽，多带一项战技。";
