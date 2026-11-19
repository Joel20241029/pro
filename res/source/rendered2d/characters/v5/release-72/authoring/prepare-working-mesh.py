import json,sys,bpy
from pathlib import Path
out=Path(sys.argv[sys.argv.index('--')+1])
bpy.context.preferences.filepaths.save_version=0
mesh=bpy.data.objects['CharacterSource']
bpy.ops.object.select_all(action='DESELECT')
mesh.select_set(True)
bpy.context.view_layer.objects.active=mesh
count=len(mesh.data.polygons)
mod=mesh.modifiers.new('Preview mesh reduction for offline rendering','DECIMATE')
mod.ratio=min(1,170000/count)
mod.use_collapse_triangulate=True
bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.context.scene.cycles.samples=18
bpy.context.scene.render.use_persistent_data=True
bpy.ops.wm.save_as_mainfile(filepath=str(out))
print('WORKING_MESH',count,len(mesh.data.polygons))
