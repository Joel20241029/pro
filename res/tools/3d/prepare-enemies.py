"""Build one enemy's editable Blender source and production skinned GLB.

Blender -b -P prepare-enemies.py -- --source raw.glb --id enemy_boar
 --output .../world3d/enemies/enemy_boar.glb --editable .../enemy_boar.blend
 --work /Users/happyelements/Downloads/.../enemies/runtime/enemy_boar

The source stays immutable. Every output has idle/walk skin animation and one
512 JPEG unlit baseColorTexture, compatible with Laya's hit tint material path.
"""
import argparse,json,sys,struct,math
sys.dont_write_bytecode=True
from pathlib import Path
import bpy
from mathutils import Vector, Matrix
sys.path.insert(0,str(Path(__file__).parent))
from enemy_rig import humanoid,quadruped,create_actions,HUMAN,QUADRUPED

# Full authored heights (hair/tail included), with distinct heavy boss silhouettes.
# Quadruped shoulder heights are measured separately in the output report.
HEIGHTS={'enemy_raider':1.65,'enemy_runner':1.65,'enemy_armored':1.7,'enemy_boar':1.55,'enemy_disruptor':1.8,
 'enemy_chief':2.25,'enemy_commander':2.3,'enemy_wolfking':2.2,'enemy_tuskking':2.1,'enemy_shaman':2.3}
p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--id',required=True,choices=list(HEIGHTS));p.add_argument('--output',required=True);p.add_argument('--editable',required=True);p.add_argument('--work',required=True);p.add_argument('--preview-size',type=int,default=160);p.add_argument('--triangles',type=int);p.add_argument('--render',choices=['all','key'],default='all')
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);work=Path(a.work);work.mkdir(parents=True,exist_ok=True)
for f in [a.output,a.editable]:Path(f).parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);bpy.ops.import_scene.gltf(filepath=a.source)
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
if len(meshes)!=1:raise RuntimeError('Enemy source must contain exactly one reviewed mesh')
mesh=meshes[0];mesh.name='Body';bpy.context.view_layer.objects.active=mesh;mesh.select_set(True);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
low=min(v.co.z for v in mesh.data.vertices);high=max(v.co.z for v in mesh.data.vertices);h=HEIGHTS[a.id]
for v in mesh.data.vertices:v.co.z-=low;v.co*=h/(high-low)
before=sum(len(f.vertices)-2 for f in mesh.data.polygons);boss=a.id in ['enemy_chief','enemy_commander','enemy_wolfking','enemy_tuskking','enemy_shaman'];target=a.triangles or (3500 if boss else 2600)
mod=mesh.modifiers.new('Mobile silhouette reduction','DECIMATE');mod.ratio=min(1,target/before);mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
for f in mesh.data.polygons:f.use_smooth=True
for material in mesh.data.materials:
 images=[n.image for n in material.node_tree.nodes if n.type=='TEX_IMAGE' and n.image]
 if len(images)!=1:raise RuntimeError('Expected exactly one source shaded texture')
 image=images[0];image.scale(512,512);image.pack();material.name='Surface';nodes=material.node_tree.nodes;nodes.clear();out=nodes.new('ShaderNodeOutputMaterial');tex=nodes.new('ShaderNodeTexImage');tex.image=image;material.node_tree.links.new(tex.outputs['Color'],out.inputs['Surface'])
rig=quadruped(mesh,h,a.id) if a.id in QUADRUPED else humanoid(mesh,h,a.id)
actions=create_actions(rig,mesh,h,a.id)
root=bpy.data.objects.new(a.id,None);bpy.context.collection.objects.link(root);rig.parent=root
# Decorative sockets are actual bone children, not root-level labels. Keep
# rest orientation aligned with model axes so local +Z is forward after GLB export.
bpy.context.view_layer.update()
evaluated=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());posed=[evaluated.matrix_world@v.co for v in evaluated.data.vertices]
if a.id in QUADRUPED:
 lowy=min(v.y for v in posed);length=max(v.y for v in posed)-lowy
 headpoints=[v for v in posed if v.y<lowy+length*.40 and v.z>h*.40]
 backz=max(v.z for v in posed if abs(v.y-(lowy+length*.58))<length*.045 and abs(v.x)<h*.18)
 backpoint=Vector((0,lowy+length*.58,backz+h*.015))
else:
 headpoints=[v for v in posed if v.z>h*HUMAN[a.id]['neck']]
 backz=h*(HUMAN[a.id]['shoulder']-.035)
 backy=max(v.y for v in posed if abs(v.z-backz)<h*.035 and abs(v.x)<h*.13)
 backpoint=Vector((0,backy+h*.015,backz))
headwidth=max(v.x for v in headpoints)-min(v.x for v in headpoints)
headpoint=Vector((0,(min(v.y for v in headpoints)+max(v.y for v in headpoints))/2,max(v.z for v in headpoints)+h*.012))
sockets={}
for name,bone,position in [('HeadAnchor','Head',headpoint),('BackAnchor','Spine',backpoint)]:
 anchor=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(anchor)
 anchor.parent=rig;anchor.parent_type='BONE';anchor.parent_bone=bone
 bpy.context.view_layer.update();anchor.matrix_world=Matrix.Translation(position);bpy.context.view_layer.update()
 if (anchor.matrix_world.translation-position).length>1e-5:raise RuntimeError('Bone socket placement failed: '+name)
 sockets[name]={'bone':bone,'blenderRestPosition':list(position),'gltfRestPosition':[position.x,position.z,-position.y]}
anchor=bpy.data.objects.new('FootOrigin',None);bpy.context.collection.objects.link(anchor);anchor.parent=root
scene=bpy.context.scene;scene.render.fps=30;scene.frame_start=1;scene.frame_end=31
rig.animation_data.action=bpy.data.actions['idle'];scene.frame_set(1)
# Regenerable authoring output: keep backup/intermediate files out of res/.
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=a.editable)
bpy.ops.export_scene.gltf(filepath=a.output,export_format='GLB',export_image_format='JPEG',export_jpeg_quality=90,
 export_animations=True,export_animation_mode='ACTIONS',export_anim_single_armature=True,export_skins=True,
 export_all_influences=False,export_rest_position_armature=False,export_optimize_animation_size=True,
 export_tangents=False,export_cameras=False,export_lights=False)
# Validate the actual delivered file, not merely Blender's in-memory armature.
data=Path(a.output).read_bytes();gltf=json.loads(data[20:20+struct.unpack_from('<I',data,12)[0]])
if not gltf.get('skins') or sorted(x['name'] for x in gltf.get('animations',[]))!=['idle','walk']:raise RuntimeError('Missing exported skin/actions')
for m in gltf['materials']:
 if 'KHR_materials_unlit' not in m.get('extensions',{}) or 'baseColorTexture' not in m['pbrMetallicRoughness']:raise RuntimeError('Unlit baseColorTexture export contract broken')
if any(i.get('mimeType')!='image/jpeg' for i in gltf['images']):raise RuntimeError('Expected embedded JPEG texture')
if any(not {'JOINTS_0','WEIGHTS_0'}<=set(p['attributes']) for m in gltf['meshes'] for p in m['primitives']):raise RuntimeError('Unskinned mesh primitive')
# Re-import the actual deliverable before rendering any evidence. This catches
# exporter bind/action mistakes that a correct editable .blend would conceal.
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps=30
bpy.ops.import_scene.gltf(filepath=a.output)
# Blender's glTF importer also creates an Icosphere custom bone widget.
# It is editor-only: select the actual mesh through its Armature modifier.
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers)]
rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE']
if len(meshes)!=1 or len(rigs)!=1:raise RuntimeError('Delivered GLB mesh/rig count changed: '+repr([(o.name,o.type) for o in bpy.context.scene.objects]))
mesh=meshes[0];rig=rigs[0];scene=bpy.context.scene
for name in ['HeadAnchor','BackAnchor']:
 candidates=[o for o in scene.objects if o.name==name]
 if len(candidates)!=1 or candidates[0].parent_type!='BONE':raise RuntimeError('Delivered bone socket missing: '+name)
 if candidates[0].parent_bone!=sockets[name]['bone']:raise RuntimeError('Delivered socket bound to wrong bone: '+name)
if any(name not in bpy.data.actions for name in actions):raise RuntimeError('Delivered actions cannot be loaded')
scene.render.engine='CYCLES';scene.cycles.samples=2;scene.render.resolution_x=a.preview_size;scene.render.resolution_y=round(a.preview_size*1.2);scene.render.resolution_percentage=100;scene.render.film_transparent=True;scene.view_settings.view_transform='Standard'
bpy.ops.object.camera_add(location=(h*1.6,-h*3,h*1.55));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,h*.48))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=h*(1.50 if a.id in QUADRUPED else 1.32);scene.camera=camera
poses={};frames=list(range(1,32)) if a.render=='all' else [1,8,16,24,31]
for action in actions:
 rig.animation_data.action=bpy.data.actions[action];poses[action]=[]
 for frame in range(1,32):
  scene.frame_set(frame);evaluated=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());verts=[evaluated.matrix_world@v.co for v in evaluated.data.vertices]
  bounds={'min':[min(v[i] for v in verts) for i in range(3)],'max':[max(v[i] for v in verts) for i in range(3)]}
  poses[action].append(bounds)
  if frame in frames:
   scene.render.filepath=str(work/f'{action}_{frame:02}.png');bpy.ops.render.render(write_still=True)
for name,seq in poses.items():
 if min(f['min'][2] for f in seq)<-.015:raise RuntimeError('Animation clips below floor: '+name)
 if any(abs(seq[0][bound][i]-seq[-1][bound][i])>.002 for bound in ['min','max'] for i in range(3)):raise RuntimeError('Non-looping pose bounds: '+name)
rig.animation_data.action=bpy.data.actions['idle'];scene.frame_set(1)
report={'id':a.id,'source':a.source,'runtime':a.output,'editable':a.editable,'height':poses['idle'][0]['max'][2]-poses['idle'][0]['min'][2],'authoredHeight':h,'headWidth':headwidth,'sockets':sockets,'shoulderHeight':h*QUADRUPED[a.id]['shoulder'] if a.id in QUADRUPED else h*HUMAN[a.id]['shoulder'],
 'skeletonFamily':'quadruped' if a.id in QUADRUPED else 'humanoid','trianglesBefore':before,'triangles':sum(len(f.vertices)-2 for f in mesh.data.polygons),'vertices':len(mesh.data.vertices),'bones':len(rig.data.bones),'actions':actions,'animationFrameCount':31,'renderedFramesPerAction':len(frames),'renderEvidenceSource':'reimported_runtime_glb','texture':[512,512],'textureFormat':'JPEG','jpegQuality':90,'material':'Surface','unlit':True,'outputBytes':len(data),'poseBounds':poses}
(work/'report.json').write_text(json.dumps(report,indent=2));print('ENEMY_READY',json.dumps({k:v for k,v in report.items() if k!='poseBounds'}))
