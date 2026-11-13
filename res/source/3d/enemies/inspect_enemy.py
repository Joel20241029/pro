import bpy,sys,json
from pathlib import Path
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:]; source=Path(args[0]); out=Path(args[1]); out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source));meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
points=[o.matrix_world@Vector(v) for o in meshes for v in o.bound_box]; lo=Vector([min(v[i] for v in points) for i in range(3)]);hi=Vector([max(v[i] for v in points) for i in range(3)]);center=(lo+hi)/2;span=max(hi-lo)
report={'file':source.name,'bytes':source.stat().st_size,'meshes':[{'name':o.name,'vertices':len(o.data.vertices),'polygons':len(o.data.polygons),'triangles':sum(len(p.vertices)-2 for p in o.data.polygons)} for o in meshes],'bounds_min':list(lo),'bounds_max':list(hi),'images':[{'name':i.name,'size':list(i.size)} for i in bpy.data.images if i.size[0]>0]}
(out/(source.stem+'_inspection.json')).write_text(json.dumps(report,indent=2))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=20;scene.render.resolution_x=720;scene.render.resolution_y=800;scene.render.resolution_percentage=100;scene.world.color=(.65,.65,.65);scene.render.film_transparent=True;scene.view_settings.view_transform='Standard'
bpy.ops.object.light_add(type='AREA',location=center+Vector((-2,-3,4))*span);bpy.context.object.data.energy=350*span*span;bpy.context.object.data.size=4*span
bpy.ops.object.light_add(type='AREA',location=center+Vector((3,1,2))*span);bpy.context.object.data.energy=160*span*span;bpy.context.object.data.size=3*span
for tag,direction in [('front',(0,-4,.4)),('threequarter',(2.3,-4,1.2))]:
 bpy.ops.object.camera_add(location=center+Vector(direction)*span);cam=bpy.context.object;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=span*1.2;scene.camera=cam;scene.render.filepath=str(out/(source.stem+'_'+tag+'.png'));bpy.ops.render.render(write_still=True)
print(json.dumps(report))
