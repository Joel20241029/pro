"""Check saved walking poses for rigid soles, grounded feet and stable foot axes.

Blender arguments: -- walk.blend rig-profile.json report.json
Read-only validation of the authoring scene; never saves the input blend.
Tolerances are in normalized character-height units, not gameplay coordinates.
"""
import hashlib
import json
import sys
from pathlib import Path

import bpy

source, profile_file, output = map(Path, sys.argv[sys.argv.index('--') + 1:])
profile = json.loads(profile_file.read_text())
bpy.ops.wm.open_mainfile(filepath=str(source))
mesh = bpy.data.objects['CharacterSource']
rig = bpy.data.objects['VillagerEditableRig']
groups = {group.index: group.name for group in mesh.vertex_groups}
weights = [{groups[value.group]: value.weight for value in vertex.groups}
           for vertex in mesh.data.vertices]
region = profile['weightRegions']
sole = {'L': [], 'R': []}
feet = {'L': [], 'R': []}
for vertex in mesh.data.vertices:
    values = weights[vertex.index]
    # The elder's cane reaches the floor but is not part of either foot.
    if values.get('Cane', 0) > .5:
        continue
    side = 'L' if vertex.co.x > region['centerX'] else 'R'
    if vertex.co.z < region['shoeRigidTop']:
        assert abs(values.get('Foot.' + side, 0) - 1) < 1e-6, (vertex.index, values)
        sole[side].append(vertex.index)
    for foot in feet:
        if vertex.co.z < .10 and sum(values.get(part + '.' + foot, 0)
                                     for part in ['Foot', 'Shin', 'Thigh']) > .5:
            feet[foot].append(vertex.index)
assert all(sole.values()) and all(feet.values())

checks = []
for frame, pose in enumerate(profile['poses'] + [profile['idlePose']], 1):
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
    vertices = [evaluated.matrix_world @ vertex.co for vertex in evaluated.data.vertices]
    sides = {}
    for side in sole:
        bone = rig.pose.bones['Foot.' + side]
        deformation = bone.matrix @ bone.bone.matrix_local.inverted()
        transform = rig.matrix_world @ deformation
        residual = max((vertices[i] - transform @ mesh.data.vertices[i].co).length for i in sole[side])
        scale_error = max(abs(value - 1) for value in deformation.to_scale())
        target = bpy.data.objects['AnkleControl.' + side]
        rotation_error = (rig.matrix_world @ bone.matrix).to_quaternion().rotation_difference(
            target.matrix_world.to_quaternion()).angle
        minimum = min(vertices[i].z for i in feet[side])
        assert residual < 1e-5, ('Sole flexes instead of following Foot', frame, side, residual)
        assert scale_error < 1e-4, ('Foot stretches', frame, side, scale_error)
        assert rotation_error < .001, ('Foot target rotation differs', frame, side, rotation_error)
        assert abs(minimum - pose[side][1]) < .002, ('Foot grounding differs', frame, side, minimum)
        sides[side] = {'rigidVertexCount': len(sole[side]), 'maxRigidResidual': residual,
                       'maxScaleError': scale_error, 'targetRotationErrorRadians': rotation_error,
                       'minimumZ': minimum, 'requestedLift': pose[side][1]}
    checks.append({'frame': frame, 'feet': sides})

output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps({
    'role': profile['role'], 'passed': True, 'checks': checks,
    'scope': 'Saved profile poses only; continuous visual gait review is also required.',
    'inputs': [{'file': p.name, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
               for p in [source, profile_file, Path(__file__)]],
}, indent=2) + '\n')
print('FOOT_VALIDATION_PASSED', profile['role'])
