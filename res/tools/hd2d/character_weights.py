"""Authoring-only skin weights with duplicate-UV seam continuity."""
from mathutils import Vector


def segment_distance(point, start, end):
    start, end = Vector(start), Vector(end)
    segment = end - start
    along = max(0, min(1, (point - start).dot(segment) / segment.length_squared))
    return (point - start - segment * along).length


def smooth_weights(mesh, weights, protected):
    """Smooth cloth transitions; rigid head/cane groups remain untouched."""
    neighbors = [set() for _ in mesh.data.vertices]
    positions = {}
    for vertex in mesh.data.vertices:
        positions.setdefault(tuple(round(c, 5) for c in vertex.co), []).append(vertex.index)
    for edge in mesh.data.edges:
        a, b = edge.vertices
        neighbors[a].add(b)
        neighbors[b].add(a)
    for same in positions.values():
        common = set(same).union(*(neighbors[i] for i in same))
        for i in same:
            neighbors[i].update(common - {i})
    # Matches the male seam fix: six passes, 60% self / 40% neighbors.
    for _ in range(6):
        updated = []
        for i, current in enumerate(weights):
            if i in protected or not neighbors[i]:
                updated.append(current)
                continue
            mixed = {key: value * .60 for key, value in current.items()}
            for other in neighbors[i]:
                for key, value in weights[other].items():
                    mixed[key] = mixed.get(key, 0) + value * .40 / len(neighbors[i])
            top = sorted(mixed.items(), key=lambda item: -item[1])[:4]
            total = sum(value for _, value in top)
            updated.append({key: value / total for key, value in top})
        weights = updated
    for same in positions.values():
        if len(same) < 2:
            continue
        locked = next((i for i in same if i in protected), None)
        if locked is not None:
            merged = weights[locked]
        else:
            merged = {}
            for i in same:
                for key, value in weights[i].items():
                    merged[key] = merged.get(key, 0) + value / len(same)
        for i in same:
            weights[i] = merged
    return weights
