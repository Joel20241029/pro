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
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view

sys.dont_write_bytecode = True
source, profile_path, poses_path, output = map(Path, sys.argv[sys.argv.index('--') + 1:][:4])
profile = json.loads(profile_path.read_text())
config = json.loads(poses_path.read_text())
for action, overrides in config['actorPoseOverrides'].get(profile['role'], {}).items():
    for frame, updates in overrides.items():
        config['actions'][action]['poses'][int(frame) - 1].update(updates)
facings = {'down': 0, 'right': 90, 'up': 180, 'left': 270}
if '--probe' in sys.argv:
    config['actions'].pop('care')

output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source))
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
mesh = bpy.data.objects['CharacterSource']
rig = bpy.data.objects['VillagerEditableRig']
scene.frame_set(len(profile['poses']) + 1)
rig.animation_data_clear()
rig.location = (0, 0, 0)
for bone in rig.pose.bones:
    bone.rotation_quaternion = (1, 0, 0, 0)
    bone.location = (0, 0, 0)
for side in ['L', 'R']:
    target = bpy.data.objects['AnkleControl.' + side]
    # Last walking frame is the separately grounded neutral stance.
    target.animation_data_clear()
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
for kind in ['axe', 'hoe']:
    tool = bpy.data.objects.new('Labor_' + kind, None)
    bpy.context.collection.objects.link(tool)
    tool.parent = root
    tool.matrix_parent_inverse = root.matrix_world.inverted()
    # Local Z runs from the gripping hand to the blade. Work-specific angles
    # are keyed after skin evaluation, so the shaft stays through the palm.
    shaft_min, shaft_max = (-.13, .54) if kind == 'hoe' else (-.090, .308)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=.012, depth=shaft_max - shaft_min)
    shaft = bpy.context.object
    shaft.name = kind + '_WoodShaft'
    shaft.parent = tool
    shaft.location = (0, 0, (shaft_min + shaft_max) / 2)
    shaft.data.materials.append(wood)
    bevel = shaft.modifiers.new('Rounded handle ends', 'BEVEL')
    bevel.width, bevel.segments = .006, 3
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=.018, depth=.075)
    grip = bpy.context.object
    grip.name = kind + '_LeatherGrip'
    grip.parent = tool
    grip.location = (0, 0, 0)
    grip.data.materials.append(grip_mat)
    if kind == 'hoe':
        # The rear grip is the origin. Both palms and the second grip share the same shaft.
        front_grip = grip.copy()
        bpy.context.collection.objects.link(front_grip)
        front_grip.location.z = config['actions']['farm']['gripSeparation']
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
        # Curved forged neck and flared blade form one piece; the blade drops
        # perpendicular to the handle, with a brighter cutting lip.
        stations = [
            (.022, .023, .534, .011), (.032, .003, .559, .011),
            (.054, -.038, .566, .010), (.075, -.076, .565, .009),
            (.089, -.112, .559, .005)
        ]
        verts = [(side * width, y, z + surface * thickness)
                 for width, y, z, thickness in stations for side, surface in
                 [(-1, -1), (1, -1), (1, 1), (-1, 1)]]
        faces = [(3, 2, 1, 0)]
        for start in range(0, len(verts) - 4, 4):
            faces.extend((start + j, start + 4 + j, start + 4 + (j + 1) % 4, start + (j + 1) % 4)
                         for j in range(4))
        faces.append(tuple(range(len(verts) - 4, len(verts))))
        data = bpy.data.meshes.new('ForgedHoeBlade')
        data.from_pydata(verts, [], faces)
        data.update()
        blade = bpy.data.objects.new('HoeBlade', data)
        bpy.context.collection.objects.link(blade)
    blade.name = kind + '_BeveledBlade'
    blade.parent = tool
    blade.data.materials.append(iron)
    if kind == 'hoe':
        blade.data.materials.append(edge_steel)
        for face in list(blade.data.polygons)[-5:]:
            face.material_index = 1
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
    bevel.width, bevel.segments = .003, 3
    normal = blade.modifiers.new('Weighted face normals', 'WEIGHTED_NORMAL')
    normal.keep_sharp = True
    tools[kind] = tool
    tool['blade_name'] = blade.name

# Estimate the centre of each closed palm from the rigid glove vertices in
# the bind pose, then store it in hand-bone space. Local Y follows the fingers;
# the shaft is transverse to that direction.
palms = {}
for side in ('L', 'R'):
    name = 'Hand.' + side
    group = mesh.vertex_groups[name].index
    weights = [(v, g.weight ** 2) for v in mesh.data.vertices for g in v.groups
               if g.group == group and g.weight > .25]
    center = sum((mesh.matrix_world @ v.co * weight for v, weight in weights), Vector()) / sum(w for _, w in weights)
    bone = rig.data.bones[name]
    rest = rig.matrix_world @ bone.matrix_local
    offset = rest.inverted() @ center
    transverse = rest.to_3x3().inverted() @ Vector((1, 0, 0))
    transverse.y = 0
    palms[side] = (offset, transverse.normalized())
polygons = [p.vertices[:] for p in mesh.data.polygons]
head_group = mesh.vertex_groups['Head'].index
head_verts = {v.index for v in mesh.data.vertices if any(g.group == head_group and g.weight > .52 for g in v.groups)}
head_polygons = [values for values in polygons if all(i in head_verts for i in values)]
camera = scene.camera
aim = anchor + Vector((0, 0, .49))
camera.location = aim + Vector((0, -3, 1.25))
camera.rotation_euler = (aim - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.ortho_scale = config['cameraWidths'][profile['role']]
scene.render.fps = config['fps']
scene.cycles.samples = 12 if '--probe' in sys.argv else 22
if '--probe' in sys.argv:
    scene.render.resolution_percentage = 50
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


def palm_world(side):
    return rig.matrix_world @ rig.pose.bones['Hand.' + side].matrix @ palms[side][0]


def grip_rotation(hand, side, axis):
    hand_rotation = hand.matrix.to_quaternion()
    transverse = palms[side][1]
    across = hand_rotation @ transverse
    aligned = axis if across.dot(axis) >= 0 else -axis
    return across.rotation_difference(aligned) @ hand_rotation


def grip_hand(side, point, shaft_axis):
    """Position the wrist at the grip and solve a two-bone elbow bend."""
    upper, forearm, hand = (rig.pose.bones[name + '.' + side] for name in ('UpperArm', 'Forearm', 'Hand'))
    inverse = rig.matrix_world.inverted()
    axis = (inverse.to_3x3() @ shaft_axis).normalized()
    rotation = grip_rotation(hand, side, axis)
    wrist = inverse @ point - rotation @ palms[side][0]
    shoulder, old_elbow = upper.head.copy(), forearm.head.copy()
    reach = wrist - shoulder
    distance = reach.length
    axis_to_wrist = reach.normalized()
    upper_length, lower_length = upper.bone.length, forearm.bone.length
    # Preserve bend direction from the authored guide pose. Keeping a slight
    # bend at full extension avoids abrupt elbow flips between frames.
    bend = old_elbow - shoulder
    bend -= axis_to_wrist * bend.dot(axis_to_wrist)
    if bend.length < .001:
        bend = axis_to_wrist.cross(Vector((0, 1, 0)))
    length = min(distance, upper_length + lower_length - .002)
    along = (upper_length**2 - lower_length**2 + length**2) / (2 * length)
    elbow = shoulder + axis_to_wrist * along + bend.normalized() * math.sqrt(max(0, upper_length**2 - along**2))
    for bone, start, end in [(upper, shoulder, elbow), (forearm, elbow, shoulder + axis_to_wrist * length)]:
        matrix = bone.matrix.copy()
        matrix = (bone.vector.rotation_difference(end - start) @ matrix.to_quaternion()).to_matrix().to_4x4()
        matrix.translation = start
        bone.matrix = matrix
        bpy.context.view_layer.update()
    matrix = rotation.to_matrix().to_4x4()
    matrix.translation = hand.head
    hand.matrix = matrix
    bpy.context.view_layer.update()


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
        turn('Spine', -pose['spine'], pose.get('twist', 0))
        turn('Head', pose['spine'] * (.20 if action == 'care' else .35))
        for side, prefix in [('R', 'right'), ('L', 'left')]:
            turn('UpperArm.' + side, pose[prefix + 'Arm'], pose.get(prefix + 'Yaw', 0))
            turn('Forearm.' + side, pose[prefix + 'Elbow'])
        bpy.context.view_layer.update()
        if spec['tool']:
            tool = tools[spec['tool']]
            pitch = math.radians(pose['toolPitch'])
            yaw = math.radians(pose.get('toolYaw', 0))
            direction = Vector((math.sin(yaw) * math.sin(pitch), -math.cos(yaw) * math.sin(pitch), math.cos(pitch)))
            blade = bpy.data.objects[tool['blade_name']]
            if action == 'chop':
                # The shaft sweeps in a shallow horizontal arc; the bright
                # cutting lip leads the impact, with only a small roll.
                tangent = Vector((math.cos(yaw), math.sin(yaw), 0))
                blade_y = Quaternion(direction, math.radians(37)) @ -tangent
                blade_x = blade_y.cross(direction).normalized()
                orientation = Matrix((blade_x, blade_y, direction)).transposed().to_quaternion()
                hand = rig.pose.bones['Hand.R']
                axis = rig.matrix_world.inverted().to_3x3() @ direction
                rotation = grip_rotation(hand, 'R', axis)
                matrix = rotation.to_matrix().to_4x4()
                matrix.translation = hand.head
                hand.matrix = matrix
                bpy.context.view_layer.update()
                handle = palm_world('R')
                grips = {'R': 0.0}
            else:
                # Place the two grips across the body. Change shaft pitch to
                # lower the actual blade into the soil, keeping its length fixed.
                shoulders = [rig.matrix_world @ rig.pose.bones['UpperArm.' + side].head for side in ('R', 'L')]
                aim = sum(shoulders, Vector()) / 2 + Vector(pose['gripMidpoint'])
                half_grip = spec['gripSeparation'] / 2
                target = spec['bladeHeights'][frame - 1]
                blade_points = [v.co - Vector((0, 0, half_grip)) for v in blade.data.vertices]
                inverse = rig.matrix_world.inverted()
                rig_axes = inverse.to_3x3()
                arm_data = [
                    (side, rig.pose.bones['Hand.' + side], shoulders[i],
                     sum(rig.data.bones[name + '.' + side].length for name in ('UpperArm', 'Forearm')) - .002)
                    for i, side in enumerate(('R', 'L'))
                ]
                best = None
                # Each rig has different arm proportions. Select the nearest
                # authored pose that both arms can reach, while keeping the
                # blade physically outside the body and at the prescribed height.
                for yaw_delta in (0, 7, -7, 14, -14, 21, -21):
                    angle = yaw + math.radians(yaw_delta)
                    for dz in (0, .025, -.025, .05, -.05):
                        low, high = math.radians(55), math.radians(161)
                        for _ in range(17):
                            pitch = (low + high) / 2
                            direction = Vector((math.sin(angle) * math.sin(pitch),
                                                -math.cos(angle) * math.sin(pitch), math.cos(pitch)))
                            orientation = direction.to_track_quat('Z', 'Y')
                            edge_height = aim.z + dz + min((orientation @ v).z for v in blade_points)
                            if edge_height > target:
                                low = pitch
                            else:
                                high = pitch
                        axis = rig_axes @ direction
                        offsets = [rig.matrix_world.to_3x3() @ (grip_rotation(hand, side, axis) @ palms[side][0])
                                   for side, hand, _, _ in arm_data]
                        for dx in (0, .015, -.015, .030, -.030, .045, -.045, .060):
                            for dy in (0, -.02, .02, .04, -.04):
                                midpoint = aim + Vector((dx, dy, dz))
                                end = [midpoint - direction * half_grip, midpoint + direction * half_grip]
                                gaps = [max(0, (grip - offset - shoulder).length - length)
                                        for grip, offset, (_, _, shoulder, length) in zip(end, offsets, arm_data)]
                                # Reject a blade that swings back into the torso.
                                tip = end[0] + orientation @ Vector((0, -.112, .559))
                                collision = max(0, tip.y + .253)
                                score = (sum(gaps) + abs(edge_height - target) + collision * 2) * 15
                                score += abs(dx) + abs(dy) + abs(dz) + abs(yaw_delta) * .002
                                if best is None or score < best[0]:
                                    best = (score, midpoint, direction, orientation, edge_height)
                _, midpoint, direction, orientation, edge_height = best
                handle = midpoint - direction * half_grip
                grips = {'R': 0.0, 'L': spec['gripSeparation']}
                for side, offset in grips.items():
                    grip_hand(side, handle + direction * offset, direction)
                records.append({'action':action, 'frame':frame, 'hoeEdgeZ':edge_height, 'targetBladeZ':target})
            tool.location = handle
            tool.rotation_mode = 'QUATERNION'
            tool.rotation_quaternion = orientation
            tool.keyframe_insert('location', frame=frame)
            tool.keyframe_insert('rotation_quaternion', frame=frame)
            bpy.context.view_layer.update()
            evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
            points = [evaluated.matrix_world @ v.co for v in evaluated.data.vertices]
            body_tree = BVHTree.FromPolygons(points, polygons, all_triangles=True)
            head_tree = BVHTree.FromPolygons(points, head_polygons, all_triangles=True)
            blade_points = [blade.matrix_world @ v.co for v in blade.data.vertices]
            blade_tree = BVHTree.FromPolygons(blade_points, [p.vertices[:] for p in blade.data.polygons])
            shaft = bpy.data.objects[spec['tool'] + '_WoodShaft']
            half_shaft = max(vertex.co.z for vertex in shaft.data.vertices)
            shaft_start = tool.matrix_world @ Vector((0, 0, shaft.location.z - half_shaft))
            shaft_axis = (tool.matrix_world.to_3x3() @ Vector((0, 0, 1))).normalized()
            shaft_head = head_tree.ray_cast(shaft_start, shaft_axis, half_shaft * 2)[0] is not None
            grip_errors = [(palm_world(side) - tool.matrix_world @ Vector((0, 0, offset))).length
                           for side, offset in grips.items()]
            records.append({'action':action, 'frame':frame, 'gripErrors':grip_errors,
                            'bladeBodyIntersections':len(body_tree.overlap(blade_tree)),
                            'bladeHeadIntersections':len(head_tree.overlap(blade_tree)),
                            'shaftHeadIntersection':shaft_head, 'bladeMinimumZ':min(p.z for p in blade_points)})
        for bone in rig.pose.bones:
            bone.keyframe_insert('rotation_quaternion', frame=frame)
    rig.animation_data.action.name = profile['role'] + '_' + action
    rig.animation_data.action.use_fake_user = True
    animated = [rig] + ([tools[spec['tool']]] if spec['tool'] else [])
    for obj in animated:
        for curve in obj.animation_data.action.fcurves:
            for key in curve.keyframe_points:
                key.interpolation = 'CONSTANT'
    for facing, degrees in facings.items():
        root.rotation_euler.z = math.radians(degrees)
        for frame in range(1, len(spec['poses']) + 1):
            scene.frame_set(frame)
            bpy.context.view_layer.update()
            tool_name = spec.get('tool')
            if tool_name:
                edge = {'axe':Vector((0, -.19, .293)), 'hoe':Vector((0, -.112, .559))}[tool_name]
                tip = tools[tool_name].matrix_world @ edge
                projected = world_to_camera_view(scene, camera, tip)
                records.append({'action':action,'direction':facing,'frame':frame,
                                'toolTipScreen':[projected.x, 1-projected.y], 'toolTipWorld':list(tip),
                                'contact':frame == spec.get('contactFrame')})
            scene.render.filepath = str(output / f"{profile['role']}_{action}_{facing}_{frame}.png")
            if '--check-only' not in sys.argv:
                bpy.ops.render.render(write_still=True)
    root.rotation_euler.z = 0
    scene.frame_set(1)
    if '--check-only' not in sys.argv:
        bpy.ops.wm.save_as_mainfile(filepath=str(output / f"{profile['role']}_{action}.blend"), compress=True)

ground = world_to_camera_view(scene, camera, anchor)
(output / 'labor-report.json').write_text(json.dumps({
    'role': profile['role'], 'directions': list(facings), 'method': 'offline high-resolution skinned rendering',
    'status': 'tool_edges_and_grip_recorded_for_review',
    'runtime3d': False, 'mirror': False, 'displayScale': camera.data.ortho_scale / profile['walkCycle']['orthoScale'],
    'anchor': {'x': ground.x, 'y': 1 - ground.y}, 'framesPerAction': {name:len(a['poses']) for name,a in config['actions'].items()},
    'records': records, 'inputs': [{'file': str(p), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
                                  for p in [source, profile_path, poses_path, Path(__file__)]]
}, indent=2) + '\n')
print('LABOR_CANDIDATES_READY', profile['role'])
