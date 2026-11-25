import { UI } from "../UiTheme";

/** 全村只出现一条台词。白天活动时间按该区间随机，遮挡和暂停时不消耗业务随机数。 */
export const SPEECH = { seconds: UI.tipSeconds, initialWait: 12, idleMin: 22, idleSpread: 14, width: 238, height: 56, font: 22 } as const;

/** 可直接补充台词。建议一句不超过九个汉字，留足两秒阅读时间。 */
export const VILLAGER_LINES = {
    retire: ["该让后生接班了", "明天想多坐会儿"],
    farewell: ["村里的灯真暖", "听一会儿风声"],
    special: ["今晚我也守着", "这点活难不倒我"],
    FARM: ["麦穗快要熟了", "今天土还湿润"],
    LOGGING: ["柴够烧一晚上", "歇会儿再劈柴"],
    WAITING: ["去村口透透气", "村里又热闹了"],
    child: ["想去看小树", "今天长高了没"],
    elder: ["看看今年的麦", "这儿晒太阳好"]
} as const;
