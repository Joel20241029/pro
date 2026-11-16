import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// 只整理官方Layout引擎的空白/普通注释，不做变量改名、表达式改写或语句删除。
// 固定解析器版本；构建前由制作命令执行，发布只包含已验证模板，源文件留在res/source。
const args = process.argv.slice(2), acornIndex = args.indexOf('--acorn'), reportIndex = args.indexOf('--report');
if (acornIndex < 0 || reportIndex < 0) throw new Error('需要 --acorn <8.19.0目录> --report <Downloads内报告>');
const acornPath = args[acornIndex + 1], reportPath = args[reportIndex + 1];
if (!acornPath || acornPath.startsWith('--') || !reportPath?.startsWith('/Users/happyelements/Downloads/')) throw new Error('制作参数缺值或报告路径不在Downloads');
const acorn = createRequire(import.meta.url)(path.resolve(acornPath));
assert.equal(acorn.version, '8.19.0', '解析器版本必须与制作记录一致');
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.resolve(project, '../../res/source/wechat-open-data/engine.source.js');
const target = path.join(project, 'build-templates/wxgame/openDataContext/engine.js');
const source = fs.readFileSync(sourcePath, 'utf8'), tokens = [], comments = [];
const before = acorn.parse(source, { ecmaVersion: 2020, onToken: tokens, onComment: comments });
const notices = comments.filter(c => /copyright|license|preserve|^!/i.test(c.value));
const spans = [...tokens.filter(t => t.type.label !== 'eof'), ...notices].sort((a, b) => a.start - b.start);
let result = '', previous = 0;
for (const span of spans) {
    // 保留换行存在与否，不能将return后的自动分号或行注释变成另一种语义。
    result += (/[\r\n]/.test(source.slice(previous, span.start)) ? '\n' : ' ') + source.slice(span.start, span.end);
    previous = span.end;
}
result += '\n';
const normalized = ast => JSON.stringify(ast, (key, value) => ['start', 'end', 'loc', 'range', 'raw'].includes(key) ? undefined : value);
assert.equal(normalized(before), normalized(acorn.parse(result, { ecmaVersion: 2020 })), '格式整理改变了语法树，禁止覆盖发布模板');
for (const notice of notices) assert(result.includes(source.slice(notice.start, notice.end)), '版权声明丢失');
fs.writeFileSync(target, result);
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const report = { source: sourcePath, target, parser: acorn.version, before: Buffer.byteLength(source), after: Buffer.byteLength(result),
    sourceHash: sha256(source), outputHash: sha256(result), identicalAST: true, notices: notices.length };
fs.mkdirSync(path.dirname(reportPath), { recursive: true }); fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
