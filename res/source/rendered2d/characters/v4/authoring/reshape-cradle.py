"""Give the newborn a bigger face inside its existing breathing cradle."""
from pathlib import Path
import json
import math
import sys

import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

source, output = map(Path, sys.argv[sys.argv.index('--')+1:])
output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source))
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
camera = scene.camera
mesh = bpy.data.objects['CharacterSource']
inverse = mesh.matrix_world.inverted().to_3x3()
view = camera.matrix_world.to_quaternion()
canvas = camera.data.ortho_scale
center = Vector((.501, .728))
radii = Vector((.211, .155))

def weight(distance):
    x = min(1., max(0., (1.-distance)/.36))
    return x*x*(3.-2.*x)

surfaces = mesh.data.shape_keys.key_blocks
assert len(surfaces) == 2
for surface in surfaces:
    for vertex in surface.data:
        original = mesh.matrix_world @ vertex.co
        if original.z < .35:
            continue
        pos = world_to_camera_view(scene, camera, original)
        off = Vector((pos.x-center.x,pos.y-center.y))
        distance = math.hypot(off.x/radii.x,off.y/radii.y)
        deformation = weight(distance)
        if deformation:
            vertex.co += inverse @ (view @ Vector((off.x * .23 * canvas * deformation, off.y * .15 * canvas * deformation,0)))
mesh.data.update()
scene.cycles.samples = 24
scene.render.use_persistent_data = True
for frame in [1,2,3]:
    scene.frame_set(frame)
    scene.render.filepath = str(output/f'baby_idle_{frame}.png')
    bpy.ops.render.render(write_still=True)
scene.frame_set(1)
anchor = world_to_camera_view(scene,camera,Vector((0,0,0)))
bpy.ops.wm.save_as_mainfile(filepath=str(output / 'baby_cradle.blend'), compress=True)
(output / 'cradle-report.json').write_text(json.dumps({
    'fps':scene.render.fps, 'frames':4, 'uniqueFrames':3,
    'groundAnchor':{'x':anchor.x,'y':1-anchor.y},'method':'local baby face expansion in both existing breath key shapes',
}, indent=2)+'\n')
