"""Render the neutral infant and editable village cradle with a skinned breathing cycle.

Reuses the inspected two-part breathing approach in res/tools/3d/baby_rig.py,
but retains the new full-quality PBR mesh and outputs only transparent 2D PNGs.
Blender args: -- baby_inspect.blend output_dir
"""
import json
import hashlib
import math
import sys
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector

source, output = map(Path, sys.argv[sys.argv.index('--') + 1:])
output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source))
mesh = bpy.data.objects['CharacterSource']
# Recline the model onto the mattress with the face up, keeping the existing skin and light rig.
recline = -76
mattress_top = .22
rotation = Matrix.Rotation(math.radians(recline), 3, 'X')
for vertex in mesh.data.vertices:
    vertex.co = rotation @ vertex.co
lowest = min(vertex.co.z for vertex in mesh.data.vertices)
center_y = (min(vertex.co.y for vertex in mesh.data.vertices) + max(vertex.co.y for vertex in mesh.data.vertices)) / 2
offset = Vector((0, -center_y, mattress_top - lowest))
for vertex in mesh.data.vertices:
    vertex.co += offset
bpy.ops.object.armature_add(enter_editmode=True)
rig = bpy.context.object
rig.name = 'InfantEditableRig'
bones = rig.data.edit_bones
bones.remove(bones[0])
for name, a, b, parent in [
    ('Root', (0, 0, 0), (0, 0, .08), None),
    ('Breath', (0, 0, .14), (0, 0, .60), 'Root'),
    ('Head', (0, 0, .60), (0, 0, .90), 'Root'),
]:
    bone = bones.new(name)
    bone.head, bone.tail = rotation @ Vector(a) + offset, rotation @ Vector(b) + offset
    bone.use_deform = name != 'Root'
    if parent:
        bone.parent = bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
groups = {name: mesh.vertex_groups.new(name=name) for name in ['Breath', 'Head']}
inverse = rotation.inverted()
for vertex in mesh.data.vertices:
    z = (inverse @ (vertex.co - offset)).z
    head = max(0, min(1, (z - .50) / .12))
    groups['Breath'].add([vertex.index], 1 - head, 'REPLACE')
    groups['Head'].add([vertex.index], head, 'REPLACE')
mesh.parent = rig
modifier = mesh.modifiers.new('Offline breathing skin', 'ARMATURE')
modifier.object = rig
scene = bpy.context.scene
scene.render.fps, scene.frame_start, scene.frame_end = 2, 1, 4
scene.cycles.samples = 32
scene.cycles.use_denoising = True

def material(name, rgb):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*rgb, 1)
    result.use_nodes = True
    pbr = result.node_tree.nodes.get('Principled BSDF')
    pbr.inputs['Base Color'].default_value = (*rgb, 1)
    pbr.inputs['Roughness'].default_value = .52
    return result

def rounded_box(name, position, size, surface, bevel):
    bpy.ops.mesh.primitive_cube_add(size=1, location=position)
    obj = bpy.context.object
    obj.name, obj.dimensions = name, size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(surface)
    rounded = obj.modifiers.new('Rounded edges', 'BEVEL')
    rounded.width, rounded.segments = bevel, 4
    obj.modifiers.new('Weighted surface normals', 'WEIGHTED_NORMAL')
    return obj

honey = material('Honey oak', (.45, .235, .085))
dark = material('Warm oak edge', (.29, .126, .038))
linen = material('Cream linen', (.84, .71, .46))
rim = material('Golden rail cap', (.56, .32, .118))
rounded_box('Cradle base', (0, 0, .128), (.82, 1.20, .115), dark, .04)
rounded_box('Linen mattress', (0, 0, .19), (.737, 1.07, .06), linen, .026)
for side in [-1, 1]:
    x = side * .376
    for y in [-.505, .505]:
        rounded_box('Bed post', (x, y, .155), (.088, .10, .31), honey, .023)
        rounded_box('Post cap', (x, y, .317), (.098, .11, .045), rim, .016)
    rounded_box('Bed side board', (x, 0, .185), (.067, 1.07, .19), honey, .026)
    rounded_box('Bed side rail', (x, 0, .283), (.08, 1.1, .055), rim, .021)
rounded_box('Low footboard', (0, -.558, .155), (.82, .07, .22), honey, .029)
rounded_box('Rounded headboard', (0, .55, .235), (.82, .075, .32), honey, .032)
rounded_box('Bed head rail', (0, .55, .395), (.84, .088, .06), rim, .027)

aim = Vector((0, 0, .32))
camera = scene.camera
camera.data.ortho_scale = 1.61
camera.location = aim + Vector((.72, -3, 2.75))
camera.rotation_euler = (aim - camera.location).to_track_quat('-Z', 'Y').to_euler()
bpy.context.view_layer.update()
anchor = world_to_camera_view(scene, camera, Vector((0, 0, 0)))
report = []
for frame, breath in enumerate([0, .01, 0, -.006], 1):
    scene.frame_set(frame)
    # Only the swaddle/chest changes, never a whole-sprite zoom or head wobble.
    rig.pose.bones['Breath'].scale = (1 + breath, 1, 1 + breath)
    rig.pose.bones['Breath'].keyframe_insert('scale', frame=frame)
    bpy.context.view_layer.update()
    evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
    lowest_z = min((evaluated.matrix_world @ vertex.co).z for vertex in evaluated.data.vertices)
    # Inflation may change the cloth contact surface slightly; reject meaningful
    # penetration instead of silently translating the head or whole bundle.
    assert lowest_z > mattress_top - .005, ('breathing penetrates mattress', frame, lowest_z)
    scene.render.filepath = str(output / f'baby_idle_{frame}.png')
    bpy.ops.render.render(write_still=True)
    report.append({'frame': frame, 'chestScale': 1 + breath, 'lowestWorldZ': lowest_z,
        'headLocalScale': list(rig.pose.bones['Head'].scale), 'file': f'baby_idle_{frame}.png'})
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(output / 'baby_cradle.blend'))
(output / 'idle-report.json').write_text(json.dumps({
    'role': 'baby', 'status': 'cradle_2d_production_source', 'reclineDegrees': recline,
    'groundAnchor': {'x': anchor.x, 'y': 1 - anchor.y},
    'cameraAndLightsFixed': True, 'mirror': False, 'fps': 2,
    'frames': report, 'runtime3d': False, 'walking': False,
    'inputs': [{'file': p.name, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
               for p in [source, Path(__file__)]],
}, indent=2) + '\n')
print('BABY_IDLE_READY', len(report))
