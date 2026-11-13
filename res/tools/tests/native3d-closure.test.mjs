import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { copyNativeClosure } from '../native3d-closure.mjs';

// 中间夹具显式落在Downloads；这些小文件只验证引用语义，不冒充Laya的网格二进制解析。
const work = process.argv[2];
assert.ok(work?.startsWith('/Users/happyelements/Downloads/'), '传入Downloads中的独立测试目录');
const source = path.join(work, 'source'), output = path.join(work, 'output');
const values = {
    'A/mesh.lm': 'identical-mesh-fixture', 'B/mesh.lm': 'identical-mesh-fixture',
    'internal/shared.bin': 'shared-shader-fixture',
    'A/shared.lmat': JSON.stringify({ path: '../internal/shared.bin', value: 1 }),
    'B/shared.lmat': JSON.stringify({ path: '../internal/shared.bin', value: 1 }),
    'A/local.lmat': JSON.stringify({ path: 'texture.png', value: 1 }),
    'B/local.lmat': JSON.stringify({ path: 'texture.png', value: 1 }),
    'A/texture.png': 'texture-a-fixture', 'B/texture.png': 'texture-b-fixture',
    'prefabs/root.lh': JSON.stringify({ mesh: { _$uuid: '../B/mesh.lm' }, shared: { path: '../B/shared.lmat' }, local: { path: '../B/local.lmat' }, node: { _$ref: 'local-node-id' }, builtin: { _$uuid: 'res://00000000-0000-built-in' } })
};
for (const [file, data] of Object.entries(values)) { const target = path.join(source, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, data); }
const result = copyNativeClosure(source, output, Object.keys(values));
assert.equal(result.merged.length, 2);
assert.ok(!result.files.includes('B/mesh.lm'));
assert.ok(!result.files.includes('B/shared.lmat'));
assert.ok(result.files.includes('A/local.lmat') && result.files.includes('B/local.lmat'), '相同JSON在不同目录指向不同纹理，不能合并');
const scene = JSON.parse(fs.readFileSync(path.join(output, 'prefabs/root.lh')));
assert.equal(scene.mesh._$uuid, '../A/mesh.lm');
assert.equal(scene.shared.path, '../A/shared.lmat');
assert.equal(scene.local.path, '../B/local.lmat');
assert.equal(scene.node._$ref, 'local-node-id');
assert.equal(scene.builtin._$uuid, 'res://00000000-0000-built-in');
assert.deepEqual(fs.readFileSync(path.join(output, 'A/mesh.lm')), fs.readFileSync(path.join(source, 'A/mesh.lm')));
assert.equal(result.savedBytes, result.beforeBytes - result.files.reduce((n, file) => n + fs.statSync(path.join(output, file)).size, 0));
fs.writeFileSync(path.join(source, 'broken.lh'), JSON.stringify({ path: '../outside.lmat' }));
assert.throws(() => copyNativeClosure(source, output, [...Object.keys(values), 'broken.lh']), /缺失或越界/);
console.log(JSON.stringify({ passed: 12, merged: result.merged.length, savedBytes: result.savedBytes }));
