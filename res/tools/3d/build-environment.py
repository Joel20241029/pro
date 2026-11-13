"""Rebuild editable, texture-free village environment meshes with Blender 4.5.

Run Blender --background --python this_file -- --sample --render-dir <Downloads path>.
Authoring is Z-up/-Y-front; glTF export converts to Y-up/+Z-front. Units are metres.
Only named environment output directories are owned by this script.
"""
import argparse
import json
import math
import os
from pathlib import Path
import random
import re
import struct
import sys

import bpy
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / 'res/source/3d/environment'
OUTPUT = ROOT / 'res/editor/BuildingWorkshop/assets/world3d/environment'
MATS = {}
RNG = random.Random(7413)
SHARED_EXPORT = True
PATCH_MODULES = True
ASSEMBLY_PATCHES = True
STATIC_FOLIAGE = True


def material(name, color, roughness=.83, metallic=0):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Roughness'].default_value = roughness
    bs.inputs['Metallic'].default_value = metallic
    MATS[name] = m
    return m


def palette():
    colors = {
        # Linear values of the approved warm #9C5B2B and #D99A4B palette.
        'WoodHoney': (.332,.105,.024), 'WoodLight': (.694,.323,.070),
        'WoodDark': (.19,.055,.012), 'EndGrain': (.72,.37,.10),
        'Stone': (.46,.43,.345), 'StoneLight': (.65,.61,.50),
        'StoneDark': (.32,.32,.275), 'Thatch': (.78,.43,.075),
        'ThatchLight': (.96,.65,.19), 'Tile': (.50,.205,.092),
        'Teal': (.16,.40,.34), 'TealLight': (.28,.56,.44),
        'Plaster': (.87,.73,.45), 'Gold': (.94,.59,.15),
        'Iron': (.26,.29,.28), 'Banner': (.69,.155,.045),
        'Cream': (.99,.84,.45), 'LeafDark': (.115,.25,.047),
        'Leaf': (.25,.40,.065), 'LeafLight': (.43,.55,.115),
        'Apple': (.81,.12,.035), 'Pear': (.83,.65,.06),
        'Petal': (.98,.48,.38), 'PetalCream': (1,.82,.49),
        'Soil': (.28,.16,.065), 'Grass': (.34,.47,.12),
        'Grain': (.95,.63,.10), 'Path': (.72,.56,.30),
        'Crystal': (.22,.75,.79), 'CrystalLight': (.51,.90,.88),
        'FireOrange': (1,.32,.015), 'FireYellow': (1,.72,.05),
    }
    for k,v in colors.items(): material(k,v)


def empty(name, parent=None, at=(0,0,0)):
    o = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(o)
    o.parent = parent
    o.location = at
    o.empty_display_size = .12
    o.empty_display_type = 'PLAIN_AXES'
    o['role'] = name
    return o


def finish(o, name, mat, parent, bevel=0, smooth=False):
    o.name = name
    o.parent = parent
    o.data.materials.append(MATS[mat])
    if bevel:
        mod=o.modifiers.new('Soft handcrafted edges','BEVEL')
        mod.width=bevel; mod.segments=1
        mod.affect='EDGES'
        bpy.context.view_layer.objects.active=o
        bpy.ops.object.modifier_apply(modifier=mod.name)
        norm=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
        norm.keep_sharp=True; norm.weight=40
        bpy.ops.object.modifier_apply(modifier=norm.name)
    if smooth:
        for p in o.data.polygons: p.use_smooth=True
    return o


def box(name, at, size, mat, parent, bevel=.035, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at)
    o=bpy.context.object; o.dimensions=size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.rotation_euler=rot
    # Sub-11cm trim is below the gameplay silhouette resolution; keep the bevel
    # budget on load-bearing beams, masonry and large forms.
    return finish(o,name,mat,parent,min(bevel,min(size)*.35) if min(size)>.11 else 0)


def cylinder(name, at, radius, depth, mat, parent, vertices=10, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=at)
    o=bpy.context.object; o.rotation_euler=rot
    return finish(o,name,mat,parent,min(.035,radius*.22),True)


def ellipsoid(name, at, scale, mat, parent, segments=10, rings=6):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,radius=1,location=at)
    o=bpy.context.object; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,parent,0,True)


def beam(name, a, b, width, depth, mat, parent):
    va,vb=Vector(a),Vector(b)
    o=box(name,(va+vb)/2,(width,depth,(vb-va).length),mat,parent)
    o.rotation_euler=(vb-va).to_track_quat('Z','Y').to_euler()
    return o


def rod(name,a,b,radius,mat,parent):
    va,vb=Vector(a),Vector(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=radius,depth=(vb-va).length,location=(va+vb)/2)
    o=finish(bpy.context.object,name,mat,parent,0,True)
    o.rotation_euler=(vb-va).to_track_quat('Z','Y').to_euler()
    return o


def mesh(name,verts,faces,mat,parent,bevel=0):
    data=bpy.data.meshes.new(name); data.from_pydata(verts,[],faces); data.update()
    o=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(o)
    return finish(o,name,mat,parent,bevel)


def curve_tube(name,points,radius,mat,parent):
    # Continuous six-sided sweep: rounded shading without separate sphere joints.
    verts=[];faces=[];count=6
    for i,p in enumerate(points):
        tangent=(Vector(points[min(i+1,len(points)-1)])-Vector(points[max(i-1,0)])).normalized()
        a=tangent.cross(Vector((0,0,1))).normalized();b=tangent.cross(a).normalized()
        for j in range(count):
            v=Vector(p)+radius*(a*math.cos(j*2*math.pi/count)+b*math.sin(j*2*math.pi/count));verts.append(tuple(v))
    for i in range(len(points)-1):
        for j in range(count):faces.append((i*count+j,i*count+(j+1)%count,(i+1)*count+(j+1)%count,(i+1)*count+j))
    faces.extend([tuple(reversed(range(count))),tuple((len(points)-1)*count+j for j in range(count))])
    o=mesh(name,verts,faces,mat,parent)
    for p in o.data.polygons:p.use_smooth=True


def stone_ring(parent,z,radius,height,count=12,thickness=.25):
    for i in range(count):
        a=i*2*math.pi/count+.025; b=(i+1)*2*math.pi/count-.025
        inner=radius-thickness
        vs=[]
        for h in [z-height/2,z+height/2]:
            vs += [(r*math.cos(t),r*math.sin(t),h) for r,t in [(inner,a),(radius,a),(radius,b),(inner,b)]]
        mesh('DressedStone',vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],['Stone','StoneLight','StoneDark'][i%3],parent,.035)


def banner(parent,x,y,z,height=.62):
    if ASSEMBLY_PATCHES:parent=empty('BannerPatch',parent)
    w=.27
    verts=[(x-w/2,y,z),(x+w/2,y,z),(x+w/2,y-.01,z-height),(x,y-.02,z-height+.12),(x-w/2,y-.01,z-height)]
    o=mesh('WovenBanner',verts,[(0,1,2,3,4)],'Banner',parent)
    sol=o.modifiers.new('Cloth thickness','SOLIDIFY');sol.thickness=.018
    bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=sol.name)
    rod('BannerRod',(x-.19,y,z),(x+.19,y,z),.035,'Gold',parent)
    # Embroidered wheat is geometry, not a text/high-resolution image.
    rod('WheatStem',(x,y-.025,z-.12),(x,y-.025,z-.39),.014,'Cream',parent)
    for i in range(3):
        for sign in [-1,1]:
            sx=x+sign*.045;sz=z-.18-i*.065
            mesh('WheatStitch',[(sx-.025,y-.032,sz),(sx,y-.048,sz+.04),(sx+.025,y-.032,sz),(sx,y-.048,sz-.04)],[(0,1,2),(0,2,3)],'Cream',parent)
    if ASSEMBLY_PATCHES:join_patch(parent,'BannerPatch')


def crossbow(weapon, x=0, scale=1):
    # Muzzle direction is authoring -Y; vertical rotation remains on Weapon.
    p=empty('BowAssembly',weapon,(x,0,0)); p.scale=(scale,scale,scale)
    cylinder('Turntable',(0,0,.08),.21,.16,'WoodDark',p)
    box('Stock',(0,-.12,.31),(.16,1.12,.15),'WoodHoney',p)
    box('StockTrim',(0,-.12,.399),(.075,.98,.023),'EndGrain',p,.006)
    points=[(-.53,-.22,.36),(-.44,-.38,.41),(-.25,-.50,.46),(0,-.54,.47),(.25,-.50,.46),(.44,-.38,.41),(.53,-.22,.36)]
    curve_tube('BentBow',points,.043,'WoodLight',p)
    curve_tube('BowString',[points[0],(0,.15,.37),points[-1]],.011,'Cream',p)
    rod('ArrowShaft',(0,.40,.46),(0,-.91,.46),.022,'WoodDark',p)
    mesh('Arrowhead',[(-.085,-.86,.46),(.085,-.86,.46),(0,-1.06,.46),(0,-.87,.52)],[(0,1,2),(0,2,3),(1,3,2),(0,3,1)],'Iron',p)
    for side in [-1,1]:box('Fletching',(side*.035,.30,.49),(.07,.17,.018),'Cream',p,.006,rot=(0,0,side*.3))
    beam('BowMount',(-.13,.05,.13),(-.13,-.20,.31),.07,.09,'WoodDark',p)
    beam('BowMount',(.13,.05,.13),(.13,-.20,.31),.07,.09,'WoodDark',p)
    if ASSEMBLY_PATCHES:patch_meshes(p,None,'BowRigid')
    return p


def arrow(root,level):
    body=empty('Body',root); h={1:.85,4:1.3,8:1.65,12:1.85}[level]
    width=1.45 if level<8 else 1.70
    for x in [-.56,.56]:
        for y in [-.48,.48]:
            tall=level==12 and y>0
            box('StoneFoot',(x,y,.20 if tall else .14),(.44 if tall else .42,.4,.4 if tall else .28),'Stone' if tall else 'StoneLight',body,.075)
            beam('HeavyTimberLeg',(x,y,.22),(x*.86,y*.86,h),.20,.21,'WoodHoney',body)
            box('Peg',(x,y-.115,h*.65),(.055,.045,.055),'EndGrain',body,.012)
    for y in [-.44,.44]:
        beam('CrossBrace',(-.5,y,.3),(.5,y,h-.08),.12,.12,'WoodLight',body)
        if level>=4:beam('CrossBrace',(.5,y,.3),(-.5,y,h-.08),.12,.12,'WoodHoney',body)
    for x in [-.49,.49]:beam('SideBrace',(x,-.4,.3),(x,.4,h-.06),.13,.13,'WoodDark',body)
    box('PlatformBeam',(0,0,h),(width,1.35,.22),'WoodHoney',body,.045)
    for i in range(8):box('DeckPlank',(-width/2+.1+i*(width-.2)/7,0,h+.13),(.16,1.26,.08),'WoodLight' if i%3 else 'EndGrain',body,.016)
    for x in [-width/2+.09,width/2-.09]:
        for y in [-.57,.57]:
            box('RailPost',(x,y,h+.35),(.16,.16,.51),'WoodHoney',body)
            box('PostCap',(x,y,h+.62),(.21,.21,.08),'WoodLight',body,.025)
    for y in [-.57,.57]:
        box('Railing',(0,y,h+.42),(width-.12,.12,.13),'WoodLight',body)
        for x in [-.34,0,.34]:box('RailSlat',(x,y,h+.27),(.10,.10,.25),'WoodDark',body,.018)
    for x in [-width/2+.09,width/2-.09]:box('SideRailing',(x,0,h+.42),(.12,1.1,.13),'WoodLight',body)
    if level>=4:
        for x in [-.21,.21]:beam('LadderRail',(x,-.91,.08),(x,-.63,h+.03),.07,.07,'WoodLight',body)
        for i in range(7):
            t=(i+.5)/7;rod('LadderRung',(-.22,-.91+.28*t,.08+(h-.02)*t),(.22,-.91+.28*t,.08+(h-.02)*t),.035,'WoodHoney',body)
    if level>=8:
        box('MiddleFloor',(0,0,h-.49),(1.5,1.32,.14),'WoodDark',body)
        for x in [-.73,.73]:banner(body,x,-.60,h-.24)
        for i in range(8):box('AwningPlank',(-.81+i*.23,-.77,h-.19),(.22,.48,.08),'WoodLight',body,.018,rot=(.18,0,0))
    if level==12:
        for x in [-.70,.70]:
            box('GoldCorner',(x,-.66,h),(.32,.10,.18),'Gold',body)
            ellipsoid('Rivet',(x,-.72,h),(.04,.025,.04),'Cream',body,8,6)
    weapon=empty('Weapon',root,(0,0,h+.18))
    if level==12:
        crossbow(weapon,-.34,.74);crossbow(weapon,.34,.74)
    else:crossbow(weapon,0,.83 if level==1 else 1)
    bow_scale=.74 if level==12 else (.83 if level==1 else 1)
    empty('Muzzle',weapon,(0,-1.06*bow_scale,.46*bow_scale))
    if ASSEMBLY_PATCHES:
        patch_meshes(body,{'PlatformBeam','DeckPlank'},'DeckPatch')
        # Reuse one post+cap and one rail+slats panel. Joining the entire four
        # sides would bake four copies of identical corner geometry into a mesh.
        for post in [o for o in body.children if o.name.split('.')[0]=='RailPost']:
            caps=[o for o in body.children if o.name.split('.')[0]=='PostCap' and abs(o.location.x-post.location.x)<1e-6 and abs(o.location.y-post.location.y)<1e-6]
            patch_objects(body,[post]+caps,'RailingPostPatch')
        for rail in [o for o in body.children if o.name.split('.')[0]=='Railing']:
            slats=[o for o in body.children if o.name.split('.')[0]=='RailSlat' and abs(o.location.y-rail.location.y)<1e-6]
            patch_objects(body,[rail]+slats,'RailingPanelPatch')
        patch_meshes(body,{'StoneFoot'},'FootingPatch')
        patch_meshes(body,{'Peg'},'PegPatch')
    return body


def oak(root):
    body=empty('Body',root)
    cylinder('RoundedTrunk',(0,0,.48),.15,.96,'WoodHoney',body,10)
    for a in [0,2.1,4.2]:
        rod('Root',(0,0,.12),(.34*math.cos(a),.34*math.sin(a),.045),.07,'WoodDark',body)
        rod('Branch',(0,0,.55),(.45*math.cos(a),.45*math.sin(a),1.04),.08,'WoodHoney',body)
    clusters=[(0,0,1.63,.47),(-.43,0,1.33,.40),(.42,.10,1.34,.43),(0,-.4,1.30,.42),(-.25,.33,1.48,.40),(.35,-.31,1.58,.36),(-.28,-.22,1.73,.34)]
    leaf_meshes={}
    def leaf(at,scale,mat):
        if mat not in leaf_meshes:
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1)
            o=finish(bpy.context.object,'LeafCluster',mat,body,0,True);leaf_meshes[mat]=o.data
        else:
            o=bpy.data.objects.new('LeafCluster',leaf_meshes[mat]);bpy.context.collection.objects.link(o);o.parent=body
        o.location=at;o.scale=scale
    # One twenty-triangle mesh per leaf material, reused by all uneven lobes.
    for i,(x,y,z,r) in enumerate(clusters):
        leaf((x,y,z),(r,r*.90,r*.84),['Leaf','LeafLight','LeafDark'][i%3])
        for j in range(4):
            a=j*1.7+i;leaf((x+math.cos(a)*r*.71,y+math.sin(a)*r*.71,z+.10+(j%2)*.12),(r*.52,r*.48,r*.47),['LeafLight','Leaf'][j%2])
    for i,p in enumerate([(-.40,-.64,1.45),(.42,-.61,1.45),(.10,-.73,1.25),(-.12,.62,1.55)]):empty('DecorationSocket'+str(i),root,p)


def compact(group,include_shared=False):
    """Join rigid sibling meshes per material, keeping semantic transforms/hooks editable."""
    for child in list(group.children):
        if child.type=='EMPTY':compact(child,include_shared)
    buckets={}
    for child in list(group.children):
        if child.type=='MESH' and (include_shared or child.data.users==1):buckets.setdefault(child.data.materials[0].name,[]).append(child)
    for name,objects in buckets.items():
        if not objects:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        if include_shared and objects[0].data.users>1:objects[0].data=objects[0].data.copy()
        if len(objects)>1:bpy.ops.object.join()
        objects[0].name=group.name+'_'+name


def descendants(root):
    return [root]+[n for c in root.children for n in descendants(c)]


def join_patch(group, name):
    """One repeatable rigid module, retaining all polygons and material slots."""
    objects=[o for o in group.children if o.type=='MESH']
    if not objects:return
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    if len(objects)>1:bpy.ops.object.join()
    obj=objects[0];obj.name=name
    # The grouping empty is authoring-only; preserve the same parent transform.
    obj.matrix_basis=group.matrix_basis@obj.matrix_basis
    obj.parent=group.parent
    bpy.data.objects.remove(group,do_unlink=True)
    return obj


def patch_meshes(parent,names,name):
    objects=[o for o in parent.children if o.type=='MESH' and (names is None or o.name.split('.')[0] in names)]
    return patch_objects(parent,objects,name)


def patch_objects(parent,objects,name):
    if len(objects)<2:return
    group=empty(name,parent)
    for obj in objects:obj.parent=group
    return join_patch(group,name)


def share_geometry(root):
    """Exact geometry reuse: translate mesh to origin, retain object transforms.

    Unlike lossy mesh compression, this uses only core glTF mesh references.
    Removing UVs is safe because all delivered materials are texture-free.
    """
    cache={}
    for obj in descendants(root):
        if obj.type!='MESH':continue
        # A copied data block avoids moving other objects already sharing it.
        obj.data=obj.data.copy()
        data=obj.data
        for layer in list(data.uv_layers):data.uv_layers.remove(layer)
        lo=Vector([min(v.co[k] for v in data.vertices) for k in range(3)])
        hi=Vector([max(v.co[k] for v in data.vertices) for k in range(3)])
        center=(lo+hi)/2
        data.transform(Matrix.Translation(-center));obj.matrix_basis=obj.matrix_basis@Matrix.Translation(center)
        # Joining identical modules can change vertex/material-slot order.
        # Canonical face cycles retain winding and material ownership while
        # recognizing the same complete surface independently of buffer order.
        vertices=[tuple(round(v,5) for v in vertex.co) for vertex in data.vertices]
        faces=[]
        for p in data.polygons:
            cycle=tuple(vertices[i] for i in p.vertices)
            canonical=min(cycle[i:]+cycle[:i] for i in range(len(cycle)))
            faces.append((data.materials[p.material_index].name,p.use_smooth,canonical))
        key=tuple(sorted(faces))
        if key in cache:
            obj.data=cache[key];bpy.data.meshes.remove(data)
        else:cache[key]=data


def world_bounds(root):
    bpy.context.view_layer.update()
    points=[o.matrix_world@v.co for o in descendants(root) if o.type=='MESH' for v in o.data.vertices]
    # Authoring Z-up/-Y-front to delivered glTF Y-up/+Z-front.
    points=[(p.x,p.z,-p.y) for p in points]
    lo=[min(p[k] for p in points) for k in range(3)]
    hi=[max(p[k] for p in points) for k in range(3)]
    return {'min':[round(v,6) for v in lo],'max':[round(v,6) for v in hi],'size':[round(hi[k]-lo[k],6) for k in range(3)]}


def export_asset(name,builder,levels=False):
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    for m in list(bpy.data.meshes):
        if m.users==0:bpy.data.meshes.remove(m)
    root=empty(name)
    if levels:
        for level in [1,4,8,12]:
            variant=empty('Level'+str(level),root)
            builder(variant,level)
            empty('SortOrigin',variant)
            empty('FootprintMin',variant,(-.80,-.70,0));empty('FootprintMax',variant,(.80,.70,0))
    else:builder(root)
    # Save artist-editable individual parts before the compact export pass.
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/(name+'.blend')),compress=True)
    if STATIC_FOLIAGE and name in {'TREE_OAK','TREE_PINE','GRASS'}:compact(root,True)
    if SHARED_EXPORT:share_geometry(root)
    else:compact(root)
    nodes=descendants(root)
    bpy.ops.object.select_all(action='DESELECT')
    for o in nodes:o.select_set(True)
    bpy.context.view_layer.objects.active=root
    bpy.ops.export_scene.gltf(filepath=str(OUTPUT/(name+'.glb')),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,export_extras=True)
    # Blender requires globally unique object names; glTF correctly permits the
    # same semantic name in different Level parents. Preserve that public API.
    path=OUTPUT/(name+'.glb');data=path.read_bytes();length,kind=struct.unpack_from('<II',data,12)
    doc=json.loads(data[20:20+length]);tail=data[20+length:]
    for n in doc['nodes']:
        role=n.get('extras',{}).get('role')
        if role:n['name']=role
    payload=json.dumps(doc,separators=(',',':')).encode();payload+=b' '*((-len(payload))%4)
    path.write_bytes(struct.pack('<III',0x46546c67,2,20+len(payload)+len(tail))+struct.pack('<II',len(payload),kind)+payload+tail)
    tri=lambda group:sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in descendants(group) if o.type=='MESH')
    counts={'bytes':(OUTPUT/(name+'.glb')).stat().st_size,'nodes':len(nodes),'renderNodes':sum(o.type=='MESH' for o in nodes),'triangles':tri(root)}
    counts['bounds']=world_bounds(root)
    if levels:
        counts['levelTriangles']={c['role']:tri(c) for c in root.children}
        counts['levelBounds']={c['role']:world_bounds(c) for c in root.children}
    return root,counts


def render_sample(directory):
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    r=empty('Arrow1');arrow(r,1);r.location=(-2.6,0,0)
    r=empty('Arrow12');arrow(r,12);r.location=(0,0,0)
    r=empty('Oak');oak(r);r.location=(2.4,.15,0)
    ground=material('PreviewGround',(.56,.64,.34));box('Ground',(0,0,-.075),(30,30,.1),'PreviewGround',None,.01)
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=48
    scene.render.resolution_x=1500;scene.render.resolution_y=850;scene.render.resolution_percentage=100
    scene.world.color=(.6,.6,.6)
    scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.72,.79,.84,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
    bpy.ops.object.light_add(type='AREA',location=(-3,-4,7));bpy.context.object.data.energy=900;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=5
    bpy.ops.object.camera_add(location=(5,-9,7));cam=bpy.context.object;target=Vector((0,0,1.05));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=9.4;scene.camera=cam
    scene.view_settings.view_transform='AgX'
    scene.render.image_settings.file_format='PNG';scene.render.filepath=str(directory/'ARROW_TREE_sample.png')
    bpy.ops.render.render(write_still=True)


def render_levels(directory,name,builder):
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    for i,level in enumerate([1,4,8,12]):
        r=empty(name+str(level));builder(r,level);r.location=((i-1.5)*3.6,0,0)
    box('Ground',(0,0,-.075),(40,40,.1),'PreviewGround',None,.01)
    scene=bpy.context.scene;scene.render.resolution_x=1800;scene.render.resolution_y=650
    bpy.ops.object.light_add(type='AREA',location=(-3,-4,9));bpy.context.object.data.energy=1400;bpy.context.object.data.size=6
    bpy.ops.object.camera_add(location=(3,-12,9));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.9))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=16;scene.camera=cam
    scene.render.filepath=str(directory/(name+'_levels.png'));bpy.ops.render.render(write_still=True)


def render_props(directory,props):
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    tree=empty('Oak');oak(tree);tree.location=(-2.3,1,0)
    for i,c in enumerate(list(tree.children)):
        if str(c.get('role','')).startswith('DecorationSocket'):
            fruit=empty('AttachedFruit',c);props.fruit(fruit)
    tree=empty('Pine');props.pine(tree);tree.location=(-.2,1.2,0)
    for c in list(tree.children):
        if str(c.get('role','')).startswith('DecorationSocket'):
            f=empty('AttachedFlower',c);props.flower(f);f.rotation_euler.x=math.pi/3
    for name,builder,pos in [('Wall',props.wall,(2,1.2,0)),('Sign',props.sign,(2,-.2,0)),('Campfire',props.campfire,(-.2,-.7,0)),('Torch',props.torch,(1.2,-.8,0)),('Rocks',props.rock,(-2.1,-.8,0)),('Grass',props.grass,(-1.2,-1,0)),('Flower',props.flower,(-1.65,-.9,.05))]:
        r=empty(name);builder(r);r.location=pos
    material('PreviewGround',(.56,.64,.34));box('Ground',(0,0,-.075),(30,30,.1),'PreviewGround',None,.01)
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=48
    scene.render.resolution_x=1500;scene.render.resolution_y=950;scene.render.resolution_percentage=100
    scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.72,.79,.84,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
    bpy.ops.object.light_add(type='AREA',location=(-3,-4,7));bpy.context.object.data.energy=900;bpy.context.object.data.size=5
    bpy.ops.object.camera_add(location=(4,-8,7));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.7))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=8;scene.camera=cam
    scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=str(directory/'ENVIRONMENT_props.png');bpy.ops.render.render(write_still=True)


def main():
    global SOURCE,OUTPUT,SHARED_EXPORT,PATCH_MODULES,ASSEMBLY_PATCHES,STATIC_FOLIAGE
    parser=argparse.ArgumentParser();parser.add_argument('--sample',action='store_true');parser.add_argument('--props-only',action='store_true');parser.add_argument('--patch-modules',action=argparse.BooleanOptionalAction,default=True);parser.add_argument('--assembly-patches',action=argparse.BooleanOptionalAction,default=True);parser.add_argument('--static-foliage',action=argparse.BooleanOptionalAction,default=True);parser.add_argument('--compact',action='store_true',help='Diagnostic previous per-material export, larger payload');parser.add_argument('--output-root',type=Path);parser.add_argument('--skip-renders',action='store_true');parser.add_argument('--render-dir',type=Path,required=True)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if args.output_root:
        SOURCE=args.output_root/'source';OUTPUT=args.output_root/'glb'
    SHARED_EXPORT=not args.compact
    PATCH_MODULES=args.patch_modules
    ASSEMBLY_PATCHES=args.assembly_patches
    STATIC_FOLIAGE=args.static_foliage
    SOURCE.mkdir(parents=True,exist_ok=True);OUTPUT.mkdir(parents=True,exist_ok=True);args.render_dir.mkdir(parents=True,exist_ok=True)
    bpy.context.preferences.filepaths.save_version=0
    sys.dont_write_bytecode=True
    palette();report={}
    sys.path.insert(0,str(Path(__file__).parent));sys.modules['env_common']=sys.modules[__name__]
    import env_buildings as buildings
    import env_props as props
    if args.props_only:
        render_props(args.render_dir,props);return
    assets={'ARROW':(arrow,True),'TREE_OAK':(oak,False)}
    if not args.sample:
        assets.update({k:(v,True) for k,v in {'STONE':buildings.stone,'SLOW':buildings.slow,'HOUSE':buildings.house,'GATE':buildings.gate,'FARM':buildings.farm,'LOGGING':buildings.logging}.items()})
        assets.update({k:(v,False) for k,v in {'TREE_PINE':props.pine,'FRUIT_APPLE':props.fruit,'FLOWER':props.flower,'GRASS':props.grass,'ROCKS':props.rock,'WALL':props.wall,'SIGN':props.sign,'CAMPFIRE':props.campfire,'TORCH':props.torch,'PATH':props.path,'PAD':props.pad,'LOG_PILE':props.log_pile,'BUSH':props.bush}.items()})
    for name,(builder,levels) in assets.items():_,report[name]=export_asset(name,builder,levels)
    (SOURCE/'manifest.json').write_text(json.dumps({'authoring':'Blender 4.5','upAxis':'GLB Y+','frontAxis':'GLB Z+','assets':report},indent=2)+'\n')
    if not args.skip_renders:render_sample(args.render_dir)
    if not args.sample and not args.skip_renders:
        for name,(builder,levels) in assets.items():
            if levels and name!='ARROW':render_levels(args.render_dir,name,builder)
        render_props(args.render_dir,props)
    print('ENVIRONMENT_SAMPLE_DONE',json.dumps(report))


if __name__=='__main__':main()
