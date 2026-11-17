"""Render eight fixed-camera views and prove that the entire rig turns together."""
import json
import hashlib
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

source, profile_file, output = map(Path, sys.argv[sys.argv.index('--') + 1:][:3])
profile = json.loads(profile_file.read_text())
role = profile['role']
output.mkdir(parents=True, exist_ok=True)
verify_only = '--verify-only' in sys.argv
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
for frame in range(1, len(profile['poses']) + 2):
    root.rotation_euler = (0, 0, 0)
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
    baseline = [evaluated.matrix_world @ vertex.co for vertex in evaluated.data.vertices]
    for name, angle in [('down', 0), ('down_right', 45), ('right', 90), ('up_right', 135), ('up', 180), ('up_left', -135), ('left', -90), ('down_left', -45)]:
        root.rotation_euler = (0, 0, math.radians(angle))
        bpy.context.view_layer.update()
        evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
        vertices = [evaluated.matrix_world @ vertex.co for vertex in evaluated.data.vertices]
        transform = Matrix.Translation(anchor) @ Matrix.Rotation(math.radians(angle), 4, 'Z') @ Matrix.Translation(-anchor)
        error = max((actual - transform @ original).length for actual, original in zip(vertices, baseline))
        assert error < tolerance, (role, name, frame, error)
        file = f'{role}_{name}_{frame}.png' if frame <= len(profile['poses']) else f'{role}_{name}_idle.png'
        scene.render.filepath = str(output / file)
        if not verify_only:
            bpy.ops.render.render(write_still=True)
        records.append({'direction': name, 'frame': frame, 'rootYawDegrees': angle,
            'maxRigidError': error, 'lowestWorldZ': min(vertex.z for vertex in vertices),
            'headLocalRotation': list(rig.pose.bones['Head'].rotation_quaternion), 'file': None if verify_only else file})
root.rotation_euler = (0, 0, 0)
scene.frame_set(1)
bpy.context.view_layer.update()
if not verify_only:
    bpy.ops.wm.save_as_mainfile(filepath=str(output / f'{role}_direction_probe.blend'))
(output / 'direction-report.json').write_text(json.dumps({
    'role': role, 'status': 'eight_direction_geometry_test' if verify_only else 'eight_direction_motion_candidate_not_integrated',
    'cameraAndLightsFixed': True, 'mirror': False, 'framesPerDirection': len(profile['poses']),
    'fps': profile['fps'], 'groundAnchor': list(anchor), 'camera': list(camera.location),
    'rigidTolerance': tolerance, 'views': records,
    'inputs': [{'file': p.name, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
               for p in [source, profile_file, Path(__file__)]],
    'pending': 'full art/shadow and gameplay direction integration',
}, indent=2) + '\n')
print('DIRECTION_PROBE_READY', role, len(records))
