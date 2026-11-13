"""Render a neutral infant reclining, with a gentle skinned breathing cycle.

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
from mathutils import Matrix, Vector

source, output = map(Path, sys.argv[sys.argv.index('--') + 1:])
output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source))
mesh = bpy.data.objects['CharacterSource']
# Reclining about X keeps the face upwards and the back on the ground.
rotation = Matrix.Rotation(math.radians(-50), 3, 'X')
for vertex in mesh.data.vertices:
    vertex.co = rotation @ vertex.co
lowest = min(vertex.co.z for vertex in mesh.data.vertices)
center_y = (min(vertex.co.y for vertex in mesh.data.vertices) + max(vertex.co.y for vertex in mesh.data.vertices)) / 2
offset = Vector((0, -center_y, -lowest))
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
aim = Vector((0, 0, .28))
camera = scene.camera
camera.location = aim + Vector((0, -3, 1.25))
camera.rotation_euler = (aim - camera.location).to_track_quat('-Z', 'Y').to_euler()
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
    assert lowest_z > -.005, ('breathing penetrates floor', frame, lowest_z)
    scene.render.filepath = str(output / f'baby_idle_{frame}.png')
    bpy.ops.render.render(write_still=True)
    report.append({'frame': frame, 'chestScale': 1 + breath, 'lowestWorldZ': lowest_z,
        'headLocalScale': list(rig.pose.bones['Head'].scale), 'file': f'baby_idle_{frame}.png'})
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(output / 'baby_idle_probe.blend'))
(output / 'idle-report.json').write_text(json.dumps({
    'role': 'baby', 'status': 'idle_candidate_not_integrated', 'reclineDegrees': -50,
    'cameraAndLightsFixed': True, 'mirror': False, 'fps': 2,
    'frames': report, 'runtime3d': False, 'walking': False,
    'inputs': [{'file': p.name, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
               for p in [source, Path(__file__)]],
}, indent=2) + '\n')
print('BABY_IDLE_READY', len(report))
