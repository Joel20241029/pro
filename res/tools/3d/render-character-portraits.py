"""Render transparent 256 px busts from editable 3D assets, never AI substitutes.

Blender --background --python this.py -- <project-root> <Downloads-check-directory>
Exports the chosen 512-texture render and a 256-texture comparison without
changing the .blend sources or runtime models, including the existing male.
"""
import bpy, sys, json
sys.dont_write_bytecode=True
from pathlib import Path
from mathutils import Vector

project, work = map(Path, sys.argv[sys.argv.index('--')+1:])
output=project/'res/source/ui/hd/portraits';output.mkdir(parents=True,exist_ok=True)
work.mkdir(parents=True,exist_ok=True)
heights={'male':1.8,'female':1.8,'child':1.24,'elder':1.62,'baby':.72}
for kind,h in heights.items():
    bpy.ops.wm.open_mainfile(filepath=str(project/'res/source/3d/characters'/f'{kind}.blend'))
    rig=bpy.data.objects['Skeleton'];rig.animation_data.action=bpy.data.actions['idle'];scene=bpy.context.scene;scene.frame_set(1)
    for name in ['ToolAxe','ToolHoe']:
        if name in bpy.data.objects: bpy.data.objects[name].scale=(0,0,0)
    scene.render.engine='CYCLES';scene.cycles.samples=24
    scene.render.resolution_x=256;scene.render.resolution_y=256;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
    scene.render.film_transparent=True;scene.view_settings.view_transform='Standard'
    target=Vector((0,0,h*.765)) if kind!='baby' else Vector((0,h*.19,h*.43))
    camera_position=target+Vector((0,-3*h,.08*h)) if kind!='baby' else target+Vector((0,-h,3*h))
    bpy.ops.object.camera_add(location=camera_position);cam=bpy.context.object
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=h*(.57 if kind!='baby' else .83);scene.camera=cam
    scene.render.filepath=str(output/f'{kind}.png');bpy.ops.render.render(write_still=True)
    # Downscale only an in-memory copy for visual comparison. Never save source.
    for image in bpy.data.images:
        if image.size[0]==512: image.scale(256,256)
    scene.render.filepath=str(work/f'{kind}_texture256.png');bpy.ops.render.render(write_still=True)
    print('PORTRAIT_READY',kind,str(output/f'{kind}.png'))
