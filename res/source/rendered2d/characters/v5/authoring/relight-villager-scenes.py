"""Apply the softer look to reviewed, editable poses and render their existing views."""
import json
import math
import sys
from pathlib import Path

import bpy

source, destination, role, action, preview = sys.argv[sys.argv.index('--') + 1:]
source, destination = Path(source), Path(destination)
destination.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source))
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene

# Broader light lowers the forehead and hair peaks while maintaining readable
# contact shadows. The texture curve softens baked highlights in the GLB.
scene.view_settings.look = 'None'
scene.view_settings.exposure = -.10
for name, (energy, size) in {
    'WarmKey': (174,5.0),
    'SoftFill': (78,5.0),
    'Rim': (30,4.0),
}.items():
    light = bpy.data.objects[name].data
    light.energy, light.size = energy, size
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .43
for material in bpy.data.objects['CharacterSource'].data.materials:
    tree = material.node_tree
    shader = next(node for node in tree.nodes if node.type == 'BSDF_PRINCIPLED')
    shader.inputs['Specular IOR Level'].default_value = .055
    roughness = shader.inputs['Roughness']
    if roughness.is_linked:
        link = roughness.links[0]
        original_roughness = link.from_socket
        tree.links.remove(link)
        remap = tree.nodes.new('ShaderNodeMath')
        remap.label = 'Matte roughness'
        remap.operation = 'MULTIPLY_ADD'
        remap.inputs[1].default_value = .24
        remap.inputs[2].default_value = .69
        tree.links.new(original_roughness, remap.inputs[0])
        tree.links.new(remap.outputs[0], roughness)
    else:
        roughness.default_value = .81
    albedo = shader.inputs['Base Color']
    if albedo.is_linked:
        link = albedo.links[0]
        original_albedo = link.from_socket
        tree.links.remove(link)
        curve = tree.nodes.new('ShaderNodeRGBCurve')
        curve.label = 'Soft baked highlights'
        luminance = curve.mapping.curves[3]
        luminance.points[-1].location = (1,.87)
        luminance.points.new(.40,.38)
        luminance.points.new(.69,.61)
        curve.mapping.update()
        tree.links.new(original_albedo, curve.inputs['Color'])
        tree.links.new(curve.outputs['Color'], albedo)

scene.cycles.samples = 24
scene.render.use_persistent_data = True
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'METAL'
for device in prefs.get_devices_for_type('METAL'):
    device.use = device.type == 'METAL'
scene.cycles.device = 'GPU'

directions = [('down',0),('down_right',45),('right',90),('up_right',135),
              ('up',180),('up_left',-135),('left',-90),('down_left',-45)]
counts = {'walk':7,'chop':5,'farm':4,'care':4,'strike':4,'rest':3}
moves = directions if action != 'rest' else [('down',0)]
selected = [(facing,angle,frame) for facing,angle in moves for frame in range(1, counts[action]+1)]
if preview == 'sample':
    selected = [('down_right',45,7)] if action=='walk' else [('down',0,1)]
anchor = bpy.data.objects.get('WholeCharacterFacing')
for facing, angle, frame in selected:
    if anchor: anchor.rotation_euler.z = math.radians(angle)
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    if action == 'walk':
        name = f"{role}_{facing}_{'idle' if frame==7 else frame}.png"
    elif action == 'rest':
        name = f"{role}_idle_{frame}.png"
    else:
        name = f"{role}_{action}_{facing}_{frame}.png"
    scene.render.filepath = str(destination / name)
    bpy.ops.render.render(write_still=True)
if preview != 'sample':
    if anchor: anchor.rotation_euler.z = 0
    scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(destination / source.name),compress=True)
print('MATTE_READY', role, action, len(selected))
