"""Add work-tool nodes to an existing approved humanoid without rebuilding skin."""
import bpy,sys
sys.dont_write_bytecode=True
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from character_props import add_work_tools,hide_exported_tools
source,editable,output=sys.argv[sys.argv.index('--')+1:]
bpy.ops.wm.open_mainfile(filepath=source)
rig=bpy.data.objects['Skeleton']
if any(name in bpy.data.objects for name in ['ToolAxe','ToolHoe']):
    raise RuntimeError('Work tools already exist; do not add duplicates')
tools=add_work_tools(rig,1.8)
rig.animation_data.action=bpy.data.actions['idle'];bpy.context.scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=editable)
for tool in tools:tool.scale=(1,1,1)
bpy.ops.export_scene.gltf(filepath=output,export_format='GLB',export_image_format='JPEG',export_jpeg_quality=90,
    export_animations=True,export_animation_mode='ACTIONS',export_anim_single_armature=True,
    export_skins=True,export_all_influences=False,export_rest_position_armature=False,
    export_optimize_animation_size=True,export_tangents=False,export_cameras=False,export_lights=False)
hide_exported_tools(output)
