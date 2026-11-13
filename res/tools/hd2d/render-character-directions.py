"""Render four fixed-camera views and prove that the entire rig turns together."""
import json
import hashlib
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

source, profile_file, output = map(Path, sys.argv[sys.argv.index('--') + 1:])
profile = json.loads(profile_file.read_text())
role = profile['role']
output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source))
scene = bpy.context.scene
scene.frame_set(1)
mesh, rig = bpy.data.objects['CharacterSource'], bpy.data.objects['VillagerEditableRig']
assert mesh.parent == rig
controls = [bpy.data.objects[name + '.' + side] for name in ['AnkleControl', 'KneePole'] for side in ['L', 'R']]
anchor = Vector(profile['groundAnchor'])
root = bpy.data.objects.new('WholeCharacterFacing', None)
bpy.context.collection.objects.link(root)
root.location = anchor
bpy.context.view_layer.update()
for obj in [rig] + controls:
    world = obj.matrix_world.copy()
    obj.parent = root
    obj.matrix_parent_inverse = root.matrix_world.inverted()
    obj.matrix_world = world
camera = scene.camera
aim = anchor + Vector((0, 0, .49))
camera.location = aim + Vector((0, -3, 1.25))
camera.rotation_euler = (aim - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.ortho_scale = 1.30
records = []
# Same unit-height tolerance as the male test; catches detached IK targets.
tolerance = .0001
for frame in range(1, 5):
    root.rotation_euler = (0, 0, 0)
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
    baseline = [evaluated.matrix_world @ vertex.co for vertex in evaluated.data.vertices]
    for name, angle in [('down', 0), ('right', 90), ('up', 180), ('left', -90)]:
        root.rotation_euler = (0, 0, math.radians(angle))
        bpy.context.view_layer.update()
        evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
        vertices = [evaluated.matrix_world @ vertex.co for vertex in evaluated.data.vertices]
        transform = Matrix.Translation(anchor) @ Matrix.Rotation(math.radians(angle), 4, 'Z') @ Matrix.Translation(-anchor)
        error = max((actual - transform @ original).length for actual, original in zip(vertices, baseline))
        assert error < tolerance, (role, name, frame, error)
        file = f'{role}_{name}_{frame}.png'
        scene.render.filepath = str(output / file)
        bpy.ops.render.render(write_still=True)
        records.append({'direction': name, 'frame': frame, 'rootYawDegrees': angle,
            'maxRigidError': error, 'lowestWorldZ': min(vertex.z for vertex in vertices),
            'headLocalRotation': list(rig.pose.bones['Head'].rotation_quaternion), 'file': file})
root.rotation_euler = (0, 0, 0)
scene.frame_set(1)
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(output / f'{role}_direction_probe.blend'))
(output / 'direction-report.json').write_text(json.dumps({
    'role': role, 'status': 'four_direction_motion_candidate_not_integrated',
    'cameraAndLightsFixed': True, 'mirror': False, 'framesPerDirection': 4,
    'fps': profile['fps'], 'groundAnchor': list(anchor), 'camera': list(camera.location),
    'rigidTolerance': tolerance, 'views': records,
    'inputs': [{'file': p.name, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
               for p in [source, profile_file, Path(__file__)]],
    'pending': 'full art/shadow and gameplay direction integration',
}, indent=2) + '\n')
print('DIRECTION_PROBE_READY', role, len(records))
