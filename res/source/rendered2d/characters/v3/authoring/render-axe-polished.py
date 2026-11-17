"""Render work actions from the existing high-resolution measured villager rigs.

Blender --background --python this.py -- walk.blend profile.json poses.json out
No runtime model, procedural replacement person, mirrored lighting or game data.
The saved .blend retains the four poses, tools, materials, camera and lights.
"""
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector
from bpy_extras.object_utils import world_to_camera_view

sys.dont_write_bytecode = True
source, profile_path, poses_path, output = map(Path, sys.argv[sys.argv.index('--') + 1:][:4])
profile = json.loads(profile_path.read_text())
config = json.loads(poses_path.read_text())
config['actions'] = {'chop': config['actions']['chop']}
if '--axe-test' in sys.argv:
    config['actions']['chop']['directions'] = {'right': 90, 'down_right': 45}
output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source))
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
mesh = bpy.data.objects['CharacterSource']
rig = bpy.data.objects['VillagerEditableRig']
rig.animation_data_clear()
rig.location = (0, 0, 0)
for bone in rig.pose.bones:
    bone.rotation_quaternion = (1, 0, 0, 0)
    bone.location = (0, 0, 0)
for side in ['L', 'R']:
    target = bpy.data.objects['AnkleControl.' + side]
    target.animation_data_clear()
    target.location = profile['bones']['Foot.' + side][0]
anchor = Vector(profile['groundAnchor'])
root = bpy.data.objects.new('WholeCharacterFacing', None)
bpy.context.collection.objects.link(root)
root.location = anchor
bpy.context.view_layer.update()
for obj in [rig] + [bpy.data.objects[n + '.' + s] for n in ['AnkleControl', 'KneePole'] for s in ['L', 'R']]:
    world = obj.matrix_world.copy()
    obj.parent = root
    obj.matrix_parent_inverse = root.matrix_world.inverted()
    obj.matrix_world = world


def material(name, color, metallic=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = .42 if metallic else .64
    return mat


wood = material('LaborHoneyWood', (.30, .12, .025))
iron = material('LaborBeveledIron', (.16, .22, .25), .62)
edge_steel = material('SharpenedHatchetEdge', (.54, .62, .66), .63)
grip_mat = material('LaborLeatherGrip', (.16, .065, .025))
tools = {}
for kind in ['axe', 'hoe', 'sword']:
    tool = bpy.data.objects.new('Labor_' + kind, None)
    bpy.context.collection.objects.link(tool)
    tool.parent = root
    tool.matrix_parent_inverse = root.matrix_world.inverted()
    # Local Z runs from the gripping hand to the blade. Work-specific angles
    # are keyed after skin evaluation, so the shaft stays through the palm.
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=.012, depth=.39)
    shaft = bpy.context.object
    shaft.name = kind + '_WoodShaft'
    shaft.parent = tool
    shaft.location = (0, 0, .115)
    shaft.data.materials.append(wood)
    bevel = shaft.modifiers.new('Rounded handle ends', 'BEVEL')
    bevel.width, bevel.segments = .006, 3
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=.018, depth=.075)
    grip = bpy.context.object
    grip.name = kind + '_LeatherGrip'
    grip.parent = tool
    grip.location = (0, 0, 0)
    grip.data.materials.append(grip_mat)
    if kind == 'axe':
        # Broad cutting face lies in the swing plane. The former X/Z block
        # turned edge-on in both side views and read as a hammer, not an axe.
        # Flared iron cheek, curved cutting edge and blunt poll on the opposite side.
        # The shaft ends in the eye instead of extending through the blade.
        profile_points = [
            (.057, .262), (.056, .332), (.009, .337), (-.059, .340),
            (-.111, .377), (-.150, .399), (-.168, .385), (-.184, .344),
            (-.191, .292), (-.187, .242), (-.169, .196), (-.144, .187),
            (-.112, .203), (-.104, .239), (-.063, .258), (.003, .256)
        ]
        def thickness(y):
            return .004 + .014 * min(1, (y + .191) / .19)
        verts = [(sign * thickness(y), y, z) for sign in [-1, 1] for y, z in profile_points]
        count = len(profile_points)
        faces = [tuple(range(count - 1, -1, -1)), tuple(range(count, count * 2))]
        faces += [(i, (i + 1) % count, (i + 1) % count + count, i + count) for i in range(count)]
        data = bpy.data.meshes.new('ForgedAxeWedge')
        data.from_pydata(verts, [], faces)
        data.update()
        blade = bpy.data.objects.new('AxeBlade', data)
        bpy.context.collection.objects.link(blade)
    else:
        bpy.ops.mesh.primitive_cube_add(size=1)
        blade = bpy.context.object
    blade.name = kind + '_BeveledBlade'
    blade.parent = tool
    if kind == 'hoe':
        blade.location = (0, -.035, .315)
        blade.dimensions = (.18, .11, .025)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if kind == 'sword':
        blade.location = (0, 0, .272)
        blade.dimensions = (.052, .023, .24)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    blade.data.materials.append(iron)
    if kind == 'axe':
        # Thin bright sharpening bevel is part of the geometry and follows
        # the cutting edge instead of swinging as a detached decal.
        ribbon = []
        for yy, zz in profile_points[5:12]:
            ribbon.extend([(thickness(yy) + .0005, yy, zz), (thickness(yy + .022) + .0005, yy + .022, zz)])
        spans = [(i, i + 1, i + 3, i + 2) for i in range(0, len(ribbon) - 2, 2)]
        for sign in [-1, 1]:
            metal = bpy.data.meshes.new('SingleBitSharpenedFace')
            metal.from_pydata([(abs(x) * sign, y, z) for x, y, z in ribbon], [], spans)
            strip = bpy.data.objects.new('SharpenedEdge', metal)
            bpy.context.collection.objects.link(strip)
            strip.parent = tool
            metal.materials.append(edge_steel)
    bevel = blade.modifiers.new('Soft forged edge', 'BEVEL')
    bevel.width, bevel.segments = (.004 if kind == 'axe' else .012), 3
    normal = blade.modifiers.new('Weighted face normals', 'WEIGHTED_NORMAL')
    normal.keep_sharp = True
    tools[kind] = tool

hand_group = mesh.vertex_groups['Hand.R'].index
# Same weighted-palm selection as the existing character_props tool mounting:
# hand/forearm blend weights are intentionally shared around the wrist.
palm = [(v.index, g.weight ** 2) for v in mesh.data.vertices for g in v.groups
        if g.group == hand_group and g.weight > .25]
assert palm, 'Measured right palm has no rigid vertices'
weight_sum = sum(weight for _, weight in palm)
camera = scene.camera
aim = anchor + Vector((0, 0, .49))
camera.location = aim + Vector((0, -3, 1.25))
camera.rotation_euler = (aim - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.ortho_scale = 1.50
scene.render.fps = config['fps']
scene.cycles.samples = 20
scene.render.use_persistent_data = True
if '--metal' in sys.argv:
    cycles = bpy.context.preferences.addons['cycles'].preferences
    cycles.compute_device_type = 'METAL'
    for device in cycles.get_devices_for_type('METAL'):
        device.use = device.type == 'METAL'
    scene.cycles.device = 'GPU'
scene.frame_start, scene.frame_end = 1, max(len(a['poses']) for a in config['actions'].values())
records = []


def turn(name, pitch, yaw=0):
    inv = rig.data.bones[name].matrix_local.to_3x3().inverted()
    swing = Quaternion(inv @ Vector((1, 0, 0)), math.radians(pitch))
    facing = Quaternion(inv @ Vector((0, 0, 1)), math.radians(yaw))
    rig.pose.bones[name].rotation_quaternion = facing @ swing



for action, spec in config['actions'].items():
    root.rotation_euler.z = 0
    rig.animation_data_clear()
    for tool in tools.values():
        tool.animation_data_clear()
        for child in tool.children:
            child.hide_render = tool.name != 'Labor_' + str(spec['tool'])
    for frame, pose in enumerate(spec['poses'], 1):
        scene.frame_set(frame)
        for bone in rig.pose.bones:
            bone.rotation_quaternion = (1, 0, 0, 0)
        turn('Spine', pose['spine'], pose.get('twist', 0))
        # Counter the torso tilt so the head looks at the work instead of
        # unnaturally rolling with the shoulders.
        turn('Head', -pose['spine'] * .35)
        for side, prefix in [('R', 'right'), ('L', 'left')]:
            turn('UpperArm.' + side, pose[prefix + 'Arm'], pose.get(prefix + 'Yaw', 0))
            turn('Forearm.' + side, pose[prefix + 'Elbow'])
        for bone in rig.pose.bones:
            bone.keyframe_insert('rotation_quaternion', frame=frame)
        bpy.context.view_layer.update()
        evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
        palm_position = sum((evaluated.matrix_world @ evaluated.data.vertices[i].co * w for i, w in palm), Vector()) / weight_sum
        if spec['tool']:
            tool = tools[spec['tool']]
            tool.location = palm_position
            pitch = math.radians(pose['toolPitch'])
            yaw = math.radians(pose.get('toolYaw', 0))
            direction = Vector((math.sin(yaw) * math.sin(pitch), -math.cos(yaw) * math.sin(pitch), math.cos(pitch)))
            if spec['tool'] == 'hoe' and frame == spec.get('contactFrame'):
                # The hoe points down into the plot; cap its reach at ground
                # height to keep the blade out of the villager's legs.
                direction = Vector((0, -.24, -max(.05, palm_position.z - .035))).normalized()
            tool.rotation_mode = 'QUATERNION'
            if spec['tool'] == 'axe':
                # The blade faces the tangent of the sweep, with a slight bevel
                # tilt to expose the forged face. It cannot hang vertically below
                # the haft at the horizontal impact.
                tangent = Vector((math.cos(yaw), math.sin(yaw), 0))
                blade_y = Quaternion(direction, math.radians(49)) @ -tangent
                blade_x = blade_y.cross(direction).normalized()
                tool.rotation_quaternion = Matrix((blade_x, blade_y, direction)).transposed().to_quaternion()
            else:
                tool.rotation_quaternion = direction.to_track_quat('Z', 'Y')

            tool.keyframe_insert('location', frame=frame)
            tool.keyframe_insert('rotation_quaternion', frame=frame)
        records.append({'action': action, 'frame': frame, 'palm': list(palm_position),
                        'lowestBodyZ': min(v.co.z for v in evaluated.data.vertices)})
    rig.animation_data.action.name = profile['role'] + '_' + action
    rig.animation_data.action.use_fake_user = True
    for facing, degrees in spec['directions'].items():
        root.rotation_euler.z = math.radians(degrees)
        for frame in range(1, len(spec['poses']) + 1):
            scene.frame_set(frame)
            bpy.context.view_layer.update()
            tool_name = spec.get('tool')
            if tool_name:
                edge = Vector((0, -.19, .293)) if tool_name == 'axe' else Vector((0, 0, .36))
                tip = tools[tool_name].matrix_world @ edge
                projected = world_to_camera_view(scene, camera, tip)
                records.append({'action':action,'direction':facing,'frame':frame,
                                'toolTipScreen':[projected.x, 1-projected.y],
                                'contact':frame == spec.get('contactFrame')})
            scene.render.filepath = str(output / f"{profile['role']}_{action}_{facing}_{frame}.png")
            bpy.ops.render.render(write_still=True)
    root.rotation_euler.z = 0
    scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(output / f"{profile['role']}_{action}.blend"), compress=True)

ground = world_to_camera_view(scene, camera, anchor)
(output / 'labor-report.json').write_text(json.dumps({
    'role': profile['role'], 'method': 'offline high-resolution skinned rendering',
    'status': 'candidate_requires_contact_and_pose_visual_review',
    'runtime3d': False, 'mirror': False, 'displayScale': 1.50 / 1.30,
    'anchor': {'x': ground.x, 'y': 1 - ground.y}, 'framesPerAction': {name:len(a['poses']) for name,a in config['actions'].items()},
    'records': records, 'inputs': [{'file': str(p), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
                                  for p in [source, profile_path, poses_path, Path(__file__)]]
}, indent=2) + '\n')
print('LABOR_CANDIDATES_READY', profile['role'])
