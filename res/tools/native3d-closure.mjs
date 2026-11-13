import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/** 包内原生资源去重。只合并完全相同的LM与语义引用相同的Lmat，LH/动作/贴图入口不动。 */
export function copyNativeClosure(source, output, declaredFiles) {
    const declared = new Set(declaredFiles), buffers = new Map(), documents = new Map(), references = new Map();
    const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
    for (const file of declaredFiles) {
        const bytes = fs.readFileSync(path.join(source, file)); buffers.set(file, bytes);
        if (!/\.(lh|lmat)$/.test(file)) continue;
        const document = JSON.parse(bytes.toString('utf8')), refs = [];
        const visit = (value, pointer) => {
            if (!value || typeof value !== 'object') return;
            for (const [key, item] of Object.entries(value)) {
                const location = pointer + '/' + key.replace(/~/g, '~0').replace(/\//g, '~1');
                if ((key === '_$uuid' || key === 'path') && typeof item === 'string') {
                    if (item.startsWith('res://00000000')) continue;
                    if (item.startsWith('res://') || item.includes('\\') || path.posix.isAbsolute(item)) throw new Error('非包内原生引用：' + file + location);
                    const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), item));
                    if (!declared.has(target)) throw new Error('原生引用缺失或越界：' + file + ' -> ' + target);
                    refs.push({ owner: value, key, target, pointer: location });
                } else visit(item, location);
            }
        };
        visit(document, ''); documents.set(file, document); references.set(file, refs);
    }
    const aliases = new Map(), canonicalByKey = new Map(), merged = [];
    for (const file of [...declaredFiles].sort()) {
        const ext = path.posix.extname(file), hash = digest(buffers.get(file));
        // 同字节材质若位于不同目录，同一相对路径可能指向不同纹理；连同字段位置比较解析后的引用。
        const refs = references.get(file) || [], semantic = JSON.stringify(refs.map(r => [r.pointer, r.target]));
        const key = ext + ':' + hash + ':' + semantic;
        const duplicate = ext === '.lm' || ext === '.lmat' ? canonicalByKey.get(key) : undefined;
        if (duplicate) { aliases.set(file, duplicate); merged.push({ original: file, canonical: duplicate, sha256: hash, bytes: buffers.get(file).length }); }
        else { aliases.set(file, file); canonicalByKey.set(key, file); }
    }
    const files = [...new Set(aliases.values())].sort();
    for (const file of files) {
        const refs = references.get(file) || [];
        for (const ref of refs) ref.owner[ref.key] = path.posix.relative(path.posix.dirname(file), aliases.get(ref.target));
        const data = documents.has(file) ? Buffer.from(JSON.stringify(documents.get(file))) : buffers.get(file);
        const destination = path.join(output, file); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, data);
        // 写出后的闭包再按最终路径核对，不能仅依赖去重表的理论关系。
        for (const ref of refs) {
            const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), ref.owner[ref.key]));
            if (!files.includes(resolved)) throw new Error('去重后原生引用缺失：' + file + ' -> ' + resolved);
        }
    }
    const beforeBytes = [...buffers.values()].reduce((n, bytes) => n + bytes.length, 0);
    const afterBytes = files.reduce((n, file) => n + fs.statSync(path.join(output, file)).size, 0);
    return { files, beforeBytes, afterBytes, savedBytes: beforeBytes - afterBytes, merged, checkedReferences: [...references.values()].reduce((n, refs) => n + refs.length, 0) };
}
