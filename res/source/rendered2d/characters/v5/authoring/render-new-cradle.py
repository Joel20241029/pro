"""Animate the approved olive blanket inside the fixed wicker cradle."""
from pathlib import Path
from math import exp
import json
import sys

import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

source, output = map(Path, sys.argv[sys.argv.index('--')+1:])
output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source))
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
obj = bpy.data.objects['CharacterSource']
camera = scene.camera
aim = Vector((0,0,.45))
camera.location = aim + Vector((0,-2.9,2.15))
camera.rotation_euler = (aim-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.ortho_scale = 1.66
bpy.context.view_layer.update()
base = obj.shape_key_add(name='Cradle and rest')
breath = obj.shape_key_add(name='Blanket rise')
center = Vector((.50,.419))
exposed_vertices = 0
for i,v in enumerate(base.data):
    pos = world_to_camera_view(scene,camera,obj.matrix_world@v.co)
    a,b=(pos.x-center.x)/.156,(pos.y-center.y)/.095
    q=a*a+b*b
    if q < 1 and v.co.z > .28:
        # Zero displacement at and beyond the visible blanket boundary.
        breath.data[i].co.z += .021*(1-q)**2
        exposed_vertices += 1
assert exposed_vertices > 800
scene.render.resolution_x = scene.render.resolution_y = 384
scene.render.fps = 3
scene.cycles.samples = 28
scene.render.use_persistent_data = True
scene.frame_start, scene.frame_end = 1, 4
for i,amount in enumerate([0,.5,1,.5],1):
    breath.value=amount
    breath.keyframe_insert('value',frame=i)
for frame in [1,2,3]:
    scene.frame_set(frame)
    scene.render.filepath=str(output/f'baby_idle_{frame}.png')
    bpy.ops.render.render(write_still=True)
scene.frame_set(1)
pos = world_to_camera_view(scene,camera,Vector((0,0,0)))
bpy.ops.wm.save_as_mainfile(filepath=str(output/'baby_cradle.blend'),compress=True)
(output/'cradle-report.json').write_text(json.dumps({
    'frames':4,'uniqueFrames':3,'fps':3,'groundAnchor':{'x':pos.x,'y':1-pos.y},
    'deformedBlanketVertices':exposed_vertices,'method':'local breathing on the approved cradle mesh'
}, indent=2)+'\n')
