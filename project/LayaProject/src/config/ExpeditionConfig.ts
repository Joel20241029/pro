/** 本村达 8 胜解锁；短线给一件修门工具，长线给一件巡防消耗品。 */
export const EXPEDITION = { name: "勇闯521", wins: 8 } as const;
export const EXPEDITION_ROUTES = {
    lobby: { name: "521大厅", nights: 3, reward: "gate_kit" },
    overnight: { name: "521通宵区", nights: 5, reward: "patrol_ration" }
} as const;
export type ExpeditionRoute = keyof typeof EXPEDITION_ROUTES;
export type ExpeditionRewardId = typeof EXPEDITION_ROUTES[ExpeditionRoute]["reward"];

/** 同一趟里事件不重复。键写入存档，编辑文案时保留原键。 */
export const EXPEDITION_EVENTS = {
    keyboard: { area: "前台", text: "救活了进水的键盘，老板当场道谢。" },
    reconnect: { area: "靠窗机位", text: "修好掉线机位，隔壁整排都在鼓掌。" },
    snacks: { area: "夜宵吧台", text: "送完一排夜宵，老板给留了一份。" },
    match: { area: "开黑区", text: "临时补位，和老板赢了最后一局。" },
    storage: { area: "杂物间", text: "把压箱底的工具擦干净，老板点头让带回村。" },
    seat: { area: "角落机位", text: "找到了风水座，原来离插座最近。" },
    finals: { area: "比赛区", text: "替掉线选手补位，竟拿下了决胜局。" },
    headphones: { area: "器材架", text: "理顺一团耳机线，店员结了工钱。" },
    nightshift: { area: "通宵座席", text: "替熟客守住机位，对方醒来就请客。" }
} as const;
