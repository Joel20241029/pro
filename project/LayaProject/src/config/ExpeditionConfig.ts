/** 本村达 8 胜解锁。路线逐夜限额保证一趟的总量与派遣预览一致。 */
export const EXPEDITION = { name: "勇闯521", wins: 8 } as const;
type Range = readonly [number, number];
type Route = { name: string; nights: readonly { wood: Range; food: Range }[] };
export const EXPEDITION_ROUTES = {
    lobby: { name: "521大厅", nights: [
        { wood: [4, 6], food: [3, 4] }, { wood: [5, 7], food: [3, 4] }, { wood: [5, 7], food: [4, 6] }
    ] },
    overnight: { name: "521通宵区", nights: [
        { wood: [5, 7], food: [3, 4] }, { wood: [5, 7], food: [3, 4] }, { wood: [5, 7], food: [4, 5] },
        { wood: [5, 6], food: [4, 5] }, { wood: [6, 7], food: [4, 6] }
    ] }
} as const satisfies Record<string, Route>;
export type ExpeditionRoute = keyof typeof EXPEDITION_ROUTES;

/** 同一趟里事件不重复。键写入存档，编辑文案时保留原键。 */
export const EXPEDITION_EVENTS = {
    keyboard: { area: "前台", text: "救活了进水的键盘，老板当场道谢。" },
    reconnect: { area: "靠窗机位", text: "修好掉线机位，隔壁整排都在鼓掌。" },
    snacks: { area: "夜宵吧台", text: "送完一排夜宵，老板给留了一份。" },
    match: { area: "开黑区", text: "临时补位，和老板赢了最后一局。" },
    storage: { area: "杂物间", text: "翻出几块好木板，店员又塞了些干粮。" },
    seat: { area: "角落机位", text: "找到了风水座，原来离插座最近。" },
    finals: { area: "比赛区", text: "替掉线选手补位，竟拿下了决胜局。" },
    headphones: { area: "器材架", text: "理顺一团耳机线，店员结了工钱。" },
    nightshift: { area: "通宵座席", text: "替熟客守住机位，对方醒来就请客。" }
} as const;
