"""Reduce, bind and export a character in Blender, retaining editable source.

Usage: Blender --background --python prepare-character.py -- --source raw.glb
 --id male --output model.glb --editable model.blend --work <Downloads directory>
"""
import argparse
import json
from pathlib import Path
import sys
sys.dont_write_bytecode = True
import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).parent))
from character_rig import humanoid, natural_rest, create_actions
from baby_rig import bind_baby
from character_props import add_work_tools, hide_exported_tools

parser = argparse.ArgumentParser()
parser.add_argument("--source", required=True)
parser.add_argument("--id", required=True, choices=["male", "female", "child", "elder", "baby"])
parser.add_argument("--output", required=True)
parser.add_argument("--editable", required=True)
parser.add_argument("--work", required=True)
parser.add_argument("--triangles", type=int, default=3000)
parser.add_argument("--texture", type=int, default=512)
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
work = Path(args.work)
work.mkdir(parents=True, exist_ok=True)
for filename in [args.output, args.editable]:
    Path(filename).parent.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=args.source)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
if len(meshes) != 1:
    raise RuntimeError("Expected one reconstructed character mesh; review multi-mesh source before binding")
mesh = meshes[0]
mesh.name = "Body"
bpy.context.view_layer.objects.active = mesh
mesh.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
low = min(v.co.z for v in mesh.data.vertices)
high = max(v.co.z for v in mesh.data.vertices)
height = {"male": 1.8, "female": 1.8, "child": 1.24, "elder": 1.62, "baby": .72}[args.id]
for vertex in mesh.data.vertices:
    vertex.co.z -= low
    vertex.co *= height / (high - low)
before = len(mesh.data.polygons)
modifier = mesh.modifiers.new("Mobile silhouette reduction", "DECIMATE")
modifier.ratio = min(1.0, args.triangles / before)
modifier.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier=modifier.name)
for polygon in mesh.data.polygons:
    polygon.use_smooth = True

# The reconstructed Shaded texture already contains the approved soft modelling
# light. Export an unlit base-color material; avoid duplicated PBR map sets.
textures = []
for material in mesh.data.materials:
    image_nodes = [n for n in material.node_tree.nodes if n.type == "TEX_IMAGE" and n.image]
    if len(image_nodes) != 1:
        raise RuntimeError("Expected one shaded source image; inspect material instead of silently substituting")
    image = image_nodes[0].image
    image.scale(args.texture, args.texture)
    image.pack()
    material.name = "Surface"
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = image
    # Blender's official glTF exporter recognizes RGBA directly connected to
    # Surface as KHR_materials_unlit (unlit.py); unlike emission-only PBR this
    # gives Laya a base color that can be safely tinted for visual hit feedback.
    material.node_tree.links.new(texture.outputs["Color"], output.inputs["Surface"])
    textures.append(list(image.size))

if args.id == "baby":
    rig, actions = bind_baby(mesh, height)
else:
    rig = humanoid(mesh, height, args.id)
    natural_rest(rig, mesh, args.id)
    actions = create_actions(rig, height, args.id)
tools = add_work_tools(rig, height) if args.id == "female" else []
root = bpy.data.objects.new(args.id, None)
bpy.context.collection.objects.link(root)
rig.parent = root
anchor_height = max(v.co.z for v in mesh.data.vertices) if args.id == "baby" else height
for name, z in [("HeadAnchor", anchor_height * .98), ("FootOrigin", 0)]:
    anchor = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(anchor)
    anchor.parent = root
    anchor.location.z = z
rig.show_in_front = True
bpy.context.scene.render.fps = 30
bpy.context.scene.frame_start = 1
bpy.context.scene.frame_end = 31
bpy.ops.wm.save_as_mainfile(filepath=args.editable)
for tool in tools: tool.scale=(1,1,1)
bpy.ops.export_scene.gltf(filepath=args.output, export_format="GLB", export_image_format="JPEG", export_jpeg_quality=90,
    export_animations=True, export_animation_mode="ACTIONS", export_anim_single_armature=True,
    export_skins=True, export_all_influences=False, export_rest_position_armature=False,
    export_optimize_animation_size=True, export_tangents=False, export_cameras=False, export_lights=False)
if tools: hide_exported_tools(args.output)

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 24
scene.render.resolution_x = 512
scene.render.resolution_y = 640
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.view_settings.view_transform = "Standard"
bpy.ops.object.camera_add(location=(height * 1.2, -height * 3, height * 1.7))
camera = bpy.context.object
camera.rotation_euler = (Vector((0, 0, height * .5)) - camera.location).to_track_quat("-Z", "Y").to_euler()
camera.data.type = "ORTHO"
camera.data.ortho_scale = height * 1.45
scene.camera = camera
preview_frames = [("idle", 1), ("idle", 16), ("idle", 46)] if args.id == "baby" else [("idle", 1), ("walk", 7), ("walk", 22), ("chop", 1), ("chop", 16), ("farm", 16), ("care", 16)]
for action, frame in preview_frames:
    if action not in actions:
        continue
    rig.animation_data.action = bpy.data.actions[action]
    scene.frame_set(frame)
    for tool in tools:
        tool.scale = (1,1,1) if (tool.name == "ToolAxe" and action == "chop") or (tool.name == "ToolHoe" and action == "farm") else (0,0,0)
    scene.render.filepath = str(work / f"{args.id}_{action}_{frame}.png")
    bpy.ops.render.render(write_still=True)
report = {"id": args.id, "source": args.source, "trianglesBefore": before, "triangles": len(mesh.data.polygons),
    "vertices": len(mesh.data.vertices), "bones": len(rig.data.bones), "actions": actions,
    "textures": textures, "outputBytes": Path(args.output).stat().st_size, "height": height,
    "editable": args.editable, "runtime": args.output}
(work / f"{args.id}_report.json").write_text(json.dumps(report, indent=2))
print("CHARACTER_READY", json.dumps(report))
