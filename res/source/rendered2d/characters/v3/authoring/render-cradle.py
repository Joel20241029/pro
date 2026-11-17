"""Render the neutral newborn with its approved wicker cradle and a fixed ground anchor."""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

source, output = map(Path, sys.argv[sys.argv.index('--') + 1:])
output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source))
scene = bpy.context.scene
mesh = bpy.data.objects['CharacterSource']
camera = scene.camera
aim = Vector((0, 0, .45))
camera.location = aim + Vector((0, -2.9, 2.15))
camera.rotation_euler = (aim - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.ortho_scale = 1.66
base = mesh.shape_key_add(name='Rest')
inhale = mesh.shape_key_add(name='Blanket breath')
for i, original in enumerate(base.data):
    x, y, z = original.co
    # Feather the blanket deformation inward from the cradle rim.
    distance = ((x / .34) ** 2 + ((y + .07) / .47) ** 2)
    if distance < 1 and .30 < z < .75:
        inhale.data[i].co.z += .021 * (1 - distance) ** 2 * math.sin((z - .30) / .45 * math.pi)
scene.render.fps = 3
scene.frame_start, scene.frame_end = 1, 4
for frame, value in enumerate([0, .5, 1, .5], 1):
    inhale.value = value
    inhale.keyframe_insert('value', frame=frame)
scene.render.resolution_x = scene.render.resolution_y = 384
for frame in range(1, 5):
    scene.frame_set(frame)
    scene.render.filepath = str(output / f'baby_idle_{frame}.png')
    bpy.ops.render.render(write_still=True)
scene.frame_set(1)
ground = world_to_camera_view(scene, camera, Vector((0, 0, 0)))
bpy.ops.wm.save_as_mainfile(filepath=str(output / 'baby_cradle.blend'))
(output / 'cradle-report.json').write_text(json.dumps({
    'fps': 3, 'frames': 4, 'groundAnchor': {'x': ground.x,'y': 1 - ground.y},
    'source': source.name, 'method': 'Local blanket shape key, crib fixed'
}, indent=2) + '\n')
