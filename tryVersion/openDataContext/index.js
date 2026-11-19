const Layout = require('./engine.js').default;
const { SCORE_KEY, rankFriends, createScoreStore } = require('./score-store.js');
const render = require('./render.js');
const canvas = wx.getSharedCanvas(), context = canvas.getContext('2d');
const scores = createScoreStore(wx);
let visible = false, epoch = 0, localBest = 0;
let trace = null, stage = 'initial', logged = 0;
// 开放域只在本地记阶段与数量；不输出好友数据或错误原文。
function note(event, fields = {}) {
    if (!trace || logged++ >= 120) return;
    try {
        console.info('[ranking-open-data]', { request: trace, event, stage, epoch, ...fields });
    } catch (_) { /* 诊断不影响开放域。 */ }
}
let content = render.status(['正在准备好友榜…']);
function draw() {
    if (!visible) return;
    let operation = 'clear';
    try {
        Layout.clear(); operation = 'init';
        Layout.init(content, render.style, render.decode); operation = 'layout';
        Layout.layout(context);
        note('draw_returned', { width: canvas.width, height: canvas.height });
    } catch (error) { note('draw_failed', { operation }); throw error; }
}
function status(lines) { content = render.status(lines); draw(); }
function refresh() {
    const request = ++epoch;
    stage = 'score_sync'; note('refresh');
    status(['正在同步守村纪录…']);
    scores.request(localBest, error => {
        if (!visible || request !== epoch) return;
        if (error) { note('score_sync_failed'); status(['守村纪录同步失败', '请稍后重新打开排行榜']); return; }
        stage = 'friend_read'; note('score_sync_ok');
        status(['正在读取同玩好友…']);
        try {
            wx.getFriendCloudStorage({ keyList: [SCORE_KEY], success(result) {
                if (!visible || request !== epoch) return;
                const { rows, invalid } = rankFriends(result.data);
                stage = 'rows'; note('friend_read_ok', { rows: rows.length, invalid });
                content = render.template(rows, invalid); draw();
            }, fail(error) {
                if (!visible || request !== epoch) return;
                note('friend_read_failed', { code: Number.isSafeInteger(error?.errCode) ? error.errCode : undefined });
                status(['好友榜暂时无法读取', '请检查网络与朋友信息权限']);
            } });
        } catch (error) { note('friend_call_error'); status(['好友榜暂时无法读取', '请稍后重新打开排行榜']); }
    });
}
wx.onMessage(data => {
    if (typeof data.diagnosticRequest === 'string' && /^[a-z0-9]+-\d+$/.test(data.diagnosticRequest))
        trace = data.diagnosticRequest;
    // 单向消息：只有数字纪录与 UI 指令；从不向主域传递用户数据。
    if (Number.isSafeInteger(data.bestNight) && data.bestNight >= 0) {
        localBest = Math.max(localBest, data.bestNight);
        if (!data.showRanking && !data.refreshRanking) scores.request(localBest);
    }
    if (data.type === 'close') {
        note('close'); trace = null; visible = false; ++epoch; Layout.clearAll(); context.clearRect(0, 0, canvas.width, canvas.height);
    } else if (data.type === 'updateViewPort') { Layout.updateViewPort(data.box); draw(); }
    else if (data.showRanking) { visible = true; ++epoch; stage = 'authorization'; note('show'); status(['正在确认好友权限…']); }
    else if (data.authorizationError && visible) { ++epoch; note('authorization_failed'); status(['好友榜暂不可用', data.authorizationError]); }
    else if (data.refreshRanking && visible) refresh();
});
