"""Render the seated elder with the village's existing rig, textures and lighting."""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Quaternion, Vector
from bpy_extras.object_utils import world_to_camera_view

source, output = map(Path, sys.argv[sys.argv.index("--") + 1:])
output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source))
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.frame_set(1)
rig = bpy.data.objects["VillagerEditableRig"]
rig.animation_data_clear()
for bone in rig.pose.bones:
    bone.location = (0, 0, 0)
    bone.rotation_quaternion = (1, 0, 0, 0)
    for constraint in bone.constraints:
        constraint.mute = True
rig.location = (0, .045, .125)

def pitch(name, degrees):
    axis = rig.data.bones[name].matrix_local.to_3x3().inverted() @ Vector((1, 0, 0))
    rig.pose.bones[name].rotation_quaternion = Quaternion(axis, math.radians(degrees))

for side in ("L", "R"):
    pitch("Thigh." + side, -64)
    pitch("Shin." + side, 36)
    pitch("Foot." + side, 24)
pitch("Spine", -7)
pitch("Head", 4)

chair = bpy.data.collections.new("Editable Rocking Chair")
scene.collection.children.link(chair)

def wood(name, color):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1)
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = .64
    return material

dark = wood("Warm stained oak", (.21, .077, .026))
light = wood("Polished honey oak", (.45, .224, .080))
cushion = wood("Woven village cushion", (.31, .093, .049))

def chair_part(obj, name, material):
    obj.name = name
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    chair.objects.link(obj)
    obj.data.materials.append(material)
    return obj

def block(name, location, dimensions, material, angle=0, bevel=.012):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = chair_part(bpy.context.object, name, material)
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.rotation_euler.x = math.radians(angle)
    round_edges = obj.modifiers.new("Soft woodwork edges", "BEVEL")
    round_edges.width, round_edges.segments = bevel, 4
    obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return obj

for side in (-1, 1):
    x = .23 * side
    rail = bpy.data.curves.new("Arc of rocker", "CURVE")
    rail.dimensions = "3D"
    rail.bevel_depth, rail.bevel_resolution = .027, 4
    rail.use_fill_caps = True
    spline = rail.splines.new("POLY")
    spline.points.add(48)
    for index, point in enumerate(spline.points):
        y = -.43 + .87 * index / 48
        point.co = (x, y, .028 + .49 * y * y, 1)
    chair_part(bpy.data.objects.new(f"Curved runner {side}", rail), f"Curved runner {side}", dark)
    block("Front leg", (x, -.195, .14), (.052, .055, .215), dark, 4)
    block("Reclined rear upright", (x, .269, .295), (.054, .06, .525), dark, -20)
    block("Arm post", (x, -.19, .303), (.045, .047, .15), dark)
    block("Rounded armrest", (x, .005, .384), (.07, .43, .043), light)
block("Seat frame", (0, .018, .234), (.51, .48, .056), dark)
block("Padded seat", (0, .018, .27), (.45, .418, .037), cushion, bevel=.017)
block("Footrest", (0, -.232, .11), (.41, .18, .036), light, bevel=.012)
for y, z in [(.278, .38), (.31, .47), (.341, .555)]:
    block("Back slat", (0, y, z), (.47, .06, .051), light, -20)

aim = Vector((0, 0, .54))
camera = scene.camera
camera.location = aim + Vector((1.85, -2.68, 1.56))
camera.rotation_euler = (aim - camera.location).to_track_quat("-Z", "Y").to_euler()
camera.data.ortho_scale = 1.38
scene.render.resolution_x = scene.render.resolution_y = 256
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.color_mode = "RGBA"
bpy.context.view_layer.update()
contact = world_to_camera_view(scene, camera, Vector((0, 0, 0)))
assert 0 < contact.x < 1 and 0 < contact.y < 1
meta = {"anchor": {"x": contact.x, "y": 1 - contact.y}, "render": "elder_chair.png"}
(output / "chair-anchor.json").write_text(json.dumps(meta, indent=2) + "\n")
scene.render.filepath = str(output / "elder_chair.png")
bpy.ops.render.render(write_still=True)
scene.render.filepath = "//elder_chair.png"
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(output / "elder_chair.blend"))
