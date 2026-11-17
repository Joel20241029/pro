import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

/** 已确认整图的实测位置。换原图时重新标定弯心与横路，逻辑坐标沿用原路。 */
const width = 1122, height = 1402, wallRow = 914;
const referenceTop = 140, referenceGate = 830, referenceWidth = 720;
const bends = [[442, 385], [582, 551], [722, 749]];
/** 横路前最后一个稳定纵路截面。配准从横路向下平滑收回，居民区不做调整。 */
const approachRow = 878, fadeRows = 87;
/** 只移动中间路面及过渡草地，林带横向尺寸保持原图。 */
const fixedLeft = width * .15, fixedRight = width * .85;
/** 旧走廊已内收，补回 5 个逻辑像素给两侧草边及采样误差。 */
const verge = 5;
const mulX = width / referenceWidth;
const pxY = y => (y - referenceTop) / (referenceGate - referenceTop) * wallRow;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const sha256 = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// 暖色、实心、最长的连续带是主路。小碎石及路边草丝不作为截面边界。
function soilSpan(rgb, y) {
    let start = 0, previous = -width, bestLeft = 0, bestRight = 0;
    for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 3, r = rgb[i], g = rgb[i + 1], b = rgb[i + 2];
        if (r <= 125 || r - g < 13 || g - b < 13) continue;
        // 三像素以内的小石和压实土纹都留在同一个截面。
        if (x - previous > 4) start = x;
        previous = x;
        if (x - start > bestRight - bestLeft) { bestLeft = start; bestRight = x; }
    }
    if (bestRight - bestLeft < width * .06) throw Error('没有连续的土路截面，纹理行 ' + y);
    return [bestLeft, bestRight];
}

function interpolateRow(rows, at) {
    const base = Math.floor(at), a = rows[base], b = rows[Math.min(base + 1, rows.length - 1)], t = at - base;
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
}

export function fitVillageMap(root, source, target, magick) {
    const roadFile = path.resolve(root, '../project/LayaProject/src/config/RoadGeometry.ts');
    const table = fs.readFileSync(roadFile, 'utf8').match(/ROAD_PROFILE = (\[[\s\S]*\]) as const/);
    if (!table) throw Error('没有可校准的旧通行走廊');
    const profile = JSON.parse(table[1].replace(/,\s*\]/g, ']'));
    const first = profile[0][0], last = profile.at(-1)[0], step = profile[1][0] - first;
    const run = (args, options = {}) => execFileSync(magick, args, { maxBuffer: 16 * 1024 * 1024, ...options });
    if (run(['identify', '-format', '%wx%h', source]).toString() !== `${width}x${height}`)
        throw Error('地图母图已改变尺寸，需重新标定');
    const rgb = run([source, '-depth', '8', 'rgb:-']);
    const spans = Array.from({ length: approachRow + 1 }, (_, y) => soilSpan(rgb, y));
    const meanSpans = spans.map((_, y) => {
        // 消除个别草尖像素的锯齿，不对画面做模糊处理。
        const samples = spans.slice(Math.max(0, y - 4), y + 5);
        return [0, 1].map(edge => samples.reduce((sum, s) => sum + s[edge], 0) / samples.length);
    });
    const walkable = profile.map(([, left, right]) => [left, right]);
    const gateHalfWidth = (walkable.at(-1)[1] - walkable.at(-1)[0]) / 2;
    const gate = [referenceWidth / 2 - gateHalfWidth, referenceWidth / 2 + gateHalfWidth];
    const anchors = [[0, 0], ...bends.map(([y, row]) => [pxY(y), row]), [wallRow, wallRow]];
    const out = Buffer.from(rgb);
    let segment = 0;
    for (let y = 0; y < wallRow + fadeRows; y++) {
        let fromY = y;
        if (y < wallRow) {
            while (y > anchors[segment + 1][0]) segment++;
            const [a, b] = [anchors[segment], anchors[segment + 1]];
            fromY += lerp(a[1] - a[0], b[1] - b[0], smooth((y - a[0]) / (b[0] - a[0])));
        }
        const fromEdges = interpolateRow(meanSpans, Math.min(approachRow, fromY));
        const at = lerp(referenceTop, referenceGate, y / wallRow);
        const [left, right] = interpolateRow(walkable, Math.min(last - first, Math.max(0, at - first)) / step);
        const towardGate = smooth(Math.max(0, Math.min(1, (at - last) / (referenceGate - last))));
        const fade = smooth(Math.max(0, (y - wallRow) / fadeRows));
        const toLeft = lerp((lerp(left, gate[0], towardGate) - verge) * mulX, fromEdges[0], fade);
        const toRight = lerp((lerp(right, gate[1], towardGate) + verge) * mulX, fromEdges[1], fade);
        if (!(fixedLeft < Math.min(toLeft, fromEdges[0]) && fixedRight > Math.max(toRight, fromEdges[1]))) throw Error('地图路缘进入林带');
        const y0 = Math.floor(fromY), dy = fromY - y0;
        for (let x = 0; x < width; x++) {
            let fromX = x;
            if (x > fixedLeft && x < fixedRight) {
                if (x < toLeft) fromX = lerp(fixedLeft, fromEdges[0], (x - fixedLeft) / (toLeft - fixedLeft));
                else if (x < toRight) fromX = lerp(fromEdges[0], fromEdges[1], (x - toLeft) / (toRight - toLeft));
                else fromX = lerp(fromEdges[1], fixedRight, (x - toRight) / (fixedRight - toRight));
            }
            // 单次亚像素重采样，避免多次缩放损失树叶和地面细节。
            const x0 = Math.floor(fromX), x1 = Math.min(width - 1, x0 + 1), dx = fromX - x0;
            for (let c = 0; c < 3; c++) {
                const top = lerp(rgb[(y0 * width + x0) * 3 + c], rgb[(y0 * width + x1) * 3 + c], dx);
                const bottom = lerp(rgb[((y0 + 1) * width + x0) * 3 + c], rgb[((y0 + 1) * width + x1) * 3 + c], dx);
                out[(y * width + x) * 3 + c] = Math.round(lerp(top, bottom, dy));
            }
        }
    }
    let minRoadMargin = Infinity, weakestRow;
    for (let y = first; y <= last; y++) {
        const [left, right] = interpolateRow(walkable, (y - first) / step);
        const [a, b] = soilSpan(out, Math.round(pxY(y)));
        const margin = Math.min(left - a / mulX, b / mulX - right);
        if (margin < minRoadMargin) { minRoadMargin = margin; weakestRow = [y, left, right, a / mulX, b / mulX]; }
    }
    if (minRoadMargin < 1) throw Error('原通行走廊超出新路面安全边，最小留边 ' + minRoadMargin + '，' + weakestRow.join(', '));
    const [gateLeft, gateRight] = soilSpan(out, approachRow);
    if (Math.abs((gateRight + gateLeft) / 2 - width / 2) > width * .012) throw Error('新路未对齐城门中心');
    const [laneLeft, laneRight] = soilSpan(out, wallRow);
    if (laneLeft > width * .01 || laneRight < width * .99) throw Error('城门横路未贯通');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    run(['-size', `${width}x${height}`, '-depth', '8', 'rgb:-', '-strip', target], { input: out });
    return {
        width, height, wallRow, sourceSha256: sha256(source),
        registration: { roadRows: last - first + 1, minRoadMargin: +minRoadMargin.toFixed(2),
            referenceWidth, referenceTop, referenceGate, corridorSha256: sha256(roadFile) }
    };
}
