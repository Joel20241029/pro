"""Bind a measured villager profile, save the profile’s real walking poses for offline rendering.

Blender args: -- inspected.blend profile.json output_dir
The profile is identity-specific, measured from the untouched normalized mesh.
"""
import json
import hashlib
import math
import sys
from pathlib import Path

import bpy
from mathutils import Quaternion, Vector

sys.path.insert(0, str(Path(__file__).parent))
from character_weights import segment_distance, smooth_weights

source, profile_file, output = map(Path, sys.argv[sys.argv.index('--') + 1:])
profile = json.loads(profile_file.read_text())
role = profile['role']
output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source))
mesh = bpy.data.objects['CharacterSource']
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.object.armature_add(enter_editmode=True)
rig = bpy.context.object
rig.name = 'VillagerEditableRig'
bones = rig.data.edit_bones
bones.remove(bones[0])
spec = profile['bones']
for name, (start, end, parent) in spec.items():
    bone = bones.new(name)
    bone.head, bone.tail = start, end
    bone.use_deform = name != 'Root'
    if parent:
        bone.parent = bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
groups = {name: mesh.vertex_groups.new(name=name) for name in spec if name != 'Root'}
weights, protected = [], set()
region = profile['weightRegions']
cane_indices = []
for vertex in mesh.data.vertices:
    point = vertex.co
    side = 'L' if point.x > region['centerX'] else 'R'
    cane = profile['cane']
    if cane and all(cane['min'][axis] <= point[axis] <= cane['max'][axis] for axis in range(3)):
        weights.append({'Cane': 1})
        protected.add(vertex.index)
        cane_indices.append(vertex.index)
        continue
    if point.z < region['shoeRigidTop']:
        # A boot sole must not flex with the shin. Identity-specific measured
        # shoe bounds keep the heel/toe together; the ankle transition smooths.
        weights.append({'Foot.' + side: 1})
        protected.add(vertex.index)
        continue
    # Low ponytail vertices behind the neck are rigidly weighted to the head.
    rear = profile.get('headRearProtection')
    if rear and point.y >= rear['minY'] and point.z >= rear['minZ']:
        weights.append({'Head': 1})
        protected.add(vertex.index)
        continue
    if point.z >= region['headStart']:
        weights.append({'Head': 1})
        if point.z >= region['headRigidStart']:
            protected.add(vertex.index)
        continue
    if role == 'elder' and point.z >= region['upperBodyRigidStart']:
        weights.append({'Spine': 1})
        protected.add(vertex.index)
        continue
    if point.z < region['legEnd']:
        names = ['Thigh.' + side, 'Shin.' + side, 'Foot.' + side]
    elif (abs(point.x - region['centerX']) > region['armOuterX']
          and region.get('armBottom', region['legEnd']) <= point.z < region['armTop']
          and point.y <= region.get('armMaxY', math.inf)):
        names = ['UpperArm.' + side, 'Forearm.' + side, 'Hand.' + side]
    else:
        names = ['Hips', 'Spine']
    distances = [(name, segment_distance(point, *spec[name][:2])) for name in names]
    raw = [(name, 1 / (distance + .013) ** 5) for name, distance in distances]
    total = sum(value for _, value in raw)
    weights.append({name: value / total for name, value in raw})
weights = smooth_weights(mesh, weights, protected)
for index, values in enumerate(weights):
    assert abs(sum(values.values()) - 1) < 1e-5
    for name, weight in values.items():
        groups[name].add([index], weight, 'REPLACE')
mesh.parent = rig
modifier = mesh.modifiers.new('Offline skeleton', 'ARMATURE')
modifier.object = rig
feet = {
    side: [vertex.index for vertex in mesh.data.vertices
           if vertex.co.z < .10 and sum(weights[vertex.index].get(part + '.' + side, 0)
                                        for part in ['Foot', 'Shin', 'Thigh']) > .5]
    for side in ['L', 'R']
}
assert all(feet.values()), 'Measured shoe regions must contain vertices'
targets = {}
for side in ['L', 'R']:
    position = Vector(spec['Foot.' + side][0])
    target = bpy.data.objects.new('AnkleControl.' + side, None)
    bpy.context.collection.objects.link(target)
    target.empty_display_type, target.empty_display_size = 'SPHERE', .025
    target.location = position
    target.rotation_mode = 'QUATERNION'
    target.rotation_quaternion = rig.data.bones['Foot.' + side].matrix_local.to_quaternion()
    pole = bpy.data.objects.new('KneePole.' + side, None)
    bpy.context.collection.objects.link(pole)
    pole.location = (position.x, position.y - .55, .2)
    ik = rig.pose.bones['Shin.' + side].constraints.new('IK')
    ik.target, ik.pole_target, ik.chain_count, ik.pole_angle = target, pole, 2, -math.pi / 2
    foot = rig.pose.bones['Foot.' + side].constraints.new('COPY_ROTATION')
    foot.target, foot.target_space, foot.owner_space = target, 'WORLD', 'WORLD'
    targets[side] = target
for bone in rig.pose.bones:
    bone.rotation_mode = 'QUATERNION'

def turn_bone(name, angle):
    axis = rig.data.bones[name].matrix_local.to_3x3().inverted() @ Vector((1, 0, 0))
    rig.pose.bones[name].rotation_quaternion = Quaternion(axis, angle)

scene = bpy.context.scene
scene.render.fps, scene.frame_start, scene.frame_end = profile['fps'], 1, len(profile['poses']) + 1
report = []
for frame, pose in enumerate(profile['poses'] + [profile['idlePose']], 1):
    scene.frame_set(frame)
    for bone in rig.pose.bones:
        bone.rotation_quaternion, bone.location = (1, 0, 0, 0), (0, 0, 0)
    rig.location = (0, pose['bodyY'], pose['bodyZ'])
    for side in ['L', 'R']:
        position = Vector(spec['Foot.' + side][0])
        forward, lift = pose[side]
        position.y += forward
        position.z += lift
        targets[side].location = position
        sign = 1 if side == 'L' else -1
        turn_bone('UpperArm.' + side, profile['armSwing'] * pose['swing'] * sign)
        turn_bone('Forearm.' + side, profile['elbowBend'])
    # Ground each shoe independently. The elder's cane must not conceal a
    # floating support foot by becoming the minimum vertex of the whole mesh.
    for _ in range(20):
        bpy.context.view_layer.update()
        evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
        vertices = [evaluated.matrix_world @ vertex.co for vertex in evaluated.data.vertices]
        for side in ['L', 'R']:
            targets[side].location.z += pose[side][1] - min(vertices[i].z for i in feet[side])
    bpy.context.view_layer.update()
    evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
    vertices = [evaluated.matrix_world @ vertex.co for vertex in evaluated.data.vertices]
    sole_heights = {side: min(vertices[i].z for i in feet[side]) for side in ['L', 'R']}
    assert all(abs(sole_heights[side] - pose[side][1]) < .002 for side in ['L', 'R']), {
        'role': role, 'frame': frame, 'soleHeights': sole_heights,
        'minimumVertices': {side: {
            'index': (index := min(feet[side], key=lambda i: vertices[i].z)),
            'rest': list(mesh.data.vertices[index].co), 'weights': weights[index],
            'target': list(targets[side].location),
        } for side in ['L', 'R']},
    }
    lowest = min(vertex.z for vertex in vertices)
    assert lowest > -.002, ('mesh penetrates the ground', role, frame, lowest)
    for bone in rig.pose.bones:
        bone.keyframe_insert('rotation_quaternion', frame=frame)
    rig.keyframe_insert('location', frame=frame)
    for target in targets.values():
        target.keyframe_insert('location', frame=frame)
        target.keyframe_insert('rotation_quaternion', frame=frame)
    report.append({'frame': frame, 'pose': pose, 'lowestWorldZ': lowest,
        'shoeMinimumZ': sole_heights, 'shoeVertexCounts': {side: len(ids) for side, ids in feet.items()},
        'caneTipZ': min(vertices[i].z for i in cane_indices) if cane_indices else None})
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(output / f'{role}_walk_probe.blend'))
(output / 'walk-probe.json').write_text(json.dumps({
    'role': role, 'profile': profile_file.name, 'frames': report, 'boneCount': len(spec),
    'caneRigidVertices': cane_indices, 'status': 'four_direction_visual_review_required',
    'runtime3d': False,
    'inputs': [{'file': p.name, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
               for p in [source, profile_file, Path(__file__), Path(__file__).with_name('character_weights.py')]],
}, indent=2) + '\n')
print('WALK_BINDING_READY', role, len(spec), len(cane_indices))
