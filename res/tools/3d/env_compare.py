"""Compare delivered triangles in world space without Blender or native packages."""
import argparse
from collections import defaultdict
import itertools
import json
import math
from pathlib import Path
import struct

IDENTITY = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]


def multiply(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def transform(node):
    if 'matrix' in node:
        return [[node['matrix'][j * 4 + i] for j in range(4)] for i in range(4)]
    x, y, z, w = node.get('rotation', [0, 0, 0, 1])
    scale = node.get('scale', [1, 1, 1])
    at = node.get('translation', [0, 0, 0])
    rotation = [[1-2*y*y-2*z*z, 2*x*y-2*z*w, 2*x*z+2*y*w],
                [2*x*y+2*z*w, 1-2*x*x-2*z*z, 2*y*z-2*x*w],
                [2*x*z-2*y*w, 2*y*z+2*x*w, 1-2*x*x-2*y*y]]
    return [[rotation[i][j] * scale[j] for j in range(3)] + [at[i]] for i in range(3)] + [[0, 0, 0, 1]]


def triangles(path):
    data = path.read_bytes()
    size = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20 + size])
    binary = data[28 + size:]
    result = defaultdict(list)

    def accessor(index):
        a = doc['accessors'][index]
        view = doc['bufferViews'][a['bufferView']]
        offset = view.get('byteOffset', 0) + a.get('byteOffset', 0)
        code = {5126: 'f', 5125: 'I', 5123: 'H', 5121: 'B'}[a['componentType']]
        count = {'VEC3': 3, 'SCALAR': 1}[a['type']]
        stride = view.get('byteStride', struct.calcsize('<' + code * count))
        return [struct.unpack_from('<' + code * count, binary, offset + k * stride) for k in range(a['count'])]

    def visit(index, matrix):
        node = doc['nodes'][index]
        matrix = multiply(matrix, transform(node))
        if 'mesh' in node:
            for primitive in doc['meshes'][node['mesh']]['primitives']:
                vertices = accessor(primitive['attributes']['POSITION'])
                vertices = [tuple(sum(matrix[i][j] * p[j] for j in range(3)) + matrix[i][3] for i in range(3)) for p in vertices]
                indices = [v[0] for v in accessor(primitive['indices'])]
                material = doc['materials'][primitive['material']]['name']
                for k in range(0, len(indices), 3):
                    raw = tuple(vertices[i] for i in indices[k:k + 3])
                    key = material, tuple(sorted(tuple(round(v, 4) for v in p) for p in raw))
                    result[key].append(raw)
        for child in node.get('children', []):
            visit(child, matrix)

    for root in doc['scenes'][doc.get('scene', 0)]['nodes']:
        visit(root, IDENTITY)
    return result


def compare(original, candidate, tolerance):
    a, b = triangles(original), triangles(candidate)
    count_a, count_b = sum(map(len, a.values())), sum(map(len, b.values()))
    assert count_a == count_b, (original.name, count_a, count_b)
    left, right = [], []
    for key in a.keys() | b.keys():
        common = min(len(a[key]), len(b[key]))
        left.extend((key[0], tri) for tri in a[key][common:])
        right.extend((key[0], tri) for tri in b[key][common:])
    maximum = 0
    for material, triangle in left:
        found = None
        best_error = math.inf
        for i, (other_material, other) in enumerate(right):
            if material != other_material:
                continue
            error = min(max(math.dist(p, q) for p, q in zip(triangle, permutation)) for permutation in itertools.permutations(other))
            if error < best_error:
                best_error, found = error, i
        assert best_error <= tolerance, (original.name, 'unmatched triangle', best_error)
        maximum = max(maximum, best_error)
        right.pop(found)
    assert not right
    print(f'{original.stem}: {count_a} triangles, all material-labelled faces match; boundary float delta <= {maximum:.3g}')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('original', type=Path)
    parser.add_argument('candidate', type=Path)
    parser.add_argument('--tolerance', type=float, default=2e-6)
    parser.add_argument('--allow-new', action='store_true', help='Explicitly report new assets that have no baseline')
    args = parser.parse_args()
    for path in sorted(args.candidate.glob('*.glb')):
        if args.allow_new and not (args.original / path.name).exists():
            print(f'{path.stem}: new asset, no baseline triangle comparison')
            continue
        compare(args.original / path.name, path, args.tolerance)


if __name__ == '__main__':
    main()
