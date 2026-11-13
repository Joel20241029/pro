"""Import an untouched authoring GLB and render fixed-light inspection views.

Blender invocation: --background --python this.py -- input.glb output_dir role
Outputs stay separate from the source. This does not export runtime 3D assets.
"""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

source, output, role = sys.argv[sys.argv.index('--') + 1:]
source, output = Path(source), Path(output)
output.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))
meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
if len(meshes) != 1:
    raise RuntimeError('Review multi-mesh input before binding: ' + str(len(meshes)))
mesh = meshes[0]
mesh.name = 'CharacterSource'
bpy.context.view_layer.objects.active = mesh
mesh.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# glTF imports quaternion rotation; switch explicitly before inspection yaw.
mesh.rotation_mode = 'XYZ'
low = Vector(tuple(min(v.co[i] for v in mesh.data.vertices) for i in range(3)))
high = Vector(tuple(max(v.co[i] for v in mesh.data.vertices) for i in range(3)))
height = high.z - low.z
center = (low + high) / 2
for vertex in mesh.data.vertices:
    vertex.co = (vertex.co - Vector((center.x, center.y, low.z))) / height
for polygon in mesh.data.polygons:
    polygon.use_smooth = True
for material in mesh.data.materials:
    for node in material.node_tree.nodes:
        if node.type == 'BSDF_PRINCIPLED':
            node.inputs['Specular IOR Level'].default_value = .10
            # These four villagers contain skin, hair, cloth and wood only.
            # Preserve the raw PBR maps, but render these dielectric materials
            # with zero metallic response. Roughness and normal maps remain.
            for link in list(node.inputs['Metallic'].links):
                material.node_tree.links.remove(link)
            node.inputs['Metallic'].default_value = 0

# Same camera, soft lighting, PBR treatment and colour transform as the male probe.
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.resolution_x = scene.render.resolution_y = 512
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.film_transparent = True
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'Medium High Contrast'
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.7, .76, .85, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .45
for name, position, energy, size, colour in [
    ('WarmKey', (-2.5, -3.5, 5), 240, 4, (1, .84, .66)),
    ('SoftFill', (3, -1, 2), 80, 4, (.75, .85, 1)),
    ('Rim', (1, 3, 3), 65, 3, (1, .88, .7)),
]:
    bpy.ops.object.light_add(type='AREA', location=position)
    light = bpy.context.object
    light.name = name
    light.data.energy, light.data.size, light.data.color = energy, size, colour
    light.data.shape = 'DISK'
    light.rotation_euler = (Vector((0, 0, .5)) - light.location).to_track_quat('-Z', 'Y').to_euler()
bpy.ops.object.camera_add()
camera = bpy.context.object
camera.name = 'FixedOrthographic'
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 1.30
aim = Vector((0, 0, .49))
camera.location = aim + Vector((0, -3, 1.25))
camera.rotation_euler = (aim - camera.location).to_track_quat('-Z', 'Y').to_euler()
scene.camera = camera
for direction, angle in [('down', 0), ('right', 90), ('up', 180), ('left', -90)]:
    mesh.rotation_euler.z = math.radians(angle)
    bpy.context.view_layer.update()
    scene.render.filepath = str(output / f'{role}_inspect_{direction}.png')
    bpy.ops.render.render(write_still=True)
mesh.rotation_euler.z = 0
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(output / f'{role}_inspect.blend'))
report = {
    'role': role, 'sourceFile': source.name,
    'vertices': len(mesh.data.vertices),
    'triangles': sum(len(p.vertices) - 2 for p in mesh.data.polygons),
    'dimensions': list(mesh.dimensions),
    'images': [{'name': i.name, 'size': list(i.size)} for i in bpy.data.images if i.type == 'IMAGE'],
    'noDecimation': True, 'noTextureReduction': True,
    'status': 'geometry_and_identity_review_required',
}
(output / 'model-inspection.json').write_text(json.dumps(report, indent=2) + '\n')
print('INSPECTION_READY', json.dumps(report))
