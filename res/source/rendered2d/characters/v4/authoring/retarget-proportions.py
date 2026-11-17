"""Reshape the approved actor in bind space and solve its existing six walking poses."""
from hashlib import sha256
from pathlib import Path
import json
import math
import sys

import bpy
from mathutils import Quaternion, Vector

source, profile_file, output = map(Path, sys.argv[sys.argv.index('--') + 1:])
profile = json.loads(profile_file.read_text())
role = profile['role']
output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source))
bpy.context.preferences.filepaths.save_version = 0
mesh = bpy.data.objects['CharacterSource']
rig = bpy.data.objects['VillagerEditableRig']
scene = bpy.context.scene
rig.animation_data_clear()
rig.rotation_euler = (0, 0, 0)
rig.location = (0, 0, 0)
rig.data.pose_position = 'POSE'
for bone in rig.pose.bones:
    bone.rotation_quaternion = (1, 0, 0, 0)
    bone.location = (0, 0, 0)
targets = {side: bpy.data.objects['AnkleControl.' + side] for side in ['L', 'R']}
poles = {side: bpy.data.objects['KneePole.' + side] for side in ['L', 'R']}
for target in targets.values():
    target.animation_data_clear()

# Measured at the collar in the common normalized model. Taller hair, hat and
# armor retain the relative silhouette of the prototype in the approved sheet.
neck = profile['weightRegions']['headStart']
height = max(v.co.z for v in mesh.data.vertices)
body_fraction = {'blue': .397, 'straw': .414, 'red': .404, 'jade': .395,
                 'elite_male': .417, 'elite_female': .409, 'child': .377, 'elder': .405}[role]
head_width = {'blue': 1.44, 'straw': 1.33, 'red': 1.41, 'jade': 1.41,
              'elite_male': 1.39, 'elite_female': 1.38, 'child': 1.31, 'elder': 1.36}[role]
body_width = {'blue': 1.26, 'straw': 1.11, 'red': 1.20, 'jade': 1.24,
              'elite_male': 1.14, 'elite_female': 1.19, 'child': 1.15, 'elder': 1.14}[role]
target_neck = height * body_fraction
depth_scale = 1.10
# These four short-legged silhouettes need a smaller reach once the legs are
# shortened. The same scale is written to the distance-driven runtime stride.
short_reach = {'blue', 'straw', 'child', 'elite_male'}
step_ratio = (target_neck / neck) * .89 if role in short_reach else math.sqrt(target_neck / neck)

def smooth(value):
    t = min(1., max(0., value))
    return t * t * (3. - 2. * t)

def reshape(co):
    x, y, z = co
    head = smooth((z - neck + .065) / .125)
    boot = smooth(z / .15)
    torso = 1.065 + (body_width - 1.065) * boot
    width = torso + (head_width - torso) * head
    if z <= neck:
        # Keep the boot sole volume. Compress the exposed leg and torso above it.
        bz, new_bz = .052, .045
        nz = z * new_bz / bz if z <= bz else new_bz + (z - bz) * (target_neck - new_bz) / (neck - bz)
    else:
        nz = target_neck + (z - neck) * (height - target_neck) / (height - neck)
    return Vector((x * width, y * (depth_scale + .14 * head), nz))

groups = {group.name: group.index for group in mesh.vertex_groups}
shoe_indices = {}
for side in ['L', 'R']:
    ids = {groups[part + '.' + side] for part in ['Foot', 'Shin', 'Thigh']}
    shoe_indices[side] = [v.index for v in mesh.data.vertices if v.co.z < .10 and
                          sum(g.weight for g in v.groups if g.group in ids) > .5]
assert all(shoe_indices.values())
cane_index = groups.get('Cane')
cane = [v.index for v in mesh.data.vertices if any(g.group == cane_index and g.weight > .5 for g in v.groups)]

for vertex in mesh.data.vertices:
    vertex.co = reshape(vertex.co)
mesh.data.update()
bpy.context.view_layer.objects.active = rig
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for bone in rig.data.edit_bones:
    bone.head = reshape(bone.head)
    bone.tail = reshape(bone.tail)
bpy.ops.object.mode_set(mode='OBJECT')

for name, (_, _, parent) in profile['bones'].items():
    b = rig.data.bones[name]
    profile['bones'][name] = [list(b.head_local), list(b.tail_local), parent]
for side in targets:
    foot = rig.data.bones['Foot.' + side]
    targets[side].location = foot.head_local
    targets[side].rotation_quaternion = foot.matrix_local.to_quaternion()
    poles[side].location = (foot.head_local.x, foot.head_local.y - .55, .18)

for key in ['headStart','headRigidStart','legEnd','armTop','shoeRigidTop','armBottom','upperBodyRigidStart']:
    if key in profile['weightRegions']:
        profile['weightRegions'][key] = reshape((0, 0, profile['weightRegions'][key])).z
for pose in profile['poses'] + [profile['idlePose']]:
    for side in targets:
        pose[side][0] *= step_ratio
        pose[side][1] *= .88
    pose['bodyZ'] *= step_ratio
    if role in short_reach and pose is not profile['idlePose']:
        pose['bodyZ'] = min(pose['bodyZ'], -.025)
if role == 'red':
    # The sixth pose is toe-off under a flared skirt. Show the weight transfer
    # in the torso as well, so the back-left view retains the alternating beat.
    toe_off = profile['poses'][5]
    toe_off['bodyZ'] -= .007
    toe_off['swing'] *= .55
for key in ['strideCanvasPixels', 'strideModelUnits']:
    profile['walkCycle'][key] *= step_ratio
profile['proportions'] = {'collarHeight': target_neck, 'sourceCollarHeight': neck, 'height': height,
                          'headWidthScale': head_width, 'torsoWidthScale': body_width, 'strideScale': step_ratio}

def turn(name, radians):
    b = rig.data.bones[name]
    axis = b.matrix_local.to_3x3().inverted() @ Vector((1, 0, 0))
    rig.pose.bones[name].rotation_quaternion = Quaternion(axis, radians)

def vertices():
    bpy.context.view_layer.update()
    return mesh.evaluated_get(bpy.context.evaluated_depsgraph_get()).data.vertices

records = []
for frame, pose in enumerate(profile['poses'] + [profile['idlePose']], 1):
    scene.frame_set(frame)
    for bone in rig.pose.bones:
        bone.rotation_quaternion = (1, 0, 0, 0)
        bone.location = (0, 0, 0)
    rig.location = (0, pose['bodyY'], pose['bodyZ'])
    for side, target in targets.items():
        point = rig.data.bones['Foot.' + side].head_local.copy()
        point.y += pose[side][0]
        point.z += pose[side][1]
        target.location = point
        turn('UpperArm.' + side, profile['armSwing'] * pose['swing'] * (1 if side == 'L' else -1))
        turn('Forearm.' + side, profile['elbowBend'])
    scene_matrix = mesh.matrix_world.copy()
    for _ in range(7):
        verts = vertices()
        for side, foot in shoe_indices.items():
            ground = min((scene_matrix @ verts[i].co).z for i in foot)
            targets[side].location.z += pose[side][1] - ground
    verts = vertices()
    shoe = {side: min((scene_matrix @ verts[i].co).z for i in foot) for side, foot in shoe_indices.items()}
    lowest = min((scene_matrix @ v.co).z for v in verts)
    assert max(abs(shoe[side] - pose[side][1]) for side in targets) < .002 and lowest > -.002, (role, frame, shoe, lowest)
    records.append({'frame': frame, 'pose': pose, 'shoeMinimumZ': shoe,
                    'lowestWorldZ': lowest, 'caneTipZ': min((scene_matrix @ verts[i].co).z for i in cane) if cane else None})
    for bone in rig.pose.bones:
        bone.keyframe_insert('rotation_quaternion', frame=frame)
    rig.keyframe_insert('location', frame=frame)
    for target in targets.values():
        target.keyframe_insert('location', frame=frame)
        target.keyframe_insert('rotation_quaternion', frame=frame)
scene.frame_start, scene.frame_end = 1, len(records)
scene.frame_set(1)
scene.render.use_persistent_data = True
scene.cycles.samples = 22
bpy.ops.wm.save_as_mainfile(filepath=str(output / f'{role}_walk_probe.blend'), compress=True)
(output / 'rig-profile.json').write_text(json.dumps(profile, indent=2) + '\n')
(output / 'walk-probe.json').write_text(json.dumps({
    'role':role, 'frames':records, 'boneCount':len(profile['bones']),
    'sourceSha256':sha256(source.read_bytes()).hexdigest(), 'proportions':profile['proportions'],
    'method':'bind-space deformation with existing skin weights and independently grounded ankles',
}, indent=2) + '\n')
print('RETARGET_READY',role,body_fraction,len(records))
