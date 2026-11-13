"""Two stationary breathing poses; feet and the elder's cane remain planted.

Blender args: -- walk.blend profile.json output_dir
Presentation authoring only. Uses the inspected profile rather than a second rig.
"""
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Quaternion, Vector

source, profile_path, output = map(Path, sys.argv[sys.argv.index('--') + 1:])
profile = json.loads(profile_path.read_text())
output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source))
bpy.context.preferences.filepaths.save_version = 0
scene, rig = bpy.context.scene, bpy.data.objects['VillagerEditableRig']
rig.animation_data_clear()
rig.location = (0, 0, 0)
for bone in rig.pose.bones:
    bone.rotation_quaternion, bone.location = (1, 0, 0, 0), (0, 0, 0)
for side in ['L', 'R']:
    target = bpy.data.objects['AnkleControl.' + side]
    target.animation_data_clear()
    target.location = profile['bones']['Foot.' + side][0]
anchor = Vector(profile['groundAnchor'])
aim = anchor + Vector((0, 0, .49))
scene.camera.location = aim + Vector((0, -3, 1.25))
scene.camera.rotation_euler = (aim - scene.camera.location).to_track_quat('-Z', 'Y').to_euler()
scene.camera.data.ortho_scale = 1.30
scene.render.fps, scene.frame_start, scene.frame_end = 2, 1, 2
for frame, angle in [(1, -.5), (2, .5)]:
    scene.frame_set(frame)
    for name, degrees in [('Spine', angle), ('Head', -angle * .5)]:
        axis = rig.data.bones[name].matrix_local.to_3x3().inverted() @ Vector((1, 0, 0))
        rig.pose.bones[name].rotation_quaternion = Quaternion(axis, math.radians(degrees))
    for bone in rig.pose.bones:
        bone.keyframe_insert('rotation_quaternion', frame=frame)
    scene.render.filepath = str(output / f"{profile['role']}_idle_{frame}.png")
    bpy.ops.render.render(write_still=True)
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(output / f"{profile['role']}_idle.blend"))
print('REST_CANDIDATES_READY', profile['role'])
