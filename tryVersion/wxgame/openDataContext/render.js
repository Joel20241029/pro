// 复用微信 Layout 排行榜模板的 scrollview，像素尺寸随 sharedCanvas 保持 600×680。
// 所有昵称/头像字段只在开放域使用；XML 转义避免合法昵称被模板解释为标签。
function escape(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
// Layout 的 XML 解析器不自动还原实体。解析后只解码一遍，避免双重解码用户原文。
function decode(value) {
    const entities = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
    return value.replace(/&(amp|lt|gt|quot|apos);/g, entity => entities[entity]);
}
const style = {
    root: { width: 600, height: 680, backgroundColor: '#fff1cf', flexDirection: 'column' },
    header: { width: 600, height: 44, flexDirection: 'row', backgroundColor: '#eddbad', alignItems: 'center' },
    rank: { width: 66, height: 44, lineHeight: 44, fontSize: 26, color: '#9a591f', textAlign: 'center', fontWeight: 'bold' },
    player: { width: 354, height: 44, lineHeight: 44, fontSize: 26, color: '#48311f' },
    score: { width: 180, height: 44, lineHeight: 44, fontSize: 28, color: '#557637', textAlign: 'center', fontWeight: 'bold' },
    list: { width: 600, height: 586 },
    row: { width: 600, height: 84, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff1cf', borderBottomWidth: 1, borderColor: '#dfc48d' },
    alternate: { backgroundColor: '#f5e5bb' },
    avatar: { width: 56, height: 56, borderRadius: 8 },
    avatarSpace: { width: 56, height: 56 },
    name: { width: 278, height: 44, lineHeight: 44, marginLeft: 20, fontSize: 28, color: '#48311f', textOverflow: 'ellipsis' },
    tip: { width: 600, height: 50, lineHeight: 50, textAlign: 'center', fontSize: 24, color: '#796348' },
    message: { width: 600, height: 80, lineHeight: 80, fontSize: 28, color: '#796348', textAlign: 'center' },
    spacer: { width: 600, height: 230 }
};
function template(rows, invalid) {
    const entries = rows.length ? rows.map((row, i) => `<view class="row ${i % 2 ? 'alternate' : ''}"><text class="rank" value="${row.rank}"/>${row.avatarUrl ? `<image class="avatar" src="${escape(row.avatarUrl)}"/>` : '<view class="avatarSpace"/>'}<text class="name" value="${escape(row.nickname)}"/><text class="score" value="${row.score} 波"/></view>`).join('') : '<text class="message" value="暂未读取到可显示的排行记录"/>';
    return `<view class="root"><view class="header"><text class="rank" value="名次"/><text class="player" value="同玩好友"/><text class="score" value="最高波数"/></view><scrollview class="list" scrollY="true">${entries}</scrollview><text class="tip" value="${invalid ? `${invalid} 条异常成绩未参与排名` : '上下滑动查看 · 同分并列' }"/></view>`;
}
function status(lines) { return `<view class="root"><view class="spacer"/>${lines.map(line => `<text class="message" value="${escape(line)}"/>`).join('')}</view>`; }
module.exports = { style, template, status, escape, decode };
