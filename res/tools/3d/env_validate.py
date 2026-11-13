"""Read-only GLB delivery checks; run with system Python, no Blender required."""
import json
import math
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / 'res/source/3d/environment'
OUTPUT = ROOT / 'res/editor/BuildingWorkshop/assets/world3d/environment'
BUILDINGS = {'ARROW', 'STONE', 'SLOW', 'HOUSE', 'GATE', 'FARM', 'LOGGING'}
TOWERS = {'ARROW', 'STONE', 'SLOW'}


def validate(path):
    data = path.read_bytes()
    assert struct.unpack_from('<III', data) == (0x46546C67, 2, len(data)), path
    size, kind = struct.unpack_from('<II', data, 12)
    assert kind == 0x4E4F534A, path
    doc = json.loads(data[20:20 + size])
    binary_length, binary_kind = struct.unpack_from('<II', data, 20 + size)
    assert binary_kind == 0x004E4942
    binary = data[28 + size:28 + size + binary_length]
    assert not doc.get('textures') and not doc.get('images')
    assert not doc.get('animations') and not doc.get('cameras')
    assert all('uri' not in b for b in doc.get('buffers', []))
    nodes = doc['nodes']
    roots = [nodes[i] for i in doc['scenes'][doc.get('scene', 0)]['nodes']]
    assert len(roots) == 1 and roots[0]['name'] == path.stem, path
    levels = {nodes[i]['name']: nodes[i] for i in roots[0].get('children', [])
              if nodes[i]['name'].startswith('Level')}
    if path.stem in BUILDINGS:
        assert set(levels) == {'Level1', 'Level4', 'Level8', 'Level12'}, path
    if path.stem in TOWERS:
        for level in levels.values():
            weapons = [nodes[i] for i in level['children'] if nodes[i]['name'] == 'Weapon']
            assert len(weapons) == 1, path
            assert len([i for i in weapons[0]['children'] if nodes[i]['name'] == 'Muzzle']) == 1, path
    # Validate mesh streams instead of treating a successful export log as proof.
    for shape in doc.get('meshes', []):
        for primitive in shape['primitives']:
            positions = doc['accessors'][primitive['attributes']['POSITION']]
            assert positions['componentType'] == 5126 and positions['type'] == 'VEC3'
            view = doc['bufferViews'][positions['bufferView']]
            offset = view.get('byteOffset', 0) + positions.get('byteOffset', 0)
            for i in range(positions['count']):
                values = struct.unpack_from('<fff', binary, offset + i * view.get('byteStride', 12))
                assert all(math.isfinite(v) for v in values), path
            indices = doc['accessors'][primitive['indices']]
            assert indices['count'] % 3 == 0
            view = doc['bufferViews'][indices['bufferView']]
            offset = view.get('byteOffset', 0) + indices.get('byteOffset', 0)
            code = {5121: 'B', 5123: 'H', 5125: 'I'}[indices['componentType']]
            values = struct.unpack_from('<' + code * indices['count'], binary, offset)
            assert min(values) >= 0 and max(values) < positions['count'], path
    return len(data)


def main():
    manifest = json.loads((SOURCE / 'manifest.json').read_text())
    actual = {p.stem for p in OUTPUT.glob('*.glb')}
    assert actual == set(manifest['assets']), (actual, set(manifest['assets']))
    total = 0
    for name, report in manifest['assets'].items():
        size = validate(OUTPUT / (name + '.glb'))
        assert size == report['bytes']
        assert (SOURCE / (name + '.blend')).stat().st_size > 0
        total += size
    print(f'PASS: {len(actual)} GLBs, {total} bytes; roots, stages, muzzle hooks, vertex/index streams, texture-free payloads, source pairs.')


if __name__ == '__main__':
    main()
