/** 微信三点菜单的好友/群聊分享卡片；复用已制作的 500×400 分享图和图中文字。
 * imageUrl 相对微信代码包根目录，由 build-templates/wxgame/share 随主包导出，不能放入按需分包。
 * 修改文案或图片时同步 res/branding/share 原稿与制作说明；仅开启好友分享，不获取群信息或发放奖励。
 */
export const SHARE = {
    title: "你能守住多少波？",
    imageUrl: "share/village-share.jpg",
    menu: "shareAppMessage"
} as const;
