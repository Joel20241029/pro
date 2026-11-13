"""Offline campfire/fruit sources with crisp alpha; does not export runtime 3D.

Reuses the existing env_props campfire composition and material helpers, with
offline-only smooth geometry. Blender args: -- output_directory
"""
import hashlib
import importlib.util
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.dont_write_bytecode = True
root = Path(__file__).resolve().parents[3]
output = Path(sys.argv[sys.argv.index('--') + 1])
output.mkdir(parents=True, exist_ok=True)
helper_path = root / 'res/tools/3d/build-environment.py'
spec = importlib.util.spec_from_file_location('environment_authoring', helper_path)
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)


def prepare():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    helpers.MATS.clear()
    helpers.palette()
    # Source palette is linear; geometry and material refinements are offline
    # only and never affect the original 3D package or gameplay values.
    helpers.material('OfflineStone', (.29, .27, .26), .88)
    helpers.material('OfflineStoneLight', (.39, .37, .34), .86)
    helpers.material('OfflineApple', (.65, .036, .009), .42)
    helpers.material('OfflineLeaf', (.21, .33, .035), .65)
    wood = helpers.material('OfflineBark', (.28, .09, .018), .75)
    nodes, links = wood.node_tree.nodes, wood.node_tree.links
    coordinates = nodes.new('ShaderNodeTexCoord')
    stretch = nodes.new('ShaderNodeVectorMath'); stretch.operation = 'MULTIPLY'
    stretch.inputs[1].default_value = (6, 6, .45)
    grain = nodes.new('ShaderNodeTexNoise')
    grain.inputs['Scale'].default_value = 4
    grain.inputs['Detail'].default_value = 2
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (.13, .035, .008, 1)
    ramp.color_ramp.elements[1].color = (.48, .20, .043, 1)
    links.new(coordinates.outputs['Generated'], stretch.inputs[0])
    links.new(stretch.outputs[0], grain.inputs['Vector'])
    links.new(grain.outputs['Fac'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], nodes.get('Principled BSDF').inputs['Base Color'])


def render(name, aim, scale):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 64
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
    for label, at, energy, color in [
        ('WarmKey', (-2.5, -3.5, 5), 240, (1, .84, .66)),
        ('SoftFill', (3, -1, 2), 80, (.75, .85, 1)),
        ('Rim', (1, 3, 3), 65, (1, .88, .7)),
    ]:
        bpy.ops.object.light_add(type='AREA', location=at)
        light = bpy.context.object; light.name = label
        light.data.energy, light.data.size, light.data.color = energy, 4, color
        light.rotation_euler = (Vector(aim) - light.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.object.camera_add()
    camera = bpy.context.object; camera.name = 'OfflineOrthographic'
    camera.data.type, camera.data.ortho_scale = 'ORTHO', scale
    camera.location = Vector(aim) + Vector((0, -3, 1.25))
    camera.rotation_euler = (Vector(aim) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = camera
    scene.render.filepath = str(output / (name + '.png'))
    bpy.ops.wm.save_as_mainfile(filepath=str(output / (name + '.blend')))
    bpy.ops.render.render(write_still=True)


prepare()
base = helpers.empty('CampfireBase')
# Same eight-stone / three-log composition as env_props.campfire. The source
# contains only static geometry; the separate 2D flame animates in Laya.
for index in range(8):
    angle = index * math.tau / 8
    bpy.ops.mesh.primitive_cube_add(size=1, location=(.34 * math.cos(angle), .34 * math.sin(angle), .09))
    stone = bpy.context.object; stone.name = 'FireRingStone'; stone.parent = base
    stone.dimensions = (.258, .239, .18 + .012 * math.sin(index * 2.1))
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    stone.data.materials.append(helpers.MATS['OfflineStone' if index % 2 else 'OfflineStoneLight'])
    bevel = stone.modifiers.new('Rounded stone corners', 'BEVEL')
    bevel.width, bevel.segments = .065, 5
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    for polygon in stone.data.polygons:
        polygon.use_smooth = True
    normal = stone.modifiers.new('Broad stone planes', 'WEIGHTED_NORMAL')
    normal.keep_sharp = True
    stone.rotation_euler.z = angle
    stone['frontOccluder'] = index in [5, 6, 7]
for index, angle in enumerate([.3, 2.4, 4.5]):
    start = Vector((-.27 * math.cos(angle), -.27 * math.sin(angle), .13 + index * .018))
    end = Vector((.27 * math.cos(angle), .27 * math.sin(angle), .16 + index * .018))
    log = helpers.cylinder('Firewood', (start + end) / 2, .072, (end - start).length,
                           'OfflineBark', base, 64)
    log.rotation_euler = (end - start).to_track_quat('Z', 'Y').to_euler()
    for tip in [start, end]:
        cap = helpers.cylinder('EndGrain', tip, .062, .005, 'EndGrain', base, 64)
        cap.rotation_euler = log.rotation_euler
# Constant baked warmth on the static ring; the moving 2D flame is separate.
bpy.ops.object.light_add(type='POINT', location=(0, -.035, .35))
ember_light = bpy.context.object; ember_light.name = 'BakedFlameWarmth'
ember_light.data.energy = 8
ember_light.data.color = (1, .27, .025)
ember_light.data.shadow_soft_size = .18
render('campfire_base', (0, 0, .12), 1.25)
# Keep identical camera/canvas/light transport. Only the three near stones are
# visible to the camera in this pass; rear geometry still casts its shading.
campfire_meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
assert 'visible_camera' in bpy.types.Object.bl_rna.properties
for obj in campfire_meshes:
    obj.visible_camera = bool(obj.get('frontOccluder'))
bpy.context.scene.render.filepath = str(output / 'campfire_front.png')
bpy.ops.render.render(write_still=True)
for obj in campfire_meshes:
    obj.visible_camera = True

prepare()
fruit = helpers.empty('CanopyApple')
apple = helpers.ellipsoid('Apple', (0, 0, .11), (.11, .10, .11), 'OfflineApple', fruit, 96, 64)
# Dimple around the stalk; retain a rounded, readable small fruit silhouette.
for vertex in apple.data.vertices:
    radial = math.hypot(vertex.co.x, vertex.co.y)
    if vertex.co.z > .06:
        vertex.co.z -= .018 * math.exp(-radial * radial / .0012)
stem = helpers.cylinder('Stem', (.005, 0, .23), .009, .064, 'WoodDark', fruit, 32)
stem.rotation_euler.y = .15
leaf = helpers.ellipsoid('Leaf', (.052, 0, .245), (.06, .024, .006), 'OfflineLeaf', fruit, 64, 32)
leaf.rotation_euler = (.50, -.35, .25)
render('fruit_apple', (0, 0, .13), .36)

records = [{'file': p.name, 'bytes': p.stat().st_size,
            'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
           for p in sorted(output.iterdir()) if p.suffix in ['.blend', '.png']]
(output / 'render-report.json').write_text(json.dumps({
    'method': 'actual Blender offline rendering', 'runtime3d': False,
    'status': 'isolated_environment_candidate_not_integrated',
    'resolution': [512, 512], 'files': records,
    'inputs': [{'file': str(p.relative_to(root)), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
               for p in [Path(__file__), helper_path, root / 'res/tools/3d/env_props.py']],
}, indent=2) + '\n')
print('ENVIRONMENT_OFFLINE_READY')
