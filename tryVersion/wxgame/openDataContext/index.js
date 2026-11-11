const Layout = require('./engine.js').default;
const { SCORE_KEY, rankFriends, createScoreStore } = require('./score-store.js');
const render = require('./render.js');
const canvas = wx.getSharedCanvas(), context = canvas.getContext('2d');
const scores = createScoreStore(wx);
let visible = false, epoch = 0, localBest = 0;
let content = render.status(['正在准备好友榜…']);
function draw() {
    if (!visible) return;
    Layout.clear(); Layout.init(content, render.style, render.decode); Layout.layout(context);
}
function status(lines) { content = render.status(lines); draw(); }
function refresh() {
    const request = ++epoch;
    status(['正在同步守村纪录…']);
    scores.request(localBest, (error, ownScore) => {
        if (!visible || request !== epoch) return;
        if (error) { status(['守村纪录同步失败', '请稍后重新打开排行榜']); return; }
        status(['正在读取同玩好友…']);
        try {
            wx.getFriendCloudStorage({ keyList: [SCORE_KEY], success(result) {
                if (!visible || request !== epoch) return;
                const { rows, invalid } = rankFriends(result.data);
                content = render.template(rows, ownScore, invalid); draw();
            }, fail(error) {
                if (!visible || request !== epoch) return;
                console.warn('[好友榜] 好友数据读取失败', error.errMsg);
                status(['好友榜暂时无法读取', '请检查网络与朋友信息权限']);
            } });
        } catch (error) { console.error('[好友榜] 好友接口异常', error); status(['好友榜暂时无法读取', '请稍后重新打开排行榜']); }
    });
}
wx.onMessage(data => {
    // 单向消息：只有数字纪录与 UI 指令；从不向主域传递用户数据。
    if (Number.isSafeInteger(data.bestNight) && data.bestNight >= 0) {
        localBest = Math.max(localBest, data.bestNight);
        if (!data.showRanking && !data.refreshRanking) scores.request(localBest);
    }
    if (data.type === 'close') {
        visible = false; ++epoch; Layout.clearAll(); context.clearRect(0, 0, canvas.width, canvas.height);
    } else if (data.type === 'updateViewPort') { Layout.updateViewPort(data.box); draw(); }
    else if (data.showRanking) { visible = true; ++epoch; status(['正在确认好友权限…']); }
    else if (data.authorizationError && visible) { ++epoch; status(['好友榜暂不可用', data.authorizationError]); }
    else if (data.refreshRanking && visible) refresh();
});
