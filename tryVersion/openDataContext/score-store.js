// 本游戏的最高成功防守波数，十进制整数。改 key 会形成新榜，不能用于开发清档。
const SCORE_KEY = 'daidai_best_defended_waves_v1';

function parseScore(list) {
    if (!Array.isArray(list)) throw new Error('成绩格式异常');
    const record = list.find(item => item.key === SCORE_KEY);
    if (!record) return null; // 官方 KV 缺 key 表示尚未提交；读取失败不会走这里。
    if (typeof record.value !== 'string' || !/^(0|[1-9]\d*)$/.test(record.value)) throw new Error('成绩格式异常');
    const score = Number(record.value);
    if (!Number.isSafeInteger(score)) throw new Error('成绩超出有效范围');
    return score;
}

function rankFriends(data) {
    const rows = [];
    let invalid = 0;
    for (const friend of data) {
        try {
            const score = parseScore(friend.KVDataList);
            if (score !== null && score > 0) rows.push({ nickname: friend.nickname, avatarUrl: friend.avatarUrl, score, order: rows.length });
        } catch (error) { invalid++; } // 损坏成绩明确计数并展示，不将其降成 0 分。
    }
    rows.sort((a, b) => b.score - a.score || a.order - b.order);
    rows.forEach((row, i) => row.rank = i && row.score === rows[i - 1].score ? rows[i - 1].rank : i + 1);
    return { rows, invalid };
}

/** 独立于面板生命周期的串行读 max 写；读取失败不覆盖云端未知高分。
 * 同一会话合并新纪录；无循环重试，失败后仅新纪录/用户刷新再次请求。
 * 微信 KV 无原子 max：双设备同时写的服务端原子性不在此接口能力内。
 */
function createScoreStore(api) {
    let desired = 0, busy = false, value = null, waiters = [];
    function request(score, done) {
        if (!Number.isSafeInteger(score) || score < 0) throw new Error('本地成绩无效');
        const increased = score > desired;
        desired = Math.max(desired, score);
        if (done) waiters.push(done);
        if (!busy && (increased || done)) run();
    }
    function run() {
        busy = true;
        let attempt = desired;
        const finish = error => {
            busy = false;
            if (!error && desired > attempt) { run(); return; }
            const callbacks = waiters; waiters = [];
            if (error) console.warn('[好友榜] 成绩同步失败', error.errMsg || error.message);
            callbacks.forEach(done => done(error, value));
        };
        try {
            api.getUserCloudStorage({ keyList: [SCORE_KEY],
                success(result) {
                    try { value = parseScore(result.KVDataList); }
                    catch (error) { finish(error); return; }
                    attempt = desired;
                    const target = Math.max(value === null ? 0 : value, attempt);
                    if (target === 0 || target === value) { finish(null); return; }
                    finish(null); // 全模块本地试玩只读好友榜。
                }, fail: finish
            });
        } catch (error) { finish(error); }
    }
    return { request };
}
module.exports = { SCORE_KEY, parseScore, rankFriends, createScoreStore };
